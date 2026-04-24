import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { Command } from "@secret/shared";

const ACK_TIMEOUT_MS = 10_000;
const ACK_TIMEOUT_MESSAGE =
  "서버 응답 시간이 초과되었습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.";
const DISCONNECT_MESSAGE = "서버 연결이 끊겼습니다. 다시 시도해 주세요.";
const CONNECT_ERROR_MESSAGE = "서버에 연결할 수 없습니다. 연결 상태를 확인해 주세요.";

interface AckResult {
  ok: boolean;
  message?: string;
}

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

export function emitWithAck(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs = ACK_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    let isSettled = false;

    function cleanup(): void {
      globalThis.clearTimeout(timeoutId);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    }

    function settle(handler: () => void): void {
      if (isSettled) {
        return;
      }
      isSettled = true;
      cleanup();
      handler();
    }

    function handleDisconnect(): void {
      settle(() => reject(new Error(DISCONNECT_MESSAGE)));
    }

    function handleConnectError(error: Error): void {
      settle(() =>
        reject(error instanceof Error ? error : new Error(CONNECT_ERROR_MESSAGE))
      );
    }

    const timeoutId = globalThis.setTimeout(() => {
      settle(() => reject(new Error(ACK_TIMEOUT_MESSAGE)));
    }, timeoutMs);

    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socket.emit(event, payload, (result: AckResult) => {
      if (result?.ok) {
        settle(() => resolve());
        return;
      }
      settle(() => reject(new Error(result?.message ?? "요청 처리에 실패했습니다.")));
    });
  });
}

export function sendCommand(socket: Socket, command: Command): Promise<void> {
  return emitWithAck(socket, "command", command);
}
