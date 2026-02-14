/**
 * N2 Cloud — API Key Authentication Middleware (n2-auth.js)
 * 
 * Now delegates to N2CloudDB (SQLite) for user management.
 * Keeps backward-compatible exports for test.js.
 * 
 * Key format: n2_sk_live_xxxxxxxxxxxxxxxx (production)
 *             n2_sk_test_xxxxxxxxxxxxxxxx (testing)
 */

import crypto from 'node:crypto';

// ── AES-256 for Stitch API key encryption ────────────────
// Kept for backward compatibility (encryption helpers)

const ENCRYPTION_ALGO = 'aes-256-gcm';

function deriveKey(secret) {
    return crypto.scryptSync(secret, 'n2-cloud-salt', 32);
}

export function encryptApiKey(plainKey, secret) {
    const key = deriveKey(secret);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
    let encrypted = cipher.update(plainKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptApiKey(encryptedKey, secret) {
    const [ivHex, tagHex, data] = encryptedKey.split(':');
    const key = deriveKey(secret);
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ── Plan Limits ──────────────────────────────────────────

export const PLAN_LIMITS = {
    free: { stitch_per_month: 50, search_per_month: 500, max_keys: 1 },
    pro: { stitch_per_month: -1, search_per_month: -1, max_keys: 3 },
    team: { stitch_per_month: -1, search_per_month: -1, max_keys: 10 },
};

// ── Express Middleware (using N2CloudDB) ─────────────────

export function createAuthMiddleware(db, logger) {
    return (req, res, next) => {
        // Skip auth for health check
        if (req.path === '/health') return next();

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing Authorization header. Use: Bearer n2_sk_live_xxx' });
        }

        const key = authHeader.replace('Bearer ', '').trim();
        if (!key.startsWith('n2_sk_')) {
            return res.status(401).json({ error: 'Invalid API key format. Keys start with n2_sk_live_ or n2_sk_test_' });
        }

        const user = db.findByApiKey(key);
        if (!user) {
            return res.status(401).json({ error: 'Unknown API key' });
        }

        // Attach user info to request
        req.n2User = user;
        req.n2ApiKey = key;
        next();
    };
}

// ── Rate Limit Check (called per-request in MCP handler) ─

export function checkRateLimit(user, service) {
    // Accept both db-style and legacy-style user objects
    const plan = user.plan || 'free';
    const usage = user.usage || {};

    // Re-import PLAN_LIMITS inline to avoid circular
    const limits = {
        free: { stitch_per_month: 50, search_per_month: 500 },
        pro: { stitch_per_month: -1, search_per_month: -1 },
        team: { stitch_per_month: -1, search_per_month: -1 },
    };

    const planLimits = limits[plan] || limits.free;

    if (service === 'stitch' && planLimits.stitch_per_month > 0) {
        if ((usage.stitch_calls || 0) >= planLimits.stitch_per_month) {
            return {
                limited: true,
                error: `Monthly Stitch limit reached (${planLimits.stitch_per_month}). Upgrade to Pro for unlimited.`,
                upgrade_url: 'https://cloud.nton2.com/pricing',
            };
        }
    }

    if (service === 'search' && planLimits.search_per_month > 0) {
        if ((usage.search_calls || 0) >= planLimits.search_per_month) {
            return {
                limited: true,
                error: `Monthly search limit reached (${planLimits.search_per_month}). Upgrade to Pro for unlimited.`,
                upgrade_url: 'https://cloud.nton2.com/pricing',
            };
        }
    }

    return { limited: false };
}

// ── Legacy UserDB wrapper (for test.js compatibility) ────

export class UserDB {
    constructor(logger) {
        this.logger = logger || { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } };
        // Import db dynamically to avoid circular dependency issues
        this._users = {};
    }

    find(apiKey) { return this._users[apiKey] || null; }

    create(name, email, plan, stitchApiKey, encryptionSecret) {
        const prefix = plan === 'test' ? 'n2_sk_test_' : 'n2_sk_live_';
        const key = prefix + crypto.randomBytes(16).toString('hex');
        this._users[key] = {
            name,
            email: email || '',
            plan: plan === 'test' ? 'free' : plan,
            created: new Date().toISOString(),
            usage: { stitch_calls: 0, search_calls: 0, month: new Date().toISOString().slice(0, 7) },
        };
        return key;
    }

    updateUsage(apiKey, service) {
        const user = this._users[apiKey];
        if (!user) return;
        if (service === 'stitch') user.usage.stitch_calls++;
        if (service === 'search') user.usage.search_calls++;
    }

    getUsage(apiKey) {
        const user = this._users[apiKey];
        if (!user) return null;
        return { ...user.usage };
    }

    listAll() {
        return Object.entries(this._users).map(([key, user]) => ({
            key: key.slice(0, 20) + '...',
            name: user.name,
            plan: user.plan,
            usage: user.usage,
        }));
    }
}
