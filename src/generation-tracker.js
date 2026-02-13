/**
 * N2 Stitch MCP — Generation Tracker (Layer 3 Safety)
 * 
 * Handles the biggest reliability problem with the Stitch API:
 * 
 *   Screen generation takes 2–10 minutes, but the Stitch API
 *   drops the TCP connection after ~60 seconds.
 * 
 * Solution (proven in the Go stitch-mcp project):
 *   1. Snapshot existing screens (baseline)
 *   2. Fire the generation request
 *   3. If the connection drops → poll list_screens until a new screen appears
 *   4. Return the new screen as if nothing went wrong
 * 
 * This makes generation transparent and reliable for the caller.
 */

export class GenerationTracker {
    /**
     * @param {import('./proxy-client.js').ProxyClient} proxyClient
     * @param {object} config
     * @param {object} logger
     */
    constructor(proxyClient, config, logger) {
        this.proxy = proxyClient;
        this.config = config;
        this.logger = logger;

        /** @type {Map<string, Generation>} */
        this.generations = new Map();

        /** @type {Set<string>} claimed screen IDs (prevent two pollers claiming same screen) */
        this.claimedScreens = new Set();

        // Cleanup old generations every 5 min
        this._cleanupTimer = setInterval(() => this._cleanup(), 5 * 60_000);
        if (this._cleanupTimer.unref) this._cleanupTimer.unref();
    }

    // ── Public API ────────────────────────────────────────────

    /**
     * Resilient screen generation.
     * Returns the parsed JSON result from Stitch (same structure as direct call).
     */
    async generate(projectId, prompt, deviceType, modelId) {
        const gen = {
            id: this._genId(),
            projectId,
            prompt,
            deviceType,
            modelId,
            status: 'pending',
            createdAt: Date.now(),
            completedAt: null,
            error: null,
            result: null,
            baseline: new Set(),
        };

        this.generations.set(gen.id, gen);
        this.logger.info(`Generation ${gen.id}: starting for project ${projectId}`);

        // ── Phase 1: Snapshot existing screens ──
        try {
            gen.baseline = await this._snapshotScreens(projectId);
            this.logger.info(`Generation ${gen.id}: baseline has ${gen.baseline.size} screens`);
        } catch (err) {
            this._fail(gen, `Failed to snapshot screens: ${err.message}`);
            throw new Error(`Generation ${gen.id}: ${gen.error}`);
        }

        // ── Phase 2: Fire the generation request ──
        gen.status = 'fired';

        try {
            const result = await this._fireGeneration(projectId, prompt, deviceType, modelId);

            // Direct success — the connection survived the full 2–10 min generation
            this._complete(gen, result);
            return result;
        } catch (err) {
            // Check if this is an API-level error (bad params, quota) vs TCP drop
            if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 408) {
                this._fail(gen, `Stitch API error: ${err.message}`);
                throw new Error(`Generation ${gen.id}: ${gen.error}`);
            }

            // ── Phase 3: Connection dropped — enter polling mode ──
            this.logger.warn(`Generation ${gen.id}: connection dropped (${err.code || err.message}), entering polling mode`);
            gen.status = 'polling';
        }

        // Brief delay before first poll to give Stitch time to complete
        this.logger.info(`Generation ${gen.id}: waiting ${this.config.generationInitialWaitMs}ms before first poll`);
        await this._sleep(this.config.generationInitialWaitMs);

        try {
            const result = await this._pollForNewScreen(gen);
            this._complete(gen, result);
            return result;
        } catch (err) {
            this._fail(gen, `Polling failed: ${err.message}`);
            throw new Error(`Generation ${gen.id}: ${gen.error}`);
        }
    }

    /**
     * Get info about a specific generation.
     */
    getInfo(id) {
        const gen = this.generations.get(id);
        if (!gen) return null;
        return this._toInfo(gen);
    }

    /**
     * List all tracked generations.
     */
    listAll() {
        return [...this.generations.values()].map(g => this._toInfo(g));
    }

    // ── Internal: Stitch API calls ────────────────────────────

    async _snapshotScreens(projectId) {
        const resp = await this.proxy.send('tools/call', {
            name: 'list_screens',
            arguments: { projectId },
        });

        const ids = new Set();

        if (resp.result) {
            // Extract screen IDs from the result
            const resultData = typeof resp.result === 'string' ? JSON.parse(resp.result) : resp.result;
            const content = resultData.content || resultData;

            if (Array.isArray(content)) {
                for (const item of content) {
                    const text = typeof item === 'string' ? item : (item.text || JSON.stringify(item));
                    // Extract screen IDs from response
                    const matches = text.match(/screens\/([a-f0-9]+)/g);
                    if (matches) {
                        for (const m of matches) {
                            ids.add(m.replace('screens/', ''));
                        }
                    }
                }
            }

            // Also try parsing as JSON with screens array
            try {
                const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                if (parsed.screens) {
                    for (const screen of parsed.screens) {
                        const name = screen.name || '';
                        const match = name.match(/screens\/([a-f0-9]+)/);
                        if (match) ids.add(match[1]);
                    }
                }
            } catch { /* not JSON — OK */ }
        }

        return ids;
    }

    async _fireGeneration(projectId, prompt, deviceType, modelId) {
        const args = { projectId, prompt };
        if (deviceType) args.deviceType = deviceType;
        if (modelId) args.modelId = modelId;

        const resp = await this.proxy.send('tools/call', {
            name: 'generate_screen_from_text',
            arguments: args,
        });

        if (resp.error) {
            const err = new Error(resp.error.message || JSON.stringify(resp.error));
            err.statusCode = resp.error.code || 500;
            throw err;
        }

        return resp.result;
    }

    async _pollForNewScreen(gen) {
        const deadline = Date.now() + this.config.generationPollTimeoutMs;
        let pollCount = 0;

        while (Date.now() < deadline) {
            pollCount++;
            this.logger.info(`Generation ${gen.id}: poll #${pollCount}`);

            try {
                const currentScreens = await this._snapshotScreens(gen.projectId);

                // Find new screens that weren't in the baseline
                for (const screenId of currentScreens) {
                    if (!gen.baseline.has(screenId) && !this.claimedScreens.has(screenId)) {
                        // Found a new screen! Claim it.
                        this.claimedScreens.add(screenId);
                        this.logger.info(`Generation ${gen.id}: new screen detected! ${screenId}`);

                        // Fetch the full screen details
                        const screenResult = await this.proxy.send('tools/call', {
                            name: 'get_screen',
                            arguments: {
                                projectId: gen.projectId,
                                screenId,
                                name: `projects/${gen.projectId}/screens/${screenId}`,
                            },
                        });

                        return screenResult.result || screenResult;
                    }
                }
            } catch (err) {
                this.logger.warn(`Generation ${gen.id}: poll error — ${err.message}`);
                // Don't fail on transient poll errors — keep trying
            }

            await this._sleep(this.config.generationPollIntervalMs);
        }

        throw new Error(`Timed out after ${this.config.generationPollTimeoutMs / 60000} minutes of polling`);
    }

    // ── State management ──────────────────────────────────────

    _complete(gen, result) {
        gen.status = 'completed';
        gen.completedAt = Date.now();
        gen.result = result;
        const elapsed = ((gen.completedAt - gen.createdAt) / 1000).toFixed(1);
        this.logger.info(`Generation ${gen.id}: completed in ${elapsed}s`);
    }

    _fail(gen, errMsg) {
        gen.status = 'failed';
        gen.completedAt = Date.now();
        gen.error = errMsg;
        this.logger.error(`Generation ${gen.id}: failed — ${errMsg}`);
    }

    _toInfo(gen) {
        const elapsed = ((Date.now() - gen.createdAt) / 1000).toFixed(1);
        return {
            id: gen.id,
            projectId: gen.projectId,
            prompt: gen.prompt?.slice(0, 80) + (gen.prompt?.length > 80 ? '...' : ''),
            status: gen.status,
            createdAt: new Date(gen.createdAt).toISOString(),
            completedAt: gen.completedAt ? new Date(gen.completedAt).toISOString() : null,
            elapsed: `${elapsed}s`,
            error: gen.error,
        };
    }

    _cleanup() {
        const now = Date.now();
        for (const [id, gen] of this.generations) {
            const isDone = gen.status === 'completed' || gen.status === 'failed';
            if (isDone && gen.completedAt && (now - gen.completedAt) > 30 * 60_000) {
                this.generations.delete(id);
            }
        }
    }

    _genId() {
        return Math.random().toString(36).slice(2, 10);
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
