import fs from "node:fs/promises";
import path from "node:path";

import type { RoomState } from "@secret/game-engine";

export interface PersistedRoomSnapshot {
  roomId: string;
  roomCode: string;
  hostToken: string;
  playerTokens: Record<string, string>;
  state: RoomState;
}

interface StorePayload {
  version: 1;
  rooms: PersistedRoomSnapshot[];
}

export class SnapshotStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<PersistedRoomSnapshot[]> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const payload = JSON.parse(raw) as StorePayload;
      return payload.rooms ?? [];
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async save(rooms: PersistedRoomSnapshot[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload: StorePayload = {
      version: 1,
      rooms
    };
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
    await fs.rm(this.filePath, { force: true });
    await fs.rename(tempPath, this.filePath);
  }
}
