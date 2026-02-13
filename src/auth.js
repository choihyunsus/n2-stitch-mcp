/**
 * N2 Stitch MCP — Auth Module
 * 
 * Manages Google Cloud authentication via:
 *   1. API Key (simplest — set STITCH_API_KEY)
 *   2. ADC (gcloud auth application-default login)
 *   3. Service Account JSON (GOOGLE_APPLICATION_CREDENTIALS)
 * 
 * Handles automatic token refresh before expiry.
 */

import { GoogleAuth } from 'google-auth-library';

export class AuthManager {
    /** @param {import('./config.js').loadConfig} config */
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;

        this._accessToken = '';
        this._expiresAt = 0;
        this._refreshTimer = null;
        this._googleAuth = null;
        this._client = null;
    }

    // ── Public ──────────────────────────────────────────────
    async initialize() {
        if (this.config.apiKey) {
            this.logger.info('Using API key authentication');
            return;
        }

        this.logger.info('Using Google ADC authentication');

        this._googleAuth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        this._client = await this._googleAuth.getClient();

        // Fetch initial token
        await this._refreshToken();

        // Start background refresh
        this._startRefreshLoop();
    }

    /**
     * Returns the current access token (or empty string if API key mode).
     */
    getAccessToken() {
        return this._accessToken;
    }

    /**
     * Returns headers suitable for Stitch API requests.
     */
    getAuthHeaders() {
        if (this.config.apiKey) {
            return { 'x-goog-api-key': this.config.apiKey };
        }
        return { Authorization: `Bearer ${this._accessToken}` };
    }

    /**
     * Force-refresh the token (called on 401 responses).
     */
    async forceRefresh() {
        if (this.config.apiKey) return; // API keys don't refresh
        this.logger.info('Force-refreshing access token...');
        await this._refreshToken();
    }

    /**
     * Stop the background refresh loop.
     */
    stop() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
    }

    // ── Private ─────────────────────────────────────────────
    async _refreshToken() {
        try {
            const tokenResponse = await this._client.getAccessToken();
            this._accessToken = tokenResponse.token || tokenResponse;
            this._expiresAt = Date.now() + this.config.tokenRefreshIntervalMs;
            this.logger.info('Access token refreshed successfully');
        } catch (err) {
            this.logger.error(`Failed to refresh token: ${err.message}`);
            throw err;
        }
    }

    _startRefreshLoop() {
        // Refresh every tokenRefreshIntervalMs (50 min by default)
        this._refreshTimer = setInterval(async () => {
            try {
                await this._refreshToken();
            } catch (err) {
                this.logger.error(`Background token refresh failed: ${err.message}`);
            }
        }, this.config.tokenRefreshIntervalMs);

        // Don't let the timer block process exit
        if (this._refreshTimer.unref) {
            this._refreshTimer.unref();
        }
    }
}
