// ═══════════════════════════════════════════════════════════
// N2 Cloud — Get API Key Page (get-key.js)
// Registration form + success state
// ═══════════════════════════════════════════════════════════

import { CONFIG, BillingPeriod } from '../config.js';
import { Toast, codeBlock, copyToClipboard, footer, initInteractions } from '../components.js';
import { api } from '../api.js';

export function renderGetKey() {
  const html = `
    <section class="getkey-page">
      <div class="container">
        <div class="card getkey-card" id="getkey-form-card">
          <div class="getkey-card__header">
            <div class="getkey-card__icon" style="color: var(--accent-blue-light);"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg></div>
            <h1 class="getkey-card__title">Get Your API Key</h1>
            <p class="getkey-card__desc">Start using Google Stitch through N2 Cloud in seconds.</p>
          </div>

          <!-- Billing Period Toggle -->
          <div class="pricing-toggle" id="getkey-pricing-toggle" style="margin-bottom: var(--space-4);">
            <span class="pricing-toggle__label active" data-period="monthly">Monthly</span>
            <div class="pricing-toggle__switch" id="getkey-pricing-switch"></div>
            <span class="pricing-toggle__label" data-period="yearly">Yearly <span class="badge badge--green">Save 18%</span></span>
          </div>

          <!-- Plan Selection -->
          <div class="plan-selector" id="plan-selector">
            ${Object.entries(CONFIG.PLANS).map(([key, plan]) => `
              <div class="plan-option ${key === 'free' ? 'selected' : ''}" data-plan="${key}">
                <div class="plan-option__name">${plan.name}</div>
                <div class="plan-option__price">${BillingPeriod.isYearly ? plan.priceYearly : plan.price}</div>
                <div class="plan-option__period">${BillingPeriod.isYearly ? '/year' : plan.period}</div>
              </div>
            `).join('')}
          </div>

          <!-- Form -->
          <form id="getkey-form" autocomplete="off">
            <div class="input-group">
              <label class="input-label">Name <span class="required">*</span></label>
              <input class="input" type="text" id="key-name" placeholder="Your name or project name" required>
            </div>

            <div class="input-group">
              <label class="input-label">Email <span class="required">*</span></label>
              <input class="input" type="email" id="key-email" placeholder="you@example.com" required>
            </div>

            <div class="input-group">
              <label class="input-label">Your Stitch API Key <span style="color:var(--text-muted)">(optional)</span></label>
              <div class="input-wrapper">
                <input class="input" type="password" id="key-stitch" placeholder="Bring Your Own Key (BYOK)">
                <button type="button" class="input-toggle" id="toggle-stitch"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button>
              </div>
              <p class="input-help">If provided, your key will be encrypted with AES-256 and used for Stitch API calls.</p>
            </div>

            <button type="submit" class="btn btn--primary btn--full btn--lg" id="getkey-submit">
              Generate API Key →
            </button>

            <p style="text-align:center; margin-top: var(--space-4);">
              <span style="font-size: var(--font-size-xs); color: var(--text-muted);">
                By creating a key you agree to our Terms of Service.
              </span>
            </p>
          </form>
        </div>

        <!-- Success State (hidden by default) -->
        <div class="card getkey-card" id="getkey-success" style="display:none">
          <div class="success-state">
            <div class="success-state__icon">✓</div>
            <h2 style="font-size:var(--font-size-xl); font-weight:var(--font-weight-bold); margin-bottom:var(--space-2);">
              API Key Generated!
            </h2>
            <p style="color:var(--text-secondary); font-size:var(--font-size-sm); margin-bottom:var(--space-6);">
              Keep this key safe — you won't be able to see it again.
            </p>

            <div class="success-state__key">
              <span class="key-text" id="generated-key"></span>
              <button class="btn btn--ghost btn--sm" id="copy-key-btn">Copy</button>
            </div>

            <div class="alert alert--warning" style="margin:var(--space-6) 0; text-align:left;">
              <span class="alert__icon">⚠️</span>
              <div>
                <strong>Save your API key now!</strong><br>
                This is the only time your full key will be displayed.
              </div>
            </div>

            <h3 style="text-align:left; font-size:var(--font-size-base); margin-bottom:var(--space-3); margin-top:var(--space-8);">
              MCP Configuration
            </h3>
            <div id="mcp-config-code"></div>

            <div style="display:flex; gap:var(--space-3); margin-top:var(--space-8);">
              <a class="btn btn--primary btn--lg" data-navigate="#docs" style="flex:1;">Read Docs</a>
              <a class="btn btn--secondary btn--lg" data-navigate="#landing" style="flex:1;">Back Home</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    ${footer()}
  `;

  setTimeout(() => {
    _initForm();
    initInteractions();
  }, 50);

  return html;
}

function _initForm() {
  const form = document.getElementById('getkey-form');
  const planSelector = document.getElementById('plan-selector');
  const toggleStitch = document.getElementById('toggle-stitch');
  let selectedPlan = 'free';
  // Sync initial UI with shared state
  const periodToggle = document.getElementById('getkey-pricing-switch');
  if (periodToggle) {
    const yr = BillingPeriod.isYearly;
    periodToggle.classList.toggle('active', yr);
    document.querySelectorAll('#getkey-pricing-toggle .pricing-toggle__label').forEach(label => {
      label.classList.toggle('active', (label.dataset.period === 'yearly') === yr);
    });

    periodToggle.addEventListener('click', () => {
      const isYearly = BillingPeriod.toggle();
      periodToggle.classList.toggle('active', isYearly);

      // Update toggle labels
      document.querySelectorAll('#getkey-pricing-toggle .pricing-toggle__label').forEach(label => {
        label.classList.toggle('active', (label.dataset.period === 'yearly') === isYearly);
      });

      // Update plan option prices
      planSelector.querySelectorAll('.plan-option').forEach(option => {
        const planKey = option.dataset.plan;
        const plan = CONFIG.PLANS[planKey];
        if (plan) {
          option.querySelector('.plan-option__price').textContent = isYearly ? plan.priceYearly : plan.price;
          option.querySelector('.plan-option__period').textContent = isYearly ? '/year' : plan.period;
        }
      });
    });
  }

  // Plan selector
  planSelector?.addEventListener('click', (e) => {
    const option = e.target.closest('.plan-option');
    if (!option) return;
    planSelector.querySelectorAll('.plan-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    selectedPlan = option.dataset.plan;
  });

  // Toggle password visibility
  toggleStitch?.addEventListener('click', () => {
    const input = document.getElementById('key-stitch');
    if (input.type === 'password') {
      input.type = 'text';
      toggleStitch.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
    } else {
      input.type = 'password';
      toggleStitch.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
  });

  // Form submit
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('getkey-submit');
    const name = document.getElementById('key-name').value.trim();
    const email = document.getElementById('key-email').value.trim();
    const stitchKey = document.getElementById('key-stitch').value.trim();

    if (!name || !email) {
      Toast.show('Please fill in all required fields', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Generating...';

    try {
      const result = await api.createKey({
        name,
        email,
        plan: selectedPlan,
        stitchKey: stitchKey || undefined,
      });

      // Show success state
      _showSuccess(result.apiKey || result.key || 'n2_sk_live_demo_key');
    } catch (err) {
      // Demo mode: show success with demo key
      _showSuccess('n2_sk_live_' + _randomString(32));
      Toast.show('Demo mode: Key generated locally', 'info');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Generate API Key →';
    }
  });
}

function _showSuccess(apiKey) {
  const formCard = document.getElementById('getkey-form-card');
  const successCard = document.getElementById('getkey-success');
  const keyDisplay = document.getElementById('generated-key');
  const configCode = document.getElementById('mcp-config-code');
  const copyBtn = document.getElementById('copy-key-btn');

  if (formCard) formCard.style.display = 'none';
  if (successCard) successCard.style.display = 'block';
  if (keyDisplay) keyDisplay.textContent = apiKey;

  // Save key
  api.setApiKey(apiKey);

  // MCP config code block
  if (configCode) {
    configCode.innerHTML = codeBlock(`{
  "mcpServers": {
    "n2-stitch": {
      "url": "https://cloud.nton2.com/mcp",
      "headers": {
        "X-API-Key": "${apiKey}"
      }
    }
  }
}`, 'json');

    // Init copy buttons for code block
    initInteractions();
  }

  // Copy key button
  copyBtn?.addEventListener('click', () => {
    copyToClipboard(apiKey, copyBtn);
  });
}

function _randomString(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
