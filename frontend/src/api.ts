import type { AlarmHistoryResponse, BmsSettingWriteResponse, BmsSettingsResponse, CapabilitiesResponse, DiagnosticsResponse, HistorySample, Status } from "./types";
import { createI18n, storedLanguage } from "./i18n";
let csrf = sessionStorage.getItem("sako_csrf") || "";
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const deviceWrite = init.method === "POST" && /^\/api\/(?:settings|bms\/settings)\//.test(path);
  if (deviceWrite && !navigator.onLine) throw new Error(createI18n(storedLanguage()).t("pwa.offlineDetail"));
  const response = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...init.headers }, ...init, cache: "no-store" });
  if (!response.ok) throw new Error((await response.json().catch(() => ({ detail: response.statusText }))).detail || response.statusText);
  return response.json() as Promise<T>;
}
export type HistoryRequest = { hours: number } | { start: string; end: string };
export const api = {
  status: () => request<Status>("/api/status"),
  alarmHistory: (range: HistoryRequest = { hours: 24 }, beforeId?: number, signal?: AbortSignal) => {
    const params = new URLSearchParams("hours" in range ? { hours: String(range.hours) } : range);
    if (beforeId !== undefined) params.set("before_id", String(beforeId));
    return request<AlarmHistoryResponse>(`/api/alarms/history?${params}`, { signal });
  },
  capabilities: () => request<CapabilitiesResponse>("/api/capabilities"),
  history: (range: HistoryRequest = { hours: 24 }) => {
    const params = new URLSearchParams("hours" in range ? { hours: String(range.hours) } : { start: range.start, end: range.end });
    return request<{ samples: HistorySample[] }>(`/api/history?${params}`);
  },
  login: async (password: string) => { const data = await request<{ csrf_token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }); csrf = data.csrf_token; sessionStorage.setItem("sako_csrf", csrf); },
  logout: async () => { await request("/api/auth/logout", { method: "POST" }); csrf = ""; sessionStorage.removeItem("sako_csrf"); },
  change: (key: string, value: string) => request(`/api/settings/${key}`, { method: "POST", body: JSON.stringify({ value, confirmation: `APPLY ${key}` }) }),
  bmsSettings: () => request<BmsSettingsResponse>("/api/bms/settings"),
  changeBmsSetting: (key: string, value: number | boolean) => request<BmsSettingWriteResponse>(`/api/bms/settings/${key}`, { method: "POST", body: JSON.stringify({ value, confirmation: `APPLY BMS ${key}` }) }),
  audit: () => request<{ entries: Array<Record<string, string>> }>("/api/audit"),
  diagnostics: () => request<DiagnosticsResponse>("/api/diagnostics"),
  refreshDiagnostics: () => request<DiagnosticsResponse>("/api/diagnostics/refresh", { method: "POST" })
};
