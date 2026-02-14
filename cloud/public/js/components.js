// ═══════════════════════════════════════════════════════════
// N2 Cloud — Shared Components (components.js)
// Reusable HTML component generators
// ═══════════════════════════════════════════════════════════

import { CONFIG } from './config.js';

/** Toast notification system */
export const Toast = {
  show(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✓', error: '✕', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span>${icons[type] || ''}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
};

/** Copy text to clipboard */
export async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 2000);
    }
    Toast.show('Copied to clipboard!');
  } catch {
    Toast.show('Failed to copy', 'error');
  }
}

/** Generate a code block with copy button */
export function codeBlock(code, lang = 'json') {
  const id = 'cb-' + Math.random().toString(36).substr(2, 6);
  return `
    <div class="code-block">
      <div class="code-block__header">
        <div class="code-block__dots">
          <span class="code-block__dot code-block__dot--red"></span>
          <span class="code-block__dot code-block__dot--yellow"></span>
          <span class="code-block__dot code-block__dot--green"></span>
        </div>
        <span class="code-block__lang">${lang}</span>
        <button class="code-block__copy" data-copy-target="${id}">Copy</button>
      </div>
      <div class="code-block__body">
        <pre id="${id}">${escapeHtml(code.trim())}</pre>
      </div>
    </div>
  `;
}

/** Render a feature card */
export function featureCard({ icon, iconClass, title, desc }) {
  return `
    <div class="card animate-slide-up">
      <div class="card__icon card__icon--${iconClass}">${icon}</div>
      <h3 class="card__title">${title}</h3>
      <p class="card__desc">${desc}</p>
    </div>
  `;
}

/** Render a pricing card */
export function pricingCard({ name, price, priceYearly, period, features, cta, featured, badge }, yearly = false, planKey = '') {
  const displayPrice = yearly ? priceYearly : price;
  const displayPeriod = yearly ? '/year' : period;
  return `
    <div class="card pricing-card ${featured ? 'card--featured' : ''} animate-slide-up">
      ${badge ? `<div class="pricing-card__badge">${badge}</div>` : ''}
      <h3 class="pricing-card__name">${name}</h3>
      <div class="pricing-card__price">${displayPrice}</div>
      <div class="pricing-card__period">${displayPeriod}</div>
      <ul class="pricing-card__features">
        ${features.map(f => `<li>${f}</li>`).join('')}
      </ul>
      <a class="btn ${featured ? 'btn--primary' : 'btn--secondary'} btn--full btn--lg" data-navigate="#get-key" data-plan-key="${planKey}">${cta}</a>
    </div>
  `;
}

/** Render an FAQ item */
export function faqItem({ q, a }, index) {
  return `
    <div class="faq-item" data-faq="${index}">
      <button class="faq-question">
        <span>${q}</span>
        <span class="faq-arrow">▼</span>
      </button>
      <div class="faq-answer">
        <p>${a}</p>
      </div>
    </div>
  `;
}

/** Render step item */
export function stepItem({ num, title, desc }) {
  return `
    <div class="step animate-slide-up">
      <div class="step__number">${num}</div>
      <h4 class="step__title">${title}</h4>
      <p class="step__desc">${desc}</p>
    </div>
  `;
}

/** Footer component */
export function footer() {
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer__grid">
          <div>
            <div class="footer__brand-name"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -4px;"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg> N2 Cloud</div>
            <p class="footer__brand-desc">
              Cloud MCP proxy for Google Stitch API.
              Zero setup, instant access, enterprise security.
            </p>
          </div>
          <div>
            <h4 class="footer__heading">Product</h4>
            <ul class="footer__links">
              <li><a data-navigate="#landing">Features</a></li>
              <li><a data-navigate="#billing">Pricing</a></li>
              <li><a data-navigate="#docs">Documentation</a></li>
              <li><a data-navigate="#get-key">Get API Key</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer__heading">Resources</h4>
            <ul class="footer__links">
              <li><a data-navigate="#docs">Quick Start</a></li>
              <li><a data-navigate="#docs">API Reference</a></li>
              <li><a href="${CONFIG.SOCIAL.github}" target="_blank">GitHub</a></li>
              <li><a href="${CONFIG.SOCIAL.npm}" target="_blank">NPM</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer__heading">Company</h4>
            <ul class="footer__links">
              <li><a href="https://nton2.com" target="_blank">N2 Official Site</a></li>
              <li><a href="mailto:nton2@nton2.com">Contact</a></li>
              <li><a href="${CONFIG.SOCIAL.github}/issues" target="_blank">Report Issue</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div class="footer__bottom">
          <span>© ${new Date().getFullYear()} N2 Cloud. All rights reserved.</span>
          <div class="footer__socials">
            <a href="${CONFIG.SOCIAL.github}" target="_blank" title="GitHub">⬡</a>
            <a href="${CONFIG.SOCIAL.npm}" target="_blank" title="NPM">▣</a>
            <a href="${CONFIG.SOCIAL.discord}" title="Discord">◉</a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

/** Escape HTML */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Initialize copy buttons and FAQ accordions after render */
export function initInteractions() {
  // Copy buttons
  document.querySelectorAll('[data-copy-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.copyTarget);
      if (target) copyToClipboard(target.textContent, btn);
    });
  });

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    question?.addEventListener('click', () => {
      // Close others
      document.querySelectorAll('.faq-item.open').forEach(other => {
        if (other !== item) other.classList.remove('open');
      });
      item.classList.toggle('open');
    });
  });

  // Intersection Observer for scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.animate-slide-up, .animate-fade-in').forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });
}
