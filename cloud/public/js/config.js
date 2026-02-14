// ═══════════════════════════════════════════════════════════
// N2 Cloud — Configuration (config.js)
// ═══════════════════════════════════════════════════════════

export const CONFIG = {
    // API endpoints
    API_BASE: window.location.origin,
    ENDPOINTS: {
        MCP: '/mcp',
        ADMIN_KEYS: '/admin/keys',
        ADMIN_USAGE: '/admin/usage',
        ADMIN_SESSIONS: '/admin/sessions',
        ADMIN_USERS: '/admin/users',
    },

    // Service info
    SERVICE_NAME: 'N2 Cloud',
    SERVICE_TAGLINE: 'Google Stitch, Without the Setup Pain',
    SERVICE_DESC: 'Zero-config cloud proxy for Google Stitch API. Full MCP compatibility. Auto session recovery.',

    // Plans
    PLANS: {
        free: {
            name: 'Free',
            price: '$0',
            priceYearly: '$0',
            period: '/month',
            features: [
                '50 Stitch generations/month',
                '500 search queries/month',
                '1 API key',
                'Community support',
                'Standard priority',
            ],
            cta: 'Start Free',
        },
        pro: {
            name: 'Pro',
            price: '$5',
            priceYearly: '$49',
            period: '/month',
            featured: true,
            badge: 'MOST POPULAR',
            features: [
                'Unlimited generations',
                'Unlimited search queries',
                '3 API keys',
                'Priority processing',
                'Email support',
                'Usage analytics',
            ],
            cta: 'Go Pro',
        },
        team: {
            name: 'Team',
            price: '$15',
            priceYearly: '$149',
            period: '/month',
            features: [
                'Everything in Pro',
                '5 team members',
                '10 API keys',
                'Team dashboard',
                'Priority support',
                'Custom integrations',
            ],
            cta: 'Start Team',
        },
    },

    // Features
    FEATURES: [
        {
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
            iconClass: 'blue',
            title: 'Zero Setup',
            desc: 'Get your API key and start using Stitch in seconds. No Google Cloud console, no OAuth dance.',
        },
        {
            icon: '🔄',
            iconClass: 'purple',
            title: 'TCP Drop Recovery',
            desc: 'Automatic session recovery when connections drop. Your MCP sessions survive network hiccups.',
        },
        {
            icon: '🛡️',
            iconClass: 'cyan',
            title: 'Enterprise Security',
            desc: 'AES-256 encryption for stored keys. Cloudflare DDoS protection. Rate limiting per plan.',
        },
        {
            icon: '🌐',
            iconClass: 'green',
            title: 'MCP Compatible',
            desc: 'Drop-in replacement for local Stitch. Works with Claude, Cursor, Windsurf, and any MCP client.',
        },
    ],

    // Steps
    STEPS: [
        { num: '1', title: 'Get API Key', desc: 'Register and receive your N2 API key instantly.' },
        { num: '2', title: 'Configure MCP', desc: 'Add the endpoint to your MCP client settings.' },
        { num: '3', title: 'Start Building', desc: 'Generate Stitch designs through the cloud.' },
    ],

    // FAQ
    FAQ: [
        {
            q: 'What is N2 Cloud?',
            a: 'N2 Cloud is a cloud MCP proxy for Google Stitch API. It eliminates the need for local setup — no Google Cloud credentials, no OAuth configuration, no Node.js installation required.',
        },
        {
            q: 'How does pricing work?',
            a: 'We offer a generous free tier with 50 Stitch generations/month. Pro and Team plans provide unlimited usage, priority processing, and team features.',
        },
        {
            q: 'Is my Stitch API key secure?',
            a: 'Yes. All stored API keys are encrypted with AES-256-GCM. Keys are never logged or exposed in responses. We use Cloudflare for DDoS protection and TLS encryption.',
        },
        {
            q: 'Which MCP clients are supported?',
            a: 'N2 Cloud works with any MCP-compatible client including Claude Desktop, Cursor, Windsurf, Cline, and custom implementations using the MCP SDK.',
        },
        {
            q: 'What happens if my connection drops?',
            a: 'N2 Cloud features automatic TCP drop recovery. Your MCP session state is preserved and automatically reconnected when the network is restored.',
        },
    ],

    // Social links
    SOCIAL: {
        github: 'https://github.com/choihyunsus/n2-stitch-mcp',
        npm: 'https://www.npmjs.com/package/n2-stitch-mcp',
        discord: '#',
    },
};

// ── Shared Billing Period State ─────────────────
// All pricing toggles (landing, billing, get-key) share this state.
export const BillingPeriod = {
    _yearly: false,
    _plan: null,
    get isYearly() { return this._yearly; },
    get plan() { return this._plan; },
    toggle() { this._yearly = !this._yearly; return this._yearly; },
    set(val) { this._yearly = !!val; },
    setPlan(key) { this._plan = key; },
    consumePlan() { const p = this._plan; this._plan = null; return p; },
};
