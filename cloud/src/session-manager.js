/**
 * N2 Cloud — Session Manager
 * 
 * Manages per-user MCP sessions with Streamable HTTP transport.
 * Each authenticated user gets their own StitchMCPServer instance
 * backed by their own Stitch API key (BYOK).
 * 
 * Session lifecycle:
 *   1. User POST /mcp with Initialize → new session created
 *   2. User POST /mcp with session-id header → reuse existing session
 *   3. 30 min inactivity → session auto-cleaned
 *   4. User DELETE /mcp → session manually closed
 */

import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import existing modules from parent project
import { AuthManager } from '../../src/auth.js';
import { ProxyClient } from '../../src/proxy-client.js';
import { GenerationTracker } from '../../src/generation-tracker.js';
import { StitchMCPServer } from '../../src/server.js';
import { loadConfig } from '../../src/config.js';
import { decryptApiKey } from './n2-auth.js';

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

export class SessionManager {
    /**
     * @param {import('./n2-auth.js').UserDB} userDB
     * @param {string} encryptionSecret
     * @param {object} logger
     */
    constructor(userDB, encryptionSecret, logger) {
        this.userDB = userDB;
        this.encryptionSecret = encryptionSecret;
        this.logger = logger;

        /** @type {Map<string, Session>} sessionId → Session */
        this.sessions = new Map();

        // Cleanup timer
        this._cleanupTimer = setInterval(() => this._cleanup(), 60 * 1000);
        if (this._cleanupTimer.unref) this._cleanupTimer.unref();
    }

    /**
     * Get or create a session for a user.
     * Returns { transport, isNew, sessionId }
     */
    async getOrCreateSession(n2ApiKey, user) {
        // If user already has a session, close it first (new initialize = fresh start)
        for (const [sid, session] of this.sessions) {
            if (session.n2ApiKey === n2ApiKey) {
                this.logger.info(`Closing stale session ${sid} for ${user.name} (re-initialize)`);
                this.closeSession(sid);
                break;
            }
        }

        // Create new session
        const sessionId = randomUUID();

        // Get user's Stitch API key (from DB, encrypted)
        let stitchApiKey = '';
        if (user.stitch_api_key) {
            try {
                stitchApiKey = decryptApiKey(user.stitch_api_key, this.encryptionSecret);
            } catch (err) {
                // Try using DB's own decryption (different key derivation)
                try {
                    stitchApiKey = this.userDB.getStitchApiKey(user.id);
                } catch (err2) {
                    this.logger.error(`Failed to decrypt Stitch API key for ${user.name}: ${err2.message}`);
                    throw new Error('Failed to decrypt your Stitch API key. Please re-register it.');
                }
            }
        } else {
            // Try fetching from DB directly
            const dbKey = this.userDB.getStitchApiKey(user.id);
            if (dbKey) {
                stitchApiKey = dbKey;
            }
        }

        if (!stitchApiKey) {
            throw new Error(
                'No Stitch API key found. Please register your Google Stitch API key at https://cloud.nton2.com/#get-key'
            );
        }

        // Build config with user's Stitch API key
        const config = loadConfig();
        config.apiKey = stitchApiKey;

        // Create per-user instances
        const authManager = new AuthManager(config, this.logger);
        await authManager.initialize();

        const proxyClient = new ProxyClient(config, authManager, this.logger);
        const genTracker = new GenerationTracker(proxyClient, config, this.logger);
        const mcpServer = new StitchMCPServer(config, proxyClient, genTracker, this.logger);

        // Discover tools from Stitch API
        try {
            await mcpServer.discoverAndRegisterTools();
        } catch (err) {
            this.logger.error(`Tool discovery failed for ${user.name}: ${err.message}`);
            authManager.stop();
            throw new Error(`Failed to connect to Stitch API: ${err.message}`);
        }

        const session = {
            sessionId,
            n2ApiKey,
            userName: user.name,
            plan: user.plan,
            mcpServer,
            authManager,
            genTracker,
            createdAt: Date.now(),
            lastActivity: Date.now(),
        };

        this.sessions.set(sessionId, session);
        this.logger.info(`Created session ${sessionId} for ${user.name} (${user.plan})`);

        return { session, isNew: true, sessionId };
    }

    /**
     * Get existing session by ID.
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = Date.now();
        }
        return session || null;
    }

    /**
     * Close a specific session.
     */
    closeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.authManager.stop();
            clearInterval(session.genTracker._cleanupTimer);
            this.sessions.delete(sessionId);
            this.logger.info(`Closed session ${sessionId} for ${session.userName}`);
            return true;
        }
        return false;
    }

    /**
     * Get session stats.
     */
    getStats() {
        const sessions = [...this.sessions.values()].map(s => ({
            sessionId: s.sessionId,
            user: s.userName,
            plan: s.plan,
            createdAt: new Date(s.createdAt).toISOString(),
            lastActivity: new Date(s.lastActivity).toISOString(),
            age: `${((Date.now() - s.createdAt) / 60000).toFixed(1)} min`,
        }));

        return {
            active: sessions.length,
            sessions,
        };
    }

    /**
     * Cleanup expired sessions (TTL: 30 min).
     */
    _cleanup() {
        const now = Date.now();
        for (const [sid, session] of this.sessions) {
            if (now - session.lastActivity > SESSION_TTL) {
                this.logger.info(`Session ${sid} expired (${session.userName})`);
                this.closeSession(sid);
            }
        }
    }

    /**
     * Shutdown all sessions.
     */
    shutdown() {
        clearInterval(this._cleanupTimer);
        for (const [sid] of this.sessions) {
            this.closeSession(sid);
        }
        this.logger.info('All sessions closed');
    }
}
