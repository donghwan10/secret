# 아키텍처

## 선택한 구조

- 모노레포는 `pnpm workspace` 기반으로 구성했다.
- `packages/shared`는 공용 상수, 타입, Zod schema, 소켓 명령 정의를 제공한다.
- `packages/game-engine`은 PDF 규칙을 담는 순수 TypeScript reducer/프로젝션 계층이다.
- `apps/server`는 Fastify + Socket.IO 서버, room/session 관리, JSON snapshot 영속성, LAN URL 감지를 담당한다.
- `apps/web`는 React + Vite + TypeScript + CSS 기반 PWA 프런트엔드다.

## 데이터 흐름

1. 호스트가 `/`에서 방을 만들면 서버가 `roomId`, `roomCode`, `hostToken`, `lanOrigin`을 발급한다.
2. 플레이어는 `/join`에서 닉네임으로 참가하고 `playerToken`을 받아 `/p/:playerToken`으로 이동한다.
3. 호스트와 플레이어는 모두 REST로 1차 claim 후 Socket.IO로 subscribe 한다.
4. 모든 실질 게임 상태 변화는 서버에서 `commandSchema` 검증 후 `packages/game-engine` reducer로만 처리한다.
5. 서버는 같은 `RoomState`에서 호스트용 `HostView`, 플레이어별 `PlayerView`를 각각 projection 하여 push 한다.

## public / private 분리

- 공용 화면은 `getHostView()`만 사용한다.
- 플레이어 화면은 `getPlayerView(state, playerId)`로 생성된 개인 뷰만 사용한다.
- 역할, 팀 지식, 손패, 조사 결과는 권한 있는 플레이어 projection에만 포함된다.
- 서버 로그와 공개 로그는 `publicLog`만 사용하며 비밀 카드 선택 내역은 별도 secret log로 저장하지 않는다.

## 상태 머신

엔진은 다음 phase를 명시적으로 가진다.

- `lobby`
- `game_setup`
- `role_reveal`
- `president_rotation`
- `chancellor_nomination`
- `voting_open`
- `voting_reveal`
- `government_formed`
- `hitler_chancellor_check`
- `president_draw_3`
- `president_discards_1`
- `chancellor_chooses_1_or_veto`
- `enact_policy`
- `resolve_executive_power`
- `next_round`
- `game_over`

## 영속성 선택

- JSON snapshot 파일을 선택했다.
- 이유:
  - 단일 호스트 PC, 단일 프로세스 전제에서 가장 단순하다.
  - 외부 인프라 없이 방 복구와 새로고침 복구를 충족할 수 있다.
  - `apps/server/src/persistence.ts`에서 temp file write 후 rename 방식으로 저장해 손상 가능성을 낮췄다.
- 저장 위치는 `data/store.json`이다.

## 재접속 / 복구

- 호스트는 `localStorage`의 `sh.host.<roomId>` 토큰으로 `/host/:roomId` 새로고침을 복구한다.
- 플레이어는 `playerToken` 기반 `/p/:playerToken` 경로와 `localStorage` 저장으로 재접속을 복구한다.
- 서버는 스냅샷에서 room state, host token, player token을 다시 읽어 프로세스 재시작 후에도 복구한다.

## UI 자산 전략

- PDF 페이지를 PNG로 추출한 뒤 `apps/web/src/lib/assets.ts`에서 직접 import 했다.
- 보드, 역할 카드, 멤버십 카드, 투표 카드, 정책 카드는 PNG crop 기반 `SpriteCrop`으로 노출한다.
- 상호작용이 필요한 부분만 HTML/CSS 버튼과 overlay로 구현했다.

## 테스트 전략

- 단위 테스트는 `packages/game-engine/tests/engine.test.ts`에 집중시켜 규칙 엔진을 고정한다.
- E2E는 `apps/web/e2e/game.spec.ts`에서 host 1개 + 모바일 다중 세션으로 검증한다.
- Playwright는 테스트용 state patch API를 통해 권한 상황을 빠르게 재현한다.
