# N2 Stitch MCP — Work History

## 📅 2026-02-12 (v1.0.0) — 초기 구현

### 🎯 목적
- Google Stitch MCP의 연결 불안정 문제 해결
- 기존 Stitch MCP가 화면 생성 시 TCP 연결 끊김으로 실패하는 문제
- 3중 안전 장치를 가진 Resilient MCP 프록시 서버 구축

### 📝 리서치 내용
1. **근본 원인 발견**: Stitch API의 `generate_screen_from_text`는 2~10분 소요, 
   API가 ~60초 후에 TCP 연결을 끊어버림
2. **참고 프로젝트**:
   - `davideast/stitch-mcp` (Node.js) — Google 커뮤니티 프록시, CLI 도구
   - `obinnaokechukwu/stitch-mcp` (Go) — Resilient screen generation 구현
3. **핵심 해결법**: 연결 끊김 시 `list_screens` 폴링으로 새 화면 감지

### 🏗️ 구현 파일

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `index.js` | 227줄 | 엔트리포인트 + init wizard |
| `src/config.js` | 60줄 | 환경변수 설정 |
| `src/auth.js` | 113줄 | Google 인증 (ADC/API Key) |
| `src/proxy-client.js` | 226줄 | HTTP 클라이언트 (L1+L2 Safety) |
| `src/generation-tracker.js` | 277줄 | Resilient 생성 (L3 Safety) |
| `src/server.js` | 255줄 | MCP 서버 (Low-level Server) + 도구 발견 |
| `test.js` | 174줄 | 테스트 35개 |
| **총합** | **1332줄** | **6개 모듈 + 테스트** |

### 🛡️ 3중 안전 장치
1. **L1 — Exponential Backoff Retry**: 네트워크 에러 시 최대 3회 (1s→2s→4s, ±30% jitter)
2. **L2 — Auto Token Refresh**: 401 시 토큰 갱신 + 재시도, 50분마다 백그라운드 갱신
3. **L3 — TCP Drop Recovery**: 생성 중 연결 끊김 → list_screens 폴링 (10초 간격, 최대 12분)

### ✅ 테스트 결과
- **35개** 테스트 전부 통과 (리팩토링 후 2개 추가)
- Config, Auth, ProxyClient, GenerationTracker, Server, Integration 6개 영역 검증
- Server 모듈: McpServer → Low-level Server 리팩토링 (동적 도구의 인자 passthrough 보장)

### ⚠️ 남은 작업
- [ ] gcloud SDK 설치 (`winget install Google.CloudSDK`)
- [ ] `gcloud auth application-default login` 실행 (브라우저 인증 필요)
- [ ] 또는 `STITCH_API_KEY` 환경변수 설정
- [ ] Antigravity MCP 설정에 n2-stitch 추가
- [ ] 실제 Stitch API 연동 테스트 (인증 필요)

### 🔗 참고
- Stitch API: `https://stitch.googleapis.com/mcp`
- JSON-RPC 2.0 프로토콜로 통신
- STDIO 트랜스포트 (Antigravity 호환)
