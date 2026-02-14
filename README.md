# 🌐 N2 Stitch MCP

> Google Stitch API를 쉽게 사용할 수 있는 MCP 프록시 서버 + N2 Cloud 웹 서비스.  
> Stitch의 UI 디자인 자동 생성 기능을 MCP 프로토콜로 래핑하여, API 키 관리·빌링·모니터링 대시보드를 제공.

## 🚀 Quick Start

### Option 1: Local Mode (Direct Stitch Connection)

gcloud 인증 또는 Stitch API Key로 직접 연결:

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

**gcloud 설치 불필요!** N2 Cloud를 통해 Stitch API 사용:

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

1. [cloud.nton2.com](https://cloud.nton2.com) 에서 무료 API Key 발급
2. 위 설정을 MCP 클라이언트에 추가
3. 끝! 🎉

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
