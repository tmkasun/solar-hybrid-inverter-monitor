import type { CapabilitiesResponse, DiagnosticsResponse, HistorySample, Status } from "./types";
let csrf = sessionStorage.getItem("sako_csrf") || "";
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...init.headers }, ...init });
  if (!response.ok) throw new Error((await response.json().catch(() => ({ detail: response.statusText }))).detail || response.statusText);
  return response.json() as Promise<T>;
}
export type HistoryRequest = { hours: number } | { start: string; end: string };
export const api = {
  status: () => request<Status>("/api/status"),
  capabilities: () => request<CapabilitiesResponse>("/api/capabilities"),
  history: (range: HistoryRequest = { hours: 24 }) => {
    const params = new URLSearchParams("hours" in range ? { hours: String(range.hours) } : { start: range.start, end: range.end });
    return request<{ samples: HistorySample[] }>(`/api/history?${params}`);
  },
  login: async (password: string) => { const data = await request<{ csrf_token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }); csrf = data.csrf_token; sessionStorage.setItem("sako_csrf", csrf); },
  logout: async () => { await request("/api/auth/logout", { method: "POST" }); csrf = ""; sessionStorage.removeItem("sako_csrf"); },
  change: (key: string, value: string) => request(`/api/settings/${key}`, { method: "POST", body: JSON.stringify({ value, confirmation: `APPLY ${key}` }) }),
  audit: () => request<{ entries: Array<Record<string, string>> }>("/api/audit"),
  diagnostics: () => request<DiagnosticsResponse>("/api/diagnostics"),
  refreshDiagnostics: () => request<DiagnosticsResponse>("/api/diagnostics/refresh", { method: "POST" })
};
