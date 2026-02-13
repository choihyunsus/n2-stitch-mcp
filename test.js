/**
 * N2 Stitch MCP — Test Suite
 * 
 * Validates all modules without requiring actual Stitch API access.
 * Tests the 3-layer safety architecture with mock responses.
 */

import { loadConfig, useApiKey } from './src/config.js';

// ── ANSI colors for output ──
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;

function assert(condition, name) {
    if (condition) {
        console.log(`  ${GREEN}✓${RESET} ${name}`);
        passed++;
    } else {
        console.log(`  ${RED}✗${RESET} ${name}`);
        failed++;
    }
}

// ── Test 1: Config Module ───────────────────────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 1: Config Module ═══${RESET}`);

const config = loadConfig();
assert(config.stitchHost === 'https://stitch.googleapis.com/mcp', 'Default stitchHost');
assert(config.maxRetries === 3, 'Default maxRetries = 3');
assert(config.httpTimeoutMs === 300000, 'HTTP timeout = 5 min');
assert(config.retryBaseDelayMs === 1000, 'Retry base delay = 1s');
assert(config.generationPollIntervalMs === 10000, 'Poll interval = 10s');
assert(config.generationPollTimeoutMs === 720000, 'Poll timeout = 12 min');
assert(config.generationInitialWaitMs === 5000, 'Initial wait = 5s');
assert(config.tokenRefreshIntervalMs === 3000000, 'Token refresh = 50 min');
assert(!config.debug, 'Debug off by default');
assert(!useApiKey(config), 'No API key by default');

// Test with env var
process.env.STITCH_API_KEY = 'test-key';
const config2 = loadConfig();
assert(useApiKey(config2), 'API key mode when STITCH_API_KEY set');
delete process.env.STITCH_API_KEY;

// ── Test 2: Auth Module (unit tests without network) ─────

console.log(`\n${BOLD}${CYAN}═══ Test 2: Auth Module ═══${RESET}`);

import { AuthManager } from './src/auth.js';

// API key mode
const apiKeyConfig = { ...config, apiKey: 'test-key-123' };
const mockLogger = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { },
};

const authApiKey = new AuthManager(apiKeyConfig, mockLogger);
await authApiKey.initialize();
const headers = authApiKey.getAuthHeaders();
assert(headers['x-goog-api-key'] === 'test-key-123', 'API key auth headers');
assert(!headers.Authorization, 'No Bearer token in API key mode');
authApiKey.stop();

// ── Test 3: Proxy Client (backoff logic) ─────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 3: Proxy Client ═══${RESET}`);

import { ProxyClient } from './src/proxy-client.js';

const proxyClient = new ProxyClient(config, authApiKey, mockLogger);

// Test backoff calculation
const delay0 = proxyClient._backoffDelay(0);
assert(delay0 >= 1000 && delay0 <= 1300, `Backoff attempt 0: ${delay0}ms (1000-1300)`);

const delay1 = proxyClient._backoffDelay(1);
assert(delay1 >= 2000 && delay1 <= 2600, `Backoff attempt 1: ${delay1}ms (2000-2600)`);

const delay2 = proxyClient._backoffDelay(2);
assert(delay2 >= 4000 && delay2 <= 5200, `Backoff attempt 2: ${delay2}ms (4000-5200)`);

// Test transient error detection
const transientErr1 = new Error('connection reset');
transientErr1.code = 'ECONNRESET';
assert(proxyClient._isTransient(transientErr1), 'ECONNRESET is transient');

const transientErr2 = new Error('timeout');
transientErr2.name = 'AbortError';
assert(proxyClient._isTransient(transientErr2), 'AbortError is transient');

const transientErr3 = new Error('rate limit');
transientErr3.statusCode = 429;
assert(proxyClient._isTransient(transientErr3), '429 is transient');

const transientErr4 = new Error('server error');
transientErr4.statusCode = 503;
assert(proxyClient._isTransient(transientErr4), '503 is transient');

const nonTransientErr = new Error('bad request');
nonTransientErr.statusCode = 400;
assert(!proxyClient._isTransient(nonTransientErr), '400 is NOT transient');

const nonTransientErr2 = new Error('not found');
nonTransientErr2.statusCode = 404;
assert(!proxyClient._isTransient(nonTransientErr2), '404 is NOT transient');

// ── Test 4: Generation Tracker (state management) ────────

console.log(`\n${BOLD}${CYAN}═══ Test 4: Generation Tracker ═══${RESET}`);

import { GenerationTracker } from './src/generation-tracker.js';

// Create tracker with mock proxy
const mockProxy = {
    send: async () => ({ result: { tools: [] } }),
    sendRaw: async () => ({ result: {} }),
};

const tracker = new GenerationTracker(mockProxy, config, mockLogger);

assert(tracker.listAll().length === 0, 'Empty generation list initially');
assert(tracker.getInfo('nonexistent') === null, 'getInfo returns null for unknown ID');

// Test ID generation
const id1 = tracker._genId();
const id2 = tracker._genId();
assert(id1 !== id2, 'Generated IDs are unique');
assert(id1.length === 8, 'ID length is 8');

// ── Test 5: Server Module (import check) ─────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 5: Server Module ═══${RESET}`);

import { StitchMCPServer } from './src/server.js';

const server = new StitchMCPServer(config, mockProxy, tracker, mockLogger);
assert(server.server !== null, 'Low-level Server instance created');
assert(server.getServer() === server.server, 'getServer() returns server');
assert(server._remoteTools.length === 0, 'Remote tools initially empty');
assert(server._virtualTools.length === 0, 'Virtual tools initially empty');

// ── Test 6: Module Integration ───────────────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 6: Module Integration ═══${RESET}`);

assert(typeof loadConfig === 'function', 'Config module exports loadConfig');
assert(typeof AuthManager === 'function', 'Auth module exports AuthManager');
assert(typeof ProxyClient === 'function', 'Proxy module exports ProxyClient');
assert(typeof GenerationTracker === 'function', 'Generation module exports GenerationTracker');
assert(typeof StitchMCPServer === 'function', 'Server module exports StitchMCPServer');

// Clean up
clearInterval(tracker._cleanupTimer);

// ── Results ──────────────────────────────────────────────

console.log(`\n${BOLD}═══════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  Results: ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}`);
console.log(`${BOLD}═══════════════════════════════════════════════${RESET}\n`);

if (failed > 0) {
    process.exit(1);
}
