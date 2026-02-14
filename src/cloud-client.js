// STDIO↔HTTP Bridge for N2 Cloud — connects any MCP client to cloud.nton2.com
/**
 * N2 Stitch MCP — Cloud Proxy Client (cloud-client.js)
 * 
 * Bridges STDIO (local MCP client) ↔ Streamable HTTP (N2 Cloud).
 * 
 * Flow:
 *   MCP Client → STDIN (JSON-RPC) → CloudProxyClient → POST cloud.nton2.com/mcp
 *   MCP Client ← STDOUT (JSON-RPC) ← CloudProxyClient ← HTTP Response
 * 
 * Features:
 *   - Automatic session management (Mcp-Session-Id header)
 *   - SSE notification subscription (server → client events)
 *   - Exponential backoff retry on network errors
 *   - Graceful error handling with user-friendly messages
 */

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

export class CloudProxyClient {
    /**
     * @param {object} config - Configuration from loadConfig()
     * @param {object} logger - Logger with info/warn/error/debug methods
     */
    constructor(config, logger) {
        this.cloudUrl = config.cloudUrl.replace(/\/$/, ''); // strip trailing slash
        this.n2ApiKey = config.n2ApiKey;
        this.debug = config.debug;
        this.logger = logger;
        this.sessionId = null;
        this.sseController = null;
    }

    /**
     * Send a JSON-RPC request to N2 Cloud and return the response.
     * Handles session ID tracking and retry logic.
     * 
     * @param {object} body - JSON-RPC request body
     * @returns {Promise<object>} JSON-RPC response
     */
    async sendRequest(body) {
        let lastError;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.n2ApiKey}`,
                    'Accept': 'application/json, text/event-stream',
                };

                if (this.sessionId) {
                    headers['Mcp-Session-Id'] = this.sessionId;
                }

                this.logger.debug(`Cloud request [attempt ${attempt + 1}]: ${body.method || 'unknown'}`);

                const resp = await fetch(`${this.cloudUrl}/mcp`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });

                // Capture session ID from response
                const newSessionId = resp.headers.get('mcp-session-id');
                if (newSessionId && !this.sessionId) {
                    this.sessionId = newSessionId;
                    this.logger.info(`Cloud session established: ${this.sessionId.slice(0, 8)}...`);
                }

                // Handle error responses
                if (!resp.ok) {
                    const errorText = await resp.text();

                    if (resp.status === 401) {
                        throw new CloudAuthError(
                            `Invalid N2 API Key. Get yours at ${this.cloudUrl}/#get-key`
                        );
                    }
                    if (resp.status === 429) {
                        let errorMsg = 'Monthly usage limit reached.';
                        try {
                            const errorJson = JSON.parse(errorText);
                            errorMsg = errorJson.error || errorMsg;
                        } catch { /* ignore */ }
                        throw new CloudRateLimitError(
                            `${errorMsg} Upgrade at ${this.cloudUrl}/#billing`
                        );
                    }
                    if (resp.status >= 500) {
                        // Server error — retry
                        lastError = new Error(`Cloud server error (${resp.status}): ${errorText}`);
                        this.logger.warn(`Server error ${resp.status}, retrying...`);
                        await this._backoff(attempt);
                        continue;
                    }

                    // 4xx (other than 401/429) — don't retry
                    throw new Error(`Cloud error (${resp.status}): ${errorText}`);
                }

                // Check content type for SSE vs JSON
                const contentType = resp.headers.get('content-type') || '';

                if (contentType.includes('text/event-stream')) {
                    // SSE response — parse events and return the JSON-RPC result
                    return await this._parseSSEResponse(resp);
                }

                // Regular JSON response
                const result = await resp.json();
                this.logger.debug(`Cloud response: ${JSON.stringify(result).slice(0, 200)}`);
                return result;

            } catch (err) {
                if (err instanceof CloudAuthError || err instanceof CloudRateLimitError) {
                    throw err; // Don't retry auth/rate limit errors
                }

                lastError = err;
                if (attempt < MAX_RETRIES - 1) {
                    this.logger.warn(`Request failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${err.message}`);
                    await this._backoff(attempt);
                }
            }
        }

        throw lastError || new Error('Cloud request failed after all retries');
    }

    /**
     * Parse Server-Sent Events response into JSON-RPC messages.
     * The Streamable HTTP transport may return SSE for long-running operations.
     * 
     * @param {Response} resp - Fetch response with SSE content
     * @returns {Promise<object>} Parsed JSON-RPC response
     */
    async _parseSSEResponse(resp) {
        const text = await resp.text();
        const messages = [];

        // Parse SSE format: "data: {...}\n\n"
        const lines = text.split('\n');
        let currentData = '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                currentData += line.slice(6);
            } else if (line === '' && currentData) {
                try {
                    messages.push(JSON.parse(currentData));
                } catch (e) {
                    this.logger.warn(`Failed to parse SSE data: ${currentData.slice(0, 100)}`);
                }
                currentData = '';
            }
        }

        // Handle remaining data
        if (currentData) {
            try {
                messages.push(JSON.parse(currentData));
            } catch { /* ignore trailing data */ }
        }

        // Return the last JSON-RPC response (notifications come first, result last)
        if (messages.length > 0) {
            // Forward any notification messages to stdout
            for (let i = 0; i < messages.length - 1; i++) {
                if (messages[i].method) {
                    // This is a notification — write to stdout
                    process.stdout.write(JSON.stringify(messages[i]) + '\n');
                }
            }
            return messages[messages.length - 1];
        }

        throw new Error('Empty SSE response from cloud');
    }

    /**
     * Close the cloud session gracefully.
     */
    async closeSession() {
        if (!this.sessionId) return;

        try {
            await fetch(`${this.cloudUrl}/mcp`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.n2ApiKey}`,
                    'Mcp-Session-Id': this.sessionId,
                },
            });
            this.logger.info('Cloud session closed');
        } catch (err) {
            this.logger.warn(`Failed to close session: ${err.message}`);
        }

        this.sessionId = null;
    }

    /**
     * Exponential backoff delay with jitter.
     * @param {number} attempt - Retry attempt number (0-based)
     */
    async _backoff(attempt) {
        const delay = Math.min(
            RETRY_BASE_DELAY_MS * Math.pow(2, attempt),
            15_000
        );
        const jitter = delay * (0.7 + Math.random() * 0.6); // ±30%
        await new Promise(r => setTimeout(r, jitter));
    }
}

// ── Custom Error Types ──────────────────────────────────────

export class CloudAuthError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CloudAuthError';
    }
}

export class CloudRateLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CloudRateLimitError';
    }
}
