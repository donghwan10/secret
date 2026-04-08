# 구현 계획

1. PDF 기반 규칙과 자산을 기준으로 참조 페이지/텍스트를 정리하고, 코드와 UI에서 어떤 페이지를 어떤 용도로 쓸지 먼저 고정한다.
2. 모노레포를 `packages/shared`, `packages/game-engine`, `apps/server`, `apps/web` 구조로 구성하고 공용 타입, Zod schema, 이벤트 정의를 먼저 만든다.
3. `packages/game-engine`에 명시적 상태 머신과 순수 reducer를 구현하고, 역할 분배, 선거, chaos, 입법, 권한, 베토, 처형, 공개/비공개 상태 분리를 unit test로 고정한다.
4. `apps/server`에 Fastify + Socket.IO 서버를 만들고, room/host/player 세션 관리, JSON snapshot 영속성, 재접속 복구, 비밀 정보 분리 전송을 구현한다.
5. `apps/web`에 PWA 가능한 React 앱을 만들고, `/join`, `/p/:playerToken`, `/host/:roomId` 경로와 모바일/호스트 전용 UI를 PDF 자산 기반으로 구현한다.
6. 프린트 플레이 PDF 페이지를 카드/보드 자산으로 매핑하고, 필요한 부분은 PNG crop + HTML/CSS overlay로 인터랙션을 제공한다.
7. Vitest unit test와 Playwright E2E를 작성하고, 마지막에 빌드, 타입체크, 테스트를 모두 통과시킨다.
