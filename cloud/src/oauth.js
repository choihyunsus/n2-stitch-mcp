/**
 * N2 Cloud — OAuth Authentication (oauth.js)
 * 
 * Handles GitHub & Google OAuth 2.0 login flows.
 * Uses N2CloudDB for user management (SQLite).
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// ── Config ──────────────────────────────────────────────

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'n2cloud-jwt-secret';
const JWT_EXPIRY = '7d';
const COOKIE_NAME = 'n2_token';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3500';

// ── OAuth URL Builders ──────────────────────────────────

function githubAuthUrl(state) {
    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: `${BASE_URL}/auth/github/callback`,
        scope: 'read:user user:email',
        state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
}

function googleAuthUrl(state) {
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: `${BASE_URL}/auth/google/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'offline',
        prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ── Token Exchange Helpers ──────────────────────────────

async function exchangeGithubCode(code) {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
        }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

    const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    let email = user.email;
    if (!email) {
        const emailRes = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const emails = await emailRes.json();
        const primary = emails.find(e => e.primary) || emails[0];
        email = primary?.email;
    }

    return {
        provider: 'github',
        providerId: String(user.id),
        name: user.name || user.login,
        email: email || '',
        avatar: user.avatar_url,
        username: user.login,
    };
}

async function exchangeGoogleCode(code) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: `${BASE_URL}/auth/google/callback`,
            grant_type: 'authorization_code',
        }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    return {
        provider: 'google',
        providerId: user.id,
        name: user.name,
        email: user.email || '',
        avatar: user.picture,
        username: user.email?.split('@')[0] || '',
    };
}

// ── JWT Helpers ─────────────────────────────────────────

function issueToken(user) {
    return jwt.sign({
        userId: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
    }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

// ── Create Router ───────────────────────────────────────

export function createOAuthRouter(db, logger) {
    const router = Router();

    // CSRF state store (in-memory, short-lived)
    const stateStore = new Map();

    function cleanStaleStates() {
        for (const [k, v] of stateStore) {
            if (Date.now() - v.ts > 600_000) stateStore.delete(k);
        }
    }

    // ── GitHub Login ──
    router.get('/github', (req, res) => {
        const state = crypto.randomBytes(16).toString('hex');
        stateStore.set(state, { ts: Date.now() });
        cleanStaleStates();
        res.redirect(githubAuthUrl(state));
    });

    // ── GitHub Callback ──
    router.get('/github/callback', async (req, res) => {
        try {
            const { code, state } = req.query;
            if (!code || !state || !stateStore.has(state)) {
                return res.status(400).send('Invalid OAuth callback. <a href="/#landing">Go back</a>');
            }
            stateStore.delete(state);

            const profile = await exchangeGithubCode(code);
            const user = db.upsertOAuthUser(profile);
            const token = issueToken(user);

            res.cookie(COOKIE_NAME, token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            logger.info(`GitHub login success: ${user.name}`);
            res.redirect('/#dashboard');
        } catch (err) {
            logger.error(`GitHub OAuth error: ${err.message}`);
            res.status(500).send(`Login failed: ${err.message}. <a href="/#landing">Try again</a>`);
        }
    });

    // ── Google Login ──
    router.get('/google', (req, res) => {
        const state = crypto.randomBytes(16).toString('hex');
        stateStore.set(state, { ts: Date.now() });
        cleanStaleStates();
        res.redirect(googleAuthUrl(state));
    });

    // ── Google Callback ──
    router.get('/google/callback', async (req, res) => {
        try {
            const { code, state } = req.query;
            if (!code || !state || !stateStore.has(state)) {
                return res.status(400).send('Invalid OAuth callback. <a href="/#landing">Go back</a>');
            }
            stateStore.delete(state);

            const profile = await exchangeGoogleCode(code);
            const user = db.upsertOAuthUser(profile);
            const token = issueToken(user);

            res.cookie(COOKIE_NAME, token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            logger.info(`Google login success: ${user.name}`);
            res.redirect('/#dashboard');
        } catch (err) {
            logger.error(`Google OAuth error: ${err.message}`);
            res.status(500).send(`Login failed: ${err.message}. <a href="/#landing">Try again</a>`);
        }
    });

    // ── Get Current User (API) ──
    router.get('/me', (req, res) => {
        const token = req.cookies?.[COOKIE_NAME];
        if (!token) return res.json({ authenticated: false });

        const payload = verifyToken(token);
        if (!payload) return res.json({ authenticated: false });

        const user = db._getUserFull(payload.userId);
        if (!user) return res.json({ authenticated: false });

        res.json({
            authenticated: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                plan: user.plan,
                n2ApiKey: user.n2ApiKey,
                connections: user.connections,
                usage: user.usage,
                created_at: user.created_at,
            },
        });
    });

    // ── Logout ──
    router.get('/logout', (req, res) => {
        res.clearCookie(COOKIE_NAME);
        res.redirect('/#landing');
    });

    return router;
}
