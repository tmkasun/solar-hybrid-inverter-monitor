import { Link } from "react-router-dom";
import type { I18n, TranslationKey } from "./i18n";
import type { InverterAlarm, Status } from "./types";

export function alarmLabel(alarm: InverterAlarm, i18n: I18n): string {
  if (alarm.key.startsWith("unknown_bit_")) return i18n.t("alarms.unmapped", { bit: alarm.position ?? "?" });
  const key = `alarm.${alarm.key}` as TranslationKey;
  const label = i18n.t(key);
  return label === key ? alarm.label : label;
}

export function displayedAlarms(status: Status): InverterAlarm[] {
  const alarms = status.alarms;
  const active = new Map((alarms?.active || []).map(alarm => [alarm.key, alarm]));
  if (!status.connected || !alarms?.available) {
    for (const alarm of alarms?.last_confirmed_active || []) if (!active.has(alarm.key)) active.set(alarm.key, alarm);
  }
  return [...active.values()];
}

export function alarmSummary(status: Status | null | undefined, i18n: I18n): string {
  if (!status?.connected) return i18n.t("alarms.stale");
  if (status.mode === "F" || displayedAlarms(status).some(alarm => alarm.severity === "fault")) return i18n.t("alarms.fault");
  if (!status.alarms?.available) return i18n.t("alarms.unknown");
  return i18n.t(`alarms.${status.alarms?.severity || "unknown"}`);
}

export function InverterAlerts({ status, i18n }: { status: Status | null; i18n: I18n }) {
  if (!status) return null;
  const alarms = status.alarms;
  const active = displayedAlarms(status);
  const fault = status.mode === "F" || active.some(alarm => alarm.severity === "fault") || alarms?.severity === "fault";
  const hasActive = fault || active.length > 0 || Boolean(status.warnings?.includes("1"));
  if (status.connected && alarms?.available && alarms.severity === "ok" && !hasActive) return null;
  const title = hasActive ? i18n.t(fault ? "alarms.fault" : "alarms.warning") : alarmSummary(status, i18n);
  return <aside className={`inverter-alert ${fault ? "fault" : "warning"}`} role={hasActive ? "alert" : "status"} aria-live={hasActive ? "assertive" : "polite"}>
    <h2>{title}</h2>
    {!status.connected && <p>{i18n.t("alarms.stale")}</p>}
    {status.connected && !alarms?.available && <p>{i18n.t("alarms.unknown")}</p>}
    {(!status.connected || !alarms?.available) && Boolean(alarms?.last_confirmed_active?.length) && <p>{i18n.t("alarms.unconfirmed")}</p>}
    {active.length > 0 && <ul>{active.map(alarm => <li key={alarm.key}><strong>{i18n.t(alarm.severity === "fault" ? "alarms.faultLabel" : "alarms.warningLabel")}: </strong>{alarmLabel(alarm, i18n)}</li>)}</ul>}
    {fault && active.length === 0 && <p>{i18n.t("alarms.faultMode")}</p>}
    {hasActive && <p>{i18n.t("alarms.checkDisplay")}</p>}
    {hasActive && <p>{i18n.t("alarms.provisional")}</p>}
    {status.error && <p>{status.error}</p>}
    {alarms?.error && <p>{i18n.t("alarms.detailsUnavailable")}: {alarms.error}</p>}
    {hasActive && (alarms?.last_confirmed_at || alarms?.captured_at) && <p>{i18n.t("alarms.lastReading")}: {i18n.date(alarms.last_confirmed_at || alarms.captured_at)}</p>}
    {status.warnings && <details><summary>{i18n.t("alarms.rawReply")}</summary><code>{status.warnings}</code></details>}
    <Link to="/alarms">{i18n.t("alarms.history")}</Link>
  </aside>;
}
