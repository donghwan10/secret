# 감사 결과

기준 문서:

- `docs/시크릿 히틀러 - 게임 방법.pdf`
- `docs/시크릿 히틀러 - 프린트 플레이.pdf`

## mismatch 표

| ID | 항목 | PDF/요구 기준 | 감사 결과 | 조치 |
| --- | --- | --- | --- | --- |
| A-01 | socket 재구독 시 비밀 payload 분리 | 비공개 정보는 권한 없는 클라이언트에 전송되면 안 됨 | 동일 socket이 다른 플레이어 또는 호스트로 재구독할 때 이전 구독이 남아, 같은 socket으로 다른 플레이어의 `player:update` payload가 전달될 수 있는 구조였다. | `apps/server/src/room-service.ts`, `apps/server/src/index.ts`, `apps/web/src/pages/HostPage.tsx`, `apps/web/src/pages/PlayerPage.tsx`를 수정해 재구독 시 기존 연결을 모두 제거하고 페이지 언마운트 시 disconnect 하도록 고쳤다. |
| A-02 | 히틀러 수상 체크 후 공개 정보 | 3개 이상 파시스트 정책 후 수상이 히틀러가 아니면 모두가 그 사실을 확실히 알 수 있어야 함 | 승리 타이밍 자체는 맞았지만, 히틀러가 아니었던 경우 공개 로그에 남지 않아 공용 정보가 불완전했다. | `packages/game-engine/src/reducer.ts`에 공개 로그를 추가했다. |
| A-03 | 공용 수상 후보 표시 | 대통령이 수상 후보를 지명하면 그 후보는 공개 정보임 | `HostView.currentGovernment`가 당선된 수상만 보여 주어, 지명 이후 투표 단계에서 공용 상태가 비어 있었다. | `packages/game-engine/src/projections.ts`에서 `nominatedChancellorId`를 공용 수상 표시로 승격했다. |
| A-04 | PDF 분위기 반영 강도 | 로고/보드/카드/투표 자산 사용 및 grayscale/distressed 분위기 유지 | PDF 자산 사용은 맞았지만, 상단 레이블과 패널 질감이 웹 기본 UI 느낌이 남아 PDF 분위기 재현이 약했다. | `apps/web/src/pages/HostPage.tsx`, `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/styles.css`를 보정해 한글 레이블과 종이/그레이스케일 질감을 강화했다. |

## 집중 점검 결과

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 5인 게임 수상 후보 예외 | 일치 | `packages/game-engine/src/utils.ts`의 `getEligibleChancellorIds()` |
| 3연속 정부 부결 chaos 처리 | 일치 | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/utils.ts` |
| 히틀러 수상 즉시 승리 타이밍 | 일치, 공개 로그 보강 | `packages/game-engine/src/reducer.ts` |
| 조사 시 party membership만 공개 | 일치 | `packages/game-engine/src/utils.ts`의 `getInvestigationResult()` |
| 히틀러 조사 결과가 fascist membership인지 | 일치 | `packages/game-engine/src/knowledge.ts`, `packages/game-engine/src/utils.ts` |
| 특수 선거 후 대통령 순서 복귀 | 일치 | `packages/game-engine/src/utils.ts`, `packages/game-engine/src/reducer.ts` |
| 처형 후 dead-player lockout | 일치 | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/projections.ts`, `apps/web/src/pages/PlayerPage.tsx` |
| 5개 파시스트 정책 이후 베토 | 일치 | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/projections.ts` |
| host 화면/로그/network payload secret leakage | 수정 완료 | `apps/server/tests/room-service.test.ts`, `packages/game-engine/tests/engine.test.ts` |

## UI 감사

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 보드/카드/투표/역할 아트 사용 | 일치 | `apps/web/src/lib/assets.ts`, `apps/web/src/components/SpriteCrop.tsx` |
| grayscale/distressed 스타일 | 부분 일치에서 보강 완료 | `apps/web/src/styles.css` |
| host/public vs player/private 분리 | 일치, 재구독 누수 수정 완료 | `packages/game-engine/src/projections.ts`, `apps/server/src/room-service.ts` |

## 증거 파일

- `packages/game-engine/tests/engine.test.ts`
- `apps/server/tests/room-service.test.ts`
- `docs/screenshots/host-5-player.png`
- `docs/screenshots/mobile-5-player.png`
