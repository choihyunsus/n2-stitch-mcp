// ═══════════════════════════════════════════════════════════
// N2 Cloud — Landing Page (landing.js)
// ═══════════════════════════════════════════════════════════

import { CONFIG, BillingPeriod } from '../config.js';
import {
  featureCard,
  pricingCard,
  faqItem,
  stepItem,
  codeBlock,
  footer,
  initInteractions,
} from '../components.js';

export function renderLanding() {
  const html = `
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero__orb hero__orb--1"></div>
      <div class="hero__orb hero__orb--2"></div>
      <div class="hero__orb hero__orb--3"></div>
      <div class="container">
        <div class="hero__split">
          <!-- Left: Text -->
          <div class="hero__text">
            <div class="section__badge animate-fade-in"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg> Cloud MCP Proxy</div>
            <h1 class="hero__title animate-fade-in delay-1">
              Google Stitch,<br>
              <span class="accent">Without the Setup Pain</span>
            </h1>
            <p class="hero__subtitle animate-fade-in delay-2">
              ${CONFIG.SERVICE_DESC}
              Start building with Stitch in seconds, not hours.
            </p>
            <div class="hero__actions animate-fade-in delay-3">
              <a class="btn btn--primary btn--lg" data-navigate="#get-key">
                Get Free API Key →
              </a>
              <a class="btn btn--secondary btn--lg" data-navigate="#docs">
                Read Docs
              </a>
            </div>
          </div>

          <!-- Right: Typing Terminal -->
          <div class="hero__terminal animate-fade-in delay-2">
            <div class="terminal">
              <div class="terminal__header">
                <div class="terminal__dots">
                  <span class="terminal__dot terminal__dot--red"></span>
                  <span class="terminal__dot terminal__dot--yellow"></span>
                  <span class="terminal__dot terminal__dot--green"></span>
                </div>
                <span class="terminal__title">claude_desktop_config.json</span>
              </div>
              <div class="terminal__body">
                <pre id="hero-terminal-code"></pre>
                <span class="terminal__cursor" id="hero-cursor">│</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats Bar -->
    <section class="section--sm">
      <div class="container">
        <div class="stats-bar">
          <div class="stat animate-slide-up delay-1">
            <div class="stat__value">99.9%</div>
            <div class="stat__label">Uptime SLA</div>
          </div>
          <div class="stat animate-slide-up delay-2">
            <div class="stat__value">&lt;50ms</div>
            <div class="stat__label">Avg Latency</div>
          </div>
          <div class="stat animate-slide-up delay-3">
            <div class="stat__value">AES-256</div>
            <div class="stat__label">Encryption</div>
          </div>
          <div class="stat animate-slide-up delay-4">
            <div class="stat__value">MCP 1.0</div>
            <div class="stat__label">Protocol</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="section" id="features">
      <div class="container">
        <div class="section__header">
          <div class="section__badge">Features</div>
          <h2 class="section__title">Why choose N2 Cloud?</h2>
          <p class="section__subtitle">
            Everything you need to use Google Stitch without the infrastructure headaches.
          </p>
        </div>
        <div class="grid grid--auto features-grid">
          ${CONFIG.FEATURES.map(f => featureCard(f)).join('')}
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="section section--sm">
      <div class="container">
        <div class="section__header">
          <div class="section__badge">Easy Setup</div>
          <h2 class="section__title">Up and running in 3 steps</h2>
        </div>
        <div class="steps">
          ${CONFIG.STEPS.map(s => stepItem(s)).join('')}
        </div>
      </div>
    </section>

    <!-- Integration Code -->
    <section class="section">
      <div class="container">
        <div class="integration-section">
          <div class="integration-section__text">
            <div class="section__badge">Integration</div>
            <h2 class="section__title">Integrate in Seconds</h2>
            <ul class="integration-steps">
              <li>
                <span class="step-icon">1</span>
                <span>Add the N2 Cloud endpoint to your <strong>claude_desktop_config.json</strong></span>
              </li>
              <li>
                <span class="step-icon">2</span>
                <span>Set your N2 API key in the headers</span>
              </li>
              <li>
                <span class="step-icon">3</span>
                <span>Start using Stitch tools through any MCP client</span>
              </li>
            </ul>
          </div>
          <div>
            ${codeBlock(`{
  "mcpServers": {
    "n2-stitch": {
      "url": "https://cloud.nton2.com/mcp",
      "headers": {
        "X-API-Key": "n2_sk_live_your_key"
      }
    }
  }
}`, 'json')}
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section class="section" id="pricing">
      <div class="container">
        <div class="section__header">
          <div class="section__badge">Pricing</div>
          <h2 class="section__title">Simple, transparent pricing</h2>
          <p class="section__subtitle">Start free. Upgrade when you need more.</p>
        </div>
        <div class="pricing-toggle" id="pricing-toggle">
          <span class="pricing-toggle__label active" data-period="monthly">Monthly</span>
          <div class="pricing-toggle__switch" id="pricing-switch"></div>
          <span class="pricing-toggle__label" data-period="yearly">Yearly <span class="badge badge--green">Save 18%</span></span>
        </div>
        <div class="grid grid--3" id="pricing-grid">
          ${Object.values(CONFIG.PLANS).map(p => pricingCard(p, BillingPeriod.isYearly)).join('')}
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="section">
      <div class="container container--md">
        <div class="section__header">
          <h2 class="section__title">Frequently Asked Questions</h2>
        </div>
        <div class="faq-list">
          ${CONFIG.FAQ.map((f, i) => faqItem(f, i)).join('')}
        </div>
      </div>
    </section>

    ${footer()}
  `;

  // Post-render setup
  setTimeout(() => {
    initInteractions();
    _initPricingToggle();
    _initHeroTerminal();
  }, 50);

  return html;
}

/** Typing terminal animation for hero */
function _initHeroTerminal() {
  const codeEl = document.getElementById('hero-terminal-code');
  const cursor = document.getElementById('hero-cursor');
  if (!codeEl) return;

  const codeText = `{
  "mcpServers": {
    "n2-stitch": {
      "url": "https://cloud.nton2.com/mcp",
      "headers": {
        "X-API-Key": "n2_sk_live_abc123..."
      }
    }
  }
}`;

  let i = 0;
  const speed = 35;

  function type() {
    if (i < codeText.length) {
      codeEl.innerHTML = _syntaxHL(codeText.substring(0, i + 1));
      i++;
      const ch = codeText[i - 1];
      const delay = ch === '\n' ? speed * 4 : ch === ' ' ? speed * 0.5 : speed + Math.random() * 20;
      setTimeout(type, delay);
    } else {
      cursor?.classList.add('blink');
      setTimeout(() => {
        i = 0;
        codeEl.innerHTML = '';
        cursor?.classList.remove('blink');
        setTimeout(type, 800);
      }, 5000);
    }
  }

  setTimeout(type, 1000);
}

/** Simple JSON syntax highlighting */
function _syntaxHL(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]*)"(\s*:)/g, '<span class="syn-key">"$1"</span>$2')
    .replace(/:\s*"([^"]*)"/g, ': <span class="syn-str">"$1"</span>');
}

/** Pricing toggle (monthly/yearly) — uses shared BillingPeriod state */
function _initPricingToggle() {
  const toggle = document.getElementById('pricing-switch');
  const grid = document.getElementById('pricing-grid');
  if (!toggle || !grid) return;

  // Sync initial UI with shared state
  const yr = BillingPeriod.isYearly;
  toggle.classList.toggle('active', yr);
  document.querySelectorAll('#pricing-toggle .pricing-toggle__label').forEach(label => {
    label.classList.toggle('active', (label.dataset.period === 'yearly') === yr);
  });

  toggle.addEventListener('click', () => {
    const yearly = BillingPeriod.toggle();
    toggle.classList.toggle('active', yearly);

    // Update labels
    document.querySelectorAll('#pricing-toggle .pricing-toggle__label').forEach(label => {
      label.classList.toggle('active', (label.dataset.period === 'yearly') === yearly);
    });

    // Re-render pricing cards
    grid.innerHTML = Object.values(CONFIG.PLANS)
      .map(p => pricingCard(p, yearly))
      .join('');

    // Re-init navigate listeners
    initInteractions();
  });
}
