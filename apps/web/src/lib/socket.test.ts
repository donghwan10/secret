import { afterEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io-client";

import { emitWithAck } from "./socket";

interface AckResult {
  ok: boolean;
  message?: string;
}

type AckCallback = (result: AckResult) => void;
type Listener = (...args: unknown[]) => void;

class FakeSocket {
  lastEvent: string | null = null;
  lastPayload: unknown = null;
  private ackCallback: AckCallback | null = null;
  private readonly listeners = new Map<string, Set<Listener>>();

  asSocket(): Socket {
    return this as unknown as Socket;
  }

  emit(event: string, payload: unknown, ackCallback: AckCallback): this {
    this.lastEvent = event;
    this.lastPayload = payload;
    this.ackCallback = ackCallback;
    return this;
  }

  on(event: string, listener: Listener): this {
    const listeners = this.listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  off(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  ack(result: AckResult): void {
    if (!this.ackCallback) {
      throw new Error("No acknowledgement callback registered.");
    }
    this.ackCallback(result);
  }

  fire(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

describe("emitWithAck", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves and removes listeners when the server acknowledges success", async () => {
    const socket = new FakeSocket();
    const promise = emitWithAck(socket.asSocket(), "command", { ok: true }, 1_000);

    expect(socket.lastEvent).toBe("command");
    socket.ack({ ok: true });

    await expect(promise).resolves.toBeUndefined();
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
  });

  it("rejects with the server acknowledgement message", async () => {
    const socket = new FakeSocket();
    const promise = emitWithAck(socket.asSocket(), "command", {}, 1_000);

    socket.ack({ ok: false, message: "명령 처리에 실패했습니다." });

    await expect(promise).rejects.toThrow("명령 처리에 실패했습니다.");
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
  });

  it("rejects when the acknowledgement times out", async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const promise = emitWithAck(socket.asSocket(), "command", {}, 500);
    const assertion = expect(promise).rejects.toThrow(
      "서버 응답 시간이 초과되었습니다."
    );

    await vi.advanceTimersByTimeAsync(500);

    await assertion;
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
  });

  it("rejects on disconnect and ignores later acknowledgements", async () => {
    const socket = new FakeSocket();
    const promise = emitWithAck(socket.asSocket(), "command", {}, 1_000);
    const assertion = expect(promise).rejects.toThrow("서버 연결이 끊겼습니다.");

    socket.fire("disconnect");
    socket.ack({ ok: true });

    await assertion;
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
  });

  it("rejects with the connection error", async () => {
    const socket = new FakeSocket();
    const promise = emitWithAck(socket.asSocket(), "command", {}, 1_000);
    const assertion = expect(promise).rejects.toThrow("socket unavailable");

    socket.fire("connect_error", new Error("socket unavailable"));

    await assertion;
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
  });
});
