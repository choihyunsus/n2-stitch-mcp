#!/usr/bin/env node
/**
 * N2 Stitch MCP — Entry Point
 * 
 * A resilient STDIO MCP proxy for Google Stitch.
 * 3-Layer Safety: retry → token refresh → polling recovery
 * 
 * Usage:
 *   npx n2-stitch-mcp               # Local mode (gcloud ADC)
 *   npx n2-stitch-mcp --cloud       # Cloud mode (N2 Cloud proxy)
 *   npx n2-stitch-mcp init          # Setup wizard
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig, useApiKey, useCloudMode } from './src/config.js';
import { AuthManager } from './src/auth.js';
import { ProxyClient } from './src/proxy-client.js';
import { GenerationTracker } from './src/generation-tracker.js';
import { StitchMCPServer } from './src/server.js';
import { CloudProxyClient, CloudAuthError, CloudRateLimitError } from './src/cloud-client.js';
import { createInterface } from 'node:readline';

// ── Logger (all output to stderr; stdout reserved for STDIO MCP) ──

const logger = {
    info: (msg) => process.stderr.write(`[n2-stitch] INFO  ${msg}\n`),
    warn: (msg) => process.stderr.write(`[n2-stitch] WARN  ${msg}\n`),
    error: (msg) => process.stderr.write(`[n2-stitch] ERROR ${msg}\n`),
    debug: (msg) => process.stderr.write(`[n2-stitch] DEBUG ${msg}\n`),
};

// ── Main ────────────────────────────────────────────────────

async function main() {
    // Handle init subcommand
    if (process.argv[2] === 'init') {
        await runInit();
        return;
    }

    // Handle --cloud mode (STDIO ↔ HTTP bridge)
    if (useCloudMode()) {
        await runCloudMode();
        return;
    }

    const config = loadConfig();

    if (!config.debug) {
        // In non-debug mode, suppress info/debug logs
        logger.info = () => { };
        logger.debug = () => { };
    }

    logger.info('Starting N2 Stitch MCP proxy server');
    logger.info(`Stitch API: ${config.stitchHost}`);

    // ── Step 1: Authentication ──
    const auth = new AuthManager(config, logger);
    try {
        await auth.initialize();
    } catch (err) {
        process.stderr.write(`\n[n2-stitch] FATAL: Authentication failed!\n`);
        process.stderr.write(`[n2-stitch] ${err.message}\n\n`);
        process.stderr.write(`[n2-stitch] To fix, run one of:\n`);
        process.stderr.write(`[n2-stitch]   1. Set API key:  $env:STITCH_API_KEY="your-key"\n`);
        process.stderr.write(`[n2-stitch]   2. Install gcloud + run:  gcloud auth application-default login\n`);
        process.stderr.write(`[n2-stitch]   3. Run:  node index.js init\n\n`);
        process.exit(1);
    }

    // ── Step 2: Proxy client ──
    const proxyClient = new ProxyClient(config, auth, logger);

    // ── Step 3: Generation tracker ──
    const genTracker = new GenerationTracker(proxyClient, config, logger);

    // ── Step 4: MCP Server ──
    const server = new StitchMCPServer(config, proxyClient, genTracker, logger);

    try {
        await server.discoverAndRegisterTools();
    } catch (err) {
        process.stderr.write(`\n[n2-stitch] FATAL: Failed to discover tools from Stitch API\n`);
        process.stderr.write(`[n2-stitch] ${err.message}\n`);
        process.stderr.write(`[n2-stitch] Check your network and authentication.\n\n`);
        process.exit(1);
    }

    // ── Step 5: STDIO transport ──
    const transport = new StdioServerTransport();
    await server.getServer().connect(transport);

    logger.info('STDIO MCP server ready — listening for JSON-RPC on stdin');

    // Graceful shutdown
    const shutdown = () => {
        logger.info('Shutting down...');
        auth.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

// ── Cloud Mode (STDIO ↔ HTTP Bridge) ────────────────────────

async function runCloudMode() {
    const config = loadConfig();

    if (!config.debug) {
        logger.info = () => { };
        logger.debug = () => { };
    }

    // Validate N2 API Key
    if (!config.n2ApiKey) {
        process.stderr.write(`\n`);
        process.stderr.write(`[n2-stitch] ╔═══════════════════════════════════════════════════╗\n`);
        process.stderr.write(`[n2-stitch] ║  N2 Cloud Mode — API Key Required                ║\n`);
        process.stderr.write(`[n2-stitch] ╚═══════════════════════════════════════════════════╝\n`);
        process.stderr.write(`[n2-stitch]\n`);
        process.stderr.write(`[n2-stitch] Set N2_API_KEY environment variable:\n`);
        process.stderr.write(`[n2-stitch]   N2_API_KEY=n2_sk_live_xxx\n`);
        process.stderr.write(`[n2-stitch]\n`);
        process.stderr.write(`[n2-stitch] Get your free API key at:\n`);
        process.stderr.write(`[n2-stitch]   ${config.cloudUrl}/#get-key\n`);
        process.stderr.write(`[n2-stitch]\n`);
        process.exit(1);
    }

    logger.info(`N2 Cloud mode — connecting to ${config.cloudUrl}`);

    const client = new CloudProxyClient(config, logger);

    // Read JSON-RPC messages from STDIN line by line
    const rl = createInterface({
        input: process.stdin,
        terminal: false,
    });

    let inputBuffer = '';
    let pendingRequests = 0;
    let stdinEnded = false;

    process.stdin.on('data', (chunk) => {
        inputBuffer += chunk.toString();

        // Try to parse complete JSON-RPC messages
        // MCP STDIO transport sends one JSON object per message, delimited by newlines
        let newlineIndex;
        while ((newlineIndex = inputBuffer.indexOf('\n')) !== -1) {
            const line = inputBuffer.slice(0, newlineIndex).trim();
            inputBuffer = inputBuffer.slice(newlineIndex + 1);

            if (!line) continue;

            // Parse and forward to cloud
            pendingRequests++;
            handleCloudMessage(client, line)
                .catch(err => {
                    logger.error(`Message handling error: ${err.message}`);
                })
                .finally(() => {
                    pendingRequests--;
                    // If stdin ended and no more pending requests, exit
                    if (stdinEnded && pendingRequests <= 0) {
                        client.closeSession().then(() => process.exit(0));
                    }
                });
        }
    });

    // Handle process termination
    const shutdown = async () => {
        logger.info('Shutting down cloud bridge...');
        await client.closeSession();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    process.stdin.on('end', () => {
        stdinEnded = true;
        // If no pending requests, exit immediately
        if (pendingRequests <= 0) {
            shutdown();
        }
        // Otherwise, wait for pending requests to complete (handled in finally above)
    });

    logger.info('Cloud bridge ready — forwarding STDIO ↔ N2 Cloud');
}

/**
 * Handle a single JSON-RPC message: forward to cloud, write response to stdout.
 */
async function handleCloudMessage(client, line) {
    let request;
    try {
        request = JSON.parse(line);
    } catch {
        // Not valid JSON — ignore
        return;
    }

    try {
        const response = await client.sendRequest(request);

        if (response) {
            // Write JSON-RPC response to stdout for the MCP client
            process.stdout.write(JSON.stringify(response) + '\n');
        }
    } catch (err) {
        if (err instanceof CloudAuthError) {
            process.stderr.write(`[n2-stitch] AUTH ERROR: ${err.message}\n`);
            // Send JSON-RPC error response
            if (request.id !== undefined) {
                const errorResp = {
                    jsonrpc: '2.0',
                    id: request.id,
                    error: {
                        code: -32001,
                        message: err.message,
                    },
                };
                process.stdout.write(JSON.stringify(errorResp) + '\n');
            }
            process.exit(1);
        }

        if (err instanceof CloudRateLimitError) {
            process.stderr.write(`[n2-stitch] RATE LIMIT: ${err.message}\n`);
            if (request.id !== undefined) {
                const errorResp = {
                    jsonrpc: '2.0',
                    id: request.id,
                    error: {
                        code: -32002,
                        message: err.message,
                    },
                };
                process.stdout.write(JSON.stringify(errorResp) + '\n');
            }
            return;
        }

        // Generic error
        process.stderr.write(`[n2-stitch] CLOUD ERROR: ${err.message}\n`);
        if (request.id !== undefined) {
            const errorResp = {
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32603,
                    message: `Cloud proxy error: ${err.message}`,
                },
            };
            process.stdout.write(JSON.stringify(errorResp) + '\n');
        }
    }
}

// ── Init subcommand ─────────────────────────────────────────

async function runInit() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  N2 Stitch MCP — Setup Wizard                            ║
╚═══════════════════════════════════════════════════════════╝
`);

    // Check gcloud
    const { execSync } = await import('child_process');

    try {
        execSync('gcloud --version', { stdio: 'pipe' });
        console.log('✅ gcloud CLI found');
    } catch {
        console.log('❌ gcloud CLI not found');
        console.log('');
        console.log('Install Google Cloud SDK:');
        console.log('  Windows:  winget install Google.CloudSDK');
        console.log('  macOS:    brew install --cask google-cloud-sdk');
        console.log('  Linux:    curl https://sdk.cloud.google.com | bash');
        console.log('');
        console.log('After installing, run this command again.');
        process.exit(1);
    }

    // Check ADC
    try {
        execSync('gcloud auth application-default print-access-token', { stdio: 'pipe' });
        console.log('✅ Application Default Credentials found');
    } catch {
        console.log('⚠️  No Application Default Credentials found');
        console.log('');
        console.log('Running: gcloud auth application-default login');
        console.log('A browser window will open for Google Login...');
        console.log('');
        try {
            execSync('gcloud auth application-default login', { stdio: 'inherit' });
            console.log('✅ Authentication successful!');
        } catch (err) {
            console.log(`❌ Authentication failed: ${err.message}`);
            process.exit(1);
        }
    }

    // Test Stitch API
    console.log('');
    console.log('Testing Stitch API connection...');

    try {
        const token = execSync('gcloud auth application-default print-access-token', { encoding: 'utf-8' }).trim();

        const resp = await fetch('https://stitch.googleapis.com/mcp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/list',
                params: {},
                id: 1,
            }),
        });

        if (resp.ok) {
            const json = await resp.json();
            const toolCount = json.result?.tools?.length || 0;
            console.log(`✅ Stitch API connected! Found ${toolCount} tools.`);
        } else {
            console.log(`⚠️  Stitch API returned HTTP ${resp.status}`);
            console.log('  You may need to enable the Stitch API in your GCP project.');
        }
    } catch (err) {
        console.log(`⚠️  Could not reach Stitch API: ${err.message}`);
    }

    // Print MCP configuration
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Option 1: Local mode (direct Stitch connection)');
    console.log('');
    console.log(JSON.stringify({
        mcpServers: {
            'n2-stitch': {
                command: 'npx',
                args: ['-y', 'n2-stitch-mcp'],
                env: {
                    STITCH_DEBUG: '1',
                },
            },
        },
    }, null, 2));
    console.log('');
    console.log('Option 2: Cloud mode (via N2 Cloud — no gcloud needed!)');
    console.log('');
    console.log(JSON.stringify({
        mcpServers: {
            'n2-stitch-cloud': {
                command: 'npx',
                args: ['-y', 'n2-stitch-mcp', '--cloud'],
                env: {
                    N2_API_KEY: 'your-n2-api-key-here',
                    STITCH_API_KEY: 'your-stitch-api-key-here',
                },
            },
        },
    }, null, 2));
    console.log('');
    console.log('Get your free N2 API key: https://cloud.nton2.com/#get-key');
    console.log('');
    console.log('Setup complete! 🎉');
}

// ── Entry ───────────────────────────────────────────────────

main().catch(err => {
    process.stderr.write(`[n2-stitch] FATAL: ${err.message}\n`);
    process.stderr.write(`[n2-stitch] ${err.stack}\n`);
    process.exit(1);
});
