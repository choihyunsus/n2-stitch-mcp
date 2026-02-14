// ═══════════════════════════════════════════════════════════
// N2 Cloud — Hash Router (router.js)
// Lightweight SPA routing with hash navigation
// ═══════════════════════════════════════════════════════════

import { BillingPeriod } from './config.js';

export class Router {
    constructor(container) {
        this.container = container;
        this.routes = {};
        this.currentRoute = null;
        this.beforeHooks = [];
        this.afterHooks = [];

        window.addEventListener('hashchange', () => this._onHashChange());
        document.addEventListener('click', (e) => this._handleNavClick(e));
    }

    /** Register a route with its render function */
    register(hash, renderFn) {
        this.routes[hash] = renderFn;
        return this;
    }

    /** Add before-navigation hook */
    before(fn) {
        this.beforeHooks.push(fn);
        return this;
    }

    /** Add after-navigation hook */
    after(fn) {
        this.afterHooks.push(fn);
        return this;
    }

    /** Start the router */
    start() {
        const hash = window.location.hash || '#landing';
        if (!window.location.hash) {
            window.location.hash = '#landing';
        } else {
            this._navigate(hash);
        }
    }

    /** Navigate to a hash */
    go(hash) {
        window.location.hash = hash;
    }

    /** Internal: handle hash change */
    _onHashChange() {
        const hash = window.location.hash || '#landing';
        this._navigate(hash);
    }

    /** Internal: perform navigation */
    async _navigate(hash) {
        // Extract base route (e.g., #docs/quickstart → #docs)
        const baseHash = '#' + hash.replace('#', '').split('/')[0];
        const renderFn = this.routes[baseHash];

        if (!renderFn) {
            // Fallback to landing
            this._navigate('#landing');
            return;
        }

        // Before hooks
        for (const hook of this.beforeHooks) {
            const result = await hook(baseHash, this.currentRoute);
            if (result === false) return;
        }

        const prevRoute = this.currentRoute;
        this.currentRoute = baseHash;

        // Add exit animation
        if (this.container.firstChild) {
            this.container.classList.add('page-exit');
            await new Promise(r => setTimeout(r, 200));
        }

        // Render
        this.container.innerHTML = '';
        this.container.classList.remove('page-exit');

        try {
            const content = await renderFn(hash);
            if (typeof content === 'string') {
                this.container.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                this.container.appendChild(content);
            }
        } catch (err) {
            console.error('[Router] render error:', err);
            this.container.innerHTML = `<div class="container section text-center">
        <h2>Something went wrong</h2>
        <p style="color:var(--text-secondary)">${err.message}</p>
      </div>`;
        }

        // Add enter animation
        this.container.classList.add('page-enter');
        setTimeout(() => this.container.classList.remove('page-enter'), 500);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Update nav active state
        this._updateNavLinks(baseHash);

        // After hooks
        for (const hook of this.afterHooks) {
            await hook(baseHash, prevRoute);
        }
    }

    /** Internal: handle data-navigate clicks */
    _handleNavClick(e) {
        const target = e.target.closest('[data-navigate]');
        if (!target) return;
        e.preventDefault();
        const hash = target.getAttribute('data-navigate');
        const isLogo = target.closest('.nav__logo');

        // Logo click: always scroll to top
        if (isLogo) {
            if (this.currentRoute === hash) {
                // Same page — just scroll to top (no re-render)
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
            } else {
                // Different page — navigate (which also scrolls to top)
                this.go(hash);
            }
            // Close mobile menu if open
            const mobileMenu = document.getElementById('nav-mobile-menu');
            if (mobileMenu) mobileMenu.classList.remove('open');
            return;
        }

        // Store selected plan if pricing CTA was clicked
        const planKey = target.getAttribute('data-plan-key');
        if (planKey) BillingPeriod.setPlan(planKey);

        this.go(hash);

        // Close mobile menu if open
        const mobileMenu = document.getElementById('nav-mobile-menu');
        if (mobileMenu) mobileMenu.classList.remove('open');
    }

    /** Internal: highlight active nav link */
    _updateNavLinks(hash) {
        document.querySelectorAll('.nav__link').forEach(link => {
            const linkHash = link.getAttribute('data-navigate');
            link.classList.toggle('active', linkHash === hash);
        });
    }
}
