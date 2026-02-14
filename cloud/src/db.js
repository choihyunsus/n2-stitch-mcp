/**
 * N2 Cloud — SQLite Database Layer (db.js)
 * 
 * 5-table normalized schema:
 *   users            — Core accounts (1 per person)
 *   oauth_connections — Social login links (N per user)
 *   api_keys         — API keys (plan-based limits)
 *   usage_monthly    — Monthly usage counters
 *   usage_logs       — Detailed call logs (analytics)
 */

import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'n2cloud.db');

// ── Encryption helpers ──────────────────────────────────

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'n2cloud-dev-secret-change-me';

function deriveKey(secret) {
    return crypto.createHash('sha256').update(secret).digest();
}

function encryptValue(plaintext) {
    const key = deriveKey(ENCRYPTION_SECRET);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptValue(ciphertext) {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':');
    const key = deriveKey(ENCRYPTION_SECRET);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(dataHex, 'hex'), null, 'utf8') + decipher.final('utf8');
}

function hashKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// ── Plan limits ─────────────────────────────────────────

export const PLAN_LIMITS = {
    free: { stitch_per_month: 20, search_per_month: 200, max_keys: 1 },
    pro: { stitch_per_month: -1, search_per_month: -1, max_keys: 3 },
    team: { stitch_per_month: -1, search_per_month: -1, max_keys: 10 },
};

// ── Database Class ──────────────────────────────────────

export class N2CloudDB {
    constructor(logger) {
        this.logger = logger || { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } };

        // Ensure data directory
        const dataDir = dirname(DB_PATH);
        if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

        this.db = new Database(DB_PATH);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        this._initSchema();
        this.logger.info(`N2CloudDB initialized: ${DB_PATH}`);
    }

    // ── Schema ──────────────────────────────────────────

    _initSchema() {
        this.db.exec(`
            -- 1. users
            CREATE TABLE IF NOT EXISTS users (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL,
                email           TEXT UNIQUE,
                avatar          TEXT,
                plan            TEXT NOT NULL DEFAULT 'free',
                stitch_api_key  TEXT,
                is_active       INTEGER NOT NULL DEFAULT 1,
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
                last_login      TEXT
            );

            -- 2. oauth_connections
            CREATE TABLE IF NOT EXISTS oauth_connections (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                provider     TEXT NOT NULL,
                provider_id  TEXT NOT NULL,
                username     TEXT,
                raw_profile  TEXT,
                connected_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(provider, provider_id)
            );

            -- 3. api_keys
            CREATE TABLE IF NOT EXISTS api_keys (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                key_hash      TEXT NOT NULL UNIQUE,
                key_encrypted TEXT NOT NULL,
                key_prefix    TEXT NOT NULL,
                label         TEXT NOT NULL DEFAULT 'Default',
                is_active     INTEGER NOT NULL DEFAULT 1,
                created_at    TEXT NOT NULL DEFAULT (datetime('now')),
                last_used_at  TEXT,
                revoked_at    TEXT
            );

            -- 4. usage_monthly
            CREATE TABLE IF NOT EXISTS usage_monthly (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                month         TEXT NOT NULL,
                stitch_calls  INTEGER NOT NULL DEFAULT 0,
                search_calls  INTEGER NOT NULL DEFAULT 0,
                UNIQUE(user_id, month)
            );

            -- 5. usage_logs
            CREATE TABLE IF NOT EXISTS usage_logs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT NOT NULL,
                api_key_id  INTEGER,
                type        TEXT NOT NULL,
                endpoint    TEXT,
                status_code INTEGER,
                duration_ms INTEGER,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_connections(provider, provider_id);
            CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_connections(user_id);
            CREATE INDEX IF NOT EXISTS idx_apikeys_hash ON api_keys(key_hash);
            CREATE INDEX IF NOT EXISTS idx_apikeys_user ON api_keys(user_id);
            CREATE INDEX IF NOT EXISTS idx_usage_monthly_user ON usage_monthly(user_id, month);
            CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id, created_at);
        `);

        // ── Migration: Add stitch_api_key column if not exists ──
        try {
            this.db.prepare('SELECT stitch_api_key FROM users LIMIT 1').get();
        } catch {
            this.logger.info('Migrating: Adding stitch_api_key column to users table');
            this.db.exec('ALTER TABLE users ADD COLUMN stitch_api_key TEXT');
        }
    }

    // ── User Operations ─────────────────────────────────

    /**
     * OAuth login: upsert user + connection.
     * Flow: provider_id → email merge → new user
     */
    upsertOAuthUser(profile) {
        const { provider, providerId, name, email, avatar, username } = profile;

        // Step 1: Check existing oauth_connection
        const existing = this.db.prepare(
            'SELECT user_id FROM oauth_connections WHERE provider = ? AND provider_id = ?'
        ).get(provider, providerId);

        if (existing) {
            // Known connection → update user info & last_login
            const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(existing.user_id);
            this.db.prepare(`
                UPDATE users SET name = ?, avatar = ?, last_login = datetime('now'), updated_at = datetime('now')
                WHERE id = ?
            `).run(name, avatar, user.id);
            this.logger.info(`OAuth login (existing): ${name} via ${provider}`);
            return this._getUserFull(user.id);
        }

        // Step 2: Check by email (account merge)
        if (email) {
            const emailUser = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
            if (emailUser) {
                // Link new provider to existing user
                this.db.prepare(`
                    INSERT INTO oauth_connections (user_id, provider, provider_id, username, raw_profile)
                    VALUES (?, ?, ?, ?, ?)
                `).run(emailUser.id, provider, providerId, username, JSON.stringify(profile));

                this.db.prepare(`
                    UPDATE users SET name = ?, avatar = ?, last_login = datetime('now'), updated_at = datetime('now')
                    WHERE id = ?
                `).run(name, avatar, emailUser.id);

                this.logger.info(`OAuth login (email merge): ${name} via ${provider} → existing user ${emailUser.id}`);
                return this._getUserFull(emailUser.id);
            }
        }

        // Step 3: Create new user
        const userId = `user_${crypto.randomBytes(8).toString('hex')}`;

        const insertUser = this.db.prepare(`
            INSERT INTO users (id, name, email, avatar, plan, last_login)
            VALUES (?, ?, ?, ?, 'free', datetime('now'))
        `);

        const insertOAuth = this.db.prepare(`
            INSERT INTO oauth_connections (user_id, provider, provider_id, username, raw_profile)
            VALUES (?, ?, ?, ?, ?)
        `);

        const txn = this.db.transaction(() => {
            insertUser.run(userId, name, email || null, avatar);
            insertOAuth.run(userId, provider, providerId, username, JSON.stringify(profile));
        });
        txn();

        // Auto-generate API key
        this.createApiKey(userId, 'Default');

        this.logger.info(`OAuth login (new user): ${name} via ${provider} — id: ${userId}`);
        return this._getUserFull(userId);
    }

    /**
     * Get full user profile with connections & primary key
     */
    _getUserFull(userId) {
        const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) return null;

        const connections = this.db.prepare(
            'SELECT provider, username, connected_at FROM oauth_connections WHERE user_id = ?'
        ).all(userId);

        const keys = this.db.prepare(
            'SELECT id, key_prefix, label, is_active, created_at, last_used_at FROM api_keys WHERE user_id = ? AND revoked_at IS NULL'
        ).all(userId);

        const usage = this._getUsage(userId);

        // Get primary API key (first active one)
        const primaryKey = this.db.prepare(
            'SELECT key_encrypted FROM api_keys WHERE user_id = ? AND is_active = 1 AND revoked_at IS NULL ORDER BY created_at ASC LIMIT 1'
        ).get(userId);

        let n2ApiKey = null;
        if (primaryKey) {
            try { n2ApiKey = decryptValue(primaryKey.key_encrypted); } catch { /* ignore */ }
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            plan: user.plan,
            is_active: user.is_active,
            created_at: user.created_at,
            last_login: user.last_login,
            connections,
            keys,
            usage,
            n2ApiKey, // decrypted primary key (for dashboard)
        };
    }

    // ── API Key Operations ──────────────────────────────

    /**
     * Create a new API key for a user
     */
    createApiKey(userId, label = 'Default') {
        const user = this.db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
        if (!user) throw new Error('User not found');

        // Check key limit
        const existingCount = this.db.prepare(
            'SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ? AND revoked_at IS NULL'
        ).get(userId).cnt;

        const limit = PLAN_LIMITS[user.plan]?.max_keys || 1;
        if (existingCount >= limit) {
            throw new Error(`Key limit reached (${limit} for ${user.plan} plan)`);
        }

        // Generate key
        const prefix = 'n2_sk_live_';
        const rawKey = `${prefix}${crypto.randomBytes(16).toString('hex')}`;
        const keyHash = hashKey(rawKey);
        const keyEncrypted = encryptValue(rawKey);
        const keyPrefix = rawKey.slice(0, 20) + '...';

        this.db.prepare(`
            INSERT INTO api_keys (user_id, key_hash, key_encrypted, key_prefix, label)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, keyHash, keyEncrypted, keyPrefix, label);

        this.logger.info(`API key created for user ${userId}: ${keyPrefix}`);
        return rawKey;
    }

    /**
     * Find user by API key (for auth middleware)
     */
    findByApiKey(rawKey) {
        const kHash = hashKey(rawKey);
        const keyRow = this.db.prepare(`
            SELECT ak.*, u.id as uid, u.name, u.email, u.plan, u.is_active, u.stitch_api_key
            FROM api_keys ak
            JOIN users u ON u.id = ak.user_id
            WHERE ak.key_hash = ? AND ak.is_active = 1 AND ak.revoked_at IS NULL AND u.is_active = 1
        `).get(kHash);

        if (!keyRow) return null;

        // Update last_used_at
        this.db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?').run(keyRow.id);

        const usage = this._getUsage(keyRow.uid);

        return {
            id: keyRow.uid,
            name: keyRow.name,
            email: keyRow.email,
            plan: keyRow.plan,
            apiKeyId: keyRow.id,
            stitch_api_key: keyRow.stitch_api_key || null,
            usage,
        };
    }

    /**
     * Revoke an API key
     */
    revokeApiKey(keyId, userId) {
        const result = this.db.prepare(
            'UPDATE api_keys SET revoked_at = datetime(\'now\'), is_active = 0 WHERE id = ? AND user_id = ?'
        ).run(keyId, userId);
        return result.changes > 0;
    }

    // ── Stitch API Key Operations ────────────────────────

    /**
     * Save user's Stitch API Key (encrypted)
     */
    setStitchApiKey(userId, plainKey) {
        const encrypted = encryptValue(plainKey);
        this.db.prepare(`
            UPDATE users SET stitch_api_key = ?, updated_at = datetime('now') WHERE id = ?
        `).run(encrypted, userId);
        this.logger.info(`Stitch API key saved for user ${userId}`);
    }

    /**
     * Get user's Stitch API Key (decrypted)
     */
    getStitchApiKey(userId) {
        const row = this.db.prepare('SELECT stitch_api_key FROM users WHERE id = ?').get(userId);
        if (!row || !row.stitch_api_key) return null;
        try {
            return decryptValue(row.stitch_api_key);
        } catch (err) {
            this.logger.error(`Failed to decrypt Stitch API key for user ${userId}: ${err.message}`);
            return null;
        }
    }

    /**
     * Delete user's Stitch API Key
     */
    deleteStitchApiKey(userId) {
        this.db.prepare(`
            UPDATE users SET stitch_api_key = NULL, updated_at = datetime('now') WHERE id = ?
        `).run(userId);
        this.logger.info(`Stitch API key deleted for user ${userId}`);
    }

    // ── Usage Operations ────────────────────────────────

    /**
     * Get current month usage
     */
    _getUsage(userId) {
        const month = new Date().toISOString().slice(0, 7);
        const row = this.db.prepare(
            'SELECT stitch_calls, search_calls FROM usage_monthly WHERE user_id = ? AND month = ?'
        ).get(userId, month);

        return {
            stitch_calls: row?.stitch_calls || 0,
            search_calls: row?.search_calls || 0,
            month,
        };
    }

    /**
     * Increment usage counter (atomic UPSERT)
     */
    incrementUsage(userId, type) {
        const month = new Date().toISOString().slice(0, 7);
        const col = type === 'stitch' ? 'stitch_calls' : 'search_calls';

        this.db.prepare(`
            INSERT INTO usage_monthly (user_id, month, ${col})
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, month) DO UPDATE SET ${col} = ${col} + 1
        `).run(userId, month);
    }

    /**
     * Check rate limit
     */
    checkRateLimit(userId, type) {
        const user = this.db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
        if (!user) return { limited: true, reason: 'User not found' };

        const limits = PLAN_LIMITS[user.plan];
        if (!limits) return { limited: true, reason: 'Unknown plan' };

        const limitKey = type === 'stitch' ? 'stitch_per_month' : 'search_per_month';
        const limit = limits[limitKey];

        if (limit === -1) return { limited: false }; // unlimited

        const usage = this._getUsage(userId);
        const used = type === 'stitch' ? usage.stitch_calls : usage.search_calls;

        if (used >= limit) {
            return {
                limited: true,
                reason: `${type} limit reached: ${used}/${limit} this month`,
                used,
                limit,
                upgrade_url: '/#pricing',
            };
        }

        return { limited: false, used, limit };
    }

    // ── Admin Operations ────────────────────────────────

    /**
     * Create user manually (admin)
     */
    createUser(name, email, plan = 'free') {
        const userId = `user_${crypto.randomBytes(8).toString('hex')}`;
        this.db.prepare(`
            INSERT INTO users (id, name, email, plan) VALUES (?, ?, ?, ?)
        `).run(userId, name, email || null, plan);

        const apiKey = this.createApiKey(userId, 'Default');
        this.logger.info(`Admin created user ${userId}: ${name} (${plan})`);
        return { userId, apiKey };
    }

    /**
     * List all users (admin)
     */
    listUsers() {
        return this.db.prepare(`
            SELECT u.id, u.name, u.email, u.plan, u.is_active, u.created_at, u.last_login,
                   COUNT(DISTINCT oc.id) as oauth_count,
                   COUNT(DISTINCT ak.id) as key_count
            FROM users u
            LEFT JOIN oauth_connections oc ON oc.user_id = u.id
            LEFT JOIN api_keys ak ON ak.user_id = u.id AND ak.revoked_at IS NULL
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `).all();
    }

    /**
     * Get user count
     */
    getUserCount() {
        return this.db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_active = 1').get().cnt;
    }

    // ── Cleanup ─────────────────────────────────────────

    close() {
        this.db.close();
    }
}

// ── Convenience init function ───────────────────────────

export function initDB(logger) {
    return new N2CloudDB(logger);
}
