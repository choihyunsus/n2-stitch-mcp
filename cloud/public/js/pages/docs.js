// ═══════════════════════════════════════════════════════════
// N2 Cloud — Documentation Page (docs.js)
// Sidebar + content with code examples
// ═══════════════════════════════════════════════════════════

import { codeBlock, footer, initInteractions } from '../components.js';

const DOCS_SECTIONS = [
  { id: 'quickstart', title: 'Quick Start', group: 'Getting Started' },
  { id: 'installation', title: 'Installation', group: 'Getting Started' },
  { id: 'authentication', title: 'Authentication', group: 'Getting Started' },
  { id: 'mcp-setup', title: 'MCP Setup', group: 'Integration' },
  { id: 'api-reference', title: 'API Reference', group: 'Integration' },
  { id: 'tools', title: 'Available Tools', group: 'Integration' },
  { id: 'plans', title: 'Plans & Limits', group: 'Account' },
  { id: 'security', title: 'Security', group: 'Account' },
  { id: 'troubleshooting', title: 'Troubleshooting', group: 'Support' },
];

export function renderDocs(hash) {
  const subPage = hash.replace('#docs', '').replace('/', '') || 'quickstart';

  const html = `
    <section class="section--sm">
      <div class="container">
        <div class="docs-layout">
          <!-- Sidebar -->
          <aside class="docs-sidebar">
            ${_renderSidebar(subPage)}
          </aside>

          <!-- Content -->
          <div class="docs-content" id="docs-content">
            ${_renderContent(subPage)}
          </div>
        </div>
      </div>
    </section>

    ${footer()}
  `;

  setTimeout(() => {
    initInteractions();
    _initDocsSidebar();
  }, 50);

  return html;
}

function _renderSidebar(activeId) {
  const groups = {};
  DOCS_SECTIONS.forEach(s => {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  });

  return Object.entries(groups).map(([group, sections]) => `
    <div class="docs-sidebar__section">
      <div class="docs-sidebar__heading">${group}</div>
      ${sections.map(s => `
        <a class="docs-sidebar__link ${s.id === activeId ? 'active' : ''}"
           data-doc="${s.id}">${s.title}</a>
      `).join('')}
    </div>
  `).join('');
}

function _renderContent(section) {
  const contents = {
    quickstart: _quickstart,
    installation: _installation,
    authentication: _authentication,
    'mcp-setup': _mcpSetup,
    'api-reference': _apiReference,
    tools: _tools,
    plans: _plans,
    security: _security,
    troubleshooting: _troubleshooting,
  };

  return (contents[section] || contents.quickstart)();
}

function _initDocsSidebar() {
  document.querySelectorAll('.docs-sidebar__link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const docId = link.dataset.doc;
      const content = document.getElementById('docs-content');
      if (content) {
        content.innerHTML = _renderContent(docId);
        initInteractions();
      }
      document.querySelectorAll('.docs-sidebar__link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

// ── Doc content renderers ─────────────────────────

function _quickstart() {
  return `
    <h1>Quick Start</h1>
    <p>Get up and running with N2 Cloud in under 2 minutes.</p>

    <h2>1. Get Your API Key</h2>
    <p>Visit the <a data-navigate="#get-key">API Key page</a> to generate your free key. No credit card required.</p>

    <h2>2. Configure Your MCP Client</h2>
    <p>Add the N2 Cloud endpoint to your MCP client configuration:</p>
    ${codeBlock(`{
  "mcpServers": {
    "n2-stitch": {
      "url": "https://cloud.nton2.com/mcp",
      "headers": {
        "X-API-Key": "n2_sk_live_your_key_here"
      }
    }
  }
}`, 'json')}

    <h2>3. Start Using Stitch</h2>
    <p>That's it! Your MCP client can now access all Stitch tools through N2 Cloud. Try creating a project:</p>
    ${codeBlock(`// In your MCP client, use the Stitch tools:
> Create a new Stitch project called "My App"
> Generate a login screen for a mobile app
> List all my Stitch projects`, 'text')}

    <div class="alert alert--success" style="margin-top: var(--space-6);">
      <span class="alert__icon">✨</span>
      <div><strong>Pro Tip:</strong> N2 Cloud handles session management automatically. If your connection drops, it will recover your session state.</div>
    </div>
  `;
}

function _installation() {
  return `
    <h1>Installation</h1>
    <p>N2 Cloud is a cloud service — no local installation required! Simply configure your MCP client to use our endpoint.</p>

    <h2>Self-Hosting (Optional)</h2>
    <p>If you prefer to self-host the N2 Stitch MCP proxy:</p>
    ${codeBlock(`# Install from NPM
npm install -g n2-stitch-mcp

# Or use npx directly
npx n2-stitch-mcp`, 'bash')}

    <h2>Local Development</h2>
    <p>For local development with the cloud proxy:</p>
    ${codeBlock(`# Clone the repository
git clone https://github.com/nton2/n2-stitch-mcp.git
cd n2-stitch-mcp/cloud

# Install dependencies
npm install

# Start the server
npm start`, 'bash')}

    <h2>Requirements</h2>
    <ul>
      <li>Any MCP-compatible client (Claude Desktop, Cursor, Windsurf, etc.)</li>
      <li>N2 Cloud API key (free tier available)</li>
      <li>Internet connection</li>
    </ul>
  `;
}

function _authentication() {
  return `
    <h1>Authentication</h1>
    <p>N2 Cloud uses API key authentication. Every request must include your API key.</p>

    <h2>API Key Format</h2>
    <p>N2 API keys follow this format:</p>
    ${codeBlock(`n2_sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, 'text')}

    <h2>Using Your Key</h2>
    <p>Include your API key in the <code>X-API-Key</code> header:</p>
    ${codeBlock(`curl -X POST https://cloud.nton2.com/mcp \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: n2_sk_live_your_key" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`, 'bash')}

    <h2>BYOK (Bring Your Own Key)</h2>
    <p>Optionally provide your own Google Stitch API key during registration. Benefits:</p>
    <ul>
      <li>Use your own Google Cloud quotas</li>
      <li>Direct access to your Stitch projects</li>
      <li>Your key is encrypted with AES-256-GCM</li>
    </ul>

    <div class="alert alert--warning" style="margin-top:var(--space-6);">
      <span class="alert__icon">🔒</span>
      <div><strong>Security:</strong> Your API key is never logged, stored in plain text, or included in error responses. Stitch API keys are encrypted at rest using AES-256-GCM.</div>
    </div>
  `;
}

function _mcpSetup() {
  return `
    <h1>MCP Client Setup</h1>
    <p>N2 Cloud supports any MCP-compatible client. Here are configuration examples.</p>

    <h2>Claude Desktop</h2>
    <p>Edit <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>:</p>
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

    <h2>Cursor</h2>
    <p>Add to your MCP settings in Cursor:</p>
    ${codeBlock(`{
  "n2-stitch": {
    "url": "https://cloud.nton2.com/mcp",
    "headers": {
      "X-API-Key": "n2_sk_live_your_key"
    }
  }
}`, 'json')}

    <h2>Windsurf / Cline</h2>
    <p>Same configuration format — just add the endpoint URL and API key header.</p>

    <h2>Custom MCP Client</h2>
    <p>Using the MCP SDK:</p>
    ${codeBlock(`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from
  "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("https://cloud.nton2.com/mcp"),
  { requestInit: { headers: { "X-API-Key": "n2_sk_live_your_key" } } }
);

const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log(tools);`, 'javascript')}
  `;
}

function _apiReference() {
  return `
    <h1>API Reference</h1>
    <p>N2 Cloud exposes a single MCP endpoint that handles all Stitch operations.</p>

    <h2>Endpoint</h2>
    ${codeBlock(`POST https://cloud.nton2.com/mcp
Content-Type: application/json
X-API-Key: n2_sk_live_your_key`, 'http')}

    <h2>Request Format</h2>
    <p>All requests follow the JSON-RPC 2.0 format:</p>
    ${codeBlock(`{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_project",
    "arguments": {
      "title": "My App"
    }
  },
  "id": 1
}`, 'json')}

    <h2>Response Format</h2>
    ${codeBlock(`{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Project created successfully..."
      }
    ]
  },
  "id": 1
}`, 'json')}

    <h2>Error Codes</h2>
    <table class="billing-table" style="margin-top:var(--space-4);">
      <thead>
        <tr><th>Code</th><th>Meaning</th></tr>
      </thead>
      <tbody>
        <tr><td>401</td><td>Missing or invalid API key</td></tr>
        <tr><td>403</td><td>Forbidden (plan limit exceeded)</td></tr>
        <tr><td>429</td><td>Rate limit exceeded</td></tr>
        <tr><td>500</td><td>Internal server error</td></tr>
        <tr><td>503</td><td>Service temporarily unavailable</td></tr>
      </tbody>
    </table>
  `;
}

function _tools() {
  return `
    <h1>Available Tools</h1>
    <p>N2 Cloud proxies all Google Stitch MCP tools. Here are the main ones:</p>

    <h2>Project Management</h2>
    <ul>
      <li><code>list_projects</code> — List all your Stitch projects</li>
      <li><code>create_project</code> — Create a new project</li>
      <li><code>get_project</code> — Get project details</li>
    </ul>

    <h2>Screen Generation</h2>
    <ul>
      <li><code>generate_screen_from_text</code> — Generate a screen from text description</li>
      <li><code>edit_screens</code> — Edit existing screens</li>
      <li><code>generate_variants</code> — Generate design variants</li>
      <li><code>list_screens</code> — List all screens in a project</li>
      <li><code>get_screen</code> — Get screen details and code</li>
    </ul>

    <h2>Health & Info</h2>
    <ul>
      <li><code>n2_health_check</code> — Check proxy health and session status</li>
    </ul>

    <h2>Example: Generate a Screen</h2>
    ${codeBlock(`// Ask your MCP client:
"Generate a login screen for a fintech mobile app
 with dark theme, biometric authentication option,
 and social login buttons"

// N2 Cloud will:
// 1. Route to Google Stitch API
// 2. Generate the screen design
// 3. Return preview URL and HTML/CSS code`, 'text')}
  `;
}

function _plans() {
  return `
    <h1>Plans & Limits</h1>
    <p>Choose the plan that fits your needs.</p>

    <table class="billing-table" style="margin-top:var(--space-4);">
      <thead>
        <tr>
          <th>Feature</th>
          <th>Free</th>
          <th>Pro ($5/mo)</th>
          <th>Team ($15/mo)</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Stitch Generations</td><td>50/month</td><td>Unlimited</td><td>Unlimited</td></tr>
        <tr><td>Search Queries</td><td>500/month</td><td>Unlimited</td><td>Unlimited</td></tr>
        <tr><td>API Keys</td><td>1</td><td>3</td><td>10</td></tr>
        <tr><td>Team Members</td><td>1</td><td>1</td><td>5</td></tr>
        <tr><td>Priority Processing</td><td>—</td><td>✓</td><td>✓</td></tr>
        <tr><td>Support</td><td>Community</td><td>Email</td><td>Priority</td></tr>
        <tr><td>Usage Analytics</td><td>—</td><td>✓</td><td>✓</td></tr>
        <tr><td>Custom Integrations</td><td>—</td><td>—</td><td>✓</td></tr>
      </tbody>
    </table>

    <div class="alert alert--success" style="margin-top:var(--space-8);">
      <span class="alert__icon">🎉</span>
      <div><strong>Free tier is generous!</strong> 50 Stitch generations/month is plenty for personal projects and prototyping.</div>
    </div>
  `;
}

function _security() {
  return `
    <h1>Security</h1>
    <p>We take security seriously. Here's how we protect your data.</p>

    <h2>Encryption</h2>
    <ul>
      <li><strong>In Transit:</strong> All connections use TLS 1.3 via Cloudflare</li>
      <li><strong>At Rest:</strong> Stitch API keys encrypted with AES-256-GCM</li>
      <li><strong>API Keys:</strong> Hashed and salted before storage</li>
    </ul>

    <h2>Infrastructure</h2>
    <ul>
      <li>Cloudflare DDoS protection</li>
      <li>Rate limiting per user plan</li>
      <li>Session TTL with automatic cleanup</li>
      <li>No logs of API key values</li>
    </ul>

    <h2>Best Practices</h2>
    <ul>
      <li>Never share your API key publicly</li>
      <li>Rotate keys periodically</li>
      <li>Use environment variables instead of hardcoding keys</li>
      <li>Monitor your usage dashboard for anomalies</li>
    </ul>
  `;
}

function _troubleshooting() {
  return `
    <h1>Troubleshooting</h1>

    <h2>Connection Failed</h2>
    <p>If you can't connect to N2 Cloud:</p>
    <ul>
      <li>Check your internet connection</li>
      <li>Verify your API key is correct</li>
      <li>Ensure the endpoint URL is <code>https://cloud.nton2.com/mcp</code></li>
      <li>Check the <code>X-API-Key</code> header is set</li>
    </ul>

    <h2>401 Unauthorized</h2>
    <p>Your API key is missing or invalid. Double check:</p>
    ${codeBlock(`// ✅ Correct
"headers": { "X-API-Key": "n2_sk_live_..." }

// ❌ Wrong header name
"headers": { "Authorization": "Bearer n2_sk_live_..." }`, 'json')}

    <h2>429 Rate Limited</h2>
    <p>You've exceeded your plan's limits. Options:</p>
    <ul>
      <li>Wait for your usage to reset (monthly)</li>
      <li>Upgrade to Pro or Team for unlimited usage</li>
      <li>Provide your own Stitch API key (BYOK) for higher limits</li>
    </ul>

    <h2>Session Recovery</h2>
    <p>N2 Cloud handles session recovery automatically. If you're experiencing persistent issues, try:</p>
    ${codeBlock(`# Force a new session by omitting the Mcp-Session-Id header
curl -X POST https://cloud.nton2.com/mcp \\
  -H "X-API-Key: your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`, 'bash')}

    <h2>Still Need Help?</h2>
    <p>Join our <a href="#">Discord community</a> or email <a href="mailto:support@nton2.com">support@nton2.com</a>.</p>
  `;
}
