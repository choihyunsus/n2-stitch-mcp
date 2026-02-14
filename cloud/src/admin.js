/**
 * N2 Cloud — Admin API
 * 
 * Management endpoints for API key creation, usage monitoring, etc.
 * Protected by ADMIN_SECRET environment variable.
 */

import { Router } from 'express';

export function createAdminRouter(db, sessionManager, logger) {
    const router = Router();
    const adminSecret = process.env.ADMIN_SECRET || 'n2-cloud-admin-2026';

    // Admin auth middleware
    router.use((req, res, next) => {
        const secret = req.headers['x-admin-secret'];
        if (secret !== adminSecret) {
            return res.status(403).json({ error: 'Invalid admin secret' });
        }
        next();
    });

    // ── List all users ──────────────────────────────────────
    router.get('/users', (req, res) => {
        res.json({ users: db.listUsers() });
    });

    // ── Create API key ──────────────────────────────────────
    router.post('/keys', (req, res) => {
        const { name, email, plan } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        const validPlans = ['free', 'pro', 'team'];
        const userPlan = validPlans.includes(plan) ? plan : 'free';

        try {
            const { userId, apiKey } = db.createUser(name, email, userPlan);

            logger.info(`Admin: Created user ${userId} for ${name} (${userPlan})`);
            res.json({
                success: true,
                user_id: userId,
                api_key: apiKey,
                plan: userPlan,
                message: `API key created for ${name}. Save this key — it won't be shown again!`,
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Usage stats ─────────────────────────────────────────
    router.get('/usage', (req, res) => {
        const users = db.listUsers();
        res.json({
            total_users: users.length,
            users,
        });
    });

    // ── Active sessions ─────────────────────────────────────
    router.get('/sessions', (req, res) => {
        res.json(sessionManager.getStats());
    });

    return router;
}
