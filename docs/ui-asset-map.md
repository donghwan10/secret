# UI 자산 매핑

## 참조 소스

- 규칙/로고 분위기: `docs/reference-pages/game-guide/page-01.png`
- 카드/투표/역할/멤버십: `docs/reference-pages/print-and-play/page-02.png` ~ `page-09.png`
- 보드: `docs/reference-pages/print-and-play/page-10.png` ~ `page-13.png`

## 페이지별 매핑

| PDF 페이지 | 사용 위치 | 구현 파일 |
| --- | --- | --- |
| 게임 방법 1페이지 | 랜딩 로고, 전체 색감과 포스터 분위기 | `apps/web/src/pages/HomePage.tsx`, `apps/web/src/styles.css`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 2페이지 | 파시스트 정책 카드 crop | `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 4페이지 | Ja 투표 카드와 자유 정책 crop | `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 5페이지 | Nein 투표 카드 crop | `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 7페이지 | 자유당 역할 카드 | `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 8페이지 | 히틀러/파시스트 역할 카드 | `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 9페이지 | 자유당/파시스트 멤버십 카드 | `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 10페이지 | 자유당 보드 배경 | `apps/web/src/components/HostBoard.tsx`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 11페이지 | 5~6인 파시스트 보드 배경 | `apps/web/src/components/HostBoard.tsx`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 12페이지 | 7~8인 파시스트 보드 배경 | `apps/web/src/components/HostBoard.tsx`, `apps/web/src/lib/assets.ts` |
| 프린트 플레이 13페이지 | 9~10인 파시스트 보드 배경 | `apps/web/src/components/HostBoard.tsx`, `apps/web/src/lib/assets.ts` |

## 인터랙션 원칙

- 카드, 보드, 멤버십은 PDF crop 이미지를 그대로 보여 준다.
- 클릭 가능한 부분은 HTML 버튼으로 감싸 모바일 터치 영역을 넓혔다.
- 호스트 보드는 PDF 보드 이미지를 배경층으로 두고, 현재 정책 수와 권한 라벨은 overlay로 올렸다.
- 플레이어 역할 화면은 shoulder surfing 방지를 위해 기본 가림 상태에서 수동 reveal 하도록 구성했다.

## 관련 구현 파일

- 자산 import/crop 정의: `apps/web/src/lib/assets.ts`
- crop 렌더러: `apps/web/src/components/SpriteCrop.tsx`
- 호스트 보드: `apps/web/src/components/HostBoard.tsx`
- 플레이어 액션 화면: `apps/web/src/pages/PlayerPage.tsx`
- 전체 질감과 레이아웃: `apps/web/src/styles.css`
