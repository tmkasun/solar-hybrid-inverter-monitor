// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlarmHistory, AlarmEventRow } from "./AlarmHistory";
import { InverterAlerts } from "./InverterAlerts";
import { api } from "./api";
import { createI18n } from "./i18n";
import { alarmTranslations } from "./alarmTranslations";
import type { AlarmEvent, InverterAlarm, Status } from "./types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const i18n = createI18n("en");
const lowBattery: InverterAlarm = { key: "battery_low", position: 12, label: "Low battery alarm", severity: "warning" };
const voltageLow: InverterAlarm = { key: "output_voltage_low", position: 7, label: "Inverter voltage too low", severity: "fault" };
function snapshot(active: InverterAlarm[] = []): Status {
  return { connected: true, mode: "L", warnings: active.length ? "00000001000010000000000000000000" : "0".repeat(32),
    captured_at: "2026-10-11T11:19:12Z", error: null, status: {},
    alarms: { available: true, severity: active.some(alarm => alarm.severity === "fault") ? "fault" : active.length ? "warning" : "ok",
      active, error: null, captured_at: "2026-10-11T11:19:12Z", last_confirmed_active: active, last_confirmed_at: "2026-10-11T11:19:12Z" },
  };
}
function event(id: number): AlarmEvent {
  const status = snapshot([lowBattery]);
  return { ...status, id, kind: "initial", protocol_id: "PI30", captured_at: status.captured_at!, alarms: status.alarms!,
    raised: ["battery_low"], cleared: [], cleared_alarms: [], severity_changed: [] };
}

let root: Root | undefined;
let container: HTMLDivElement;
async function render(element: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<MemoryRouter>{element}</MemoryRouter>));
}
async function click(element: Element) { await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true }))); }
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("live inverter alarms", () => {
  it("keeps the default banner brief and lets OK collapse and reopen it", async () => {
    await render(<InverterAlerts status={snapshot([lowBattery])} i18n={i18n} />);
    expect(container.querySelector("details")?.open).toBe(false);
    expect(container.querySelector(".inverter-alert-summary")?.textContent).toBe("Low battery alarm");
    await click(container.querySelector("button")!);
    expect(container.querySelector("aside.collapsed[role=status]")).not.toBeNull();
    expect((container.querySelector(".inverter-alert-body") as HTMLElement).hidden).toBe(true);
    expect(container.querySelector("button")?.textContent).toBe("Show alarms");
    expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
    await click(container.querySelector("button")!);
    expect(container.querySelector("aside.collapsed")).toBeNull();
    expect((container.querySelector(".inverter-alert-body") as HTMLElement).hidden).toBe(false);
  });
  it("keeps acknowledgement through repeated polls but expands changed alarms", async () => {
    await render(<InverterAlerts status={snapshot([lowBattery])} i18n={i18n} />);
    await click(container.querySelector("button")!);
    const next = snapshot([lowBattery]);
    next.captured_at = "2026-10-11T11:20:12Z";
    next.alarms!.captured_at = next.captured_at;
    await act(async () => root!.render(<MemoryRouter><InverterAlerts status={next} i18n={i18n} /></MemoryRouter>));
    expect(container.querySelector("aside.collapsed")).not.toBeNull();
    await act(async () => root!.render(<MemoryRouter><InverterAlerts status={snapshot([lowBattery, voltageLow])} i18n={i18n} /></MemoryRouter>));
    expect(container.querySelector("aside.fault[role=alert]")).not.toBeNull();
    expect(container.querySelector("aside.collapsed")).toBeNull();
  });
  it("expands after connection loss or an alarm clears and returns", async () => {
    await render(<InverterAlerts status={snapshot([lowBattery])} i18n={i18n} />);
    await click(container.querySelector("button")!);
    await act(async () => root!.render(<MemoryRouter><InverterAlerts status={{ ...snapshot([lowBattery]), connected: false }} i18n={i18n} /></MemoryRouter>));
    expect(container.querySelector("aside.collapsed")).toBeNull();
    await click(container.querySelector("button")!);
    await act(async () => root!.render(<MemoryRouter><InverterAlerts status={snapshot()} i18n={i18n} /></MemoryRouter>));
    expect(container.querySelector("aside")).toBeNull();
    await act(async () => root!.render(<MemoryRouter><InverterAlerts status={snapshot([lowBattery])} i18n={i18n} /></MemoryRouter>));
    expect(container.querySelector("aside[role=alert]")).not.toBeNull();
    expect(container.querySelector("aside.collapsed")).toBeNull();
  });
  it("shows fault bits outside fault mode and lists every alarm", async () => {
    await render(<InverterAlerts status={snapshot([voltageLow, lowBattery])} i18n={i18n} />);
    expect(container.querySelector(".fault[role=alert]")).not.toBeNull();
    expect(container.textContent).toContain("Inverter voltage too low");
    expect(container.textContent).toContain("Low battery alarm");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/alarms");
  });
  it("renders warnings in amber and removes confirmed healthy banners", async () => {
    const status = snapshot([lowBattery]);
    status.status.battery_capacity_percent = 99;
    status.status.battery_source = "bms";
    await render(<InverterAlerts status={status} i18n={i18n} />);
    expect(container.querySelector(".warning")).not.toBeNull();
    await act(async () => root!.render(<MemoryRouter><InverterAlerts status={snapshot()} i18n={i18n} /></MemoryRouter>));
    expect(container.querySelector("aside")).toBeNull();
  });
  it("retains confirmed faults through disconnected and unavailable readings", async () => {
    const status = snapshot();
    status.alarms = { ...status.alarms!, available: false, severity: "unknown", active: [], error: "QPIWS rejected", last_confirmed_active: [voltageLow] };
    await render(<InverterAlerts status={status} i18n={i18n} />);
    expect(container.textContent).toContain("Inverter voltage too low");
    expect(container.textContent).toContain("have not been confirmed cleared");
    await act(async () => root!.render(<MemoryRouter><InverterAlerts status={{ ...status, connected: false }} i18n={i18n} /></MemoryRouter>));
    expect(container.textContent).toContain("connection lost");
    expect(container.querySelector(".fault")).not.toBeNull();
  });
  it("shows generic fault mode and unknown bits", async () => {
    const status = snapshot([{ key: "unknown_bit_30", position: 30, label: "raw", severity: "warning" }]);
    status.mode = "F";
    await render(<InverterAlerts status={status} i18n={i18n} />);
    expect(container.textContent).toContain("bit 30");
    expect(container.querySelector(".fault")).not.toBeNull();
    await act(async () => root!.render(<MemoryRouter><InverterAlerts status={{ ...snapshot(), mode: "F", alarms: undefined }} i18n={i18n} /></MemoryRouter>));
    expect(container.textContent).toContain("fault mode without detailed alarm information");
  });
  it("does not interpret malformed replies containing a one as an active warning", async () => {
    const status = { ...snapshot(), warnings: "bad1reply", alarms: { ...snapshot().alarms!, available: false, severity: "unknown" as const } };
    await render(<InverterAlerts status={status} i18n={i18n} />);
    expect(container.textContent).toContain("alarm status unavailable");
    expect(container.querySelector("aside")?.getAttribute("role")).toBe("status");
    expect(container.textContent).not.toContain("Inverter warning detected");
  });
  it("provides translations for every alarm and history key in all languages", () => {
    for (const language of ["si", "ta"] as const) {
      expect(Object.keys(alarmTranslations[language]).sort()).toEqual(Object.keys(alarmTranslations.en).sort());
      const translated = createI18n(language);
      for (const key of Object.keys(alarmTranslations.en) as Array<keyof typeof alarmTranslations.en>) {
        expect(translated.t(key)).not.toBe(key);
        expect(translated.t(key)).not.toBe("");
      }
    }
  });
});

describe("alarm history", () => {
  it("loads history publicly and paginates without losing previous rows", async () => {
    const fetch = vi.spyOn(api, "alarmHistory").mockImplementation(async (_range, cursor) => cursor ? { events: [event(1)], next_before_id: null } : { events: [event(2)], next_before_id: 2 });
    await render(<AlarmHistory status={snapshot()} i18n={i18n} />);
    expect(container.querySelectorAll(".alarm-event")).toHaveLength(1);
    const button = [...container.querySelectorAll("button")].find(button => button.textContent === "Load more")!;
    await click(button);
    expect(container.querySelectorAll(".alarm-event")).toHaveLength(2);
    expect(fetch.mock.calls.some(call => call[1] === 2)).toBe(true);
    expect(container.textContent).toContain("Low battery alarm");
  });
  it("refreshes only while visible and updates time filters", async () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(api, "alarmHistory").mockResolvedValue({ events: [], next_before_id: null });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await render(<AlarmHistory status={snapshot()} i18n={i18n} />);
    expect(container.textContent).toContain("No alarm events");
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      const select = container.querySelector("select")!;
      select.value = "168";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(fetch.mock.calls.at(-1)?.[0]).toEqual({ hours: 168 });
  });
  it("shows history fetch failures", async () => {
    vi.spyOn(api, "alarmHistory").mockRejectedValue(new Error("API unavailable"));
    await render(<AlarmHistory status={snapshot()} i18n={i18n} />);
    expect(container.querySelector("[role=alert]")?.textContent).toContain("API unavailable");
    expect(container.textContent).not.toContain("No alarm events");
  });
  it("validates custom dates and sends UTC timestamps only after applying", async () => {
    const fetch = vi.spyOn(api, "alarmHistory").mockResolvedValue({ events: [], next_before_id: null });
    await render(<AlarmHistory status={snapshot()} i18n={i18n} />);
    await act(async () => {
      const select = container.querySelector("select")!;
      select.value = "custom";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const inputs = container.querySelectorAll("input");
    const setValue = async (input: HTMLInputElement, value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    await setValue(inputs[0], "2026-10-12T10:00");
    await setValue(inputs[1], "2026-10-11T10:00");
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.textContent).toContain("Choose valid dates in order");
    await setValue(inputs[0], "2026-10-10T10:00");
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fetch.mock.calls.at(-1)?.[0]).toEqual({ start: new Date("2026-10-10T10:00").toISOString(), end: new Date("2026-10-11T10:00").toISOString() });
    expect(container.textContent).not.toContain("Choose valid dates in order");
  });
  it("aborts pending history requests and removes refresh timers on unmount", async () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(api, "alarmHistory").mockImplementation(() => new Promise(() => {}));
    await render(<AlarmHistory status={snapshot()} i18n={i18n} />);
    const signal = fetch.mock.calls[0][2]!;
    await act(async () => root!.unmount());
    root = undefined;
    expect(signal.aborted).toBe(true);
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("renders cleared alarms using saved labels, including unmapped bits", async () => {
    const row = event(3);
    row.kind = "changed";
    row.raised = [];
    row.alarms = snapshot().alarms!;
    row.cleared = ["unknown_bit_30"];
    row.cleared_alarms = [{ key: "unknown_bit_30", position: 30, label: "Unmapped", severity: "warning" }];
    await render(<ol><AlarmEventRow event={row} i18n={i18n} /></ol>);
    expect(container.textContent).toContain("Confirmed cleared");
    expect(container.textContent).toContain("bit 30");
  });
});
