/**
 * N2 Stitch MCP — Proxy Client
 * 
 * HTTP client that forwards JSON-RPC requests to the Stitch API.
 * 
 * ┌──────────────────────────────────────────────────────────────┐
 * │  3-Layer Safety Architecture                                │
 * │                                                             │
 * │  Layer 1 ─ Exponential-backoff retry (network errors)       │
 * │  Layer 2 ─ Auto token refresh on HTTP 401                   │
 * │  Layer 3 ─ TCP drop recovery (see generation-tracker.js)    │
 * └──────────────────────────────────────────────────────────────┘
 */

export class ProxyClient {
    /**
     * @param {object} config  — from loadConfig()
     * @param {import('./auth.js').AuthManager} auth
     * @param {object} logger
     */
    constructor(config, auth, logger) {
        this.config = config;
        this.auth = auth;
        this.logger = logger;
        this._requestId = 0;
    }

    // ── Public: high-level JSON-RPC call ──────────────────────

    /**
     * Send a JSON-RPC request to the Stitch MCP API.
     * Returns the parsed JSON-RPC response object.
     */
    async send(method, params = {}) {
        const req = {
            jsonrpc: '2.0',
            method,
            params,
            id: ++this._requestId,
        };
        return this._sendWithRetry(req);
    }

    /**
     * Send a raw JSON body to the Stitch API and return the raw response body (Buffer/string).
     * Used by forwardToolCall where we already have the serialised request.
     */
    async sendRaw(bodyObj) {
        return this._sendRawWithRetry(bodyObj);
    }

    // ── Layer 1: Retry with exponential backoff ────────────────

    async _sendWithRetry(req) {
        let lastError;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const response = await this._doFetch(req);
                return response;
            } catch (err) {
                lastError = err;

                // Layer 2: Token expired — refresh and retry immediately
                if (err.statusCode === 401 && attempt < this.config.maxRetries) {
                    this.logger.warn(`401 Unauthorized — refreshing token (attempt ${attempt + 1})`);
                    await this.auth.forceRefresh();
                    continue;
                }

                // Transient network error — delay then retry
                if (this._isTransient(err) && attempt < this.config.maxRetries) {
                    const delay = this._backoffDelay(attempt);
                    this.logger.warn(
                        `Transient error (${err.code || err.message}) — retry ${attempt + 1}/${this.config.maxRetries} in ${delay}ms`
                    );
                    await this._sleep(delay);
                    continue;
                }

                // Non-transient or final attempt — throw
                throw err;
            }
        }

        throw lastError;
    }

    async _sendRawWithRetry(bodyObj) {
        let lastError;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const result = await this._doFetchRaw(bodyObj);
                return result;
            } catch (err) {
                lastError = err;

                if (err.statusCode === 401 && attempt < this.config.maxRetries) {
                    this.logger.warn(`401 on raw send — refreshing token (attempt ${attempt + 1})`);
                    await this.auth.forceRefresh();
                    continue;
                }

                if (this._isTransient(err) && attempt < this.config.maxRetries) {
                    const delay = this._backoffDelay(attempt);
                    this.logger.warn(`Transient error on raw send — retry ${attempt + 1} in ${delay}ms`);
                    await this._sleep(delay);
                    continue;
                }

                throw err;
            }
        }

        throw lastError;
    }

    // ── HTTP primitives ───────────────────────────────────────

    async _doFetch(req) {
        const url = this.config.stitchHost;
        const headers = {
            'Content-Type': 'application/json',
            ...this.auth.getAuthHeaders(),
        };
        const body = JSON.stringify(req);

        if (this.config.debug) {
            this.logger.debug(`→ ${req.method} | id=${req.id}`);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal,
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                const error = new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
                error.statusCode = res.status;
                throw error;
            }

            const json = await res.json();

            if (this.config.debug) {
                this.logger.debug(`← id=${json.id} | ${json.error ? 'ERROR' : 'OK'}`);
            }

            return json;
        } finally {
            clearTimeout(timeout);
        }
    }

    async _doFetchRaw(bodyObj) {
        const url = this.config.stitchHost;
        const headers = {
            'Content-Type': 'application/json',
            ...this.auth.getAuthHeaders(),
        };
        const body = JSON.stringify(bodyObj);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal,
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                const error = new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
                error.statusCode = res.status;
                throw error;
            }

            const text = await res.text();
            return JSON.parse(text);
        } finally {
            clearTimeout(timeout);
        }
    }

    // ── Helpers ───────────────────────────────────────────────

    _isTransient(err) {
        // Network-level errors
        const transientCodes = new Set([
            'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE',
            'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN',
            'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT',
        ]);
        if (err.code && transientCodes.has(err.code)) return true;

        // AbortError (timeout)
        if (err.name === 'AbortError') return true;

        // HTTP 429 (rate limit) or 5xx (server error)
        if (err.statusCode === 429) return true;
        if (err.statusCode >= 500 && err.statusCode < 600) return true;

        return false;
    }

    _backoffDelay(attempt) {
        const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * delay; // ±30% jitter
        return Math.min(delay + jitter, this.config.retryMaxDelayMs);
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
