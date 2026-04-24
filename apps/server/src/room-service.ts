import crypto from "node:crypto";

import {
  applyCommand,
  createRoomState,
  getHostView,
  getPlayerView
} from "@secret/game-engine";
import type { HostView, PlayerView, RoomState } from "@secret/game-engine";
import type { Command } from "@secret/shared";

import type { PersistedRoomSnapshot, SnapshotRepository } from "./persistence.js";

type SocketIdentity =
  | {
      kind: "host";
      roomId: string;
    }
  | {
      kind: "player";
      roomId: string;
      playerId: string;
      playerToken: string;
    };

interface RoomRecord {
  roomId: string;
  roomCode: string;
  hostToken: string;
  playerTokens: Record<string, string>;
  state: RoomState;
  hostSocketIds: Set<string>;
  playerSocketIds: Map<string, Set<string>>;
}

export class RoomService {
  private readonly roomsById = new Map<string, RoomRecord>();
  private readonly roomIdByCode = new Map<string, string>();
  private readonly playerTokenIndex = new Map<string, { roomId: string; playerId: string }>();
  private readonly socketIdentities = new Map<string, SocketIdentity>();
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: SnapshotRepository,
    private readonly lanOrigin: string
  ) {}

  async load(): Promise<void> {
    const snapshots = await this.store.load();
    for (const snapshot of snapshots) {
      const room: RoomRecord = {
        ...snapshot,
        hostSocketIds: new Set<string>(),
        playerSocketIds: new Map<string, Set<string>>()
      };
      this.roomsById.set(room.roomId, room);
      this.roomIdByCode.set(room.roomCode, room.roomId);
      for (const [playerId, playerToken] of Object.entries(room.playerTokens)) {
        this.playerTokenIndex.set(playerToken, {
          roomId: room.roomId,
          playerId
        });
      }
    }
  }

  createRoom(): {
    roomId: string;
    roomCode: string;
    hostToken: string;
    lanOrigin: string;
    hostView: HostView;
  } {
    const roomId = this.createId("room");
    const roomCode = this.createRoomCode();
    const hostToken = this.createOpaqueToken("host");
    const state = createRoomState({
      roomId,
      roomCode
    });

    const room: RoomRecord = {
      roomId,
      roomCode,
      hostToken,
      playerTokens: {},
      state,
      hostSocketIds: new Set<string>(),
      playerSocketIds: new Map<string, Set<string>>()
    };

    this.roomsById.set(roomId, room);
    this.roomIdByCode.set(roomCode, roomId);
    this.enqueuePersist();

    return {
      roomId,
      roomCode,
      hostToken,
      lanOrigin: this.lanOrigin,
      hostView: this.getRoomHostView(room)
    };
  }

  claimHost(roomId: string, hostToken: string): {
    roomId: string;
    hostView: HostView;
    lanOrigin: string;
  } {
    const room = this.getRoom(roomId);
    if (room.hostToken !== hostToken) {
      throw new Error("호스트 인증에 실패했습니다.");
    }

    return {
      roomId,
      hostView: this.getRoomHostView(room),
      lanOrigin: this.lanOrigin
    };
  }

  joinRoom(roomCode: string, nickname: string): {
    roomId: string;
    playerId: string;
    playerToken: string;
    playerView: PlayerView;
  } {
    const roomId = this.roomIdByCode.get(roomCode);
    if (!roomId) {
      throw new Error("방 코드를 찾을 수 없습니다.");
    }

    const room = this.getRoom(roomId);
    const playerId = this.createId("player");
    const playerToken = this.createOpaqueToken("player");

    room.state = applyCommand(room.state, {
      type: "add_player",
      playerId,
      nickname
    });
    room.playerTokens[playerId] = playerToken;
    this.playerTokenIndex.set(playerToken, {
      roomId,
      playerId
    });
    this.enqueuePersist();

    return {
      roomId,
      playerId,
      playerToken,
      playerView: this.getRoomPlayerView(room, playerId)
    };
  }

  claimPlayer(playerToken: string): {
    roomId: string;
    playerId: string;
    playerView: PlayerView;
  } {
    const entry = this.playerTokenIndex.get(playerToken);
    if (!entry) {
      throw new Error("플레이어 인증에 실패했습니다.");
    }

    const room = this.getRoom(entry.roomId);
    return {
      roomId: entry.roomId,
      playerId: entry.playerId,
      playerView: this.getRoomPlayerView(room, entry.playerId)
    };
  }

  subscribeHost(
    socketId: string,
    roomId: string,
    hostToken: string
  ): { view: HostView; detachedRoomIds: string[] } {
    const room = this.getRoom(roomId);
    if (room.hostToken !== hostToken) {
      throw new Error("호스트 인증에 실패했습니다.");
    }
    const detachedRoomIds = this.detachSocket(socketId).filter((id) => id !== roomId);
    room.hostSocketIds.add(socketId);
    this.socketIdentities.set(socketId, {
      kind: "host",
      roomId
    });
    return {
      view: this.getRoomHostView(room),
      detachedRoomIds
    };
  }

  subscribePlayer(
    socketId: string,
    playerToken: string
  ): { view: PlayerView; detachedRoomIds: string[] } {
    const entry = this.playerTokenIndex.get(playerToken);
    if (!entry) {
      throw new Error("플레이어 인증에 실패했습니다.");
    }
    const room = this.getRoom(entry.roomId);
    const detachedRoomIds = this.detachSocket(socketId).filter((id) => id !== entry.roomId);
    const playerSockets = room.playerSocketIds.get(entry.playerId) ?? new Set<string>();
    playerSockets.add(socketId);
    room.playerSocketIds.set(entry.playerId, playerSockets);
    this.socketIdentities.set(socketId, {
      kind: "player",
      roomId: entry.roomId,
      playerId: entry.playerId,
      playerToken
    });
    return {
      view: this.getRoomPlayerView(room, entry.playerId),
      detachedRoomIds
    };
  }

  unsubscribe(socketId: string): string[] {
    return this.detachSocket(socketId);
  }

  applySocketCommand(socketId: string, command: Command): string {
    const identity = this.socketIdentities.get(socketId);
    if (!identity) {
      throw new Error("먼저 구독을 완료해야 합니다.");
    }

    const room = this.getRoom(identity.roomId);
    let nextState = room.state;

    switch (command.type) {
      case "player:set-ready":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "set_player_ready",
          playerId: identity.playerId,
          ready: command.ready
        });
        break;
      case "host:reorder-seats":
        this.assertHost(identity);
        nextState = applyCommand(room.state, {
          type: "reorder_seats",
          seatOrder: command.seatOrder
        });
        break;
      case "host:randomize-seats":
        this.assertHost(identity);
        nextState = applyCommand(room.state, {
          type: "randomize_seats"
        });
        break;
      case "host:set-seat-lock":
        this.assertHost(identity);
        nextState = applyCommand(room.state, {
          type: "set_seat_lock",
          locked: command.locked
        });
        break;
      case "host:start-game":
        this.assertHost(identity);
        nextState = applyCommand(room.state, {
          type: "start_game"
        });
        break;
      case "host:advance-phase":
        this.assertHost(identity);
        nextState = applyCommand(room.state, {
          type: "advance_phase"
        });
        break;
      case "player:confirm-role-reveal":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "confirm_role_reveal",
          playerId: identity.playerId
        });
        break;
      case "president:nominate-chancellor":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "nominate_chancellor",
          presidentId: identity.playerId,
          candidateId: command.candidateId
        });
        break;
      case "player:cast-vote":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "cast_vote",
          playerId: identity.playerId,
          vote: command.vote
        });
        break;
      case "president:reveal-draw":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "president_reveal_draw",
          presidentId: identity.playerId
        });
        break;
      case "president:discard-policy":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "president_discard_policy",
          presidentId: identity.playerId,
          policyIndex: command.policyIndex
        });
        break;
      case "chancellor:request-veto":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "chancellor_request_veto",
          chancellorId: identity.playerId
        });
        break;
      case "president:respond-veto":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "president_respond_veto",
          presidentId: identity.playerId,
          accept: command.accept
        });
        break;
      case "chancellor:enact-policy":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "chancellor_enact_policy",
          chancellorId: identity.playerId,
          policyIndex: command.policyIndex
        });
        break;
      case "president:investigate":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "investigate_loyalty",
          presidentId: identity.playerId,
          targetId: command.targetId
        });
        break;
      case "president:special-election":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "special_election",
          presidentId: identity.playerId,
          targetId: command.targetId
        });
        break;
      case "president:execute":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "execute_player",
          presidentId: identity.playerId,
          targetId: command.targetId
        });
        break;
      case "president:acknowledge-executive-action":
        this.assertPlayer(identity);
        nextState = applyCommand(room.state, {
          type: "acknowledge_executive_action",
          presidentId: identity.playerId
        });
        break;
      default: {
        const exhaustive: never = command;
        return exhaustive;
      }
    }

    room.state = nextState;
    this.enqueuePersist();
    return room.roomId;
  }

  getRoomPushPayload(roomId: string): {
    roomId: string;
    hostSockets: string[];
    hostView: HostView;
    players: Array<{ socketIds: string[]; view: PlayerView }>;
  } {
    const room = this.getRoom(roomId);
    return {
      roomId,
      hostSockets: [...room.hostSocketIds],
      hostView: this.getRoomHostView(room),
      players: [...room.playerSocketIds.entries()].map(([playerId, sockets]) => ({
        socketIds: [...sockets],
        view: this.getRoomPlayerView(room, playerId)
      }))
    };
  }

  patchRoomState(roomId: string, patch: Partial<RoomState>): void {
    const room = this.getRoom(roomId);
    const playerPatch = patch.players as Partial<RoomState["players"]> | undefined;
    const nextPlayers: RoomState["players"] = { ...room.state.players };

    if (playerPatch) {
      for (const [playerId, value] of Object.entries(playerPatch)) {
        nextPlayers[playerId] = {
          ...nextPlayers[playerId],
          ...(value as Partial<RoomState["players"][string]>)
        } as RoomState["players"][string];
      }
    }

    room.state = {
      ...room.state,
      ...patch,
      players: nextPlayers
    };
    this.enqueuePersist();
  }

  async waitForPersistence(): Promise<void> {
    await this.persistQueue;
  }

  private getRoom(roomId: string): RoomRecord {
    const room = this.roomsById.get(roomId);
    if (!room) {
      throw new Error("방을 찾을 수 없습니다.");
    }
    return room;
  }

  private getRoomHostView(room: RoomRecord): HostView {
    const base = getHostView(room.state);
    return {
      ...base,
      players: base.players.map((player) => ({
        ...player,
        isConnected:
          (room.playerSocketIds.get(player.id)?.size ?? 0) > 0
      }))
    };
  }

  private getRoomPlayerView(room: RoomRecord, playerId: string): PlayerView {
    const view = getPlayerView(room.state, playerId);
    const hostPublicState = this.getRoomHostView(room);
    return {
      ...view,
      publicState: hostPublicState
    };
  }

  private buildPersistedSnapshots(): PersistedRoomSnapshot[] {
    return [...this.roomsById.values()].map((room) => ({
      roomId: room.roomId,
      roomCode: room.roomCode,
      hostToken: room.hostToken,
      playerTokens: { ...room.playerTokens },
      state: room.state
    }));
  }

  private enqueuePersist(): void {
    const snapshots = this.buildPersistedSnapshots();
    const save = async (): Promise<void> => {
      try {
        await this.store.save(snapshots);
      } catch (error) {
        console.error("Failed to persist room snapshots.", error);
      }
    };

    this.persistQueue = this.persistQueue.then(save, save);
  }

  private detachSocket(socketId: string): string[] {
    const affectedRoomIds = new Set<string>();

    for (const room of this.roomsById.values()) {
      if (room.hostSocketIds.delete(socketId)) {
        affectedRoomIds.add(room.roomId);
      }

      for (const [playerId, sockets] of room.playerSocketIds.entries()) {
        if (sockets.delete(socketId)) {
          affectedRoomIds.add(room.roomId);
        }
        if (sockets.size === 0) {
          room.playerSocketIds.delete(playerId);
        }
      }
    }

    this.socketIdentities.delete(socketId);
    return [...affectedRoomIds];
  }

  private createId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }

  private createOpaqueToken(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(20).toString("hex")}`;
  }

  private createRoomCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    do {
      code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join("");
    } while (this.roomIdByCode.has(code));
    return code;
  }

  private assertHost(identity: SocketIdentity): asserts identity is Extract<SocketIdentity, { kind: "host" }> {
    if (identity.kind !== "host") {
      throw new Error("호스트 권한이 필요합니다.");
    }
  }

  private assertPlayer(
    identity: SocketIdentity
  ): asserts identity is Extract<SocketIdentity, { kind: "player" }> {
    if (identity.kind !== "player") {
      throw new Error("플레이어 권한이 필요합니다.");
    }
  }
}
