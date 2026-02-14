// ═══════════════════════════════════════════════════════════
// N2 Cloud — Login Page (login.js)
// Split layout: branding + OAuth login
// ═══════════════════════════════════════════════════════════

import { Toast, footer, initInteractions } from '../components.js';
import { api } from '../api.js';

export function renderLogin() {
  const html = `
    <section class="login-page">
      <div class="container">
        <div class="login-split animate-fade-in">
          <!-- Brand Side -->
          <div class="login-brand">
            <div class="login-brand__logo"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -6px;"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg> N2 Cloud</div>
            <h2 class="login-brand__title">
              Welcome back,<br>
              <span class="text-gradient">Developer</span>
            </h2>
            <p class="login-brand__desc">
              Access your dashboard, manage API keys, and monitor usage — all in one place.
            </p>
            <ul class="login-brand__features">
              <li>Real-time usage analytics</li>
              <li>Manage multiple API keys</li>
              <li>Team collaboration tools</li>
              <li>Billing & invoice history</li>
            </ul>
          </div>

          <!-- Form Side -->
          <div class="login-form">
            <h2 class="login-form__title">Sign In</h2>
            <p class="login-form__subtitle">Choose your preferred login method</p>

            <!-- OAuth Login Buttons -->
            <div class="oauth-buttons">
              <a href="/auth/github" class="oauth-btn oauth-btn--github" id="btn-github">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>Continue with GitHub</span>
              </a>
              <a href="/auth/google" class="oauth-btn oauth-btn--google" id="btn-google">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </a>
            </div>

            <div class="divider">or continue with API key</div>

            <form id="login-form" autocomplete="off">
              <div class="input-group">
                <label class="input-label">API Key</label>
                <div class="input-wrapper">
                  <input class="input" type="password" id="login-key"
                    placeholder="n2_sk_live_..." required>
                  <button type="button" class="input-toggle" id="toggle-login-key"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button>
                </div>
              </div>

              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-6);">
                <label style="display:flex; align-items:center; gap:var(--space-2); font-size:var(--font-size-sm); color:var(--text-secondary); cursor:pointer;">
                  <input type="checkbox" id="remember-key" style="accent-color:var(--accent-blue);">
                  Remember me
                </label>
                <a href="#" style="font-size:var(--font-size-sm);">Forgot key?</a>
              </div>

              <button type="submit" class="btn btn--primary btn--full btn--lg" id="login-submit">
                Sign In →
              </button>
            </form>

            <div class="login-form__footer">
              <p style="color:var(--text-secondary); font-size:var(--font-size-sm);">
                Don't have a key?
                <a data-navigate="#get-key" style="font-weight:var(--font-weight-semibold);">Get one free</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    ${footer()}
  `;

  setTimeout(() => {
    _initLogin();
    _checkOAuthUser();
    initInteractions();
  }, 50);

  return html;
}

function _initLogin() {
  const form = document.getElementById('login-form');
  const toggleKey = document.getElementById('toggle-login-key');

  // Toggle visibility
  toggleKey?.addEventListener('click', () => {
    const input = document.getElementById('login-key');
    if (input.type === 'password') {
      input.type = 'text';
      toggleKey.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
    } else {
      input.type = 'password';
      toggleKey.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
  });

  // Pre-fill if key exists
  const existingKey = api.getApiKey();
  if (existingKey) {
    const input = document.getElementById('login-key');
    if (input) input.value = existingKey;
  }

  // Form submit (API key login)
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('login-key').value.trim();
    const remember = document.getElementById('remember-key').checked;
    const submitBtn = document.getElementById('login-submit');

    if (!key) {
      Toast.show('Please enter your API key', 'error');
      return;
    }

    if (!key.startsWith('n2_sk_')) {
      Toast.show('Invalid key format. Keys start with n2_sk_', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Signing in...';

    try {
      api.setApiKey(key);
      await new Promise(r => setTimeout(r, 800));

      Toast.show('Welcome back!', 'success');

      if (remember) {
        localStorage.setItem('n2_api_key', key);
      }

      setTimeout(() => {
        window.location.hash = '#billing';
      }, 500);
    } catch (err) {
      Toast.show('Authentication failed: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign In →';
    }
  });
}

// Check if user is already authenticated via OAuth
async function _checkOAuthUser() {
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    if (data.authenticated) {
      // Auto-redirect to dashboard
      Toast.show(`Welcome back, ${data.user.name}!`, 'success');
      api.setApiKey(data.user.n2ApiKey);
      localStorage.setItem('n2_api_key', data.user.n2ApiKey);
      setTimeout(() => {
        window.location.hash = '#billing';
      }, 500);
    }
  } catch {
    // Not authenticated, show login form
  }
}
