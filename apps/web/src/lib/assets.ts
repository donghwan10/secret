import coverPage from "../../../../docs/reference-pages/game-guide/page-01.png";
import liberalBoardImage from "../assets/print-and-play/boards/liberal-board.png";
import fascistBoard56Image from "../assets/print-and-play/boards/fascist-board-56.png";
import fascistBoard78Image from "../assets/print-and-play/boards/fascist-board-78.png";
import fascistBoard910Image from "../assets/print-and-play/boards/fascist-board-910.png";
import liberalRolePage from "../../../../docs/reference-pages/print-and-play/page-07.png";
import rolePage from "../../../../docs/reference-pages/print-and-play/page-08.png";
import membershipPage from "../../../../docs/reference-pages/print-and-play/page-09.png";
import voteJaPage from "../../../../docs/reference-pages/print-and-play/page-04.png";
import voteNeinPage from "../../../../docs/reference-pages/print-and-play/page-06.png";
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

const stitchedBoard = (src: string, width = 2114): SpriteSource => ({
  src,
  width,
  height: 670
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
  liberalBoard: stitchedBoard(liberalBoardImage),
  fascistBoard56: stitchedBoard(fascistBoard56Image, 2126),
  fascistBoard78: stitchedBoard(fascistBoard78Image, 2126),
  fascistBoard910: stitchedBoard(fascistBoard910Image, 2126)
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
  fascistPolicy: { x: 240, y: 145, width: 360, height: 240 } satisfies CropRect,
  liberalPolicy: { x: 690, y: 330, width: 235, height: 360 } satisfies CropRect
};
