# 🌐 N2 Stitch MCP

> MCP proxy for Google Stitch API — the easiest way to generate UI designs with AI.  
> Wraps Stitch's UI generation capabilities in the MCP protocol, with API key management, billing dashboard, and monitoring.

## 🚀 Quick Start

### Option 1: Local Mode (Direct Stitch Connection)

Connect directly with gcloud credentials or a Stitch API Key:

```json
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

### Option 2: Cloud Mode — ⭐ Recommended

**No gcloud required!** Use Stitch API through N2 Cloud:

```json
{
  "mcpServers": {
    "n2-stitch-cloud": {
      "command": "npx",
      "args": ["-y", "n2-stitch-mcp", "--cloud"],
      "env": {
        "N2_API_KEY": "n2_sk_live_abc123def456"
      }
    }
  }
}
```

1. [cloud.nton2.com](https://cloud.nton2.com) — Get your free API Key (GitHub or Google login)
2. Add the config above to your MCP client
3. Done! 🎉

**Free tier includes:**
- ✅ 50 Stitch generations/month
- ✅ 500 search queries/month
- ✅ No gcloud CLI needed
- ✅ No billing setup required

## ⚙️ Environment Variables

| Variable | Mode | Description |
|----------|------|-------------|
| `STITCH_API_KEY` | Local | Google Stitch API Key |
| `N2_API_KEY` | Cloud | N2 Cloud API Key (`n2_sk_live_xxx`) |
| `N2_CLOUD_URL` | Cloud | Cloud URL (default: `https://cloud.nton2.com`) |
| `STITCH_DEBUG` | Both | Enable debug logging (`1`) |

## �️ 3-Layer Safety Architecture

```
L1 — Exponential-backoff retry (transient network errors)
L2 — Auto token refresh on 401 (gcloud ADC mode)
L3 — TCP drop recovery via polling (generation never lost)
```

## �📁 Project Structure

| Folder/File | Description |
|-------------|-------------|
| `cloud/` | N2 Cloud web service (frontend + backend) |
| `src/` | MCP server source code |
| `src/cloud-client.js` | STDIO ↔ HTTP bridge for `--cloud` mode |
| `skills/` | Stitch design skill definitions |
| `_history/` | Work history + specs |
| `index.js` | MCP server entry point |

## 📦 Commands

```bash
# Setup wizard (checks gcloud, tests Stitch API)
npx n2-stitch-mcp init

# Run in local mode
npx n2-stitch-mcp

# Run in cloud mode
N2_API_KEY=n2_sk_live_xxx npx n2-stitch-mcp --cloud
```

## 🔗 Links

- **N2 Cloud**: [cloud.nton2.com](https://cloud.nton2.com)
- **NPM**: [npmjs.com/package/n2-stitch-mcp](https://www.npmjs.com/package/n2-stitch-mcp)
- **GitHub**: [github.com/choihyunsus/n2-stitch-mcp](https://github.com/choihyunsus/n2-stitch-mcp)

## License

MIT © [Nton2](https://nton2.com)
