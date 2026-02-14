// ═══════════════════════════════════════════════════════════
// N2 Cloud — API Client (api.js)
// Backend communication layer
// ═══════════════════════════════════════════════════════════

import { CONFIG } from './config.js';

class ApiClient {
    constructor() {
        this.baseUrl = CONFIG.API_BASE;
        this.apiKey = localStorage.getItem('n2_api_key') || '';
        this.adminSecret = '';
    }

    /** Set API Key */
    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('n2_api_key', key);
    }

    /** Get stored API key */
    getApiKey() {
        return this.apiKey;
    }

    /** Clear API key */
    clearApiKey() {
        this.apiKey = '';
        localStorage.removeItem('n2_api_key');
    }

    /** Check if user is authenticated */
    isAuthenticated() {
        return !!this.apiKey;
    }

    /** Generic fetch with auth */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.apiKey) {
            headers['X-API-Key'] = this.apiKey;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
                throw new Error('Service unavailable. Please check your connection.');
            }
            throw err;
        }
    }

    // ── Admin endpoints ──────────────────────────

    /** Create a new API key */
    async createKey({ name, email, plan = 'free', stitchKey = '' }) {
        return this.request(CONFIG.ENDPOINTS.ADMIN_KEYS, {
            method: 'POST',
            headers: { 'X-Admin-Secret': this.adminSecret },
            body: JSON.stringify({ name, email, plan, stitchKey }),
        });
    }

    /** Get usage stats */
    async getUsage(apiKey) {
        return this.request(`${CONFIG.ENDPOINTS.ADMIN_USAGE}/${apiKey}`, {
            headers: { 'X-Admin-Secret': this.adminSecret },
        });
    }

    /** List all users */
    async listUsers() {
        return this.request(CONFIG.ENDPOINTS.ADMIN_USERS, {
            headers: { 'X-Admin-Secret': this.adminSecret },
        });
    }

    /** Get active sessions */
    async getSessions() {
        return this.request(CONFIG.ENDPOINTS.ADMIN_SESSIONS, {
            headers: { 'X-Admin-Secret': this.adminSecret },
        });
    }

    // ── MCP endpoint ─────────────────────────────

    /** Send MCP request */
    async sendMCP(payload) {
        return this.request(CONFIG.ENDPOINTS.MCP, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }
}

// Singleton export
export const api = new ApiClient();
