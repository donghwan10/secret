import { describe, expect, it } from "vitest";

import type { PersistedRoomSnapshot } from "../src/persistence.js";
import { RoomService } from "../src/room-service.js";

class MemoryStore {
  private snapshots: PersistedRoomSnapshot[] = [];

  async load(): Promise<PersistedRoomSnapshot[]> {
    return this.snapshots;
  }

  async save(rooms: PersistedRoomSnapshot[]): Promise<void> {
    this.snapshots = rooms;
  }
}

describe("room service", () => {
  it("removes stale player subscriptions when a socket claims a different player or host role", async () => {
    const service = new RoomService(new MemoryStore(), "http://127.0.0.1:3000");
    await service.load();

    const room = service.createRoom();
    const firstPlayer = service.joinRoom(room.roomCode, "P1");
    const secondPlayer = service.joinRoom(room.roomCode, "P2");

    service.subscribePlayer("socket-1", firstPlayer.playerToken);
    let payload = service.getRoomPushPayload(room.roomId);
    expect(payload.players.find((entry) => entry.view.playerId === firstPlayer.playerId)?.socketIds).toEqual([
      "socket-1"
    ]);

    service.subscribePlayer("socket-1", secondPlayer.playerToken);
    payload = service.getRoomPushPayload(room.roomId);
    expect(payload.players.find((entry) => entry.view.playerId === firstPlayer.playerId)).toBeUndefined();
    expect(payload.players.find((entry) => entry.view.playerId === secondPlayer.playerId)?.socketIds).toEqual([
      "socket-1"
    ]);

    service.subscribeHost("socket-1", room.roomId, room.hostToken);
    payload = service.getRoomPushPayload(room.roomId);
    expect(payload.players.find((entry) => entry.view.playerId === secondPlayer.playerId)).toBeUndefined();
    expect(payload.hostSockets).toEqual(["socket-1"]);
  });
});
