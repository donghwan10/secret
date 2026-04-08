import coverPage from "../../../../docs/reference-pages/game-guide/page-01.png";
import liberalBoardPage from "../../../../docs/reference-pages/print-and-play/page-10.png";
import fascistBoard56Page from "../../../../docs/reference-pages/print-and-play/page-11.png";
import fascistBoard78Page from "../../../../docs/reference-pages/print-and-play/page-12.png";
import fascistBoard910Page from "../../../../docs/reference-pages/print-and-play/page-13.png";
import liberalRolePage from "../../../../docs/reference-pages/print-and-play/page-07.png";
import rolePage from "../../../../docs/reference-pages/print-and-play/page-08.png";
import membershipPage from "../../../../docs/reference-pages/print-and-play/page-09.png";
import voteJaPage from "../../../../docs/reference-pages/print-and-play/page-04.png";
import voteNeinPage from "../../../../docs/reference-pages/print-and-play/page-05.png";
import fascistPolicyPage from "../../../../docs/reference-pages/print-and-play/page-02.png";
import liberalPolicyPage from "../../../../docs/reference-pages/print-and-play/page-04.png";

export interface SpriteSource {
  src: string;
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: number;
}

const landscape = (src: string): SpriteSource => ({
  src,
  width: 1760,
  height: 1360
});

const portrait = (src: string): SpriteSource => ({
  src,
  width: 1360,
  height: 1760
});

export const assets = {
  cover: portrait(coverPage),
  roleLiberal: landscape(liberalRolePage),
  roles: landscape(rolePage),
  memberships: landscape(membershipPage),
  voteJa: landscape(voteJaPage),
  voteNein: landscape(voteNeinPage),
  fascistPolicy: landscape(fascistPolicyPage),
  liberalPolicy: landscape(liberalPolicyPage),
  liberalBoard: landscape(liberalBoardPage),
  fascistBoard56: landscape(fascistBoard56Page),
  fascistBoard78: landscape(fascistBoard78Page),
  fascistBoard910: landscape(fascistBoard910Page)
};

export const crops = {
  coverLogo: { x: 220, y: 240, width: 920, height: 1020 } satisfies CropRect,
  roleLiberal: { x: 70, y: 35, width: 350, height: 585 } satisfies CropRect,
  roleHitler: { x: 930, y: 30, width: 330, height: 585 } satisfies CropRect,
  roleFascist: { x: 1365, y: 30, width: 330, height: 585 } satisfies CropRect,
  membershipLiberal: { x: 935, y: 35, width: 350, height: 585 } satisfies CropRect,
  membershipFascist: { x: 60, y: 35, width: 350, height: 585 } satisfies CropRect,
  voteJa: { x: 55, y: 35, width: 340, height: 610 } satisfies CropRect,
  voteNein: { x: 55, y: 35, width: 340, height: 610 } satisfies CropRect,
  fascistPolicy: { x: 235, y: 90, width: 355, height: 500 } satisfies CropRect,
  liberalPolicy: { x: 700, y: 265, width: 235, height: 350 } satisfies CropRect,
  liberalBoard: { x: 40, y: 80, width: 800, height: 1200, rotate: 90 } satisfies CropRect,
  fascistBoard56: { x: 40, y: 80, width: 800, height: 1200, rotate: 90 } satisfies CropRect,
  fascistBoard78: { x: 40, y: 80, width: 800, height: 1200, rotate: 90 } satisfies CropRect,
  fascistBoard910: { x: 40, y: 80, width: 800, height: 1200, rotate: 90 } satisfies CropRect
};
