// ═══════════════════════════════════════════════════════════
// N2 Cloud — Dashboard Page (dashboard.js)
// User profile, usage stats, and API key management
// ═══════════════════════════════════════════════════════════

import { Toast } from '../components.js';

export async function renderDashboard() {
    // Check auth status
    let user = null;
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();
        if (data.authenticated) {
            user = data.user;
        }
    } catch { /* ignore */ }

    if (!user) {
        return `
        <section class="section container text-center" style="padding-top: var(--space-32);">
            <div class="glass-card" style="max-width: 480px; margin: auto; padding: var(--space-10);">
                <div style="font-size: 3rem; margin-bottom: var(--space-4); color: var(--accent-blue-light);"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                <h2 style="margin-bottom: var(--space-4);">Sign in to access your dashboard</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Connect with GitHub or Google to manage your API keys and usage.
                </p>
                <a class="btn btn--primary" data-navigate="#login">Sign In</a>
            </div>
        </section>`;
    }

    const planBadge = _planBadge(user.plan);
    const providerIcons = (user.connections || []).map(c => _providerIcon(c.provider)).join('');
    const usage = user.usage || { stitch_calls: 0, search_calls: 0 };
    const stitchLimit = user.plan === 'free' ? 50 : '∞';
    const searchLimit = user.plan === 'free' ? 500 : '∞';
    const stitchPct = user.plan === 'free' ? Math.min(100, (usage.stitch_calls / 50) * 100) : 0;
    const searchPct = user.plan === 'free' ? Math.min(100, (usage.search_calls / 500) * 100) : 0;

    const maskedKey = user.n2ApiKey
        ? user.n2ApiKey.slice(0, 15) + '•'.repeat(16) + user.n2ApiKey.slice(-4)
        : 'No API key';

    return `
    <section class="dashboard section">
        <div class="container">
            <!-- Header -->
            <div class="dashboard__header animate-fade-in">
                <h1 class="dashboard__title">Dashboard</h1>
                <p class="dashboard__subtitle">Welcome back, ${user.name}!</p>
            </div>

            <!-- Profile + Usage Grid -->
            <div class="dashboard__grid">
                <!-- Profile Card -->
                <div class="dashboard__card dashboard__profile animate-fade-in delay-1">
                    <div class="dashboard__profile-top">
                        <img class="dashboard__avatar" 
                             src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=4f6bff&color=fff'}" 
                             alt="${user.name}" />
                        <div class="dashboard__user-info">
                            <h2 class="dashboard__user-name">${user.name}</h2>
                            <p class="dashboard__user-email">${user.email || 'No email'}</p>
                            <div class="dashboard__badges">
                                ${planBadge}
                                ${providerIcons}
                            </div>
                        </div>
                    </div>
                    <div class="dashboard__profile-meta">
                        <div class="dashboard__meta-item">
                            <span class="dashboard__meta-label">Member since</span>
                            <span class="dashboard__meta-value">${_formatDate(user.created_at)}</span>
                        </div>
                        <div class="dashboard__meta-item">
                            <span class="dashboard__meta-label">User ID</span>
                            <span class="dashboard__meta-value code-text">${user.id}</span>
                        </div>
                    </div>
                </div>

                <!-- Usage Card -->
                <div class="dashboard__card dashboard__usage animate-fade-in delay-2">
                    <h3 class="dashboard__card-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px;"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Usage This Month</h3>
                    <div class="dashboard__usage-item">
                        <div class="dashboard__usage-header">
                            <span>Stitch Generations</span>
                            <span class="dashboard__usage-count">${usage.stitch_calls} / ${stitchLimit}</span>
                        </div>
                        <div class="dashboard__progress">
                            <div class="dashboard__progress-bar dashboard__progress-bar--stitch" 
                                 style="width: ${user.plan === 'free' ? stitchPct : 100}%"></div>
                        </div>
                    </div>
                    <div class="dashboard__usage-item">
                        <div class="dashboard__usage-header">
                            <span>Search Queries</span>
                            <span class="dashboard__usage-count">${usage.search_calls} / ${searchLimit}</span>
                        </div>
                        <div class="dashboard__progress">
                            <div class="dashboard__progress-bar dashboard__progress-bar--search" 
                                 style="width: ${user.plan === 'free' ? searchPct : 100}%"></div>
                        </div>
                    </div>
                    ${user.plan === 'free' ? `
                    <a class="btn btn--primary btn--sm" data-navigate="#billing" style="margin-top: var(--space-4); width: 100%;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Upgrade to Pro — Unlimited
                    </a>` : ''}
                </div>
            </div>

            <!-- API Key Card -->
            <div class="dashboard__card dashboard__apikey animate-fade-in delay-3">
                <h3 class="dashboard__card-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px;"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg> Your API Key</h3>
                <div class="dashboard__key-display">
                    <code class="dashboard__key-value" id="dash-api-key">${maskedKey}</code>
                    <div class="dashboard__key-actions">
                        <button class="btn btn--ghost btn--sm" id="dash-toggle-key" title="Show/Hide">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="btn btn--ghost btn--sm" id="dash-copy-key" title="Copy">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        </button>
                    </div>
                </div>
                <p class="dashboard__key-hint">
                    Use this key as Bearer token in your MCP client configuration.
                </p>
            </div>

            <!-- Quick Links -->
            <div class="dashboard__quicklinks animate-fade-in delay-4">
                <a class="dashboard__link glass-card" data-navigate="#docs">
                    <span class="dashboard__link-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
                    <span class="dashboard__link-text">Documentation</span>
                </a>
                <a class="dashboard__link glass-card" data-navigate="#billing">
                    <span class="dashboard__link-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg></span>
                    <span class="dashboard__link-text">Billing & Plans</span>
                </a>
                <a class="dashboard__link glass-card" data-navigate="#get-key">
                    <span class="dashboard__link-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg></span>
                    <span class="dashboard__link-text">API Key Setup</span>
                </a>
                <a class="dashboard__link glass-card" href="/auth/logout">
                    <span class="dashboard__link-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg></span>
                    <span class="dashboard__link-text">Sign Out</span>
                </a>
            </div>
        </div>
    </section>`;
}

// Wire up interactivity after render
export function initDashboardEvents() {
    const keyEl = document.getElementById('dash-api-key');
    const toggleBtn = document.getElementById('dash-toggle-key');
    const copyBtn = document.getElementById('dash-copy-key');

    if (!keyEl) return;

    let revealed = false;
    let fullKey = '';

    // Get full key from /auth/me
    fetch('/auth/me').then(r => r.json()).then(data => {
        if (data.authenticated) fullKey = data.user.n2ApiKey || '';
    });

    toggleBtn?.addEventListener('click', () => {
        revealed = !revealed;
        if (revealed && fullKey) {
            keyEl.textContent = fullKey;
            toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
        } else {
            keyEl.textContent = fullKey
                ? fullKey.slice(0, 15) + '•'.repeat(16) + fullKey.slice(-4)
                : 'No API key';
            toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
    });

    copyBtn?.addEventListener('click', async () => {
        if (!fullKey) return;
        try {
            await navigator.clipboard.writeText(fullKey);
            Toast.show('API key copied to clipboard!', 'success');
        } catch {
            Toast.show('Failed to copy', 'error');
        }
    });
}

// ── Helpers ──────────────────────────────────────────

function _planBadge(plan) {
    const styles = {
        free: 'background: var(--accent-blue-dim); color: var(--accent-blue-light);',
        pro: 'background: var(--accent-purple-dim); color: var(--accent-purple-light);',
        team: 'background: var(--accent-green-dim); color: var(--accent-green-light);',
    };
    return `<span class="badge" style="${styles[plan] || styles.free}">${plan.toUpperCase()}</span>`;
}

function _providerIcon(provider) {
    const icons = { github: '🐙', google: '🔵' };
    return `<span class="badge badge--provider" title="${provider}">${icons[provider] || '🔗'} ${provider}</span>`;
}

function _formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}
