# PDF 규칙 매핑

| PDF 규칙 항목 | 구현 위치 | 비고 |
| --- | --- | --- |
| 플레이어 수별 역할 분포 | `packages/shared/src/constants.ts`, `packages/game-engine/src/utils.ts` | `ROLE_DISTRIBUTION` 사용 |
| 정책 카드 구성 6/11 | `packages/shared/src/constants.ts`, `packages/game-engine/src/utils.ts` | `POLICY_DECK_COUNTS`, `assignDeck()` |
| 승리 조건 | `packages/game-engine/src/reducer.ts` | 정책 트랙 승리, 히틀러 수상 승리, 히틀러 처형 승리 |
| 5~6인 / 7~10인 비밀 정보 차이 | `packages/game-engine/src/knowledge.ts` | `getKnownTeam()` |
| 명시적 라운드 상태 머신 | `packages/shared/src/constants.ts`, `packages/game-engine/src/reducer.ts` | `GAME_PHASES`, `advancePhase()` |
| 대통령 순환 / 특별 선거 복귀 | `packages/game-engine/src/utils.ts`, `packages/game-engine/src/reducer.ts` | `beginPresidency()`, `prepareNextRound()` |
| 수상 후보 자격 제한과 5인 예외 | `packages/game-engine/src/utils.ts` | `getEligibleChancellorIds()` |
| 생존자 동시 투표 / 과반 초과 | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/utils.ts` | `cast_vote`, `tallyVotes()` |
| election tracker / chaos | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/utils.ts` | `createChaosResolution()` |
| 히틀러 수상 당선 체크 | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/utils.ts` | `getWinnerForHitlerElection()` |
| 입법회의 3장 드로우 / 1장 폐기 / 2장 전달 | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/utils.ts` | 비밀 카드 정보는 projection 분리 |
| 정책 더미 부족 시 셔플 | `packages/game-engine/src/utils.ts` | `refillDeckIfNeeded()` |
| 조사 / 정책 선정 / 특수 선거 / 처형 | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/projections.ts` | 플레이어별 비공개 액션 UI 제공 |
| 히틀러 조사 시 파시스트 멤버십 | `packages/game-engine/src/knowledge.ts`, `packages/game-engine/src/utils.ts` | 역할 카드가 아닌 멤버십만 노출 |
| 동일 플레이어 조사 2회 금지 | `packages/game-engine/src/reducer.ts` | `investigatedPlayerIds` 추적 |
| 처형 후 상호작용 잠금 | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/projections.ts`, `apps/web/src/pages/PlayerPage.tsx` | dead action 처리 |
| 베토 해금 / 요청 / 수락 / 거부 | `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/projections.ts`, `apps/web/src/pages/PlayerPage.tsx` | 대통령 응답 UI 포함 |
| public/private state 분리 | `packages/game-engine/src/projections.ts`, `apps/server/src/room-service.ts` | 호스트 뷰와 플레이어 뷰 분리 push |
| 소켓 이벤트 검증 | `packages/shared/src/schemas.ts`, `apps/server/src/index.ts` | `commandSchema` 사용 |

## 테스트 매핑

- 역할 분포: `packages/game-engine/tests/engine.test.ts`
- 비밀 정보 공개 차이: `packages/game-engine/tests/engine.test.ts`
- 5인 수상 후보 예외: `packages/game-engine/tests/engine.test.ts`
- chaos 정책: `packages/game-engine/tests/engine.test.ts`
- 히틀러 수상 승리: `packages/game-engine/tests/engine.test.ts`
- 조사 시 히틀러 멤버십: `packages/game-engine/tests/engine.test.ts`
- 조사 2회 금지: `packages/game-engine/tests/engine.test.ts`
- 특수 선거 복귀: `packages/game-engine/tests/engine.test.ts`
- 정책 선정: `packages/game-engine/tests/engine.test.ts`
- 처형과 히틀러 처형 승리: `packages/game-engine/tests/engine.test.ts`
- 베토 수락/거부: `packages/game-engine/tests/engine.test.ts`
- 셔플 규칙: `packages/game-engine/tests/engine.test.ts`
- dead-player lockout: `packages/game-engine/tests/engine.test.ts`
- public/private state 분리: `packages/game-engine/tests/engine.test.ts`
- host + player 다중 세션 흐름: `apps/web/e2e/game.spec.ts`
