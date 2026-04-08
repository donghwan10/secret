import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  devices,
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page
} from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.resolve(__dirname, "../../../docs/screenshots");

interface CreatedPlayer {
  playerId: string;
  playerToken: string;
  nickname: string;
}

interface CreatedRoom {
  roomId: string;
  roomCode: string;
  hostToken: string;
  players: CreatedPlayer[];
}

async function ensureScreenshotDir(): Promise<void> {
  await fs.mkdir(screenshotDir, { recursive: true });
}

async function createRoomWithPlayers(
  request: APIRequestContext,
  playerCount: number
): Promise<CreatedRoom> {
  const roomResponse = await request.post("/api/rooms", { data: {} });
  expect(roomResponse.ok()).toBeTruthy();

  const room = (await roomResponse.json()) as {
    roomId: string;
    roomCode: string;
    hostToken: string;
  };

  const players: CreatedPlayer[] = [];
  for (let index = 0; index < playerCount; index += 1) {
    const nickname = `P${index + 1}`;
    const response = await request.post("/api/players/join", {
      data: {
        roomCode: room.roomCode,
        nickname
      }
    });
    expect(response.ok()).toBeTruthy();

    const joined = (await response.json()) as {
      playerId: string;
      playerToken: string;
    };
    players.push({
      playerId: joined.playerId,
      playerToken: joined.playerToken,
      nickname
    });
  }

  return {
    ...room,
    players
  };
}

async function patchRoom(
  request: APIRequestContext,
  roomId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const response = await request.post(`/api/test/rooms/${roomId}/state`, {
    data: { patch }
  });
  expect(response.ok()).toBeTruthy();
}

async function openHost(page: Page, roomId: string, hostToken: string): Promise<void> {
  await page.addInitScript(
    ({ nextRoomId, nextHostToken }) => {
      window.localStorage.setItem(`sh.host.${nextRoomId}`, nextHostToken);
    },
    { nextRoomId: roomId, nextHostToken: hostToken }
  );
  await page.goto(`/host/${roomId}`);
  await expect(page.getByText("방 코드")).toBeVisible();
}

async function openPlayer(page: Page, playerToken: string): Promise<void> {
  await page.goto(`/p/${playerToken}`);
  await expect(page.getByText("방 코드")).toBeVisible();
}

async function openMobilePlayers(
  browser: Browser,
  players: CreatedPlayer[]
): Promise<{ contexts: BrowserContext[]; pages: Page[] }> {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];

  for (const player of players) {
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    contexts.push(context);
    pages.push(page);
    await openPlayer(page, player.playerToken);
  }

  return { contexts, pages };
}

test("5인 게임 happy path", async ({ browser, page, request }) => {
  await ensureScreenshotDir();

  const room = await createRoomWithPlayers(request, 5);
  const { contexts, pages } = await openMobilePlayers(browser, room.players);

  try {
    await openHost(page, room.roomId, room.hostToken);
    await expect(page.locator(".seat-list li")).toHaveCount(5);

    await page.getByRole("button", { name: "게임 시작" }).click();
    await patchRoom(request, room.roomId, {
      regularNextPresidentId: room.players[0]?.playerId,
      drawPile: ["liberal", "liberal", "fascist", "liberal", "fascist"],
      players: Object.fromEntries(
        room.players.map((player, index) => [
          player.playerId,
          {
            role:
              index === 3
                ? "fascist"
                : index === 4
                  ? "hitler"
                  : "liberal"
          }
        ])
      )
    });

    await page.getByRole("button", { name: "다음 단계" }).click();
    for (const playerPage of pages) {
      await playerPage.getByRole("button", { name: "역할 공개하기" }).click();
      await playerPage.getByRole("button", { name: "역할 확인 완료" }).click();
    }

    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(page.getByText("P1 님 차례")).toBeVisible();
    await page.getByRole("button", { name: "다음 단계" }).click();

    await pages[0]?.getByRole("button", { name: "P2" }).click();
    for (const playerPage of pages) {
      await playerPage.locator(".vote-card-button").first().click();
    }

    await page.getByRole("button", { name: "다음 단계" }).click();
    await page.getByRole("button", { name: "다음 단계" }).click();

    await pages[0]?.getByRole("button", { name: "카드 확인 후 폐기 고르기" }).click();
    await pages[0]?.locator(".policy-choice-button").nth(2).click();
    await pages[1]?.locator(".policy-choice-button").first().click();

    await expect(page.getByText("자유 정책이 시행되었습니다.")).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, "host-5-player.png"),
      fullPage: true
    });
    await pages[0]?.screenshot({
      path: path.join(screenshotDir, "mobile-5-player.png"),
      fullPage: true
    });
  } finally {
    for (const context of contexts) {
      await context.close();
    }
  }
});

test("7인 게임 특수 선거 path", async ({ browser, page, request }) => {
  const room = await createRoomWithPlayers(request, 7);
  const presidentContext = await browser.newContext({ ...devices["iPhone 13"] });
  const targetContext = await browser.newContext({ ...devices["iPhone 13"] });

  try {
    await patchRoom(request, room.roomId, {
      phase: "resolve_executive_power",
      turn: 4,
      currentPresidentId: room.players[0]?.playerId,
      currentRoundType: "regular",
      regularNextPresidentId: room.players[0]?.playerId,
      fascistPolicyCount: 3,
      pendingExecutiveAction: {
        power: "special_election",
        presidentId: room.players[0]?.playerId,
        targetId: null,
        investigationResult: null,
        peekedPolicies: null
      },
      players: Object.fromEntries(
        room.players.map((player, index) => [
          player.playerId,
          {
            role:
              index === 6
                ? "hitler"
                : index <= 2
                  ? "fascist"
                  : "liberal"
          }
        ])
      )
    });

    const presidentPage = await presidentContext.newPage();
    const targetPage = await targetContext.newPage();

    await openHost(page, room.roomId, room.hostToken);
    await openPlayer(presidentPage, room.players[0]?.playerToken ?? "");
    await openPlayer(targetPage, room.players[4]?.playerToken ?? "");

    await presidentPage.getByRole("button", { name: "P5" }).click();
    await expect(page.getByText("P5 님이 차기 대통령 후보로 지정되었습니다.")).toBeVisible();

    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(targetPage.locator(".phase-chip")).toHaveText("P5 님 차례");
  } finally {
    await presidentContext.close();
    await targetContext.close();
  }
});

test("10인 게임 smoke test", async ({ browser, page, request }) => {
  const room = await createRoomWithPlayers(request, 10);
  const mobileContext = await browser.newContext({ ...devices["iPhone 13"] });

  try {
    const playerPage = await mobileContext.newPage();

    await openHost(page, room.roomId, room.hostToken);
    await openPlayer(playerPage, room.players[0]?.playerToken ?? "");

    await expect(page.locator(".seat-list li")).toHaveCount(10);
    await page.getByRole("button", { name: "게임 시작" }).click();
    await expect(page.getByRole("button", { name: "다음 단계" })).toBeVisible();
    await expect(playerPage.getByText("방 코드")).toBeVisible();
  } finally {
    await mobileContext.close();
  }
});
