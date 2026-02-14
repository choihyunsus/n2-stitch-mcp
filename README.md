# 🌐 N2 Stitch MCP

**Resilient MCP proxy for [Google Stitch](https://stitch.withgoogle.com/)** — 3-layer safety net ensures your UI generations never get lost.

Use Google Stitch's AI-powered UI design tools through the [Model Context Protocol](https://modelcontextprotocol.io/). Supports direct local connection or zero-config cloud proxy via [N2 Cloud](https://cloud.nton2.com).

## 🚀 Quick Start

### Option A: Cloud Mode ⭐ Recommended

No gcloud SDK required. Connect through N2 Cloud:

```jsonc
// MCP client config (Claude, Cursor, Windsurf, etc.)
{
  "mcpServers": {
    "n2-stitch": {
      "command": "npx",
      "args": ["-y", "n2-stitch-mcp", "--cloud"],
      "env": {
        "N2_API_KEY": "n2_sk_live_your_key_here"
      }
    }
  }
}
```

1. Get your free API key at [cloud.nton2.com](https://cloud.nton2.com)
2. Add the config above to your MCP client
3. Done! 🎉

### Option B: Local Mode

Direct connection using gcloud ADC or a Stitch API key:

```jsonc
{
  "mcpServers": {
    "n2-stitch": {
      "command": "npx",
      "args": ["-y", "n2-stitch-mcp"],
      "env": {
        "STITCH_API_KEY": "your-stitch-api-key"
      }
    }
  }
}
```

## 🛡️ 3-Layer Safety Architecture

```
L1 — Exponential-backoff retry (transient network errors)
L2 — Auto token refresh on 401 (gcloud ADC mode)
L3 — TCP drop recovery via polling (generation never lost)
```

## ⚙️ Environment Variables

| Variable | Mode | Description |
|----------|------|-------------|
| `STITCH_API_KEY` | Local | Google Stitch API key |
| `N2_API_KEY` | Cloud | N2 Cloud API key |
| `N2_CLOUD_URL` | Cloud | Custom cloud endpoint (default: `https://cloud.nton2.com`) |
| `STITCH_HOST` | Local | Custom Stitch API endpoint |
| `STITCH_DEBUG` | Both | Enable debug logging (`1`) |

## 📦 CLI Commands

```bash
# Setup wizard — checks gcloud, tests Stitch API
npx n2-stitch-mcp init

# Run in local mode
npx n2-stitch-mcp

# Run in cloud mode
npx n2-stitch-mcp --cloud
```

## 🔗 Links

- **N2 Cloud**: [cloud.nton2.com](https://cloud.nton2.com)
- **NPM**: [npmjs.com/package/n2-stitch-mcp](https://www.npmjs.com/package/n2-stitch-mcp)
- **Google Stitch**: [stitch.withgoogle.com](https://stitch.withgoogle.com/)

## License

MIT © [Nton2](https://nton2.com)
