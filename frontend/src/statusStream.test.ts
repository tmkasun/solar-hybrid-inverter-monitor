import { afterEach, describe, expect, it, vi } from "vitest";
import { startStatusStream } from "./statusStream";
import type { Status } from "./types";

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  sendStatus(status: Status) { this.onmessage?.({ data: JSON.stringify({ type: "telemetry", data: status }) }); }
}

const healthy: Status = { connected: true, mode: "L", warnings: "0".repeat(32), captured_at: "2026-10-11T11:19:12Z", error: null, status: {} };

function setup(fetchStatus = vi.fn(async () => healthy)) {
  const sockets: FakeSocket[] = [];
  const onStatus = vi.fn(), onStale = vi.fn(), onMessage = vi.fn();
  const stop = startStatusStream({ url: "ws://test/ws", fetchStatus, onStatus, onStale, onMessage,
    createSocket: () => { const socket = new FakeSocket(); sockets.push(socket); return socket as unknown as WebSocket; },
  });
  return { sockets, onStatus, onStale, onMessage, stop, fetchStatus };
}

afterEach(() => vi.useRealTimers());

describe("status stream", () => {
  it("marks disconnected readings stale and refetches on reconnect", async () => {
    vi.useFakeTimers();
    const stream = setup();
    stream.sockets[0].open();
    await Promise.resolve();
    expect(stream.onStatus).toHaveBeenCalledWith(healthy);
    stream.sockets[0].close();
    expect(stream.onStale).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1999);
    expect(stream.sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    stream.sockets[1].open();
    await Promise.resolve();
    expect(stream.fetchStatus).toHaveBeenCalledTimes(2);
    stream.stop();
  });

  it("backs off to 30 seconds and cancels reconnection on cleanup", () => {
    vi.useFakeTimers();
    const stream = setup();
    for (const delay of [2000, 4000, 8000, 16000, 30000, 30000]) {
      const count = stream.sockets.length;
      stream.sockets[count - 1].close();
      vi.advanceTimersByTime(delay - 1);
      expect(stream.sockets).toHaveLength(count);
      vi.advanceTimersByTime(1);
      expect(stream.sockets).toHaveLength(count + 1);
    }
    stream.stop();
    const count = stream.sockets.length;
    vi.advanceTimersByTime(60000);
    expect(stream.sockets).toHaveLength(count);
  });

  it("rejects late HTTP snapshots after newer websocket telemetry", async () => {
    let resolve!: (status: Status) => void;
    const fetch = vi.fn(() => new Promise<Status>(done => { resolve = done; }));
    const stream = setup(fetch);
    stream.sockets[0].open();
    const fault = { ...healthy, mode: "F" };
    stream.sockets[0].sendStatus(fault);
    resolve(healthy);
    await Promise.resolve();
    expect(stream.onStatus).toHaveBeenCalledOnce();
    expect(stream.onStatus).toHaveBeenCalledWith(fault);
    stream.stop();
  });

  it("ignores old replies after disconnect and cleanup", async () => {
    let resolve!: (status: Status) => void;
    const stream = setup(vi.fn(() => new Promise<Status>(done => { resolve = done; })));
    stream.sockets[0].open();
    stream.sockets[0].close();
    stream.stop();
    resolve(healthy);
    stream.sockets[0].sendStatus(healthy);
    await Promise.resolve();
    expect(stream.onStatus).not.toHaveBeenCalled();
  });

  it("keeps status unconfirmed if HTTP refresh fails", async () => {
    const stream = setup(vi.fn(async () => { throw new Error("offline"); }));
    stream.sockets[0].open();
    await Promise.resolve();
    await Promise.resolve();
    expect(stream.onStale).toHaveBeenCalled();
    stream.stop();
  });
});
