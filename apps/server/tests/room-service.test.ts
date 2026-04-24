import { describe, expect, it, vi } from "vitest";

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

  getSnapshots(): PersistedRoomSnapshot[] {
    return this.snapshots;
  }
}

class DeferredStore {
  readonly snapshots: PersistedRoomSnapshot[][] = [];
  activeSaves = 0;
  maxActiveSaves = 0;
  saveCalls = 0;
  private readonly saveResolvers: Array<() => void> = [];
  private readonly saveStartWaiters: Array<() => void> = [];

  async load(): Promise<PersistedRoomSnapshot[]> {
    return [];
  }

  async save(rooms: PersistedRoomSnapshot[]): Promise<void> {
    this.saveCalls += 1;
    this.activeSaves += 1;
    this.maxActiveSaves = Math.max(this.maxActiveSaves, this.activeSaves);
    this.snapshots.push(rooms);
    this.resolveSaveStartWaiters();

    try {
      await new Promise<void>((resolve) => {
        this.saveResolvers.push(resolve);
      });
    } finally {
      this.activeSaves -= 1;
    }
  }

  completeNextSave(): void {
    const resolve = this.saveResolvers.shift();
    if (!resolve) {
      throw new Error("No pending save to complete.");
    }
    resolve();
  }

  async waitForSaveStart(expectedSaveCalls: number): Promise<void> {
    while (this.saveCalls < expectedSaveCalls) {
      await new Promise<void>((resolve) => {
        this.saveStartWaiters.push(resolve);
      });
    }
  }

  private resolveSaveStartWaiters(): void {
    const waiters = this.saveStartWaiters.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }
}

class FailingOnceStore extends MemoryStore {
  saveCalls = 0;

  override async save(rooms: PersistedRoomSnapshot[]): Promise<void> {
    this.saveCalls += 1;
    if (this.saveCalls === 1) {
      throw new Error("Simulated save failure.");
    }
    await super.save(rooms);
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

  it("serializes snapshot saves so writes cannot overlap", async () => {
    const store = new DeferredStore();
    const service = new RoomService(store, "http://127.0.0.1:3000");
    await service.load();

    const room = service.createRoom();
    service.joinRoom(room.roomCode, "P1");
    service.joinRoom(room.roomCode, "P2");
    const persisted = service.waitForPersistence();

    await store.waitForSaveStart(1);
    expect(store.activeSaves).toBe(1);
    expect(store.saveCalls).toBe(1);

    store.completeNextSave();
    await store.waitForSaveStart(2);
    expect(store.activeSaves).toBe(1);
    expect(store.saveCalls).toBe(2);

    store.completeNextSave();
    await store.waitForSaveStart(3);
    expect(store.activeSaves).toBe(1);
    expect(store.saveCalls).toBe(3);

    store.completeNextSave();
    await persisted;

    expect(store.maxActiveSaves).toBe(1);
    expect(store.snapshots.at(-1)?.[0]?.state.seatOrder).toHaveLength(2);
  });

  it("keeps later snapshot saves running after a save failure", async () => {
    const store = new FailingOnceStore();
    const service = new RoomService(store, "http://127.0.0.1:3000");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      await service.load();
      const room = service.createRoom();
      service.joinRoom(room.roomCode, "P1");
      await service.waitForPersistence();

      expect(store.saveCalls).toBe(2);
      expect(store.getSnapshots()[0]?.state.seatOrder).toHaveLength(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to persist room snapshots.",
        expect.any(Error)
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
