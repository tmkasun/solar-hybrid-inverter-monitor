// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RegisterSWOptions } from "vite-plugin-pwa/types";
import { PwaActions, PwaNotices, usePwa } from "./Pwa";
import type { PwaState } from "./Pwa";
import { createI18n } from "./i18n";
import { pwaTranslations } from "./pwaTranslations";

const sw = vi.hoisted(() => ({
  update: vi.fn<() => Promise<void>>(),
  options: undefined as RegisterSWOptions | undefined,
  refresh: undefined as ((value: boolean) => void) | undefined,
}));
vi.mock("virtual:pwa-register/react", async () => {
  const { useState } = await import("react");
  return {
    useRegisterSW(options: RegisterSWOptions) {
      sw.options ||= options;
      const state = useState(false);
      sw.refresh = state[1];
      return { needRefresh: state, offlineReady: [false, vi.fn()], updateServiceWorker: sw.update };
    },
  };
});
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let container: HTMLDivElement;
let latest: PwaState;
function Harness({ busy = false }: { busy?: boolean }) {
  const pwa = usePwa(busy);
  latest = pwa;
  const i18n = createI18n("en");
  return <><PwaActions pwa={pwa} i18n={i18n} /><PwaNotices pwa={pwa} i18n={i18n} /></>;
}
async function render(busy = false) {
  if (!root) { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); }
  await act(async () => root!.render(<Harness busy={busy} />));
}
function button(text: string) { return Array.from(container.querySelectorAll("button")).find(node => node.textContent === text); }
async function click(text: string) {
  const target = button(text);
  expect(target, `Missing button: ${text}`).toBeDefined();
  await act(async () => target!.click());
}
function installEvent(outcome: "accepted" | "dismissed" = "dismissed") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  return { event, prompt };
}
beforeEach(() => {
  sw.options = undefined;
  sw.refresh = undefined;
  sw.update.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PWA installation", () => {
  it("uses the browser prompt once and handles dismissal without triggering updates", async () => {
    await render();
    expect(button("Install app")).toBeUndefined();
    expect(button("Update now")).toBeUndefined();
    const { event, prompt } = installEvent();
    await act(async () => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    await click("Install app");
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(button("Install app")).toBeUndefined();
    expect(sw.update).not.toHaveBeenCalled();
  });
  it("hides install actions after installation", async () => {
    await render();
    await act(async () => window.dispatchEvent(installEvent("accepted").event));
    await click("Install app");
    await act(async () => window.dispatchEvent(new Event("appinstalled")));
    await act(async () => window.dispatchEvent(installEvent().event));
    expect(button("Install app")).toBeUndefined();
  });
  it("hides install actions in standalone mode", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    await render();
    await act(async () => window.dispatchEvent(installEvent().event));
    expect(button("Install app")).toBeUndefined();
  });
  it("provides dismissible iOS home-screen instructions", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone) Safari/605.1.15");
    await render();
    await click("Install app");
    expect(container.querySelector('[role="note"]')?.textContent).toContain("Add to Home Screen");
    await click("Close");
    expect(container.querySelector('[role="note"]')).toBeNull();
  });
  it("does not offer installation on an insecure origin", async () => {
    vi.stubGlobal("isSecureContext", false);
    await render();
    await act(async () => window.dispatchEvent(installEvent().event));
    expect(button("Install app")).toBeUndefined();
  });
  it("handles a failed browser prompt", async () => {
    await render();
    const { event, prompt } = installEvent();
    prompt.mockRejectedValue(new Error("Browser refused"));
    await act(async () => window.dispatchEvent(event));
    await click("Install app");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Installation could not start");
  });
});

describe("PWA updates and offline notices", () => {
  it("does not prompt on first installation and defers a waiting update only for this session", async () => {
    await render();
    expect(button("Update now")).toBeUndefined();
    await act(async () => sw.refresh!(true));
    expect(container.textContent).toContain("Update available");
    await click("Later");
    expect(button("Update now")).toBeUndefined();
    expect(sw.update).not.toHaveBeenCalled();
    await click("Update app");
    await click("Update now");
    expect(sw.update).toHaveBeenCalledTimes(1);
    expect(button("Updating…")?.disabled).toBe(true);
    expect(button("Later")?.disabled).toBe(true);
  });
  it("uses the current write state when blocking activation", async () => {
    await render();
    await act(async () => sw.refresh!(true));
    await render(true);
    expect(button("Update now")?.disabled).toBe(true);
    await act(async () => latest.update());
    expect(sw.update).not.toHaveBeenCalled();
    await render(false);
    await click("Update now");
    expect(sw.update).toHaveBeenCalledTimes(1);
  });
  it("shows a retryable activation failure", async () => {
    await render();
    await act(async () => sw.refresh!(true));
    sw.update.mockRejectedValueOnce(new Error("Activation failed"));
    await click("Update now");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not be applied");
    expect(button("Update now")?.disabled).toBe(false);
    await click("Update now");
    expect(sw.update).toHaveBeenCalledTimes(2);
  });
  it("recovers when a worker accepts the message but never activates", async () => {
    vi.useFakeTimers();
    await render();
    await act(async () => sw.refresh!(true));
    await click("Update now");
    await act(async () => vi.advanceTimersByTime(15000));
    expect(button("Update now")?.disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("tracks offline and reconnection events without hiding update availability", async () => {
    await render();
    await act(async () => sw.refresh!(true));
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await act(async () => window.dispatchEvent(new Event("offline")));
    expect(latest.online).toBe(false);
    expect(container.textContent).toContain("You’re offline");
    expect(button("Update now")).toBeDefined();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(container.textContent).not.toContain("You’re offline");
  });
  it("provides every PWA message in all supported languages", () => {
    for (const language of ["en", "si", "ta"] as const) {
      for (const key of Object.keys(pwaTranslations.en) as Array<keyof typeof pwaTranslations.en>) {
        expect(pwaTranslations[language][key]).toBeTruthy();
        expect(createI18n(language).t(key)).toBe(pwaTranslations[language][key]);
      }
    }
  });
});
