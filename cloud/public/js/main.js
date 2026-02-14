// ═══════════════════════════════════════════════════════════
// N2 Cloud — Main Entry Point (main.js)
// Initializes router, nav, auth state, and global interactions
// ═══════════════════════════════════════════════════════════

import { Router } from './router.js?v=10';
import { renderLanding } from './pages/landing.js?v=10';
import { renderGetKey } from './pages/get-key.js?v=10';
import { renderDocs } from './pages/docs.js?v=10';
import { renderLogin } from './pages/login.js?v=10';
import { renderBilling } from './pages/billing.js?v=10';
import { renderDashboard, initDashboardEvents } from './pages/dashboard.js?v=10';

// ── Auth State ──────────────────────────────────
let currentUser = null;

async function checkAuth() {
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();
        if (data.authenticated) {
            currentUser = data.user;
        } else {
            currentUser = null;
        }
    } catch {
        currentUser = null;
    }
    _updateNavForAuth();
    return currentUser;
}

function _updateNavForAuth() {
    const navActions = document.querySelector('.nav__actions');
    if (!navActions) return;

    // Remove existing auth-related buttons
    navActions.querySelectorAll('[data-auth-btn]').forEach(el => el.remove());

    const hamburger = navActions.querySelector('.nav__hamburger');

    if (currentUser) {
        // Logged in → show user avatar + dropdown
        const userMenu = document.createElement('div');
        userMenu.className = 'nav__user-menu';
        userMenu.setAttribute('data-auth-btn', '');
        userMenu.innerHTML = `
            <button class="nav__user-trigger" id="nav-user-trigger">
                <img class="nav__user-avatar" src="${currentUser.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.name) + '&background=4f6bff&color=fff&size=32'}" 
                     alt="${currentUser.name}" />
                <span class="nav__user-name hide-mobile">${currentUser.name.split(' ')[0]}</span>
                <svg class="nav__user-chevron" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
            </button>
            <div class="nav__dropdown" id="nav-dropdown">
                <div class="nav__dropdown-header">
                    <img class="nav__dropdown-avatar" src="${currentUser.avatar || ''}" alt="" />
                    <div>
                        <div class="nav__dropdown-name">${currentUser.name}</div>
                        <div class="nav__dropdown-email">${currentUser.email || ''}</div>
                    </div>
                </div>
                <div class="nav__dropdown-divider"></div>
                <a class="nav__dropdown-item" data-navigate="#dashboard">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Dashboard
                </a>
                <a class="nav__dropdown-item" data-navigate="#billing">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> Billing
                </a>
                <a class="nav__dropdown-item" data-navigate="#docs">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> Docs
                </a>
                <div class="nav__dropdown-divider"></div>
                <a class="nav__dropdown-item nav__dropdown-item--danger" href="/auth/logout">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg> Sign Out
                </a>
            </div>
        `;
        navActions.insertBefore(userMenu, hamburger);

        // Toggle dropdown
        const trigger = userMenu.querySelector('#nav-user-trigger');
        const dropdown = userMenu.querySelector('#nav-dropdown');
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
        });
    } else {
        // Not logged in → show Sign In + Get API Key
        const signInBtn = document.createElement('a');
        signInBtn.className = 'btn btn--ghost hide-mobile';
        signInBtn.setAttribute('data-navigate', '#login');
        signInBtn.setAttribute('data-auth-btn', '');
        signInBtn.textContent = 'Sign In';

        const getKeyBtn = document.createElement('a');
        getKeyBtn.className = 'btn btn--primary';
        getKeyBtn.setAttribute('data-navigate', '#get-key');
        getKeyBtn.setAttribute('data-auth-btn', '');
        getKeyBtn.textContent = 'Get API Key';

        navActions.insertBefore(signInBtn, hamburger);
        navActions.insertBefore(getKeyBtn, hamburger);
    }

    // Update mobile menu
    _updateMobileMenuAuth();
}

function _updateMobileMenuAuth() {
    const mobileMenu = document.getElementById('nav-mobile-menu');
    if (!mobileMenu) return;

    // Remove old auth link
    mobileMenu.querySelectorAll('[data-auth-mobile]').forEach(el => el.remove());

    if (currentUser) {
        const dashLink = document.createElement('a');
        dashLink.className = 'nav__link';
        dashLink.setAttribute('data-navigate', '#dashboard');
        dashLink.setAttribute('data-auth-mobile', '');
        dashLink.textContent = 'Dashboard';
        mobileMenu.appendChild(dashLink);

        const logoutLink = document.createElement('a');
        logoutLink.className = 'nav__link';
        logoutLink.href = '/auth/logout';
        logoutLink.setAttribute('data-auth-mobile', '');
        logoutLink.textContent = 'Sign Out';
        mobileMenu.appendChild(logoutLink);
    } else {
        const signInLink = document.createElement('a');
        signInLink.className = 'nav__link';
        signInLink.setAttribute('data-navigate', '#login');
        signInLink.setAttribute('data-auth-mobile', '');
        signInLink.textContent = 'Sign In';
        mobileMenu.appendChild(signInLink);
    }
}

// ── Initialize App ──────────────────────────────
async function init() {
    const container = document.getElementById('app-content');
    if (!container) {
        console.error('[N2 Cloud] #app-content not found');
        return;
    }

    // Check auth state first
    await checkAuth();

    // Create router
    const router = new Router(container);

    // Register routes
    router
        .register('#landing', renderLanding)
        .register('#get-key', renderGetKey)
        .register('#docs', renderDocs)
        .register('#login', renderLogin)
        .register('#billing', renderBilling)
        .register('#dashboard', renderDashboard);

    // After navigation hooks
    router.after((hash) => {
        _updateNavScroll();
        // Init dashboard events after render
        if (hash === '#dashboard') {
            setTimeout(() => initDashboardEvents(), 100);
        }
    });

    // Handle OAuth callback redirect
    const params = new URLSearchParams(window.location.search);
    if (params.has('login') && params.get('login') === 'success') {
        // Clean URL and go to dashboard
        window.history.replaceState({}, '', '/');
        await checkAuth();
        window.location.hash = '#dashboard';
    }

    // Start
    router.start();

    // Global: nav scroll effect
    _initNavScroll();

    // Global: hamburger toggle
    _initHamburger();



    console.log('[N2 Cloud] initialized', currentUser ? `(logged in as ${currentUser.name})` : '(not logged in)');
}

// ── Nav Scroll Effect ───────────────────────────
function _initNavScroll() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                _updateNavScroll();
                ticking = false;
            });
            ticking = true;
        }
    });
}

function _updateNavScroll() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 20);
}

// ── Mobile Hamburger ────────────────────────────
function _initHamburger() {
    const hamburger = document.getElementById('nav-hamburger');
    const mobileMenu = document.getElementById('nav-mobile-menu');

    hamburger?.addEventListener('click', () => {
        mobileMenu?.classList.toggle('open');
        // Animate hamburger
        hamburger.classList.toggle('active');
    });

    // Close on link click
    mobileMenu?.addEventListener('click', (e) => {
        if (e.target.closest('.nav__link')) {
            mobileMenu.classList.remove('open');
            hamburger?.classList.remove('active');
        }
    });
}



// ── Bootstrap ───────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
