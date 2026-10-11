import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "./api";
import type { HistoryRequest } from "./api";
import { alarmLabel, alarmSummary, displayedAlarms } from "./InverterAlerts";
import type { I18n } from "./i18n";
import type { AlarmEvent, Status } from "./types";

function localInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AlarmHistory({ status, i18n }: { status: Status | null; i18n: I18n }) {
  const [preset, setPreset] = useState("24");
  const [start, setStart] = useState(() => localInput(new Date(Date.now() - 86400000)));
  const [end, setEnd] = useState(() => localInput(new Date()));
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
  const [pages, setPages] = useState(1);
  const [events, setEvents] = useState<AlarmEvent[]>([]);
  const [nextId, setNextId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rangeError, setRangeError] = useState("");
  const range = useMemo<HistoryRequest>(() => preset === "custom" && custom ? custom : { hours: Number(preset === "custom" ? "24" : preset) }, [preset, custom]);

  useEffect(() => {
    setEvents([]);
    setNextId(null);
  }, [range]);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (running) return;
      running = true;
      setLoading(true);
      try {
        const rows: AlarmEvent[] = [];
        let cursor: number | undefined;
        let next: number | null = null;
        for (let page = 0; page < pages; page++) {
          const response = await api.alarmHistory(range, cursor, controller.signal);
          rows.push(...response.events);
          next = response.next_before_id;
          if (next === null) break;
          cursor = next;
        }
        if (!controller.signal.aborted) {
          setEvents(rows);
          setNextId(next);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : i18n.t("alarms.historyError"));
      } finally {
        running = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [range, pages, i18n]);

  const applyCustom = (event: FormEvent) => {
    event.preventDefault();
    const first = new Date(start), last = new Date(end);
    if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime()) || first > last || last.getTime() - first.getTime() > 720 * 3600000) {
      setRangeError(i18n.t("alarms.invalidRange"));
      return;
    }
    setRangeError("");
    setPages(1);
    setCustom({ start: first.toISOString(), end: last.toISOString() });
  };

  return <section className="alarm-history">
    <div className="section-title"><div><h2>{i18n.t("alarms.title")}</h2><p>{alarmSummary(status, i18n)}</p></div></div>
    <article className="panel">
      <h3>{i18n.t("alarms.history")}</h3>
      <p>{i18n.t("alarms.historyNote")}</p>
      <div className="alarm-filters">
        <label>{i18n.t("alarms.range")} <select value={preset} onChange={event => { setPreset(event.target.value); setPages(1); setRangeError(""); }}>
          <option value="24">{i18n.t("alarms.last24h")}</option>
          <option value="168">{i18n.t("alarms.last7d")}</option>
          <option value="720">{i18n.t("alarms.last30d")}</option>
          <option value="custom">{i18n.t("alarms.custom")}</option>
        </select></label>
        {preset === "custom" && <form onSubmit={applyCustom}>
          <label>{i18n.t("alarms.from")} <input type="datetime-local" required value={start} onChange={event => setStart(event.target.value)} /></label>
          <label>{i18n.t("alarms.to")} <input type="datetime-local" required value={end} onChange={event => setEnd(event.target.value)} /></label>
          <button type="submit">{i18n.t("alarms.applyRange")}</button>
        </form>}
      </div>
      {rangeError && <p className="error" role="alert">{rangeError}</p>}
      {error && <p className="error" role="alert">{i18n.t("alarms.historyError")}: {error}</p>}
      {loading && <p role="status">{i18n.t("alarms.loading")}</p>}
      {!loading && !error && events.length === 0 && <p>{i18n.t("alarms.emptyHistory")}</p>}
      <ol className="alarm-events">{events.map(event => <AlarmEventRow key={event.id} event={event} i18n={i18n} />)}</ol>
      {nextId !== null && <button className="quiet" disabled={loading} onClick={() => setPages(value => value + 1)}>{i18n.t("alarms.loadMore")}</button>}
    </article>
  </section>;
}

export function AlarmEventRow({ event, i18n }: { event: AlarmEvent; i18n: I18n }) {
  const confirmed = event.alarms.last_confirmed_active || [];
  const active = displayedAlarms({ ...event, status: {} });
  const all = new Map([...(event.cleared_alarms || []), ...confirmed, ...event.alarms.active].map(alarm => [alarm.key, alarm]));
  const labels = (keys: string[]) => keys.map(key => all.has(key) ? alarmLabel(all.get(key)!, i18n) : i18n.t(`alarm.${key}` as Parameters<I18n["t"]>[0])).join(", ");
  return <li className={`alarm-event ${event.alarms.severity}`}>
    <div className="alarm-event-heading"><strong>{i18n.t(`alarms.event.${event.kind}`)}</strong><time dateTime={event.captured_at}>{i18n.date(event.captured_at)}</time></div>
    {!event.connected || !event.alarms.available ? <p>{i18n.t("alarms.unconfirmed")}</p> : <p>{i18n.t(`alarms.${event.alarms.severity}`)}</p>}
    {active.length > 0 && <ul>{active.map(alarm => <li key={alarm.key}>{i18n.t(alarm.severity === "fault" ? "alarms.faultLabel" : "alarms.warningLabel")}: {alarmLabel(alarm, i18n)}</li>)}</ul>}
    {event.raised.length > 0 && <p><b>{i18n.t("alarms.raised")}:</b> {labels(event.raised)}</p>}
    {event.cleared.length > 0 && <p><b>{i18n.t("alarms.cleared")}:</b> {labels(event.cleared)}</p>}
    {event.severity_changed.length > 0 && <p><b>{i18n.t("alarms.severityChanged")}:</b> {labels(event.severity_changed)}</p>}
    {(event.error || event.alarms.error) && <p>{event.error || event.alarms.error}</p>}
    <details><summary>{i18n.t("alarms.rawReply")}</summary><p>{event.protocol_id || "—"} · {i18n.t("overview.mode")}: {event.mode || "—"}</p><code>{event.warnings ?? "—"}</code></details>
  </li>;
}
