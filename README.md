# 🛡️ N2 Stitch MCP — Resilient Proxy for Google Stitch

> **Never lose a screen generation again.** Built by [Nton2](https://nton2.com)

[![npm version](https://img.shields.io/npm/v/n2-stitch-mcp)](https://www.npmjs.com/package/n2-stitch-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight, resilient MCP proxy server for [Google Stitch](https://stitch.withgoogle.com/). While other Stitch MCP servers silently fail when connections drop during long-running screen generations, **N2 Stitch MCP keeps going**.

## 🔥 The Problem

Google Stitch's `generate_screen_from_text` takes **2–10 minutes** to create a screen. But the API **drops the TCP connection after ~60 seconds**.

```
Other MCP servers:
  Request → 60s → TCP dropped → ❌ "Error: connection reset" → Your work is LOST

N2 Stitch MCP:
  Request → 60s → TCP dropped → 🛡️ Auto-recovery → Polling... → ✅ Screen delivered!
```

## 🆚 Why N2 Stitch MCP?

| Feature | Official CLI | Other MCPs | **N2 Stitch MCP** |
|---------|:---:|:---:|:---:|
| TCP Drop Recovery | ❌ | ❌ | ✅ **Auto-polling** |
| Generation Tracking | ❌ | ❌ | ✅ `generation_status` |
| Generation List | ❌ | ❌ | ✅ `list_generations` |
| Exponential Backoff | ❌ | ❌ | ✅ **3x retry + jitter** |
| Auto Token Refresh | ✅ | ⚠️ | ✅ **Background refresh** |
| Test Suite | ? | ❌ | ✅ **33 tests** |
| Lightweight | ❌ (heavy CLI) | ✅ | ✅ **Pure proxy** |
| npx support | ✅ | ✅ | ✅ |

## 🚀 Quick Start

### 1. Prerequisites

You need **one** of these for authentication:

- **Option A**: Google Cloud SDK (recommended)
  ```bash
  # Install gcloud
  # Windows: winget install Google.CloudSDK
  # macOS:   brew install --cask google-cloud-sdk
  # Linux:   curl https://sdk.cloud.google.com | bash

  # Login
  gcloud auth application-default login
  ```

- **Option B**: API Key
  ```bash
  export STITCH_API_KEY="your-api-key"
  ```

### 2. Add to MCP Client

Add this to your MCP configuration (Cursor, Claude Desktop, Gemini CLI, Antigravity, etc.):

**With gcloud (recommended):**
```json
{
  "mcpServers": {
    "n2-stitch": {
      "command": "npx",
      "args": ["-y", "n2-stitch-mcp"]
    }
  }
}
```

**With API Key:**
```json
{
  "mcpServers": {
    "n2-stitch": {
      "command": "npx",
      "args": ["-y", "n2-stitch-mcp"],
      "env": {
        "STITCH_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

That's it! Your AI agent can now use Google Stitch. 🎉

### 3. Setup Wizard (Optional)

Run the interactive setup to verify everything:
```bash
npx -y n2-stitch-mcp init
```

## 🛡️ 3-Layer Safety Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your AI Agent                         │
│         "Create a mobile login screen"                   │
└────────────────────┬────────────────────────────────────┘
                     │ MCP (STDIO)
┌────────────────────▼────────────────────────────────────┐
│              N2 Stitch MCP Proxy                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ L1: Exponential Backoff Retry                    │   │
│  │     Network errors → retry 3x (1s→2s→4s ±jitter)│   │
│  ├──────────────────────────────────────────────────┤   │
│  │ L2: Auto Token Refresh                           │   │
│  │     401 response → refresh token → retry         │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ L3: TCP Drop Recovery                            │   │
│  │     Connection lost → poll list_screens every    │   │
│  │     10s → detect new screen → return result      │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────┐
│           Google Stitch API                              │
│           stitch.googleapis.com/mcp                      │
└─────────────────────────────────────────────────────────┘
```

### Layer 1: Exponential Backoff Retry
- Transient errors (ECONNRESET, timeout, 429, 503) → automatic retry
- 3 attempts with exponential backoff: 1s → 2s → 4s (±30% jitter)
- Non-transient errors (400, 404) fail immediately

### Layer 2: Auto Token Refresh
- Background token refresh every 50 minutes (before 60-min expiry)
- On 401 response → force refresh → retry the request

### Layer 3: TCP Drop Recovery (⭐ Unique!)
- When `generate_screen_from_text` connection drops:
  1. Wait 5 seconds (let Stitch finish processing)
  2. Poll `list_screens` every 10 seconds
  3. Detect new screen by comparing before/after screen lists
  4. Return the generated screen — **as if nothing happened!**
- Timeout: 12 minutes max polling

## 🔧 Available Tools

### Stitch API Tools (Auto-discovered)
| Tool | Description |
|------|-------------|
| `create_project` | Create a new Stitch project |
| `list_projects` | List all projects |
| `get_project` | Get project details |
| `list_screens` | List screens in a project |
| `get_screen` | Get screen details (HTML/CSS) |
| `generate_screen_from_text` | **✨ Generate UI from text (Resilient!)** |
| `edit_screens` | Edit existing screens |
| `generate_variants` | Generate design variants |

### Virtual Tools (N2 Exclusive)
| Tool | Description |
|------|-------------|
| `generation_status` | Check real-time status of a screen generation |
| `list_generations` | List all in-flight and recent generations |

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `STITCH_HOST` | Stitch API URL | `https://stitch.googleapis.com/mcp` |
| `STITCH_API_KEY` | API Key (alternative to gcloud) | — |
| `STITCH_PROJECT_ID` | GCP Project ID | — |
| `STITCH_DEBUG` | Enable debug logging (`1`) | `0` |

## 🧪 Tests

```bash
npm test
# 33 passed, 0 failed ✅
```

Tests cover:
- ✅ Configuration loading & defaults
- ✅ API key & ADC authentication
- ✅ Exponential backoff calculation
- ✅ Transient error detection
- ✅ Generation tracking state management
- ✅ Server module integration

## 📁 Project Structure

```
n2-stitch-mcp/
├── index.js                    # Entry point + setup wizard
├── src/
│   ├── config.js               # Configuration from env vars
│   ├── auth.js                 # Google auth (ADC / API key)
│   ├── proxy-client.js         # HTTP client (L1 + L2)
│   ├── generation-tracker.js   # TCP drop recovery (L3)
│   └── server.js               # MCP server + tool routing
├── test.js                     # Test suite (33 tests)
├── package.json
├── LICENSE
└── README.md
```

## 📊 Performance

| Metric | Value |
|--------|-------|
| Cold start | ~2 seconds |
| Memory usage | ~30 MB |
| Request overhead | < 10ms per proxy call |
| Dependencies | Only 2 (`@modelcontextprotocol/sdk`, `google-auth-library`) |

## 🤝 Contributing

Issues and PRs welcome at [GitHub](https://github.com/choihyunsus/n2-stitch-mcp).

## 📄 License

MIT — Use it freely, modify it, sell it, whatever you want.

---

Made with ❤️ by [Nton2](https://nton2.com) — *Building the Body for AI*
