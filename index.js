#!/usr/bin/env node
/**
 * N2 Stitch MCP — Entry Point
 * 
 *   ╔═══════════════════════════════════════════════════════════╗
 *   ║  N2 Stitch MCP Proxy Server                             ║
 *   ║                                                          ║
 *   ║  A resilient STDIO MCP proxy for Google Stitch.          ║
 *   ║  Built by the N2 AI Family (Rose 🌹 & Jennie 💎)        ║
 *   ║                                                          ║
 *   ║  3-Layer Safety Architecture:                            ║
 *   ║    L1 — Exponential-backoff retry (network errors)       ║
 *   ║    L2 — Auto token refresh on 401                        ║
 *   ║    L3 — TCP drop recovery via polling for generation     ║
 *   ╚═══════════════════════════════════════════════════════════╝
 * 
 * Usage:
 *   node index.js              # Run with gcloud ADC
 *   STITCH_API_KEY=xxx node index.js  # Run with API key
 *   STITCH_DEBUG=1 node index.js      # Enable debug logging
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig, useApiKey } from './src/config.js';
import { AuthManager } from './src/auth.js';
import { ProxyClient } from './src/proxy-client.js';
import { GenerationTracker } from './src/generation-tracker.js';
import { StitchMCPServer } from './src/server.js';

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
    console.log('Add this to your MCP client configuration:');
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
    console.log('Or with API key (no gcloud needed):');
    console.log('');
    console.log(JSON.stringify({
        mcpServers: {
            'n2-stitch': {
                command: 'npx',
                args: ['-y', 'n2-stitch-mcp'],
                env: {
                    STITCH_API_KEY: 'your-api-key-here',
                },
            },
        },
    }, null, 2));
    console.log('');
    console.log('Setup complete! 🎉');
}

// ── Entry ───────────────────────────────────────────────────

main().catch(err => {
    process.stderr.write(`[n2-stitch] FATAL: ${err.message}\n`);
    process.stderr.write(`[n2-stitch] ${err.stack}\n`);
    process.exit(1);
});
