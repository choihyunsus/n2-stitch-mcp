# N2 Cloud Service — 기획서 v2.0
> 맥미니 하나로 클라우드 서비스 운영, 월 수익 창출  
> 작성일: 2026-02-13 | v2.0 재검토 반영 | 작성자: Rose (N2 AI Family)

---

## 1. 서비스 비전

### 한 줄 요약
> Google Stitch를 더 쉽고 안정적으로 쓸 수 있는 클라우드 MCP 프록시 서비스

### 왜 클라우드인가?

현재 n2-stitch-mcp를 직접 쓰려면:
```
1. gcloud CLI 설치 (10분)
2. gcloud auth login (5분)
3. npx n2-stitch-mcp 실행 (1분)
4. MCP 설정 추가 (2분)
→ 총 18분 + 환경 설정 스트레스
```

클라우드 버전:
```
1. API 키 발급 (30초)
2. 본인의 Stitch API 키 등록 (30초)
3. MCP 설정 한 줄 추가 (30초)
→ 총 1분 30초. 끝!
```

### 핵심 가치 (클라우드에서만 가능한 것)
1. **TCP 드롭 복구가 서버 측에서 동작** — 네트워크 불안정해도 서버가 복구
2. **환경 설정 제로** — gcloud, Node.js 설치 필요 없음 
3. **모니터링** — 생성 진행 상황 실시간 추적
4. **멀티 디바이스** — 어디서든 동일한 API 키로 접속

### 최종 목표
1. 맥 미니에서 클라우드 MCP 서버 운영 (비용: $0)
2. Cloudflare Tunnel로 외부 접속 (비용: $0)
3. API 키 기반 인증 + 구독 수익
4. n2-free-search 클라우드 버전 추가 (Phase 2)

---

## 2. 서비스 구성

### Phase 1: N2 Stitch Cloud (MVP)
| 항목 | 내용 |
|------|------|
| 서비스명 | N2 Stitch Cloud |
| 기능 | Stitch API 프록시 + TCP 드롭 복구 |
| 인증 | N2 API 키 + 사용자 본인의 Stitch API 키 (BYOK) |
| 프로토콜 | Streamable HTTP (MCP 표준) |
| 서버 | 맥 미니 (192.168.219.108) |
| 터널 | Cloudflare Tunnel (무료) |

### Phase 2: N2 Search Cloud (확장)
| 항목 | 내용 |
|------|------|
| 서비스명 | N2 Search Cloud |
| 기능 | SearXNG 무료 검색 API |
| 특징 | 이미 SearXNG가 맥미니에서 가동 중 |
| 추가 작업 | HTTP 엔드포인트 노출 |

---

## 3. 기술 아키텍처

### 전체 구조

```
                    인터넷
                      │
         ┌────────────▼────────────────┐
         │    Cloudflare Tunnel (무료)   │
         │    HTTPS 자동 + DDoS 방어    │
         └────────────┬────────────────┘
                      │
         ┌────────────▼────────────────┐
         │     맥 미니 (192.168.219.108) │
         │                              │
         │  ┌──────────────────────┐   │
         │  │  N2 Cloud Gateway    │   │
         │  │  (Express.js)        │   │
         │  │  포트: 3500           │   │
         │  │                      │   │
         │  │  ┌────────────────┐  │   │
         │  │  │ N2 API 키 인증 │  │   │
         │  │  │ Rate Limiting  │  │   │
         │  │  │ 세션 관리      │  │   │
         │  │  │ 사용량 추적    │  │   │
         │  │  └────────────────┘  │   │
         │  │                      │   │
         │  │  ┌────────────────┐  │   │
         │  │  │ /mcp (Stitch)  │──┼──►  Stitch API (사용자의 API 키 사용)
         │  │  │ /search/*      │──┼──►  SearXNG (localhost:8888)
         │  │  └────────────────┘  │   │
         │  └──────────────────────┘   │
         │                              │
         │  SearXNG (8888) — 가동 중    │
         │  Node.js v25 — 설치 완료     │
         │  Docker — 가동 중            │
         └──────────────────────────────┘
```

### 인증 시스템 (BYOK — Bring Your Own Key)

> Google ToS 위반을 방지하기 위해, Stitch API 인증은 반드시 사용자 본인의 키를 사용한다.
> N2 Cloud는 "프록시 + 복구"만 제공하고, Google 인증은 대행하지 않는다.

#### 이중 인증 구조
```
사용자 → [N2 API 키] → N2 Cloud Gateway → [사용자의 Stitch API 키] → Google Stitch
         ^^^^^^^^^^^^                       ^^^^^^^^^^^^^^^^^^^^^^^^^^
         N2 서비스 인증                      사용자의 Google 인증 (우리는 전달만)
```

#### N2 API 키 (서비스 접근용)
```
n2_sk_live_xxxxxxxxxxxxxxxxxxxx    (운영용)
n2_sk_test_xxxxxxxxxxxxxxxxxxxx    (테스트용)
```

#### 사용자 데이터 (Phase 1: JSON 파일)
```json
{
  "users": {
    "n2_sk_live_abc123def456": {
      "name": "홍길동",
      "email": "hong@example.com",
      "plan": "pro",
      "stitch_api_key": "AIza...(사용자의 Google API 키, 암호화 저장)",
      "created": "2026-02-15",
      "usage": {
        "stitch_calls": 42,
        "search_calls": 150,
        "month": "2026-02"
      }
    }
  }
}
```

#### Phase 2: SQLite로 마이그레이션
- 사용자 10명 이상 시 SQLite로 전환
- API 키 암호화 저장 (AES-256)
- 사용량 통계, 결제 이력 저장

### MCP Streamable HTTP Transport (최신 표준)

> v2.0 수정: SSE는 deprecated. MCP SDK 최신 표준인 Streamable HTTP를 사용한다.

```javascript
import { randomUUID } from 'node:crypto';
import express from 'express';
import { McpServer, isInitializeRequest } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';

const app = express();
const transports = new Map();  // 세션별 transport 관리

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  
  // 기존 세션 재사용
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId);
    await transport.handleRequest(req, res, req.body);
    return;
  }
  
  // 새 세션 생성
  if (!sessionId && isInitializeRequest(req.body)) {
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => transports.set(sid, transport)
    });
    
    const server = createStitchServer(req.user);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }
  
  res.status(400).json({ error: 'Invalid request' });
});
```

### 사용자 연결 방법

사용자의 MCP 설정:
```json
{
  "mcpServers": {
    "n2-stitch-cloud": {
      "url": "https://cloud.nton2.com/mcp",
      "headers": {
        "Authorization": "Bearer n2_sk_live_abc123def456"
      }
    }
  }
}
```

npx 래퍼 (Streamable HTTP 미지원 클라이언트용):
```json
{
  "mcpServers": {
    "n2-stitch-cloud": {
      "command": "npx",
      "args": ["-y", "n2-stitch-mcp", "--cloud"],
      "env": {
        "N2_API_KEY": "n2_sk_live_abc123def456",
        "STITCH_API_KEY": "사용자의_Google_API_키"
      }
    }
  }
}
```

---

## 4. 서버 구현 계획

### 프로젝트 구조
```
n2-cloud/
├── package.json
├── server.js              # Express + Streamable HTTP 게이트웨이
├── src/
│   ├── gateway.js         # 메인 게이트웨이 라우터
│   ├── auth.js            # N2 API 키 인증 미들웨어
│   ├── session-manager.js # 세션 생성/재사용/정리
│   ├── rate-limiter.js    # 플랜별 속도 제한
│   ├── usage-tracker.js   # 사용량 추적
│   ├── stitch-handler.js  # Stitch API 프록시 (기존 코드 재사용)
│   ├── search-handler.js  # SearXNG 프록시 (Phase 2)
│   └── admin.js           # 관리 API (키 발급, 사용량 확인)
├── data/
│   ├── users.json         # 사용자 & API 키 데이터
│   └── usage-log.json     # 사용량 로그
├── scripts/
│   ├── create-key.js      # API 키 생성 CLI
│   └── check-usage.js     # 사용량 확인 CLI
└── ecosystem.config.js    # PM2 설정
```

### 핵심 모듈

#### 1. Auth Middleware
```javascript
export function authenticateApiKey(req, res, next) {
  const key = req.headers.authorization?.replace('Bearer ', '');
  
  if (!key || !key.startsWith('n2_sk_')) {
    return res.status(401).json({ error: 'Invalid N2 API key' });
  }
  
  const user = users.find(key);
  if (!user) return res.status(401).json({ error: 'Unknown API key' });
  
  // 플랜별 사용량 체크
  const limits = PLAN_LIMITS[user.plan];
  if (limits.stitch_per_month > 0 && user.usage.stitch_calls >= limits.stitch_per_month) {
    return res.status(429).json({ 
      error: 'Monthly limit reached',
      upgrade_url: 'https://cloud.nton2.com/pricing'
    });
  }
  
  req.user = user;
  next();
}
```

#### 2. Session Manager
```javascript
// 세션 TTL: 30분 미사용 시 자동 정리
const SESSION_TTL = 30 * 60 * 1000;

setInterval(() => {
  for (const [id, session] of transports) {
    if (Date.now() - session.lastActivity > SESSION_TTL) {
      session.transport.close();
      transports.delete(id);
    }
  }
}, 60 * 1000);
```

#### 3. Rate Limiter
```javascript
const PLAN_LIMITS = {
  free: { stitch_per_month: 50, search_per_month: 500 },
  pro:  { stitch_per_month: -1, search_per_month: -1 },  // 무제한
  team: { stitch_per_month: -1, search_per_month: -1 },
};
```

### 의존성 (최신 MCP SDK)
```json
{
  "dependencies": {
    "@modelcontextprotocol/server": "latest",
    "@modelcontextprotocol/node": "latest",
    "@modelcontextprotocol/express": "latest",
    "express": "^4.18.0",
    "google-auth-library": "^9.0.0"
  }
}
```

---

## 5. 인프라 세팅 계획

### Cloudflare Tunnel 설치 (맥미니)

```bash
# 1. cloudflared 설치
/opt/homebrew/bin/brew install cloudflared

# 2. Cloudflare 로그인
cloudflared tunnel login

# 3. 터널 생성
cloudflared tunnel create n2-cloud

# 4. DNS 설정
cloudflared tunnel route dns n2-cloud cloud.nton2.com

# 5. 설정 파일
cat > ~/.cloudflared/config.yml << EOF
tunnel: <터널-ID>
credentials-file: ~/.cloudflared/<터널-ID>.json

ingress:
  - hostname: cloud.nton2.com
    service: http://localhost:3500
  - service: http_status:404
EOF

# 6. 서비스 등록 (자동 시작)
cloudflared service install
```

### PM2 프로세스 관리

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'n2-cloud',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3500,
    },
    watch: false,
    max_memory_restart: '200M',
    log_file: './logs/n2-cloud.log',
    error_file: './logs/n2-cloud-error.log',
    autorestart: true,
  }]
};
```

```bash
# PM2 설치 & 시작 (맥미니에서)
/opt/homebrew/bin/npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 맥 재부팅 시 자동 시작
```

---

## 6. 가격 정책

### 요금제

| 플랜 | 월 가격 | Stitch 생성 | 검색 쿼리 | 기타 |
|------|---------|------------|----------|------|
| Free | $0 | 50회/월 | 500회/월 | API 키 1개 |
| Pro | $5/월 | 무제한 | 무제한 | 우선 처리 |
| Team | $15/월 | 무제한 | 무제한 | 팀원 5명, 키 5개 |

> 사용자는 본인의 Stitch API 키를 제공해야 함 (BYOK).
> N2 Cloud는 프록시 + TCP 복구 + 모니터링 서비스를 판매하는 것.

### 결제 수단 (초기)
1. GitHub Sponsors — 개발자 타겟, 가장 쉬움
2. Buy Me a Coffee — 간단한 구독
3. Ko-fi — 대안

### 수익 예측

| 시점 | 유료 사용자 | 월 수익 | 비용 | 순수익 |
|------|-----------|---------|------|--------|
| 1개월 | 5명 | $25 | $0 | $25 |
| 3개월 | 20명 | $100 | $0 | $100 |
| 6개월 | 50명 | $250 | $10 | $240 |
| 12개월 | 200명 | $1,000 | $50 | $950 |

> 운영비 $0 이유: 맥미니(보유) + Cloudflare(무료) + SearXNG(무료)

---

## 7. 마케팅 전략

### 홍보 채널

| 채널 | 전략 | 예상 효과 |
|------|------|----------|
| Reddit r/MCP, r/ClaudeAI | 비교 표 + 데모 | 높음 |
| Hacker News | "Show HN: Resilient Stitch MCP" | 매우 높음 |
| X (트위터) | 데모 영상 | 중간 |
| ClawHub | 이미 등록됨 | 중간 |
| Discord AI/MCP 서버 | 도구 소개 | 중간 |

### 셀링 포인트

```
Tired of Stitch MCP failing after 60 seconds?

N2 Stitch Cloud — the ONLY proxy with TCP drop recovery.
Your screen generation NEVER gets lost.

- Free tier: 50 generations/month
- Cloud: No gcloud, no Node.js — just an API key
- BYOK: Use your own Stitch API key (safe & compliant)
- Open source: github.com/choihyunsus/n2-stitch-mcp

Cloud: cloud.nton2.com
```

---

## 8. 구현 일정

### 다음 세션 (서버 구현)

| 순서 | 작업 | 예상 시간 |
|------|------|----------|
| 1 | 맥미니에 n2-cloud 프로젝트 생성 | 10분 |
| 2 | Express + Streamable HTTP 게이트웨이 | 1시간 |
| 3 | N2 API 키 인증 미들웨어 | 30분 |
| 4 | 세션 매니저 (생성/재사용/정리) | 30분 |
| 5 | Rate limiter + 사용량 추적 | 30분 |
| 6 | Stitch 프록시 핸들러 (기존 코드 재사용) | 30분 |
| 7 | Cloudflare Tunnel 설치 & 설정 | 20분 |
| 8 | PM2 설정 & 서비스 등록 | 10분 |
| 9 | 테스트 & 디버깅 | 30분 |
| 총 | | ~4.5시간 |

### 그 다음 세션 (런칭 — N2 정규식)

| 순서 | 작업 | 예상 시간 |
|------|------|----------|
| 1 | NotebookLM으로 랜딩 페이지 기획서 생성 | 30분 |
| 2 | Stitch로 랜딩 페이지 디자인 (모바일+데스크톱) | 30분 |
| 3 | Stitch 디자인 기반 TSX 코딩 (React + Vite) | 1.5시간 |
| 4 | API 키 발급 자동화 | 30분 |
| 5 | GitHub Sponsors / BMC 결제 연동 | 30분 |
| 6 | Reddit / HN / X 홍보 글 작성 | 1시간 |
| 7 | 모니터링 대시보드 | 30분 |
| 총 | | ~5시간 |

> 랜딩 페이지는 Stitch 디자인 거쳐서 고퀄리티로.
> 기술 스택: TSX (React + Vite) — n2-site 스타일.

---

## 9. 도메인 전략

| 옵션 | 도메인 | 비용 | 비고 |
|------|--------|------|------|
| A (추천) | cloud.nton2.com | $0 (서브도메인) | nton2.com 보유 |
| B | n2cloud.dev | ~$12/년 | 깔끔하지만 비용 |
| C | xxx.trycloudflare.com | $0 | URL 안 예쁨 |

추천: cloud.nton2.com — 비용 $0 + 브랜드 통일

---

## 10. 보안 체크리스트

| # | 항목 | 방법 |
|---|------|------|
| 1 | HTTPS | Cloudflare 자동 SSL |
| 2 | DDoS 방지 | Cloudflare 기본 보호 |
| 3 | N2 API 키 인증 | Bearer 토큰 |
| 4 | Rate Limiting | 플랜별 제한 |
| 5 | 사용자 Stitch 키 보관 | AES-256 암호화 저장 |
| 6 | 입력 검증 | Express 미들웨어 |
| 7 | 세션 정리 | 30분 TTL 자동 만료 |
| 8 | 로그 | PM2 로그 + usage-log.json |

### 핵심 보안 설계 (BYOK)
```
사용자 → [N2 API 키] → N2 Cloud → [사용자의 Stitch API 키] → Google Stitch
         ^^^^^^^^^^^^              ^^^^^^^^^^^^^^^^^^^^^^^^^^
         N2 서비스 인증             사용자 본인의 키 (전달만)
```
> 우리는 Google 인증을 대행하지 않는다.
> 사용자의 키를 안전하게 전달만 해주는 프록시 역할.
> 이것이 Google ToS를 준수하는 방식이다.

---

## 11. 리스크 & 대응

| 리스크 | 확률 | 영향 | 대응 |
|--------|:----:|:----:|------|
| Google Stitch API 유료화 | 중 | 높 | 가격 반영, 대안 모색 |
| Google Stitch API Rate Limit | 중 | 중 | 사용자별 키이므로 분산됨 (BYOK 이점) |
| 맥미니 다운 | 낮 | 높 | PM2 자동 재시작 + Cloudflare Health Check |
| 트래픽 폭증 | 낮 | 중 | Rate limiting, 필요시 VPS 추가 |
| 경쟁자 등장 | 중 | 중 | TCP 복구 기술력 + 선점 우위 |
| Cloudflare Tunnel 장애 | 낮 | 높 | SLA 없지만 안정적. 장애 시 알림 |
| 무료 티어 남용 | 중 | 낮 | Phase 2에서 GitHub 인증 추가 |
| 사용자 API 키 유출 | 낮 | 높 | AES-256 암호화 + 메모리에서만 복호화 |

---

## 12. v2.0 → v3.0 변경 이력

| 항목 | v1.0 (초안) | v2.0 (재검토) | v3.0 (Cloud Client) |
|------|------------|--------------|---------------------|
| Transport | SSE (deprecated) | Streamable HTTP (최신 표준) | + STDIO↔HTTP 브릿지 |
| Google 인증 | 대행 (ToS 위험) | BYOK — 사용자 자체 인증 | 동일 |
| 세션 관리 | 미고려 | Map + TTL 기반 세션 풀 | 동일 |
| 클라이언트 모드 | 없음 | 없음 | `--cloud` 래퍼 추가 |
| 패키지 의존성 | @modelcontextprotocol/sdk | server + node + express | 동일 |
| 리스크 항목 | 5개 | 8개 | 동일 |

---

## 13. `--cloud` 모드 명세 (v3.0 신규)

### 13.1 개요

> 많은 MCP 클라이언트(Cursor, Windsurf, Antigravity 등)가 아직 **Streamable HTTP URL** 직접 연결을 지원하지 않는다.
> `--cloud` 모드는 **STDIO ↔ Streamable HTTP 브릿지** 역할을 하여,
> 어떤 MCP 클라이언트에서든 N2 Cloud를 사용할 수 있게 한다.

### 13.2 아키텍처

```
┌──────────────────┐    STDIO     ┌──────────────────┐   HTTP/SSE    ┌─────────────────┐
│  MCP Client      │ ──────────►  │  n2-stitch-mcp   │ ────────────► │  N2 Cloud       │
│  (Antigravity,   │ ◄──────────  │  --cloud mode    │ ◄──────────── │  cloud.nton2.com │
│   Cursor, etc.)  │    STDIO     │  (STDIO↔HTTP     │   HTTP/SSE    │  /mcp            │
└──────────────────┘              │   Bridge)        │              └─────────────────┘
                                  └──────────────────┘
                                        │
                                        │ 환경변수:
                                        │   N2_API_KEY=n2_sk_live_xxx
                                        │   STITCH_API_KEY=xxx (선택)
                                        │   N2_CLOUD_URL=https://cloud.nton2.com (기본)
```

### 13.3 사용법

#### 사용자 MCP 설정
```json
{
  "mcpServers": {
    "n2-stitch-cloud": {
      "command": "npx",
      "args": ["-y", "n2-stitch-mcp", "--cloud"],
      "env": {
        "N2_API_KEY": "n2_sk_live_abc123def456",
        "STITCH_API_KEY": "사용자의_Google_API_키"
      }
    }
  }
}
```

#### 환경변수
| 변수 | 필수 | 설명 |
|------|:----:|------|
| `N2_API_KEY` | ✅ | N2 Cloud API 키 (`n2_sk_live_xxx`) |
| `STITCH_API_KEY` | ❌ | Google Stitch API 키 (Cloud 계정에 이미 등록된 경우 불필요) |
| `N2_CLOUD_URL` | ❌ | Cloud URL (기본: `https://cloud.nton2.com`) |
| `STITCH_DEBUG` | ❌ | 디버그 로그 활성화 (`1`) |

### 13.4 구현 명세

#### 파일: `src/cloud-client.js` (신규)

```
CloudProxyClient 클래스:
├── constructor(config, logger)
│   ├── cloudUrl = config.cloudUrl || 'https://cloud.nton2.com'
│   ├── n2ApiKey = config.n2ApiKey (필수)
│   └── sessionId = null (서버에서 발급)
│
├── async sendRequest(jsonRpcBody)
│   ├── POST cloudUrl/mcp
│   ├── Headers: Authorization, Content-Type, Mcp-Session-Id
│   ├── Body: JSON-RPC 요청
│   ├── 응답에서 Mcp-Session-Id 헤더 저장 (첫 요청 시)
│   └── return JSON-RPC 응답
│
├── async subscribeToNotifications(callback)
│   ├── GET cloudUrl/mcp (SSE stream)
│   ├── Headers: Authorization, Mcp-Session-Id, Accept: text/event-stream
│   └── 서버 → 클라이언트 알림 수신 (생성 진행 상황 등)
│
└── async closeSession()
    ├── DELETE cloudUrl/mcp
    └── Headers: Authorization, Mcp-Session-Id
```

#### 파일: `index.js` (수정)

```javascript
// 기존 main() 함수에 --cloud 분기 추가
async function main() {
    if (process.argv[2] === 'init') { ... }  // 기존
    if (process.argv[2] === '--cloud') {      // 신규!
        await runCloudMode();
        return;
    }
    // ... 기존 로컬 모드
}

async function runCloudMode() {
    // 1. N2_API_KEY 검증
    // 2. CloudProxyClient 생성
    // 3. STDIO transport 생성
    // 4. STDIO 입력 → CloudProxyClient.sendRequest() → STDIO 출력
    // 5. SSE 구독으로 서버 알림 수신 → STDIO로 전달
}
```

### 13.5 STDIO ↔ HTTP 브릿지 상세 흐름

```
1. MCP Client → STDIN (JSON-RPC)
   ↓
2. n2-stitch-mcp --cloud 파싱
   ↓
3. POST https://cloud.nton2.com/mcp
   Headers:
     Authorization: Bearer n2_sk_live_xxx
     Content-Type: application/json
     Mcp-Session-Id: (있으면)
   Body: { jsonrpc: "2.0", method: "...", params: {...}, id: N }
   ↓
4. N2 Cloud 응답 수신
   ↓
5. STDOUT으로 JSON-RPC 응답 전달
   → MCP Client가 결과 수신
```

### 13.6 에러 처리

| 상황 | 처리 |
|------|------|
| `N2_API_KEY` 미설정 | 에러 메시지 + 발급 URL 안내 → exit(1) |
| Cloud 서버 응답 없음 | 3회 재시도 (L1 Backoff) → 실패 시 에러 |
| 401 Unauthorized | "Invalid N2 API Key" 메시지 출력 |
| 429 Rate Limited | "Monthly limit reached" + 업그레이드 URL 안내 |
| 네트워크 단절 | 자동 재연결 + 세션 복구 시도 |

### 13.7 구현 일정

| 순서 | 작업 | 예상 시간 |
|------|------|----------|
| 1 | `src/cloud-client.js` 작성 (HTTP 클라이언트 + SSE) | 1시간 |
| 2 | `index.js`에 `--cloud` 분기 추가 | 30분 |
| 3 | `src/config.js`에 Cloud 관련 환경변수 추가 | 15분 |
| 4 | E2E 테스트 (Antigravity에서 연결) | 30분 |
| 5 | NPM 배포 (v1.1.0) | 15분 |
| **총** | | **~2.5시간** |

