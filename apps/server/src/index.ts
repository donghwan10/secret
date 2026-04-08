import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { Server } from "socket.io";
import { z } from "zod";
import {
  claimHostRequestSchema,
  claimPlayerRequestSchema,
  commandSchema,
  createRoomResponseSchema,
  hostSubscribeSchema,
  joinRoomRequestSchema,
  joinRoomResponseSchema,
  playerSubscribeSchema
} from "@secret/shared";

import { getLanOrigin } from "./lan.js";
import { SnapshotStore } from "./persistence.js";
import { RoomService } from "./room-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");
const webDistDir = path.resolve(rootDir, "apps/web/dist");
const dataFile = path.resolve(rootDir, "data/store.json");
const port = Number(process.env.PORT ?? 3000);

async function main(): Promise<void> {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  const roomService = new RoomService(new SnapshotStore(dataFile), getLanOrigin(port));
  await roomService.load();
  let pushRoom = (roomId: string): void => {
    void roomId;
  };

  app.post("/api/rooms", async () => {
    const room = roomService.createRoom();
    return createRoomResponseSchema.parse({
      roomId: room.roomId,
      roomCode: room.roomCode,
      hostToken: room.hostToken,
      lanOrigin: room.lanOrigin
    });
  });

  app.post("/api/host/claim", async (request) => {
    const body = claimHostRequestSchema.parse(request.body);
    return roomService.claimHost(body.roomId, body.hostToken);
  });

  app.post("/api/players/join", async (request) => {
    const body = joinRoomRequestSchema.parse(request.body);
    const joined = roomService.joinRoom(body.roomCode.toUpperCase(), body.nickname.trim());
    return joinRoomResponseSchema.parse({
      roomId: joined.roomId,
      playerId: joined.playerId,
      playerToken: joined.playerToken
    });
  });

  app.post("/api/players/claim", async (request) => {
    const body = claimPlayerRequestSchema.parse(request.body);
    return roomService.claimPlayer(body.playerToken);
  });

  if (process.env.ENABLE_TEST_API === "1") {
    app.post("/api/test/rooms/:roomId/state", async (request) => {
      const params = z.object({ roomId: z.string().min(1) }).parse(request.params);
      const body = z.object({ patch: z.record(z.any()) }).parse(request.body);
      roomService.patchRoomState(params.roomId, body.patch);
      pushRoom(params.roomId);
      return { ok: true };
    });
  }

  if (fs.existsSync(webDistDir)) {
    await app.register(fastifyStatic, {
      root: webDistDir,
      prefix: "/"
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        reply.code(404).send({ message: "Not found" });
        return;
      }

      reply.sendFile("index.html");
    });
  }

  const io = new Server(app.server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  pushRoom = (roomId: string): void => {
    const payload = roomService.getRoomPushPayload(roomId);
    for (const socketId of payload.hostSockets) {
      io.to(socketId).emit("host:update", payload.hostView);
    }
    for (const player of payload.players) {
      for (const socketId of player.socketIds) {
        io.to(socketId).emit("player:update", player.view);
      }
    }
  };

  io.on("connection", (socket) => {
    socket.on("host:subscribe", (raw, callback) => {
      try {
        const payload = hostSubscribeSchema.parse(raw);
        const view = roomService.subscribeHost(socket.id, payload.roomId, payload.hostToken);
        socket.emit("host:update", view);
        callback?.({ ok: true });
        pushRoom(payload.roomId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "호스트 연결에 실패했습니다.";
        socket.emit("server:error", { message });
        callback?.({ ok: false, message });
      }
    });

    socket.on("player:subscribe", (raw, callback) => {
      try {
        const payload = playerSubscribeSchema.parse(raw);
        const view = roomService.subscribePlayer(socket.id, payload.playerToken);
        socket.emit("player:update", view);
        callback?.({ ok: true });
        pushRoom(view.roomId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "플레이어 연결에 실패했습니다.";
        socket.emit("server:error", { message });
        callback?.({ ok: false, message });
      }
    });

    socket.on("command", (raw, callback) => {
      try {
        const command = commandSchema.parse(raw);
        const roomId = roomService.applySocketCommand(socket.id, command);
        callback?.({ ok: true });
        pushRoom(roomId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "명령 처리에 실패했습니다.";
        socket.emit("server:error", { message });
        callback?.({ ok: false, message });
      }
    });

    socket.on("disconnect", () => {
      const roomId = roomService.unsubscribe(socket.id);
      if (roomId) {
        pushRoom(roomId);
      }
    });
  });

  await app.listen({
    port,
    host: "0.0.0.0"
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
