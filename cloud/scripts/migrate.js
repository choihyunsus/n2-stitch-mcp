/**
 * N2 Cloud — Migration Script
 * 
 * Migrates existing JSON data to SQLite database.
 * Run: node scripts/migrate.js
 * 
 * Sources:
 *   data/oauth-users.json  →  users + oauth_connections + api_keys
 *   data/users.json        →  users + api_keys + usage_monthly
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDB } from '../src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function warn(msg) { console.log(`  ${YELLOW}⚠${RESET} ${msg}`); }
function err(msg) { console.log(`  ${RED}✗${RESET} ${msg}`); }

console.log(`\n${BOLD}═══ N2 Cloud Migration: JSON → SQLite ═══${RESET}\n`);

const logger = { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } };
const db = initDB(logger);

let migrated = { oauthUsers: 0, apiKeyUsers: 0, skipped: 0 };

// ── 1. Migrate OAuth Users ──────────────────────────────

const oauthFile = join(DATA_DIR, 'oauth-users.json');
if (existsSync(oauthFile)) {
    log(`Reading ${oauthFile}...`);
    try {
        const raw = JSON.parse(readFileSync(oauthFile, 'utf8'));
        const users = raw.users || {};

        for (const [id, user] of Object.entries(users)) {
            try {
                const profile = {
                    provider: user.provider || 'unknown',
                    providerId: user.providerId || id,
                    name: user.name || 'Unknown',
                    email: user.email || '',
                    avatar: user.avatar || '',
                    username: user.username || '',
                };

                const result = db.upsertOAuthUser(profile);
                ok(`OAuth user: ${user.name} (${user.provider}) → ${result.id}`);
                migrated.oauthUsers++;
            } catch (e) {
                err(`Failed to migrate OAuth user ${id}: ${e.message}`);
                migrated.skipped++;
            }
        }
    } catch (e) {
        err(`Failed to read oauth-users.json: ${e.message}`);
    }
} else {
    warn('oauth-users.json not found — skipping');
}

// ── 2. Migrate API Key Users ────────────────────────────

const usersFile = join(DATA_DIR, 'users.json');
if (existsSync(usersFile)) {
    log(`\nReading ${usersFile}...`);
    try {
        const raw = JSON.parse(readFileSync(usersFile, 'utf8'));
        const users = raw.users || {};

        for (const [apiKey, user] of Object.entries(users)) {
            try {
                // Check if this user already exists (by email)
                const { userId } = db.createUser(
                    user.name || 'API User',
                    user.email || null,
                    user.plan || 'free'
                );

                ok(`API key user: ${user.name} (${user.plan}) → ${userId}`);
                migrated.apiKeyUsers++;
            } catch (e) {
                if (e.message.includes('UNIQUE constraint')) {
                    warn(`Skipped duplicate: ${user.name} (${user.email}) — already exists`);
                    migrated.skipped++;
                } else {
                    err(`Failed to migrate API key user: ${e.message}`);
                    migrated.skipped++;
                }
            }
        }
    } catch (e) {
        err(`Failed to read users.json: ${e.message}`);
    }
} else {
    warn('users.json not found — skipping');
}

// ── Summary ─────────────────────────────────────────────

console.log(`\n${BOLD}═══ Migration Complete ═══${RESET}`);
console.log(`  OAuth users:    ${GREEN}${migrated.oauthUsers}${RESET}`);
console.log(`  API key users:  ${GREEN}${migrated.apiKeyUsers}${RESET}`);
console.log(`  Skipped:        ${YELLOW}${migrated.skipped}${RESET}`);
console.log(`  Total in DB:    ${GREEN}${db.getUserCount()}${RESET}`);
console.log('');

db.close();
