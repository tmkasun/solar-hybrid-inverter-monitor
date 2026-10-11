// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startUpdateChecks, updateCheckInterval } from "./pwaLifecycle";

let cleanup: (() => void) | undefined;
function registration() {
  return Object.assign(new EventTarget(), {
    waiting: null as ServiceWorker | null,
    installing: null as ServiceWorker | null,
    update: vi.fn().mockResolvedValue(undefined),
  }) as unknown as ServiceWorkerRegistration & { update: ReturnType<typeof vi.fn> };
}
async function flush() { await Promise.resolve(); await Promise.resolve(); }
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { onLine: true, serviceWorker: { controller: {} } });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("service worker update discovery", () => {
  it("checks at launch, hourly, on resume, and on reconnection; cleans up listeners", async () => {
    const reg = registration();
    cleanup = startUpdateChecks(reg, vi.fn());
    await flush();
    expect(reg.update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(updateCheckInterval);
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    window.dispatchEvent(new Event("online"));
    await flush();
    expect(reg.update).toHaveBeenCalledTimes(4);
    cleanup();
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(updateCheckInterval);
    expect(reg.update).toHaveBeenCalledTimes(4);
  });
  it("prevents overlapping checks and skips hidden, offline, and installing states", async () => {
    const reg = registration();
    let finish!: () => void;
    reg.update.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    cleanup = startUpdateChecks(reg, vi.fn());
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(reg.update).toHaveBeenCalledTimes(1);
    finish();
    await flush();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await vi.advanceTimersByTimeAsync(updateCheckInterval);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    Object.assign(navigator, { onLine: false });
    window.dispatchEvent(new Event("online"));
    Object.assign(navigator, { onLine: true });
    Object.assign(reg, { installing: new EventTarget() });
    window.dispatchEvent(new Event("online"));
    expect(reg.update).toHaveBeenCalledTimes(1);
  });
  it("detects an already waiting update and updates installed by other tabs", async () => {
    const reg = registration();
    const waiting = vi.fn();
    Object.assign(reg, { waiting: new EventTarget() });
    cleanup = startUpdateChecks(reg, waiting);
    expect(waiting).toHaveBeenCalled();
    Object.assign(reg, { waiting: null });
    const worker = new EventTarget();
    Object.assign(reg, { installing: worker });
    reg.dispatchEvent(new Event("updatefound"));
    waiting.mockClear();
    Object.assign(reg, { waiting: worker, installing: null });
    worker.dispatchEvent(new Event("statechange"));
    expect(waiting).toHaveBeenCalledTimes(1);
    cleanup();
    worker.dispatchEvent(new Event("statechange"));
    expect(waiting).toHaveBeenCalledTimes(1);
  });
  it("does not report the initial install as an update and tolerates failed checks", async () => {
    const reg = registration();
    const waiting = vi.fn();
    Object.assign(navigator.serviceWorker, { controller: null });
    Object.assign(reg, { waiting: new EventTarget() });
    reg.update.mockRejectedValue(new Error("Server unavailable"));
    cleanup = startUpdateChecks(reg, waiting);
    await flush();
    expect(waiting).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(updateCheckInterval);
    expect(reg.update).toHaveBeenCalledTimes(2);
  });
});
