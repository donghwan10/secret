# Secret Hitler LAN

시크릿 히틀러 PDF를 기준으로 구현한 local-first LAN 웹앱/PWA입니다. 하나의 호스트 PC 공용 화면과 5~10명의 스마트폰 개인 화면으로 플레이하도록 설계했습니다.

## 구조

- `packages/shared`: 공용 상수, 타입, Zod schema, 소켓 명령
- `packages/game-engine`: 순수 TypeScript 규칙 엔진과 projection
- `apps/server`: Fastify + Socket.IO 서버, LAN URL, snapshot 영속성
- `apps/web`: React + Vite PWA, 호스트/플레이어 UI
- `docs/reference-pages`: PDF에서 추출한 PNG 참고 자산
- `docs/reference-text`: PDF 텍스트 추출본

## 시작하기

```bash
corepack pnpm install
corepack pnpm build
corepack pnpm --dir apps/server start
```

기본 서버 주소는 `http://localhost:3000`이며, 실제 참가용 LAN URL은 호스트 화면 상단에 표시됩니다.

## 개발 명령

```bash
corepack pnpm dev
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
```

Playwright 브라우저가 없다면 한 번만 아래 명령을 실행하면 됩니다.

```bash
corepack pnpm exec playwright install chromium
```

## 주요 경로

- `/`: 호스트 시작 화면
- `/join`: 플레이어 참가 화면
- `/host/:roomId`: 메인 모니터용 호스트 화면
- `/p/:playerToken`: 플레이어 개인 화면

## 문서

- `docs/plan.md`
- `docs/architecture.md`
- `docs/rules-mapping.md`
- `docs/ui-asset-map.md`
- `docs/assumptions.md`
- `NOTICE`

## 라이선스 / 배포

이 프로젝트는 원본 PDF 자산을 파생 사용하므로 비상업적, 동일조건변경허락, 저작자표시 전제로만 사용해야 합니다. 자세한 내용은 `NOTICE`를 확인하세요.
