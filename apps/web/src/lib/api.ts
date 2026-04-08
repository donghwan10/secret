import {
  claimHostRequestSchema,
  claimPlayerRequestSchema,
  createRoomResponseSchema,
  joinRoomRequestSchema,
  joinRoomResponseSchema
} from "@secret/shared";
import type { HostView, PlayerView } from "@secret/game-engine";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "요청에 실패했습니다.");
  }
  return (await response.json()) as T;
}

export async function createRoom(): Promise<{
  roomId: string;
  roomCode: string;
  hostToken: string;
  lanOrigin: string;
}> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });

  return createRoomResponseSchema.parse(await readJson(response));
}

export async function claimHost(roomId: string, hostToken: string): Promise<{
  roomId: string;
  hostView: HostView;
  lanOrigin: string;
}> {
  const payload = claimHostRequestSchema.parse({
    roomId,
    hostToken
  });

  const response = await fetch("/api/host/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return (await readJson(response)) as {
    roomId: string;
    hostView: HostView;
    lanOrigin: string;
  };
}

export async function joinRoom(roomCode: string, nickname: string): Promise<{
  roomId: string;
  playerId: string;
  playerToken: string;
}> {
  const payload = joinRoomRequestSchema.parse({
    roomCode,
    nickname
  });

  const response = await fetch("/api/players/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return joinRoomResponseSchema.parse(await readJson(response));
}

export async function claimPlayer(playerToken: string): Promise<{
  roomId: string;
  playerId: string;
  playerView: PlayerView;
}> {
  const payload = claimPlayerRequestSchema.parse({
    playerToken
  });

  const response = await fetch("/api/players/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return (await readJson(response)) as {
    roomId: string;
    playerId: string;
    playerView: PlayerView;
  };
}
