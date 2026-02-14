// ═══════════════════════════════════════════════════════════
// N2 Cloud — Billing Page (billing.js)
// Current plan, usage, pricing comparison, billing history
// ═══════════════════════════════════════════════════════════

import { CONFIG, BillingPeriod } from '../config.js';
import { Toast, pricingCard, footer, initInteractions } from '../components.js';
import { api } from '../api.js';

export function renderBilling() {
  const isAuth = api.isAuthenticated();

  const html = `
    <section class="billing-page">
      <div class="container">
        <div class="section__header" style="margin-bottom:var(--space-10);">
          <div class="section__badge">Account</div>
          <h1 class="section__title">Billing & Plans</h1>
          <p class="section__subtitle">Manage your subscription and monitor usage.</p>
        </div>

        ${isAuth ? _renderDashboard() : _renderPricingOnly()}
      </div>
    </section>

    ${footer()}
  `;

  setTimeout(() => {
    initInteractions();
    _initBillingPricingToggle();
    if (isAuth) _initBillingDashboard();
  }, 50);

  return html;
}

function _renderDashboard() {
  return `
    <!-- Current Plan Banner -->
    <div class="billing-header animate-fade-in">
      <div class="billing-header__plan">
        <div>
          <span class="badge badge--blue">Current Plan</span>
          <h3 class="billing-header__plan-name" style="margin-top:var(--space-2);" id="current-plan">Free</h3>
        </div>
        <a class="btn btn--primary" data-navigate="#get-key">Upgrade</a>
      </div>
      <div class="billing-usage" id="usage-grid">
        <div class="billing-usage__item">
          <div class="billing-usage__label">Stitch Generations</div>
          <div class="billing-usage__value" id="usage-stitch">0 / 50</div>
          <div class="progress"><div class="progress__bar" style="width:0%"></div></div>
        </div>
        <div class="billing-usage__item">
          <div class="billing-usage__label">Search Queries</div>
          <div class="billing-usage__value" id="usage-search">0 / 500</div>
          <div class="progress"><div class="progress__bar" style="width:0%"></div></div>
        </div>
      </div>
    </div>

    <!-- Plan Comparison -->
    <div style="margin-top:var(--space-10);">
      <h2 style="font-size:var(--font-size-xl); font-weight:var(--font-weight-bold); margin-bottom:var(--space-6); text-align:center;">
        Available Plans
      </h2>
      <div class="pricing-toggle" id="billing-pricing-toggle">
        <span class="pricing-toggle__label active" data-period="monthly">Monthly</span>
        <div class="pricing-toggle__switch" id="billing-pricing-switch"></div>
        <span class="pricing-toggle__label" data-period="yearly">Yearly <span class="badge badge--green">Save 18%</span></span>
      </div>
      <div class="grid grid--3" id="billing-pricing-grid">
        ${Object.entries(CONFIG.PLANS).map(([k, p]) => pricingCard(p, BillingPeriod.isYearly, k)).join('')}
      </div>
    </div>

    <!-- Billing History -->
    <div class="billing-history" style="margin-top:var(--space-10);">
      <h2 style="font-size:var(--font-size-xl); font-weight:var(--font-weight-bold); margin-bottom:var(--space-6);">
        Billing History
      </h2>
      <div class="card card--flat" style="padding:0; overflow:hidden;">
        <table class="billing-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="billing-history-body">
            <tr>
              <td colspan="4" style="text-align:center; padding:var(--space-10); color:var(--text-muted);">
                No billing history yet. You're on the free plan!
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function _renderPricingOnly() {
  return `
    <div class="alert alert--warning" style="margin-bottom:var(--space-8);">
      <span class="alert__icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg></span>
      <div>
        <strong>Not signed in.</strong>
        <a data-navigate="#login">Sign in</a> to view your usage and manage your plan.
      </div>
    </div>

    <div class="pricing-toggle" id="billing-pricing-toggle">
      <span class="pricing-toggle__label active" data-period="monthly">Monthly</span>
      <div class="pricing-toggle__switch" id="billing-pricing-switch"></div>
      <span class="pricing-toggle__label" data-period="yearly">Yearly <span class="badge badge--green">Save 18%</span></span>
    </div>
    <div class="grid grid--3" id="billing-pricing-grid">
      ${Object.entries(CONFIG.PLANS).map(([k, p]) => pricingCard(p, BillingPeriod.isYearly, k)).join('')}
    </div>
  `;
}

async function _initBillingDashboard() {
  // Note: _initBillingPricingToggle() is already called by renderBilling() setTimeout
  // Skip admin-only usage API if no admin secret (avoids 403 console error)
  if (!api.adminSecret) return;
  try {
    const usage = await api.getUsage(api.getApiKey());
    if (usage) {
      _updateUsageDisplay(usage);
    }
  } catch {
    // Demo data — already showing defaults
  }
}

function _initBillingPricingToggle() {
  const toggle = document.getElementById('billing-pricing-switch');
  const grid = document.getElementById('billing-pricing-grid');
  if (!toggle || !grid) return;

  // Sync initial UI with shared state
  const yr = BillingPeriod.isYearly;
  toggle.classList.toggle('active', yr);
  document.querySelectorAll('#billing-pricing-toggle .pricing-toggle__label').forEach(label => {
    label.classList.toggle('active', (label.dataset.period === 'yearly') === yr);
  });

  // Re-render pricing cards to match toggle state
  if (yr) {
    grid.innerHTML = Object.entries(CONFIG.PLANS)
      .map(([k, p]) => pricingCard(p, true, k))
      .join('');
    initInteractions();
  }

  toggle.addEventListener('click', () => {
    const yearly = BillingPeriod.toggle();
    toggle.classList.toggle('active', yearly);

    // Update labels
    document.querySelectorAll('#billing-pricing-toggle .pricing-toggle__label').forEach(label => {
      label.classList.toggle('active', (label.dataset.period === 'yearly') === yearly);
    });

    // Re-render pricing cards
    grid.innerHTML = Object.entries(CONFIG.PLANS)
      .map(([k, p]) => pricingCard(p, yearly, k))
      .join('');

    initInteractions();
  });
}

function _updateUsageDisplay(usage) {
  const stitchEl = document.getElementById('usage-stitch');
  const searchEl = document.getElementById('usage-search');

  if (stitchEl && usage.stitch_used !== undefined) {
    const limit = usage.stitch_limit || 50;
    const used = usage.stitch_used || 0;
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    stitchEl.textContent = `${used} / ${limit === -1 ? '∞' : limit}`;
    const bar = stitchEl.closest('.billing-usage__item')?.querySelector('.progress__bar');
    if (bar) {
      bar.style.width = pct + '%';
      if (pct > 80) bar.classList.add('progress__bar--warning');
    }
  }

  if (searchEl && usage.search_used !== undefined) {
    const limit = usage.search_limit || 500;
    const used = usage.search_used || 0;
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    searchEl.textContent = `${used} / ${limit === -1 ? '∞' : limit}`;
    const bar = searchEl.closest('.billing-usage__item')?.querySelector('.progress__bar');
    if (bar) {
      bar.style.width = pct + '%';
      if (pct > 80) bar.classList.add('progress__bar--warning');
    }
  }
}
