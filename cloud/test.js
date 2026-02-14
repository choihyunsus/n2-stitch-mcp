/**
 * N2 Cloud — Test Suite
 * 
 * Tests the cloud-specific modules without requiring Stitch API access.
 */

import { UserDB, encryptApiKey, decryptApiKey, checkRateLimit, PLAN_LIMITS } from './src/n2-auth.js';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ANSI colors ─────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;

function assert(condition, name) {
    if (condition) { console.log(`  ${GREEN}✓${RESET} ${name}`); passed++; }
    else { console.log(`  ${RED}✗${RESET} ${name}`); failed++; }
}

const mockLogger = { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } };

// ── Test 1: Encryption ──────────────────────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 1: AES-256 Encryption ═══${RESET}`);

const secret = 'test-encryption-secret';
const testKey = 'AIzaSyB1234567890abcdef';

const encrypted = encryptApiKey(testKey, secret);
assert(encrypted !== testKey, 'Key is encrypted (different from original)');
assert(encrypted.includes(':'), 'Encrypted format contains colons (iv:tag:data)');

const decrypted = decryptApiKey(encrypted, secret);
assert(decrypted === testKey, 'Decrypted key matches original');

// Wrong secret should fail
try {
    decryptApiKey(encrypted, 'wrong-secret');
    assert(false, 'Wrong secret should throw');
} catch {
    assert(true, 'Wrong secret throws error');
}

// ── Test 2: User Database ───────────────────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 2: User Database ═══${RESET}`);

// Use a temp users file for testing
const tempUsersFile = join(__dirname, 'data', 'users-test.json');
writeFileSync(tempUsersFile, JSON.stringify({ users: {} }), 'utf8');

const userDB = new UserDB(mockLogger);
assert(userDB.listAll().length >= 0, 'Can list users');

// Create a user
const key1 = userDB.create('Test User', 'test@example.com', 'free', '', '');
assert(key1.startsWith('n2_sk_live_'), 'Live key prefix is correct');
assert(key1.length > 20, 'Key has sufficient length');

const key2 = userDB.create('Test Dev', '', 'test', '', '');
assert(key2.startsWith('n2_sk_test_'), 'Test key prefix is correct');

// Find user
const user1 = userDB.find(key1);
assert(user1 !== null, 'Can find created user');
assert(user1.name === 'Test User', 'User name matches');
assert(user1.plan === 'free', 'User plan is free');
assert(user1.usage.stitch_calls === 0, 'Initial stitch calls is 0');

// Find non-existent
assert(userDB.find('n2_sk_live_nonexistent') === null, 'Non-existent user returns null');

// ── Test 3: Usage Tracking ──────────────────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 3: Usage Tracking ═══${RESET}`);

userDB.updateUsage(key1, 'stitch');
userDB.updateUsage(key1, 'stitch');
userDB.updateUsage(key1, 'search');

const usage = userDB.getUsage(key1);
assert(usage.stitch_calls === 2, 'Stitch usage incremented to 2');
assert(usage.search_calls === 1, 'Search usage incremented to 1');

// ── Test 4: Rate Limiting ───────────────────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 4: Rate Limiting ═══${RESET}`);

assert(PLAN_LIMITS.free.stitch_per_month === 20, 'Free plan: 20 stitch/month');
assert(PLAN_LIMITS.pro.stitch_per_month === -1, 'Pro plan: unlimited stitch');
assert(PLAN_LIMITS.team.stitch_per_month === -1, 'Team plan: unlimited stitch');

// Free user under limit
const freeUser = { plan: 'free', usage: { stitch_calls: 10, search_calls: 10, month: '2026-02' } };
const check1 = checkRateLimit(freeUser, 'stitch');
assert(!check1.limited, 'Free user under stitch limit: not limited');

// Free user at limit
const freeUser2 = { plan: 'free', usage: { stitch_calls: 20, search_calls: 10, month: '2026-02' } };
const check2 = checkRateLimit(freeUser2, 'stitch');
assert(check2.limited, 'Free user at stitch limit: limited');
assert(check2.upgrade_url !== undefined, 'Rate limit response includes upgrade URL');

// Pro user — unlimited
const proUser = { plan: 'pro', usage: { stitch_calls: 9999, search_calls: 9999, month: '2026-02' } };
const check3 = checkRateLimit(proUser, 'stitch');
assert(!check3.limited, 'Pro user: never limited');

// ── Test 5: Plan limits for search ──────────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 5: Search Rate Limits ═══${RESET}`);

const searchUser = { plan: 'free', usage: { stitch_calls: 0, search_calls: 200, month: '2026-02' } };
const check4 = checkRateLimit(searchUser, 'search');
assert(check4.limited, 'Free user at search limit: limited');

const searchUserOk = { plan: 'free', usage: { stitch_calls: 0, search_calls: 100, month: '2026-02' } };
const check5 = checkRateLimit(searchUserOk, 'search');
assert(!check5.limited, 'Free user under search limit: not limited');

// ── Test 6: Key format ──────────────────────────────────

console.log(`\n${BOLD}${CYAN}═══ Test 6: API Key Format ═══${RESET}`);

const liveKey = userDB.create('Live User', '', 'pro', '', '');
assert(liveKey.startsWith('n2_sk_live_'), 'Pro key starts with n2_sk_live_');
assert(liveKey.length === 43, `Key length is 43 (got ${liveKey.length})`);

// ── Clean up ────────────────────────────────────────────

try { unlinkSync(tempUsersFile); } catch { }

// ── Results ─────────────────────────────────────────────

console.log(`\n${BOLD}═══════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  Results: ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}`);
console.log(`${BOLD}═══════════════════════════════════════════════${RESET}\n`);

if (failed > 0) process.exit(1);
