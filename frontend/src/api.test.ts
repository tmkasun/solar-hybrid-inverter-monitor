// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { languageStorageKey } from "./i18n";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
describe("PWA API boundaries", () => {
  it("blocks inverter and BMS writes before sending requests while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(api.change("output_source_priority", "sbu")).rejects.toThrow("need a connection");
    await expect(api.changeBmsSetting("charging", true)).rejects.toThrow("need a connection");
    expect(fetch).not.toHaveBeenCalled();
    localStorage.setItem(languageStorageKey, "si");
    await expect(api.change("output_source_priority", "sbu")).rejects.toThrow("සම්බන්ධතාවයක් අවශ්‍යයි");
  });
  it("bypasses the browser HTTP cache for live data and online device writes", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    await api.status();
    await api.change("output_source_priority", "sbu");
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/status", expect.objectContaining({ cache: "no-store", credentials: "same-origin" }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/settings/output_source_priority", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });
});
