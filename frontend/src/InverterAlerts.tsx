import { useId, useState } from "react";
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
  const hasActive = fault || active.length > 0 || Boolean(status.warnings && /^[01]{32}$/.test(status.warnings) && status.warnings.includes("1"));
  if (status.connected && alarms?.available && alarms.severity === "ok" && !hasActive) return null;
  // Acknowledgement belongs to this alarm state, not to polling timestamps.
  // Remount when alarms or their reliability change, or after a healthy interval.
  const signature = JSON.stringify([status.connected, Boolean(alarms?.available), fault, hasActive,
    active.map(alarm => [alarm.key, alarm.severity]).sort(), active.length === 0 && hasActive ? status.warnings : null]);
  return <AlarmBanner key={signature} status={status} i18n={i18n} active={active} fault={fault} hasActive={hasActive} />;
}

function AlarmBanner({ status, i18n, active, fault, hasActive }: {
  status: Status; i18n: I18n; active: InverterAlarm[]; fault: boolean; hasActive: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = useId();
  const alarms = status.alarms;
  const title = hasActive ? i18n.t(fault ? "alarms.fault" : "alarms.warning") : !status.connected ? i18n.t("connection.offline") : alarmSummary(status, i18n);
  return <aside className={`inverter-alert ${fault ? "fault" : "warning"}${collapsed ? " collapsed" : ""}`} role={hasActive && !collapsed ? "alert" : "status"} aria-live={hasActive && !collapsed ? "assertive" : "polite"}>
    <div className="inverter-alert-header">
      <h2>{title}{active.length > 1 && <span className="inverter-alert-count"> ({active.length})</span>}</h2>
      {!status.connected && hasActive && <span className="inverter-alert-state">{i18n.t("status.offline")}</span>}
      {status.connected && !alarms?.available && <span className="inverter-alert-state">{i18n.t("status.unknown")}</span>}
      <div className="inverter-alert-actions">
        <Link to="/alarms">{i18n.t("alarms.history")}</Link>
        <button type="button" className="quiet" aria-expanded={!collapsed} aria-controls={bodyId} onClick={() => setCollapsed(value => !value)}>{i18n.t(collapsed ? "alarms.show" : "alarms.acknowledge")}</button>
      </div>
    </div>
    <div id={bodyId} className="inverter-alert-body" hidden={collapsed}>
      {active.length > 0 && <p className="inverter-alert-summary">{active.map(alarm => alarmLabel(alarm, i18n)).join(" · ")}</p>}
      {!status.connected && <p>{i18n.t("alarms.offlineShort")}</p>}
      {status.connected && !alarms?.available && <p>{i18n.t("alarms.unavailableShort")}</p>}
      <details className="inverter-alert-details"><summary>{i18n.t("alarms.details")}</summary>
        {!status.connected && <p>{i18n.t("alarms.stale")}</p>}
        {(!status.connected || !alarms?.available) && Boolean(alarms?.last_confirmed_active?.length) && <p>{i18n.t("alarms.unconfirmed")}</p>}
        {fault && active.length === 0 && <p>{i18n.t("alarms.faultMode")}</p>}
        {hasActive && <p>{i18n.t("alarms.checkDisplay")}</p>}
        {hasActive && <p>{i18n.t("alarms.provisional")}</p>}
        {status.error && <p>{status.error}</p>}
        {alarms?.error && <p>{i18n.t("alarms.detailsUnavailable")}: {alarms.error}</p>}
        {(alarms?.last_confirmed_at || alarms?.captured_at) && <p>{i18n.t("alarms.lastReading")}: {i18n.date(alarms.last_confirmed_at || alarms.captured_at)}</p>}
        {status.warnings && <p>{i18n.t("alarms.rawReply")}: <code>{status.warnings}</code></p>}
      </details>
    </div>
  </aside>;
}
