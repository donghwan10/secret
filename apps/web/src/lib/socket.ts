import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { Command } from "@secret/shared";

let sharedSocket: Socket | null = null;

export function getSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io({
      autoConnect: false,
      transports: ["websocket"]
    });
  }
  return sharedSocket;
}

export function connectSocket(): Socket {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (result: { ok: boolean; message?: string }) => {
      if (result?.ok) {
        resolve();
        return;
      }
      reject(new Error(result?.message ?? "요청 처리에 실패했습니다."));
    });
  });
}

export function sendCommand(socket: Socket, command: Command): Promise<void> {
  return emitWithAck(socket, "command", command);
}
