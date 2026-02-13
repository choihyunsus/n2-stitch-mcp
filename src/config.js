/**
 * N2 Stitch MCP — Configuration Module
 * 
 * Loads configuration from environment variables with sensible defaults.
 * Supports both API Key and gcloud ADC (Application Default Credentials).
 */

// ── Defaults ────────────────────────────────────────────────
const DEFAULT_STITCH_HOST = 'https://stitch.googleapis.com/mcp';

// Auth: tokens expire at 60 min; refresh at 50 for safety margin
const TOKEN_REFRESH_INTERVAL_MS = 50 * 60 * 1000;

// HTTP timeout: generation can take 2–10 min, so 5 min is generous
const HTTP_TIMEOUT_MS = 300_000;

// Retry: exponential backoff for transient network errors
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 15_000;

// Generation polling: recovery after TCP connection drop
const GENERATION_POLL_INTERVAL_MS = 10_000;   // check every 10s
const GENERATION_POLL_TIMEOUT_MS = 12 * 60_000; // give up after 12 min
const GENERATION_INITIAL_WAIT_MS = 5_000;      // wait 5s before first poll

// ── Loader ──────────────────────────────────────────────────
export function loadConfig() {
    return {
        // Stitch API
        stitchHost: process.env.STITCH_HOST || DEFAULT_STITCH_HOST,

        // Auth
        apiKey: process.env.STITCH_API_KEY || '',
        projectId: process.env.STITCH_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '',

        // Feature flags
        debug: process.env.STITCH_DEBUG === '1',

        // Retry
        maxRetries: MAX_RETRIES,
        retryBaseDelayMs: RETRY_BASE_DELAY_MS,
        retryMaxDelayMs: RETRY_MAX_DELAY_MS,

        // HTTP
        httpTimeoutMs: HTTP_TIMEOUT_MS,

        // Token refresh
        tokenRefreshIntervalMs: TOKEN_REFRESH_INTERVAL_MS,

        // Generation polling
        generationPollIntervalMs: GENERATION_POLL_INTERVAL_MS,
        generationPollTimeoutMs: GENERATION_POLL_TIMEOUT_MS,
        generationInitialWaitMs: GENERATION_INITIAL_WAIT_MS,
    };
}

export function useApiKey(config) {
    return !!config.apiKey;
}
