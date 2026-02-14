/**
 * N2 Cloud — Express Gateway Server
 * 
 *   ╔══════════════════════════════════════════════════════════════╗
 *   ║  N2 Cloud Gateway — Resilient MCP Proxy for Google Stitch   ║
 *   ║                                                              ║
 *   ║  Features:                                                   ║
 *   ║  • Streamable HTTP MCP Transport (latest standard)           ║
 *   ║  • BYOK — Bring Your Own Stitch API Key                     ║
 *   ║  • N2 API Key authentication + rate limiting                 ║
 *   ║  • Per-user session management with 30-min TTL               ║
 *   ║  • TCP drop recovery (3-layer safety from n2-stitch-mcp)     ║
 *   ║  • Zero gcloud/Node.js setup for clients                    ║
 *   ╚══════════════════════════════════════════════════════════════╝
 * 
 *   Architecture:
 *   ┌─────────────┐   HTTPS (Cloudflare)   ┌──────────────────┐   HTTP + Auth   ┌────────────────┐
 *   │   Client     │ ────────────────────► │  N2 Cloud Gateway │ ─────────────► │ Stitch API     │
 *   │  (Any MCP    │ ◄──────────────────── │  (this server)    │ ◄──────────── │ googleapis.com │
 *   │   client)    │   Streamable HTTP     │  Port 3500        │                └────────────────┘
 *   └─────────────┘                        └──────────────────┘
 * 
 * Usage:
 *   PORT=3500 node server.js
 *   PORT=3500 ADMIN_SECRET=xxx ENCRYPTION_SECRET=xxx node server.js
 */

import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { initDB } from './src/db.js';
import { createAuthMiddleware, checkRateLimit } from './src/n2-auth.js';
import { SessionManager } from './src/session-manager.js';
import { createAdminRouter } from './src/admin.js';
import { createOAuthRouter } from './src/oauth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Logger ──────────────────────────────────────────────

const logger = {
    info: (msg) => console.log(`[N2-Cloud] ${msg}`),
    warn: (msg) => console.warn(`[N2-Cloud] ⚠️  ${msg}`),
    error: (msg) => console.error(`[N2-Cloud] ❌ ${msg}`),
    debug: (msg) => { if (process.env.DEBUG === '1') console.log(`[N2-Cloud] 🔍 ${msg}`); },
};

// ── Constants ───────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3500', 10);
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'n2-cloud-encryption-key';

// ── Initialize ──────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Serve static frontend files (no-cache for JS/CSS to prevent stale Cloudflare cache)
app.use(express.static(join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
    }
}));

// CORS for cloud access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, X-API-Key, X-Admin-Secret');
    res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Initialize components
const db = initDB(logger);
const sessionManager = new SessionManager(db, ENCRYPTION_SECRET, logger);
const authMiddleware = createAuthMiddleware(db, logger);

// ── Transport Map (session → transport) ──────────────────

/** @type {Map<string, { transport: StreamableHTTPServerTransport, n2ApiKey: string }>} */
const transports = new Map();

// ── Health Check (no auth) ──────────────────────────────

app.get('/health', (req, res) => {
    const stats = sessionManager.getStats();
    res.json({
        status: 'ok',
        service: 'N2 Cloud Gateway',
        version: '1.0.0',
        uptime: `${(process.uptime() / 60).toFixed(1)} min`,
        activeSessions: stats.active,
        totalUsers: db.getUserCount(),
        timestamp: new Date().toISOString(),
    });
});

// ── Admin Routes ────────────────────────────────────────

app.use('/admin', createAdminRouter(db, sessionManager, logger));

// ── OAuth Routes ────────────────────────────────────────

app.use('/auth', createOAuthRouter(db, logger));

// ── Stitch API Key Management ───────────────────────────

// Save user's Stitch API Key (BYOK)
app.post('/api/stitch-key', authMiddleware, (req, res) => {
    try {
        const { stitchApiKey } = req.body;
        if (!stitchApiKey || typeof stitchApiKey !== 'string' || stitchApiKey.length < 10) {
            return res.status(400).json({ error: 'Invalid Stitch API key' });
        }
        db.setStitchApiKey(req.n2User.id, stitchApiKey);
        res.json({ success: true, message: 'Stitch API key saved' });
    } catch (err) {
        logger.error(`Stitch key save error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Check if user has a Stitch API Key
app.get('/api/stitch-key', authMiddleware, (req, res) => {
    try {
        const key = db.getStitchApiKey(req.n2User.id);
        res.json({ hasKey: !!key, keyPreview: key ? key.slice(0, 8) + '...' : null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete user's Stitch API Key
app.delete('/api/stitch-key', authMiddleware, (req, res) => {
    try {
        db.deleteStitchApiKey(req.n2User.id);
        res.json({ success: true, message: 'Stitch API key deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── MCP Endpoint: POST /mcp ─────────────────────────────

app.post('/mcp', authMiddleware, async (req, res) => {
    try {
        const sessionId = req.headers['mcp-session-id'];

        // ── Reuse existing transport ──
        if (sessionId && transports.has(sessionId)) {
            const entry = transports.get(sessionId);

            // Verify this transport belongs to this user
            if (entry.n2ApiKey !== req.n2ApiKey) {
                return res.status(403).json({ error: 'Session does not belong to this API key' });
            }

            // Track usage for tool calls
            if (req.body?.method === 'tools/call') {
                const rateCheck = checkRateLimit(req.n2User, 'stitch');
                if (rateCheck.limited) {
                    return res.status(429).json(rateCheck);
                }
                db.incrementUsage(req.n2User.id, 'stitch');
            }

            await entry.transport.handleRequest(req, res, req.body);
            return;
        }

        // ── New session (Initialize request) ──
        if (!sessionId && isInitializeRequest(req.body)) {
            logger.info(`New MCP session request from ${req.n2User.name} (${req.n2User.plan})`);

            // Create or reuse user's MCP server session
            const { session, isNew, sessionId: existingSessionId } = await sessionManager.getOrCreateSession(req.n2ApiKey, req.n2User);

            if (isNew) {
                // Create Streamable HTTP transport for new session
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (sid) => {
                        transports.set(sid, { transport, n2ApiKey: req.n2ApiKey });
                        // Store transport reference in session for reuse
                        session.transport = transport;
                        session.transportSessionId = sid;
                        logger.info(`Transport registered: ${sid} for ${req.n2User.name}`);
                    },
                });

                // Connect MCP server to transport
                const mcpServer = session.mcpServer.getServer();
                await mcpServer.connect(transport);

                // Handle the initialize request
                await transport.handleRequest(req, res, req.body);
            } else {
                // Reuse existing session's transport
                if (session.transport && session.transportSessionId) {
                    // Re-register in transport map (may have been cleaned)
                    transports.set(session.transportSessionId, { transport: session.transport, n2ApiKey: req.n2ApiKey });
                    await session.transport.handleRequest(req, res, req.body);
                } else {
                    // Session exists but transport was lost — destroy and recreate
                    logger.warn(`Session ${existingSessionId} has no transport, destroying and recreating`);
                    sessionManager.closeSession(existingSessionId);

                    // Recreate
                    const { session: newSession } = await sessionManager.getOrCreateSession(req.n2ApiKey, req.n2User);
                    const transport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: () => randomUUID(),
                        onsessioninitialized: (sid) => {
                            transports.set(sid, { transport, n2ApiKey: req.n2ApiKey });
                            newSession.transport = transport;
                            newSession.transportSessionId = sid;
                            logger.info(`Transport re-registered: ${sid} for ${req.n2User.name}`);
                        },
                    });
                    const mcpServer = newSession.mcpServer.getServer();
                    await mcpServer.connect(transport);
                    await transport.handleRequest(req, res, req.body);
                }
            }
            return;
        }

        // ── Invalid request ──
        res.status(400).json({
            error: 'Invalid MCP request',
            hint: 'Send an initialize request first, or include Mcp-Session-Id header',
        });
    } catch (err) {
        logger.error(`MCP POST error: ${err.message}`);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// ── MCP Endpoint: GET /mcp (SSE stream for notifications) ─

app.get('/mcp', authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];

    if (!sessionId || !transports.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid or missing session ID' });
    }

    const entry = transports.get(sessionId);
    if (entry.n2ApiKey !== req.n2ApiKey) {
        return res.status(403).json({ error: 'Session does not belong to this API key' });
    }

    await entry.transport.handleRequest(req, res);
});

// ── MCP Endpoint: DELETE /mcp (close session) ───────────

app.delete('/mcp', authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];

    if (!sessionId || !transports.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid or missing session ID' });
    }

    const entry = transports.get(sessionId);
    if (entry.n2ApiKey !== req.n2ApiKey) {
        return res.status(403).json({ error: 'Session does not belong to this API key' });
    }

    await entry.transport.handleRequest(req, res);
    transports.delete(sessionId);
    logger.info(`Session closed: ${sessionId}`);
});

// ── Graceful Shutdown ───────────────────────────────────

function shutdown() {
    logger.info('Shutting down N2 Cloud Gateway...');
    sessionManager.shutdown();

    for (const [sid, entry] of transports) {
        try { entry.transport.close?.(); } catch { }
        transports.delete(sid);
    }

    logger.info('Shutdown complete');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── SPA Fallback (serve index.html for non-API routes) ──

app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ── Start Server ────────────────────────────────────────

app.listen(PORT, () => {
    logger.info('');
    logger.info('╔══════════════════════════════════════════════╗');
    logger.info('║     N2 Cloud Gateway — Running! 🚀          ║');
    logger.info('╠══════════════════════════════════════════════╣');
    logger.info(`║  Port:     ${String(PORT).padEnd(33)}║`);
    logger.info(`║  Website:  http://localhost:${PORT}${' '.repeat(16)}║`);
    logger.info(`║  Health:   http://localhost:${PORT}/health${' '.repeat(11)}║`);
    logger.info(`║  MCP:      http://localhost:${PORT}/mcp${' '.repeat(14)}║`);
    logger.info(`║  Admin:    http://localhost:${PORT}/admin/*${' '.repeat(11)}║`);
    logger.info('╚══════════════════════════════════════════════╝');
    logger.info('');
    logger.info(`Users loaded: ${db.getUserCount()}`);
    logger.info('Waiting for MCP connections...');
});
