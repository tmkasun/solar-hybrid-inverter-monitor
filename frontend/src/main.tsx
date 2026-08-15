import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { Brush, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as THREE from "three";
import { api } from "./api";
import type { HistoryRequest } from "./api";
import { createI18n, groupLabel, languageOptions, languageStorageKey, metricLabel, normalizeLanguage, settingChoiceLabel, settingDetailLabel, settingResetLabel, settingTitleLabel, settingWarningLabel, statusFlagDescription, statusFlagLabel, storedLanguage } from "./i18n";
import type { I18n, Language, TranslationKey } from "./i18n";
import type { BmsStatus, Capability, DiagnosticsResponse, HistorySample, HistoryValue, Status, StatusValues } from "./types";
import "./styles.css";

const energySystemBackground = new URL("./assets/energy-system-background.png", import.meta.url).href;
const settingsPriorityDiagram = new URL("./assets/settings-priority-diagram.png", import.meta.url).href;

function App() {
  const routeLocation = useLocation();
  const graphFullPage = routeLocation.pathname === "/analysis/fullscreen";
  const [language, setLanguage] = useState<Language>(() => storedLanguage());
  const i18n = useMemo(() => createI18n(language), [language]);
  const [status, setStatus] = useState<Status | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [capabilityDiagnostics, setCapabilityDiagnostics] = useState<Record<string, unknown>>({});
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(Boolean(sessionStorage.getItem("sako_csrf")));
  const [message, setMessage] = useState("");
  const [pendingSetting, setPendingSetting] = useState<PendingSetting>(null);

  const load = async () => {
    try {
      const [nextStatus, nextCapabilities] = await Promise.all([api.status(), api.capabilities()]);
      setStatus(nextStatus); setCapabilities(nextCapabilities.capabilities); setCapabilityDiagnostics(nextCapabilities.diagnostics || {});
    } catch (error) { setMessage(error instanceof Error ? error.message : i18n.t("message.unableToReachApi")); }
  };
  useEffect(() => { localStorage.setItem(languageStorageKey, language); document.documentElement.lang = i18n.locale; }, [language, i18n.locale]);
  useEffect(() => { void load(); const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`); socket.onmessage = event => { const data = JSON.parse(event.data); if (data.type === "telemetry" || data.type === "connection") setStatus(data.data); if (data.type === "command_result") setMessage(data.data.ok ? i18n.t("message.settingApplied") : i18n.t("message.commandFailed", { error: data.data.error })); }; return () => socket.close(); }, [i18n]);

  const login = async (event: FormEvent) => { event.preventDefault(); try { await api.login(password); setAuthenticated(true); setPassword(""); setMessage(i18n.t("message.signedIn")); } catch (error) { setMessage(error instanceof Error ? error.message : i18n.t("message.loginFailed")); } };
  const logout = async () => { await api.logout(); setAuthenticated(false); setMessage(i18n.t("message.signedOut")); };
  const currentSettings = useMemo(() => currentPrioritySettings(capabilityDiagnostics), [capabilityDiagnostics]);
  const applySetting = async (key: string, value: string) => {
    const label = settingDisplayLabel(key, value, i18n);
    setPendingSetting({ key, value });
    try {
      await api.change(key, value);
      await load();
      setMessage(i18n.t("message.settingUpdated", { setting: settingTitle(key, i18n), value: label }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : i18n.t("message.changeFailed"));
    } finally {
      setPendingSetting(null);
    }
  };
  const resetDefaults = async () => {
    const defaults = Object.entries(factorySafeDefaults);
    if (!window.confirm(i18n.t("confirm.resetDefaults", {
      output: settingDisplayLabel("output_source_priority", factorySafeDefaults.output_source_priority, i18n),
      charger: settingDisplayLabel("charger_source_priority", factorySafeDefaults.charger_source_priority, i18n),
    }))) return;
    try {
      for (const [key, value] of defaults) {
        if (currentSettings[key] === value) continue;
        setPendingSetting({ key, value });
        await api.change(key, value);
      }
      await load();
      setMessage(i18n.t("message.defaultsApplied"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : i18n.t("message.resetFailed"));
    } finally {
      setPendingSetting(null);
    }
  };

  return <main className={graphFullPage ? "full-page-shell" : ""}>
    {!graphFullPage && <header><div><h1>Sako Energy</h1><p>{i18n.t("app.tagline")}</p></div><div className="header-actions"><label className="language-select"><span>{i18n.t("language.label")}</span><select value={language} onChange={event => setLanguage(normalizeLanguage(event.target.value))}>{languageOptions.map(option => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}</select></label><div className={`connection ${status?.connected ? "ok" : "offline"}`}>{status?.connected ? i18n.t("connection.connected") : i18n.t("connection.offline")}</div></div></header>}
    {!graphFullPage && <nav>{appRoutes.map(route => <NavLink key={route.path} to={route.path} className={({ isActive }) => isActive ? "active" : ""}>{i18n.t(route.labelKey)}</NavLink>)}</nav>}
    {message && <div className="notice">{message}<button onClick={() => setMessage("")}>×</button></div>}
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<Overview status={status} i18n={i18n} />} />
      <Route path="/analysis" element={<DataAnalysis i18n={i18n} />} />
      <Route path="/analysis/fullscreen" element={<DataAnalysis fullPage i18n={i18n} />} />
      <Route path="/settings" element={<Settings authenticated={authenticated} capabilities={capabilities} currentSettings={currentSettings} pendingSetting={pendingSetting} login={login} password={password} setPassword={setPassword} logout={logout} onChange={applySetting} onResetDefaults={resetDefaults} i18n={i18n} />} />
      <Route path="/diagnostics" element={<Diagnostics authenticated={authenticated} i18n={i18n} />} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  </main>;
}

const appRoutes = [
  { path: "/overview", labelKey: "route.overview" },
  { path: "/analysis", labelKey: "route.analysis" },
  { path: "/settings", labelKey: "route.settings" },
  { path: "/diagnostics", labelKey: "route.diagnostics" },
] satisfies Array<{ path: string; labelKey: TranslationKey }>;

type I18nProps = {
  i18n: I18n;
};

function Overview({ status, i18n }: { status: Status | null } & I18nProps) {
  const values: StatusValues = status?.status || {};
  const activeFlags = values.status_flags?.filter(flag => flag.active) || [];
  const [batteryDetailOpen, setBatteryDetailOpen] = useState(false);
  const now = useNow(1000);
  return <section><EnergyFlow values={values} connected={Boolean(status?.connected)} onBatteryOpen={() => setBatteryDetailOpen(true)} i18n={i18n} />
    <EnergyOverview values={values} connected={Boolean(status?.connected)} i18n={i18n} />
    <BmsCellHealth bms={status?.bms} i18n={i18n} />
    <div className="panel details"><h2>{i18n.t("overview.currentState")}</h2><p>{i18n.t("overview.mode")}: <b>{formatInverterMode(status?.mode, i18n)}</b> · {i18n.t("overview.lastUpdate")}: {formatLastUpdate(status?.captured_at, now, i18n)}</p><p>{i18n.t("overview.batterySource")}: <b>{batterySourceLabel(values.battery_source, status?.bms, i18n)}</b></p>{activeFlags.length > 0 && <p>{i18n.t("overview.status")}: {activeFlags.map(flag => <span key={flag.key} title={statusFlagDescription(i18n, flag.key, flag.description)}><b>{statusFlagLabel(i18n, flag.key, flag.label)}</b>{" "}</span>)}</p>}{status?.warnings && <p>{i18n.t("overview.warnings")}: <code>{status.warnings}</code></p>}{status?.error && <p className="error">{status.error}</p>}</div>
    {batteryDetailOpen && <BatteryDetailModal values={values} bms={status?.bms} onClose={() => setBatteryDetailOpen(false)} i18n={i18n} />}
  </section>;
}

function DataAnalysis({ fullPage = false, i18n }: { fullPage?: boolean } & I18nProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const analysisState = useMemo(() => parseAnalysisQuery(searchParams), [searchKey]);
  const activeGroup = metricGroups.find(group => group.id === analysisState.activeGroupId) || metricGroups[0];
  const selectedMetrics = analysisState.selectedMetricIds.map(id => metricDefinitions[id]).filter(Boolean);
  const historyRequest = useMemo(() => historyRequestForRange(analysisState.range), [analysisState.range]);
  const historyKey = rangeKey(analysisState.range);
  const [customStart, setCustomStart] = useState(() => analysisState.range.mode === "custom" ? dateTimeInputValue(analysisState.range.start) : "");
  const [customEnd, setCustomEnd] = useState(() => analysisState.range.mode === "custom" ? dateTimeInputValue(analysisState.range.end) : "");
  const [samples, setSamples] = useState<HistorySample[]>([]);
  const [zoomRange, setZoomRange] = useState<ChartZoomRange | null>(null);
  const [rawDataOpen, setRawDataOpen] = useState(false);
  const [rawFilter, setRawFilter] = useState("");
  const [rawSort, setRawSort] = useState<RawSort>({ key: "captured_at", direction: "desc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => localStorage.getItem(autoRefreshEnabledStorageKey) !== "false");
  const [autoRefreshIntervalMs, setAutoRefreshIntervalMs] = useState(() => storedAutoRefreshInterval());
  const historyLoadInFlight = useRef(false);
  const historyLoadQueued = useRef(false);
  const historyRequestRef = useRef(historyRequest);
  historyRequestRef.current = historyRequest;
  const enrichedSamples = useMemo(() => samples.map(enrichSample), [samples]);
  const chartData = useMemo(() => downsample(enrichedSamples, 360).map(sample => ({ ...sample, at: chartTimeLabel(sample.captured_at, analysisState.range, i18n) })), [enrichedSamples, historyKey, i18n]);
  const stats = useMemo(() => selectedMetrics.map(metric => metricStats(metric, enrichedSamples)), [selectedMetrics, enrichedSamples]);
  const rawRows = useMemo(() => sortedFilteredRows(enrichedSamples, selectedMetrics, rawFilter, rawSort, i18n), [enrichedSamples, selectedMetrics, rawFilter, rawSort, i18n]);
  const zoomed = Boolean(zoomRange && chartData.length > 0 && (zoomRange.startIndex > 0 || zoomRange.endIndex < chartData.length - 1));
  const activeZoomRange = zoomRange && chartData.length > 0 ? clampZoomRange(zoomRange, chartData.length) : null;
  const activeGroupLabel = groupLabel(i18n, activeGroup.id);
  const zoomLabel = activeZoomRange ? zoomRangeLabel(chartData, activeZoomRange, i18n) : i18n.t("analysis.fullRange");
  const customRangeError = customDateRangeError(customStart, customEnd, i18n);
  const fullPagePath = pathWithSearch("/analysis/fullscreen", searchParams);
  const analysisPath = pathWithSearch("/analysis", searchParams);

  const loadHistory = useCallback(async () => {
    if (historyLoadInFlight.current) {
      historyLoadQueued.current = true;
      return;
    }
    historyLoadInFlight.current = true;
    setLoading(true);
    try {
      do {
        historyLoadQueued.current = false;
        try {
          const history = await api.history(historyRequestRef.current);
          setSamples(history.samples);
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : i18n.t("analysis.loadError"));
        }
      } while (historyLoadQueued.current);
    } finally {
      historyLoadInFlight.current = false;
      setLoading(false);
    }
  }, [i18n]);
  useEffect(() => { void loadHistory(); }, [historyKey, loadHistory]);
  useEffect(() => { localStorage.setItem(autoRefreshEnabledStorageKey, String(autoRefreshEnabled)); }, [autoRefreshEnabled]);
  useEffect(() => { localStorage.setItem(autoRefreshIntervalStorageKey, String(autoRefreshIntervalMs)); }, [autoRefreshIntervalMs]);
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = window.setInterval(() => { void loadHistory(); }, autoRefreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, autoRefreshIntervalMs, loadHistory]);
  useEffect(() => { setZoomRange(null); }, [historyKey, samples.length]);
  useEffect(() => {
    if (analysisState.range.mode === "custom") {
      setCustomStart(dateTimeInputValue(analysisState.range.start));
      setCustomEnd(dateTimeInputValue(analysisState.range.end));
    } else {
      setCustomStart("");
      setCustomEnd("");
    }
  }, [historyKey]);
  useEffect(() => {
    if (rawSort.key !== "captured_at" && !analysisState.selectedMetricIds.includes(rawSort.key)) setRawSort({ key: "captured_at", direction: "desc" });
  }, [rawSort.key, analysisState.selectedMetricIds]);

  const updateAnalysisState = (next: AnalysisUrlState) => setSearchParams(analysisSearchParams(next));

  const selectGroup = (group: MetricGroup) => {
    updateAnalysisState({ ...analysisState, activeGroupId: group.id, selectedMetricIds: group.defaultMetricIds });
  };
  const selectPresetRange = (range: TimeRange) => updateAnalysisState({ ...analysisState, range: { mode: "preset", hours: range.hours, param: range.param } });
  const applyCustomRange = () => {
    const start = inputDateTimeToIso(customStart);
    const end = inputDateTimeToIso(customEnd);
    if (!start || !end || new Date(start).getTime() > new Date(end).getTime()) return;
    updateAnalysisState({ ...analysisState, range: { mode: "custom", start, end } });
  };
  const toggleMetric = (id: string) => {
    const current = analysisState.selectedMetricIds;
    const selectedMetricIds = current.includes(id) ? current.length > 1 ? current.filter(item => item !== id) : current : [...current, id];
    updateAnalysisState({ ...analysisState, selectedMetricIds });
  };

  return <section className={fullPage ? "analysis-page fullscreen" : "analysis-page"}>
    <div className="section-title">
      <div><h2>{fullPage ? i18n.t("analysis.trend", { group: activeGroupLabel }) : i18n.t("analysis.title")}</h2><p>{fullPage ? i18n.t("analysis.samplesSummary", { samples: samples.length, range: timeRangeLabel(analysisState.range, i18n), zoom: zoomLabel }) : i18n.t("analysis.subtitle")}</p></div>
      <div className="analysis-actions">
        <label className={autoRefreshEnabled ? "auto-refresh-toggle active" : "auto-refresh-toggle"}><input type="checkbox" checked={autoRefreshEnabled} onChange={event => setAutoRefreshEnabled(event.target.checked)} /><span>{i18n.t("analysis.autoRefresh")}</span></label>
        <select aria-label={i18n.t("analysis.autoRefreshInterval")} value={autoRefreshIntervalMs} disabled={!autoRefreshEnabled} onChange={event => setAutoRefreshIntervalMs(Number(event.target.value))}>{autoRefreshIntervals.map(interval => <option key={interval.ms} value={interval.ms}>{i18n.t(interval.labelKey)}</option>)}</select>
        <button className="quiet" disabled={loading} onClick={() => void loadHistory()}>{loading ? i18n.t("analysis.loading") : i18n.t("analysis.refresh")}</button>
        {fullPage && <Link className="button-link quiet" to={analysisPath}>{i18n.t("analysis.back")}</Link>}
      </div>
    </div>
    <div className="analysis-controls panel">
      <div><span>{i18n.t("analysis.range")}</span><div className="segmented">{timeRanges.map(range => <button key={range.hours} className={analysisState.range.mode === "preset" && analysisState.range.hours === range.hours ? "active" : ""} onClick={() => selectPresetRange(range)}>{range.param}</button>)}</div>
        <div className="custom-range">
          <label><span>{i18n.t("analysis.start")}</span><input type="datetime-local" value={customStart} onChange={event => setCustomStart(event.target.value)} /></label>
          <label><span>{i18n.t("analysis.end")}</span><input type="datetime-local" value={customEnd} onChange={event => setCustomEnd(event.target.value)} /></label>
          <button className={analysisState.range.mode === "custom" ? "active" : ""} disabled={!customStart || !customEnd || Boolean(customRangeError)} onClick={applyCustomRange}>{i18n.t("analysis.apply")}</button>
        </div>
        {customRangeError && <small className="custom-range-error">{customRangeError}</small>}
      </div>
      <div><span>{i18n.t("analysis.parameterType")}</span><div className="segmented metric-groups">{metricGroups.map(group => <button key={group.id} className={analysisState.activeGroupId === group.id ? "active" : ""} onClick={() => selectGroup(group)}>{groupLabel(i18n, group.id)}</button>)}</div></div>
      <div><span>{i18n.t("analysis.parameters")}</span><div className="metric-toggles">{activeGroup.metricIds.map(id => {
        const metric = metricDefinitions[id];
        const checked = analysisState.selectedMetricIds.includes(id);
        return <label key={id} className={checked ? "checked" : ""}><input type="checkbox" checked={checked} onChange={() => toggleMetric(id)} /> <i style={{ background: metric.color }} />{metricLabel(i18n, metric.id)}</label>;
      })}</div></div>
    </div>
    {error && <p className="error">{error}</p>}
    {!fullPage && <div className="analysis-summary">{stats.map(stat => <article key={stat.metric.id} className="analysis-stat"><span>{metricLabel(i18n, stat.metric.id)}</span><strong>{formatMetricValue(stat.metric, stat.latest)}</strong><small>{i18n.t("analysis.avg")} {formatMetricValue(stat.metric, stat.average)} · {i18n.t("analysis.min")} {formatMetricValue(stat.metric, stat.min)} · {i18n.t("analysis.max")} {formatMetricValue(stat.metric, stat.max)}</small></article>)}</div>}
    <div className="panel analysis-chart"><div className="analysis-panel-head"><div><h3>{i18n.t("analysis.trend", { group: activeGroupLabel })}</h3><span>{i18n.t("analysis.samplesSummary", { samples: samples.length, range: timeRangeLabel(analysisState.range, i18n), zoom: zoomLabel })}</span></div><div className="analysis-panel-actions"><button className="quiet zoom-reset" disabled={!zoomed} onClick={() => setZoomRange(null)}>{i18n.t("analysis.resetZoom")}</button>{!fullPage && <Link className="button-link quiet" to={fullPagePath}>{i18n.t("analysis.fullPage")}</Link>}</div></div>
      {loading && samples.length === 0 ? <div className="empty-chart">{i18n.t("analysis.loadingHistory")}</div> : chartData.length === 0 ? <div className="empty-chart">{i18n.t("analysis.noSamples")}</div> : <div className="chart"><ResponsiveContainer><LineChart data={chartData}><CartesianGrid stroke="#29404d" strokeDasharray="3 6" /><XAxis dataKey="at" minTickGap={34}/><YAxis/><Tooltip formatter={(value, name) => {
        const metric = metricDefinitions[String(name)];
        return [metric ? formatMetricValue(metric, value as number) : value, metric ? metricLabel(i18n, metric.id) : name];
      }} /><Legend formatter={(value) => metricDefinitions[String(value)] ? metricLabel(i18n, String(value)) : value} />{selectedMetrics.map(metric => <Line key={metric.id} type="monotone" dataKey={metric.id} stroke={metric.color} dot={false} strokeWidth={2.4} connectNulls />)}<Brush dataKey="at" height={32} stroke="#55b964" fill="#10202a" travellerWidth={12} startIndex={activeZoomRange?.startIndex ?? 0} endIndex={activeZoomRange?.endIndex ?? chartData.length - 1} onChange={range => setZoomRange(normalizeZoomRange(range, chartData.length))} /></LineChart></ResponsiveContainer></div>}
    </div>
    {!fullPage && <details className="panel analysis-table-panel" open={rawDataOpen} onToggle={event => setRawDataOpen(event.currentTarget.open)}><summary><span>{i18n.t("analysis.rawData")}</span><small>{rawDataOpen ? i18n.t("analysis.rowsOpen", { rows: rawRows.length, samples: samples.length }) : i18n.t("analysis.collapsed")}</small></summary>
      <div className="raw-data-tools">
        <label><span>{i18n.t("analysis.filter")}</span><input value={rawFilter} onChange={event => setRawFilter(event.target.value)} placeholder={i18n.t("analysis.filterPlaceholder")} /></label>
        <label><span>{i18n.t("analysis.sortBy")}</span><select value={rawSort.key} onChange={event => setRawSort(current => ({ ...current, key: event.target.value }))}><option value="captured_at">{i18n.t("analysis.capturedTime")}</option>{selectedMetrics.map(metric => <option key={metric.id} value={metric.id}>{metricLabel(i18n, metric.id)}</option>)}</select></label>
        <label><span>{i18n.t("analysis.direction")}</span><select value={rawSort.direction} onChange={event => setRawSort(current => ({ ...current, direction: event.target.value as SortDirection }))}><option value="desc">{i18n.t("analysis.descending")}</option><option value="asc">{i18n.t("analysis.ascending")}</option></select></label>
        {(rawFilter || rawSort.key !== "captured_at" || rawSort.direction !== "desc") && <button className="quiet" onClick={() => { setRawFilter(""); setRawSort({ key: "captured_at", direction: "desc" }); }}>{i18n.t("analysis.clear")}</button>}
      </div>
      {rawRows.length === 0 ? <p>{i18n.t("analysis.noRows")}</p> : <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>{i18n.t("analysis.captured")}</th>{selectedMetrics.map(metric => <th key={metric.id}>{metricLabel(i18n, metric.id)}</th>)}</tr></thead><tbody>{rawRows.map(row => <tr key={row.captured_at}><td>{formatDate(row.captured_at, i18n)}</td>{selectedMetrics.map(metric => <td key={metric.id}>{formatMetricValue(metric, metricValue(row, metric.id))}</td>)}</tr>)}</tbody></table></div>}
    </details>}
  </section>;
}

function EnergyOverview({ values, connected, i18n }: { values: StatusValues; connected: boolean } & I18nProps) {
  const loadPower = numeric(values.output_active_power_w);
  const chargePower = numeric(values.battery_voltage) * numeric(values.battery_charge_current);
  const dischargePower = numeric(values.battery_voltage) * numeric(values.battery_discharge_current);
  const batteryCharging = chargePower > 1 && chargePower >= dischargePower;
  const batteryDischarging = dischargePower > 1 && dischargePower > chargePower;
  const batteryPower = batteryCharging ? chargePower : batteryDischarging ? -dischargePower : 0;
  const pvPower = numeric(values.pv_input_voltage) * numeric(values.pv_input_current);
  const gridPower = Math.max(0, loadPower + Math.max(0, batteryPower) - pvPower - Math.max(0, -batteryPower));
  const gridActive = gridPower > 1;
  const batteryPercent = Math.min(100, Math.max(0, numeric(values.battery_capacity_percent)));
  const gridDirection = gridActive ? i18n.t("state.importing") : i18n.t("state.standby");

  return <aside className="overview-card overview-below" aria-label={i18n.t("overview.energyOverview")}>
    <div className="overview-head"><h3>{i18n.t("overview.title")}</h3><span className={connected ? "live on" : "live"}>{connected ? i18n.t("status.live") : i18n.t("status.offline")}</span></div>
    <OverviewRow icon="panel" label={i18n.t("overview.pvInput")} value={`${display(values.pv_input_voltage, " V")} · ${display(values.pv_input_current, " A")}`} compact />
    <OverviewRow icon="battery" label={i18n.t("overview.batterySoc")} value={`${batteryPercent.toFixed(0)}%`} progress={batteryPercent} />
    <OverviewRow icon="home" label={i18n.t("overview.homeLoad")} value={loadPower > 1 ? watts(loadPower) : "0 W"} />
    <OverviewRow icon="tower" label={i18n.t("overview.grid")} value={gridActive ? watts(gridPower) : "0 W"} note={`${gridDirection} · ${display(values.grid_voltage, " V", 0)} · ${display(values.grid_frequency, " Hz")}`} />
    <OverviewRow icon="pulse" label={i18n.t("overview.batteryCurrent")} value={`${display(values.battery_charge_current, " A", 0)} / ${display(values.battery_discharge_current, " A", 0)}`} note={i18n.t("overview.chargeDischarge")} compact />
    <OverviewRow icon="temp" label={i18n.t("overview.inverterTemp")} value={display(values.inverter_temperature_c, "°C")} />
  </aside>;
}

const numeric = (value: number | string | null | undefined) => typeof value === "number" ? value : Number(value) || 0;
const watts = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} kW` : `${Math.round(value)} W`;
const display = (value: number | string | null | undefined, unit = "", digits = 1) => {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toFixed(digits)}${unit}`;
};
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatLastUpdate(value: string | null | undefined, now: number, i18n: I18n) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${i18n.relativeTime(date.getTime(), now)} (${date.toLocaleString(i18n.locale)})`;
}

type MetricDefinition = { id: string; source?: string; unit: string; digits: number; color: string };
type MetricGroup = { id: string; metricIds: string[]; defaultMetricIds: string[] };
type AnalysisSample = HistorySample & Record<string, HistoryValue>;
type ChartZoomRange = { startIndex: number; endIndex: number };
type SortDirection = "asc" | "desc";
type RawSort = { key: string; direction: SortDirection };
type TimeRange = { param: string; hours: number };
type AnalysisRangeState = { mode: "preset"; hours: number; param: string } | { mode: "custom"; start: string; end: string };
type AnalysisUrlState = { activeGroupId: string; selectedMetricIds: string[]; range: AnalysisRangeState };

const bmsCellColors = ["#84cc16", "#06b6d4", "#f59e0b", "#a78bfa", "#22c55e", "#38bdf8", "#fb7185", "#eab308"];
const bmsCellMetricDefinitions: Record<string, MetricDefinition> = Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => {
    const cell = index + 1;
    return [`bms_cell_${String(cell).padStart(2, "0")}_voltage`, { id: `bms_cell_${String(cell).padStart(2, "0")}_voltage`, unit: " V", digits: 3, color: bmsCellColors[index % bmsCellColors.length] }];
  })
);
const bmsCellResistanceMetricDefinitions: Record<string, MetricDefinition> = Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => {
    const cell = index + 1;
    return [`bms_cell_${String(cell).padStart(2, "0")}_resistance_mohm`, { id: `bms_cell_${String(cell).padStart(2, "0")}_resistance_mohm`, unit: " mΩ", digits: 3, color: bmsCellColors[index % bmsCellColors.length] }];
  })
);
const bmsCellWireResistanceMetricDefinitions: Record<string, MetricDefinition> = Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => {
    const cell = index + 1;
    return [`bms_cell_${String(cell).padStart(2, "0")}_wire_resistance_mohm`, { id: `bms_cell_${String(cell).padStart(2, "0")}_wire_resistance_mohm`, unit: " mΩ", digits: 3, color: bmsCellColors[index % bmsCellColors.length] }];
  })
);

const metricDefinitions: Record<string, MetricDefinition> = {
  battery_voltage: { id: "battery_voltage", unit: " V", digits: 1, color: "#f7c948" },
  pv_input_voltage: { id: "pv_input_voltage", unit: " V", digits: 1, color: "#50c878" },
  grid_voltage: { id: "grid_voltage", unit: " V", digits: 1, color: "#7dd3fc" },
  output_voltage: { id: "output_voltage", unit: " V", digits: 1, color: "#c084fc" },
  output_active_power_w: { id: "output_active_power_w", unit: " W", digits: 0, color: "#fb923c" },
  output_apparent_power_va: { id: "output_apparent_power_va", unit: " VA", digits: 0, color: "#f472b6" },
  pv_power_w: { id: "pv_power_w", unit: " W", digits: 0, color: "#22c55e" },
  battery_capacity_percent: { id: "battery_capacity_percent", unit: "%", digits: 0, color: "#a3e635" },
  battery_charge_current: { id: "battery_charge_current", unit: " A", digits: 0, color: "#14b8a6" },
  battery_discharge_current: { id: "battery_discharge_current", unit: " A", digits: 0, color: "#f97316" },
  pv_input_current: { id: "pv_input_current", unit: " A", digits: 1, color: "#86efac" },
  grid_frequency: { id: "grid_frequency", unit: " Hz", digits: 1, color: "#38bdf8" },
  load_percent: { id: "load_percent", unit: "%", digits: 0, color: "#facc15" },
  inverter_temperature_c: { id: "inverter_temperature_c", unit: "°C", digits: 1, color: "#ef4444" },
  bms_battery_voltage: { id: "bms_battery_voltage", unit: " V", digits: 2, color: "#f7c948" },
  bms_current_a: { id: "bms_current_a", unit: " A", digits: 2, color: "#14b8a6" },
  bms_power_w: { id: "bms_power_w", unit: " W", digits: 0, color: "#fb923c" },
  bms_capacity_percent: { id: "bms_capacity_percent", unit: "%", digits: 0, color: "#a3e635" },
  bms_delta_cell_voltage: { id: "bms_delta_cell_voltage", unit: " V", digits: 3, color: "#f97316" },
  bms_min_cell_voltage: { id: "bms_min_cell_voltage", unit: " V", digits: 3, color: "#60a5fa" },
  bms_max_cell_voltage: { id: "bms_max_cell_voltage", unit: " V", digits: 3, color: "#c084fc" },
  bms_balance_current_a: { id: "bms_balance_current_a", unit: " A", digits: 2, color: "#2dd4bf" },
  bms_battery_t1_c: { id: "bms_battery_t1_c", unit: "°C", digits: 1, color: "#f87171" },
  bms_battery_t2_c: { id: "bms_battery_t2_c", unit: "°C", digits: 1, color: "#fb7185" },
  bms_mos_temperature_c: { id: "bms_mos_temperature_c", unit: "°C", digits: 1, color: "#ef4444" },
  bms_remaining_capacity_ah: { id: "bms_remaining_capacity_ah", unit: " Ah", digits: 1, color: "#99f6e4" },
  bms_nominal_capacity_ah: { id: "bms_nominal_capacity_ah", unit: " Ah", digits: 1, color: "#bfdbfe" },
  bms_cycle_count: { id: "bms_cycle_count", unit: "", digits: 0, color: "#fde047" },
  ...bmsCellMetricDefinitions,
  ...bmsCellResistanceMetricDefinitions,
  ...bmsCellWireResistanceMetricDefinitions,
};

const bmsCellMetricIds = Array.from({ length: 8 }, (_, index) => `bms_cell_${String(index + 1).padStart(2, "0")}_voltage`);
const bmsCellResistanceMetricIds = Array.from({ length: 8 }, (_, index) => `bms_cell_${String(index + 1).padStart(2, "0")}_resistance_mohm`);
const bmsCellWireResistanceMetricIds = Array.from({ length: 8 }, (_, index) => `bms_cell_${String(index + 1).padStart(2, "0")}_wire_resistance_mohm`);
const metricGroups: MetricGroup[] = [
  { id: "voltage", metricIds: ["battery_voltage", "pv_input_voltage", "grid_voltage", "output_voltage"], defaultMetricIds: ["battery_voltage", "pv_input_voltage"] },
  { id: "power", metricIds: ["output_active_power_w", "output_apparent_power_va", "pv_power_w"], defaultMetricIds: ["output_active_power_w", "pv_power_w"] },
  { id: "battery", metricIds: ["battery_capacity_percent", "battery_voltage", "battery_charge_current", "battery_discharge_current"], defaultMetricIds: ["battery_capacity_percent", "battery_voltage"] },
  { id: "bms", metricIds: ["bms_capacity_percent", "bms_battery_voltage", "bms_current_a", "bms_power_w", "bms_delta_cell_voltage", "bms_mos_temperature_c", "bms_battery_t1_c", "bms_battery_t2_c", "bms_balance_current_a"], defaultMetricIds: ["bms_capacity_percent", "bms_battery_voltage", "bms_delta_cell_voltage"] },
  { id: "cells", metricIds: [...bmsCellMetricIds, ...bmsCellWireResistanceMetricIds, ...bmsCellResistanceMetricIds], defaultMetricIds: bmsCellMetricIds.slice(0, 8) },
  { id: "pv", metricIds: ["pv_input_voltage", "pv_input_current", "pv_power_w"], defaultMetricIds: ["pv_input_voltage", "pv_power_w"] },
  { id: "grid", metricIds: ["grid_voltage", "grid_frequency"], defaultMetricIds: ["grid_voltage", "grid_frequency"] },
  { id: "load", metricIds: ["load_percent", "output_active_power_w", "output_apparent_power_va"], defaultMetricIds: ["load_percent", "output_active_power_w"] },
  { id: "temperature", metricIds: ["inverter_temperature_c"], defaultMetricIds: ["inverter_temperature_c"] },
];

const timeRanges: TimeRange[] = [
  { param: "1h", hours: 1 },
  { param: "6h", hours: 6 },
  { param: "12h", hours: 12 },
  { param: "24h", hours: 24 },
  { param: "3d", hours: 72 },
  { param: "7d", hours: 168 },
  { param: "30d", hours: 720 },
];

const defaultAnalysisGroupId = "voltage";
const defaultTimeRange = timeRanges[0];
const autoRefreshEnabledStorageKey = "sako_analysis_auto_refresh_enabled";
const autoRefreshIntervalStorageKey = "sako_analysis_auto_refresh_interval_ms";
const autoRefreshIntervals = [
  { labelKey: "analysis.interval.5s", ms: 5_000 },
  { labelKey: "analysis.interval.10s", ms: 10_000 },
  { labelKey: "analysis.interval.30s", ms: 30_000 },
  { labelKey: "analysis.interval.1m", ms: 60_000 },
] satisfies Array<{ labelKey: TranslationKey; ms: number }>;
const defaultAutoRefreshIntervalMs = 30_000;

function storedAutoRefreshInterval() {
  const stored = Number(localStorage.getItem(autoRefreshIntervalStorageKey));
  return autoRefreshIntervals.some(interval => interval.ms === stored) ? stored : defaultAutoRefreshIntervalMs;
}

function parseAnalysisQuery(params: URLSearchParams): AnalysisUrlState {
  const activeGroup = metricGroups.find(group => group.id === params.get("group")) || metricGroups.find(group => group.id === defaultAnalysisGroupId) || metricGroups[0];
  const metricIds = (params.get("metrics") || "").split(",").map(item => item.trim()).filter(id => activeGroup.metricIds.includes(id));
  const start = params.get("start");
  const end = params.get("end");
  const parsedStart = validIsoDate(start);
  const parsedEnd = validIsoDate(end);
  const range = parsedStart && parsedEnd && new Date(parsedStart).getTime() <= new Date(parsedEnd).getTime()
    ? { mode: "custom" as const, start: parsedStart, end: parsedEnd }
    : presetRange(params.get("range"));
  return { activeGroupId: activeGroup.id, selectedMetricIds: metricIds.length ? metricIds : activeGroup.defaultMetricIds, range };
}

function presetRange(value: string | null): AnalysisRangeState {
  const range = timeRanges.find(item => item.param === value) || defaultTimeRange;
  return { mode: "preset", hours: range.hours, param: range.param };
}

function validIsoDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function analysisSearchParams(state: AnalysisUrlState) {
  const params = new URLSearchParams();
  params.set("group", state.activeGroupId);
  params.set("metrics", state.selectedMetricIds.join(","));
  if (state.range.mode === "custom") {
    params.set("start", state.range.start);
    params.set("end", state.range.end);
  } else {
    params.set("range", state.range.param);
  }
  return params;
}

function pathWithSearch(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function historyRequestForRange(range: AnalysisRangeState): HistoryRequest {
  return range.mode === "custom" ? { start: range.start, end: range.end } : { hours: range.hours };
}

function rangeKey(range: AnalysisRangeState) {
  return range.mode === "custom" ? `custom:${range.start}:${range.end}` : `preset:${range.hours}`;
}

function dateTimeInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (amount: number) => String(amount).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function inputDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function customDateRangeError(start: string, end: string, i18n: I18n) {
  if (!start && !end) return "";
  if (!start || !end) return i18n.t("analysis.customBoth");
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return i18n.t("analysis.customValid");
  if (startTime > endTime) return i18n.t("analysis.customOrder");
  return "";
}

function enrichSample(sample: HistorySample): AnalysisSample {
  const pvVoltage = finiteNumber(sample.pv_input_voltage);
  const pvCurrent = finiteNumber(sample.pv_input_current);
  return { ...sample, pv_power_w: pvVoltage !== null && pvCurrent !== null ? Math.round(pvVoltage * pvCurrent) : null };
}

function finiteNumber(value: HistoryValue | number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }
  return null;
}

function metricValue(sample: AnalysisSample, id: string): number | null {
  return finiteNumber(sample[metricDefinitions[id]?.source || id]);
}

function metricStats(metric: MetricDefinition, samples: AnalysisSample[]) {
  const values = samples.map(sample => metricValue(sample, metric.id)).filter((value): value is number => value !== null);
  return {
    metric,
    latest: values.at(-1) ?? null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
  };
}

function formatMetricValue(metric: MetricDefinition, value: number | string | null | undefined) {
  return display(value, metric.unit, metric.digits);
}

function sortedFilteredRows(samples: AnalysisSample[], metrics: MetricDefinition[], filter: string, sort: RawSort, i18n: I18n) {
  const query = filter.trim().toLowerCase();
  const filtered = query ? samples.filter(sample => rawRowText(sample, metrics, i18n).includes(query)) : samples;
  return [...filtered].sort((left, right) => compareRows(left, right, sort));
}

function rawRowText(sample: AnalysisSample, metrics: MetricDefinition[], i18n: I18n) {
  return [
    formatDate(sample.captured_at, i18n),
    sample.captured_at,
    ...metrics.flatMap(metric => [metricLabel(i18n, metric.id), formatMetricValue(metric, metricValue(sample, metric.id))]),
  ].join(" ").toLowerCase();
}

function compareRows(left: AnalysisSample, right: AnalysisSample, sort: RawSort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  if (sort.key === "captured_at") return direction * (new Date(left.captured_at).getTime() - new Date(right.captured_at).getTime());
  const leftValue = metricValue(left, sort.key);
  const rightValue = metricValue(right, sort.key);
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return direction * (leftValue - rightValue);
}

function downsample<T>(rows: T[], maxPoints: number): T[] {
  if (rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, index) => index % step === 0 || index === rows.length - 1);
}

function normalizeZoomRange(range: { startIndex?: number; endIndex?: number } | undefined, length: number): ChartZoomRange | null {
  if (!range || length <= 0 || range.startIndex === undefined || range.endIndex === undefined) return null;
  return clampZoomRange({ startIndex: range.startIndex, endIndex: range.endIndex }, length);
}

function clampZoomRange(range: ChartZoomRange, length: number): ChartZoomRange {
  const startIndex = Math.min(Math.max(0, range.startIndex), Math.max(0, length - 1));
  const endIndex = Math.min(Math.max(startIndex, range.endIndex), Math.max(0, length - 1));
  return { startIndex, endIndex };
}

function zoomRangeLabel(rows: Array<AnalysisSample & { at: string }>, range: ChartZoomRange, i18n: I18n) {
  const start = rows[range.startIndex]?.captured_at;
  const end = rows[range.endIndex]?.captured_at;
  if (!start || !end) return i18n.t("analysis.fullRange");
  return i18n.t("analysis.zoomRange", { start: shortDateTime(start, i18n), end: shortDateTime(end, i18n) });
}

function chartTimeLabel(value: string, range: AnalysisRangeState, i18n: I18n) {
  const hours = range.mode === "preset" ? range.hours : (new Date(range.end).getTime() - new Date(range.start).getTime()) / 3_600_000;
  return i18n.chartTime(value, hours > 24);
}

function shortDateTime(value: string, i18n: I18n) {
  return i18n.shortDateTime(value);
}

function timeRangeLabel(range: AnalysisRangeState, i18n: I18n) {
  if (range.mode === "custom") return i18n.t("analysis.customRange", { start: shortDateTime(range.start, i18n), end: shortDateTime(range.end, i18n) });
  const hours = range.hours;
  if (hours < 24) return i18n.t(hours === 1 ? "analysis.hourSingular" : "analysis.hourPlural", { count: hours });
  const days = hours / 24;
  return i18n.t(days === 1 ? "analysis.daySingular" : "analysis.dayPlural", { count: days });
}

function EnergyFlow({ values, connected, onBatteryOpen, i18n }: { values: StatusValues; connected: boolean; onBatteryOpen: () => void } & I18nProps) {
  const [viewMode, setViewMode] = useState<EnergyFlowView>(() => localStorage.getItem("sako_energy_flow_view") === "image" ? "image" : "3d");
  const pvPower = numeric(values.pv_input_voltage) * numeric(values.pv_input_current);
  const loadPower = numeric(values.output_active_power_w);
  const chargePower = numeric(values.battery_voltage) * numeric(values.battery_charge_current);
  const dischargePower = numeric(values.battery_voltage) * numeric(values.battery_discharge_current);
  const batteryCharging = chargePower > 1 && chargePower >= dischargePower;
  const batteryDischarging = dischargePower > 1 && dischargePower > chargePower;
  const batteryPower = batteryCharging ? chargePower : batteryDischarging ? -dischargePower : 0;
  const gridPower = Math.max(0, loadPower + Math.max(0, batteryPower) - pvPower - Math.max(0, -batteryPower));
  const batteryPercent = Math.min(100, Math.max(0, numeric(values.battery_capacity_percent)));
  const solarActive = pvPower > 1;
  const gridActive = gridPower > 1;
  const batteryActive = Math.abs(batteryPower) > 1;
  const loadActive = loadPower > 1;
  const gridDirection = gridActive ? i18n.t("state.importing") : i18n.t("state.standby");
  const batteryDirection = batteryCharging ? i18n.t("state.charging") : batteryDischarging ? i18n.t("state.discharging") : i18n.t("state.idle");
  useEffect(() => { localStorage.setItem("sako_energy_flow_view", viewMode); }, [viewMode]);

  return <section className="energy-flow panel" aria-label={i18n.t("flow.live")}>
    <div className="energy-flow-heading"><div><p className="eyebrow">{i18n.t("flow.live")}</p><h2>{i18n.t("flow.title")}</h2></div><div className="energy-flow-actions"><div className="view-switch" aria-label={i18n.t("flow.view")}><button type="button" className={viewMode === "3d" ? "active" : ""} aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}>3D</button><button type="button" className={viewMode === "image" ? "active" : ""} aria-pressed={viewMode === "image"} onClick={() => setViewMode("image")}>{i18n.t("flow.viewImage")}</button></div><div className={`diagram-status ${connected ? "online" : "offline"}`}><span />{connected ? i18n.t("status.live") : i18n.t("status.offline")}</div></div></div>
    <div className="energy-diagram">
      <div className={`energy-stage ${viewMode}`}>
        {viewMode === "3d" ? <EnergyFlow3D solarActive={solarActive} loadActive={loadActive} gridActive={gridActive} batteryCharging={batteryCharging} batteryDischarging={batteryDischarging} /> : <EnergyFlowImage solarActive={solarActive} loadActive={loadActive} gridActive={gridActive} batteryCharging={batteryCharging} batteryDischarging={batteryDischarging} />}
        <div className="energy-metrics" aria-label={i18n.t("flow.details")}>
          <MetricCard className="pv-card" icon="sun" title={i18n.t("label.pv")} value={pvPower > 1 ? watts(pvPower) : "0 W"} details={[
            [i18n.t("label.voltage"), display(values.pv_input_voltage, " V")],
            [i18n.t("label.current"), display(values.pv_input_current, " A")],
          ]} />
          <MetricCard className="load-card" icon="home" title={i18n.t("label.load")} value={loadPower > 1 ? watts(loadPower) : "0 W"} details={[
            [i18n.t("label.load"), display(values.load_percent, "%", 0)],
            [i18n.t("label.output"), `${display(values.output_voltage, " V")} · ${display(values.output_frequency, " Hz")}`],
            [i18n.t("label.apparent"), display(values.output_apparent_power_va, " VA", 0)],
          ]} />
          <MetricCard className="battery-card" icon="battery" title={i18n.t("label.battery")} value={batteryActive ? watts(Math.abs(batteryPower)) : "0 W"} details={[
            [i18n.t("label.soc"), `${batteryPercent.toFixed(0)}% · ${batteryDirection}`],
            [i18n.t("label.voltage"), display(values.battery_voltage, " V")],
            [i18n.t("label.charge"), display(values.battery_charge_current, " A", 0)],
            [i18n.t("label.discharge"), display(values.battery_discharge_current, " A", 0)],
          ]} onClick={onBatteryOpen} ariaLabel={i18n.t("flow.openBattery")} />
          <MetricCard className="grid-card" icon="tower" title={i18n.t("label.grid")} value={gridActive ? watts(gridPower) : "0 W"} details={[
            [i18n.t("label.status"), gridDirection],
            [i18n.t("label.voltage"), display(values.grid_voltage, " V")],
            [i18n.t("label.frequency"), display(values.grid_frequency, " Hz")],
          ]} />
        </div>
      </div>
    </div>
    <div className="flow-legend"><span><i className="legend-dot solar" />{i18n.t("flow.solarProduction")}</span><span><i className="legend-dot battery" />{i18n.t("flow.batteryStorage")}</span><span><i className="legend-dot grid" />{i18n.t("flow.cebUtility")}</span><span>{i18n.t("flow.autoUpdate")}</span></div>
  </section>;
}

type EnergyFlowView = "3d" | "image";

function EnergyFlowImage({ solarActive, loadActive, gridActive, batteryCharging, batteryDischarging }: { solarActive: boolean; loadActive: boolean; gridActive: boolean; batteryCharging: boolean; batteryDischarging: boolean }) {
  return <>
    <img className="energy-bg" src={energySystemBackground} alt="" aria-hidden="true" />
    <svg className="energy-lines" viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">
      <path className={`flow-path ${solarActive ? "active" : "muted"}`} d="M 13 11.8 V 17.8 Q 13 20 15.2 20 H 25.5" />
      <path className={`flow-path ${solarActive ? "active" : ""}`} d="M 31 19.3 C 35 24 38.5 28.8 41.2 35.2" />
      <path className={`flow-path ${loadActive ? "active" : ""}`} d="M 42 35.2 H 50.5 Q 55 35.2 55 31.6 H 58.4" />
      <path className={`flow-path battery-flow ${batteryCharging ? "active charging" : ""} ${batteryDischarging ? "active discharging reverse" : ""}`} d="M 41.2 35.2 V 44.2" />
      <path className={`flow-path grid-flow ${gridActive ? "active importing reverse" : ""}`} d="M 42 36.7 H 54.6 Q 59 36.7 59 42 H 66" />
    </svg>
    <div className="flow-dot pv-source" />
    <div className="flow-dot inverter-port" />
    <div className="flow-dot load-port" />
    <div className="flow-dot battery-port" />
    <div className="flow-dot grid-port" />
  </>;
}

function EnergyFlow3D({ solarActive, loadActive, gridActive, batteryCharging, batteryDischarging }: { solarActive: boolean; loadActive: boolean; gridActive: boolean; batteryCharging: boolean; batteryDischarging: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    const camera = new THREE.PerspectiveCamera(29, 16 / 9, 0.1, 100);
    camera.position.set(5.15, 3.25, 5.15);
    camera.lookAt(0.12, 0.98, 0.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(3.6, 5.8, 4.4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9fd7ff, 1.1);
    fillLight.position.set(-4.2, 2.8, 3.2);
    scene.add(fillLight);

    const ground = new THREE.MeshStandardMaterial({ color: 0xe7f0e7, roughness: 0.76 });
    const panelBlue = new THREE.MeshStandardMaterial({ color: 0x0f4f9f, roughness: 0.36, metalness: 0.18 });
    const panelFrame = new THREE.MeshStandardMaterial({ color: 0xd9e2ec, roughness: 0.24, metalness: 0.72 });
    const houseWall = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.64 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8f4b27, roughness: 0.56 });
    const warmLight = new THREE.MeshStandardMaterial({ color: 0xffc76b, emissive: 0xff9f1c, emissiveIntensity: 0.55, roughness: 0.28 });
    const batteryBlue = new THREE.MeshStandardMaterial({ color: 0x1458c8, roughness: 0.42, metalness: 0.12 });
    const black = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.82 });
    const inverterWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.34, metalness: 0.04 });
    const solarWire = new THREE.MeshStandardMaterial({ color: 0xff9f1c, emissive: 0x552200, roughness: 0.34 });
    const batteryWire = new THREE.MeshStandardMaterial({ color: 0x55b964, emissive: 0x103b17, roughness: 0.34 });
    const gridWire = new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x111827, roughness: 0.34 });
    const glowSolar = new THREE.MeshStandardMaterial({ color: 0xffb84d, emissive: 0xff7a00, emissiveIntensity: 1.25 });
    const glowBattery = new THREE.MeshStandardMaterial({ color: 0x7ee787, emissive: 0x35b85b, emissiveIntensity: 1.25 });
    const glowGrid = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, emissive: 0x475569, emissiveIntensity: 1.1 });
    const mutedWire = new THREE.MeshStandardMaterial({ color: 0xb8c4cf, roughness: 0.55, transparent: true, opacity: 0.42 });

    const meshes: THREE.Object3D[] = [];
    const textures: THREE.Texture[] = [];
    const movingDots: Array<{ mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; active: () => boolean; reverse?: () => boolean; speed: number; offset: number }> = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], position: THREE.Vector3Tuple, castShadow = true) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      scene.add(mesh);
      meshes.push(mesh);
      return mesh;
    };
    const addBox = (size: THREE.Vector3Tuple, material: THREE.Material, position: THREE.Vector3Tuple) => addMesh(new THREE.BoxGeometry(...size), material, position);
    const makeCurve = (points: THREE.Vector3Tuple[]) => new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const addCable = (points: THREE.Vector3Tuple[], material: THREE.Material, active: () => boolean, reverse?: () => boolean, radius = 0.025, dotMaterial = glowSolar, speed = 0.34) => {
      const curve = makeCurve(points);
      addMesh(new THREE.TubeGeometry(curve, 84, radius, 10, false), active() ? material : mutedWire, [0, 0, 0]);
      for (const offset of [0, 0.34, 0.68]) {
        const dot = addMesh(new THREE.SphereGeometry(radius * 1.9, 16, 16), dotMaterial, [0, 0, 0], false) as THREE.Mesh;
        movingDots.push({ mesh: dot, curve, active, reverse, speed, offset });
      }
      return curve;
    };
    const addCylinderBetween = (start: THREE.Vector3Tuple, end: THREE.Vector3Tuple, radius: number, material: THREE.Material) => {
      const from = new THREE.Vector3(...start);
      const to = new THREE.Vector3(...end);
      const direction = to.clone().sub(from);
      const mesh = addMesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12), material, [0, 0, 0]);
      mesh.position.copy(from.clone().add(to).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      return mesh;
    };

    const addPanelArray = (position: THREE.Vector3Tuple, rotationX: number, width: number, depth: number, columns: number, rows: number) => {
      const group = new THREE.Group();
      group.position.set(...position);
      group.rotation.x = rotationX;
      scene.add(group);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(width, 0.045, depth), panelFrame);
      frame.castShadow = true;
      frame.receiveShadow = true;
      group.add(frame);
      meshes.push(frame);
      const cellWidth = (width - 0.16) / columns;
      const cellDepth = (depth - 0.16) / rows;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(cellWidth - 0.035, 0.052, cellDepth - 0.035), panelBlue);
          panel.position.set(-width / 2 + 0.08 + cellWidth / 2 + col * cellWidth, 0.02, -depth / 2 + 0.08 + cellDepth / 2 + row * cellDepth);
          panel.castShadow = true;
          panel.receiveShadow = true;
          group.add(panel);
          meshes.push(panel);
        }
      }
      return group;
    };
    const addRoofTiles = (xStart: number, xEnd: number, y: number, zStart: number, rows: number, rotationX: number) => {
      for (let row = 0; row < rows; row += 1) {
        const tile = addCylinderBetween([xStart, y + row * 0.006, zStart + row * 0.16], [xEnd, y + row * 0.006, zStart + row * 0.16], 0.018, roofMat);
        tile.rotation.x += rotationX;
      }
    };
    const addWindow = (x: number, y: number, z: number, width: number, height: number) => {
      addBox([width, height, 0.035], black, [x, y, z + 0.02]);
      addBox([width - 0.06, height - 0.06, 0.04], warmLight, [x, y, z + 0.045]);
    };
    const inverterFaceMaterial = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 520;
      const context = canvas.getContext("2d");
      if (!context) return inverterWhite;
      context.fillStyle = "#f8fafc";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#111827";
      context.beginPath();
      context.moveTo(0, 120);
      context.lineTo(42, 162);
      context.lineTo(42, 360);
      context.lineTo(0, 402);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(320, 120);
      context.lineTo(278, 162);
      context.lineTo(278, 360);
      context.lineTo(320, 402);
      context.closePath();
      context.fill();
      context.fillStyle = "#111827";
      context.font = "bold 54px Arial";
      context.textAlign = "center";
      context.fillText("SAKO", 160, 88);
      context.fillStyle = "#ef4444";
      context.fillRect(133, 35, 12, 46);
      context.fillStyle = "#ef4444";
      context.font = "bold 30px Arial";
      context.fillText("SUNON", 160, 250);
      context.fillStyle = "#111827";
      context.font = "bold 20px Arial";
      context.fillText("PRO", 160, 278);
      context.fillRect(96, 305, 128, 150);
      context.fillStyle = "#39d98a";
      context.fillRect(119, 328, 82, 45);
      context.fillStyle = "#10351f";
      context.font = "bold 15px Arial";
      context.fillText("230V", 160, 356);
      for (let index = 0; index < 4; index += 1) {
        context.beginPath();
        context.arc(116 + index * 30, 420, 9, 0, Math.PI * 2);
        context.fillStyle = "#f7c948";
        context.fill();
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.push(texture);
      return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.38, metalness: 0.02 });
    };

    addBox([8.2, 0.08, 4.35], ground, [0, -0.05, 0.08]);

    addBox([4.75, 1.8, 1.68], houseWall, [0.12, 0.9, -0.38]);
    addBox([0.12, 0.78, 0.1], houseWall, [-1.85, 0.39, 0.5]);
    addBox([0.12, 0.78, 0.1], houseWall, [1.85, 0.39, 0.5]);
    addBox([4.3, 0.08, 0.34], new THREE.MeshStandardMaterial({ color: 0xd7d2c7, roughness: 0.68 }), [0.12, 0.04, 0.72]);

    const roofLeft = addBox([5.18, 0.08, 1.2], roofMat, [0.12, 1.84, -0.76]);
    roofLeft.rotation.x = -0.34;
    const roofRight = addBox([5.18, 0.08, 1.2], roofMat, [0.12, 1.84, 0.08]);
    roofRight.rotation.x = 0.34;
    addCylinderBetween([-2.55, 2.1, -0.34], [2.75, 2.1, -0.34], 0.035, roofMat);
    addRoofTiles(-2.55, 2.75, 1.92, -1.22, 5, -0.34);
    addRoofTiles(-2.55, 2.75, 1.8, -0.02, 4, 0.34);

    addPanelArray([-1.05, 1.92, 0.08], 0.34, 1.55, 0.72, 2, 2);
    addPanelArray([0.98, 1.92, 0.08], 0.34, 1.7, 0.72, 2, 2);

    addWindow(-1.0, 0.92, 0.49, 0.58, 0.48);
    addWindow(0.15, 0.92, 0.49, 0.58, 0.48);
    addWindow(1.3, 0.92, 0.49, 0.58, 0.48);
    addWindow(-0.72, 0.36, 0.49, 0.7, 0.54);
    addWindow(0.58, 0.36, 0.49, 0.7, 0.54);

    addBox([0.44, 0.94, 0.18], new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42 }), [2.38, 0.47, 0.52]);
    addBox([0.3, 0.52, 0.035], new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xff9f1c, emissiveIntensity: 0.48, roughness: 0.34 }), [2.38, 0.48, 0.625]);

    addBox([0.24, 0.44, 0.08], inverterWhite, [2.62, 0.55, 0.56]);
    addBox([0.08, 0.035, 0.09], black, [2.62, 0.8, 0.56]);
    addBox([0.035, 0.24, 0.02], black, [2.505, 0.55, 0.605]);
    addBox([0.035, 0.24, 0.02], black, [2.735, 0.55, 0.605]);
    addMesh(new THREE.PlaneGeometry(0.205, 0.35), inverterFaceMaterial(), [2.62, 0.56, 0.606], false);
    for (let index = 0; index < 4; index += 1) {
      const x = 2.34 + index * 0.075;
      addBox([0.055, 0.17, 0.095], batteryBlue, [x, 0.18, 1.02]);
      addBox([0.05, 0.018, 0.085], black, [x, 0.28, 1.02]);
      addBox([0.016, 0.016, 0.016], metal, [x - 0.014, 0.31, 0.99]);
      addBox([0.016, 0.016, 0.016], metal, [x + 0.014, 0.31, 1.05]);
    }

    addCylinderBetween([-3.2, 0.0, 1.35], [-3.2, 1.75, 1.35], 0.03, metal);
    addCylinderBetween([-3.5, 1.25, 1.35], [-2.9, 1.25, 1.35], 0.02, metal);
    addCylinderBetween([-3.42, 0.88, 1.35], [-2.98, 0.88, 1.35], 0.016, metal);
    addCable([[-2.9, 1.25, 1.35], [-1.35, 1.76, 0.86], [1.05, 1.68, 0.54], [2.58, 0.62, 0.56]], gridWire, () => gridActive, undefined, 0.012, glowGrid, 0.28);

    addCable([[-1.05, 2.0, 0.08], [0.4, 1.78, 0.32], [2.58, 0.62, 0.56]], solarWire, () => solarActive, undefined, 0.014, glowSolar, 0.38);
    addCable([[0.98, 2.0, 0.08], [1.55, 1.58, 0.34], [2.58, 0.62, 0.56]], solarWire, () => solarActive, undefined, 0.014, glowSolar, 0.36);
    addCable([[2.54, 0.5, 0.58], [1.55, 0.88, 0.47], [0.28, 0.82, 0.46]], solarWire, () => loadActive, undefined, 0.016, glowSolar, 0.32);
    addCable([[2.6, 0.36, 0.62], [2.52, 0.32, 0.82], [2.45, 0.29, 1.02]], batteryWire, () => batteryCharging || batteryDischarging, () => batteryDischarging, 0.012, glowBattery, 0.32);

    const resize = () => {
      const width = container.clientWidth || 960;
      const height = container.clientHeight || 540;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const clock = new THREE.Clock();
    const frameId = { current: 0 };
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      for (const dot of movingDots) {
        dot.mesh.visible = dot.active() && !reducedMotion;
        if (!dot.mesh.visible) continue;
        let t = (elapsed * dot.speed + dot.offset) % 1;
        if (dot.reverse?.()) t = 1 - t;
        dot.mesh.position.copy(dot.curve.getPoint(t));
      }
      renderer.render(scene, camera);
      frameId.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId.current);
      observer.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      for (const object of meshes) {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      }
      for (const texture of textures) texture.dispose();
    };
  }, [batteryCharging, batteryDischarging, gridActive, loadActive, solarActive]);

  return <div className="energy-3d-canvas" ref={containerRef} aria-hidden="true" />;
}

function MetricCard({ className, icon, title, value, details, onClick, ariaLabel }: { className: string; icon: IconName; title: string; value: string; details: Array<[string, string]>; onClick?: () => void; ariaLabel?: string }) {
  const content = <><EnergyIcon name={icon} /><div><span>{title}</span><strong>{value}</strong><dl>{details.map(([label, detail]) => <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl></div></>;
  if (onClick) return <button type="button" className={`metric-card metric-card-button ${className}`} onClick={onClick} aria-label={ariaLabel || title}>{content}</button>;
  return <article className={`metric-card ${className}`}>{content}</article>;
}

type FlowState = "charging" | "discharging" | "idle";
type BatteryAnchorPosition = { left: string; top: string };
type BatteryAnchorPositions = { cells: BatteryAnchorPosition[]; bms: BatteryAnchorPosition };

const defaultBatteryAnchors: BatteryAnchorPositions = {
  cells: [
  { left: "16%", top: "39%" },
  { left: "25.5%", top: "36.5%" },
  { left: "35%", top: "34.5%" },
  { left: "44.5%", top: "32.5%" },
  { left: "54%", top: "31.5%" },
  { left: "63.5%", top: "30.5%" },
  { left: "73%", top: "30.5%" },
  { left: "82.5%", top: "32%" },
  ],
  bms: { left: "29%", top: "74%" },
};

function BatteryDetailModal({ values, bms, onClose, i18n }: { values: StatusValues; bms?: BmsStatus | null; onClose: () => void } & I18nProps) {
  const [anchors, setAnchors] = useState<BatteryAnchorPositions>(defaultBatteryAnchors);
  const updateAnchors = useCallback((next: BatteryAnchorPositions) => setAnchors(next), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const cells = Array.from({ length: 8 }, (_, index) => bms?.cells?.find(cell => cell.index === index + 1) || { index: index + 1, voltage: null, resistance_mohm: null, wire_resistance_mohm: null });
  const voltages = cells.map(cell => finiteNumber(cell.voltage)).filter((value): value is number => value !== null);
  const minVoltage = voltages.length ? Math.min(...voltages) : null;
  const maxVoltage = voltages.length ? Math.max(...voltages) : null;
  const batteryPercent = Math.min(100, Math.max(0, numeric(values.battery_capacity_percent)));
  const current = finiteNumber(bms?.current_a);
  const balanceCurrent = finiteNumber(bms?.balance_current_a);
  const flowState: FlowState = current === null || Math.abs(current) < 0.05 ? "idle" : current > 0 ? "charging" : "discharging";
  const flowLabel = flowState === "charging" ? i18n.t("state.charging") : flowState === "discharging" ? i18n.t("state.discharging") : i18n.t("state.idle");
  const balanceState = balanceCurrent === null || Math.abs(balanceCurrent) < 0.005 ? i18n.t("state.idle") : balanceCurrent > 0 ? i18n.t("state.balancingCharge") : i18n.t("state.balancingDischarge");
  const bmsOnline = Boolean(bms?.connected && !bms.stale);
  const packStats: Array<[string, string]> = [
    [i18n.t("label.pack"), display(bms?.voltage ?? values.battery_voltage, " V", 2)],
    [i18n.t("label.soc"), bms?.capacity_percent !== null && bms?.capacity_percent !== undefined ? display(bms.capacity_percent, "%", 0) : `${batteryPercent.toFixed(0)}%`],
    [i18n.t("label.current"), display(bms?.current_a, " A", 2)],
    [i18n.t("label.power"), display(bms?.power_w, " W", 0)],
    [i18n.t("label.state"), flowLabel],
    [i18n.t("label.delta"), display(bms?.delta_cell_voltage, " V", 3)],
    [i18n.t("label.balance"), `${balanceState} · ${display(bms?.balance_current_a, " A", 2)}`],
    [i18n.t("label.cycles"), display(bms?.cycle_count, "", 0)],
    [i18n.t("label.remaining"), `${display(bms?.remaining_capacity_ah, " Ah", 1)} / ${display(bms?.nominal_capacity_ah, " Ah", 1)}`],
    [i18n.t("metric.bms_battery_t1_c"), display(bms?.battery_t1_c, "°C", 1)],
    [i18n.t("metric.bms_battery_t2_c"), display(bms?.battery_t2_c, "°C", 1)],
    ["MOS", display(bms?.mos_temperature_c, "°C", 1)],
    [i18n.t("label.updated"), formatDate(bms?.captured_at, i18n)],
  ];
  const bmsStatusClass = bms?.connected && !bms.stale ? "on" : "";
  const bmsStatusLabel = !bms?.enabled ? i18n.t("status.disabled") : bms.stale ? i18n.t("status.stale") : bms.connected ? i18n.t("status.live") : i18n.t("status.offline");
  const balanceIdle = balanceCurrent === null || Math.abs(balanceCurrent) < 0.005;

  return <div className="battery-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`battery-modal ${bms?.connected ? "online" : "offline"} ${bms?.stale ? "stale" : ""}`} role="dialog" aria-modal="true" aria-labelledby="battery-detail-title">
      <div className="battery-modal-head"><div><p className="eyebrow">{i18n.t("battery.detail")}</p><h2 id="battery-detail-title">{i18n.t("battery.title")}</h2><p>{i18n.t("battery.subtitle", { name: bms?.name || bms?.address || i18n.t("battery.bluetoothBms"), protocol: bms?.protocol || "JK" })}</p></div><div><span className={`live ${bmsStatusClass}`}>{bmsStatusLabel}</span><button className="battery-modal-close" type="button" onClick={onClose} aria-label={i18n.t("battery.close")}>×</button></div></div>
      {(bms?.error || bms?.last_error) && <p className={bms.error ? "error battery-modal-message" : "bms-note battery-modal-message"}>{bms.error || i18n.t("battery.lastPollError", { error: bms.last_error || "" })}</p>}
      <div className="battery-state-strip" aria-label={i18n.t("battery.bmsState")}>
        <span className={`state-pill ${flowState}`}>{flowLabel}</span>
        <span className={`state-pill ${balanceIdle ? "idle" : "balancing"}`}>{balanceState}</span>
        <span className="state-pill neutral">{display(bms?.current_a, " A", 2)}</span>
        <span className="state-pill neutral">{display(bms?.power_w, " W", 0)}</span>
      </div>
      <div className="battery-detail-layout">
        <div className={`battery-detail-stage ${flowState}`}>
          <BatteryPack3D flowState={flowState} bmsOnline={bmsOnline} onAnchorsChange={updateAnchors} />
          {cells.map((cell, index) => {
            const voltage = finiteNumber(cell.voltage);
            const edge = voltage !== null && voltage === minVoltage ? "low" : voltage !== null && voltage === maxVoltage ? "high" : "";
            const wireResistance = cell.wire_resistance_mohm ?? cell.resistance_mohm;
            return <div className={`battery-cell-pin ${edge}`} key={cell.index} style={anchors.cells[index] || defaultBatteryAnchors.cells[index]}>
              <span>{i18n.t("battery.cell", { index: cell.index })}</span>
              <strong>{display(cell.voltage, " V", 3)}</strong>
              <small>{i18n.t("battery.wire", { value: display(wireResistance, " mΩ", 3) })}</small>
            </div>;
          })}
          <div className="bms-module-pin" style={anchors.bms}><span>BMS</span><strong>{balanceState}</strong><small>{display(bms?.balance_current_a, " A", 2)}</small></div>
        </div>
        <div className="battery-detail-stats">{packStats.map(([label, value]) => <BmsStat key={label} label={label} value={value} />)}</div>
      </div>
    </section>
  </div>;
}

function BatteryPack3D({ flowState, bmsOnline, onAnchorsChange }: { flowState: FlowState; bmsOnline: boolean; onAnchorsChange: (positions: BatteryAnchorPositions) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 100);
    camera.position.set(5.2, 3.9, 5.6);
    camera.lookAt(0, 0.6, 0.05);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 2.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
    keyLight.position.set(3.5, 5.5, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9fd7ff, 1.15);
    fillLight.position.set(-3.5, 2.5, 3.5);
    scene.add(fillLight);

    const blue = new THREE.MeshStandardMaterial({ color: 0x1458c8, roughness: 0.42, metalness: 0.12 });
    const black = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.58, metalness: 0.05 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xd8dee6, roughness: 0.22, metalness: 0.85 });
    const wood = new THREE.MeshStandardMaterial({ color: 0xc69a6b, roughness: 0.72, metalness: 0.03 });
    const red = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.38, metalness: 0.06 });
    const wireRed = new THREE.MeshStandardMaterial({ color: 0xff3f6c, emissive: 0x4f0014, roughness: 0.34, metalness: 0.02 });
    const cableBlack = new THREE.MeshStandardMaterial({ color: 0x101826, roughness: 0.45, metalness: 0.04 });
    const glowRed = new THREE.MeshStandardMaterial({ color: 0xff6b83, emissive: 0xff174d, emissiveIntensity: 1.2 });
    const glowOrange = new THREE.MeshStandardMaterial({ color: 0xff9f1c, emissive: 0xff7a00, emissiveIntensity: 1.3 });

    const meshes: THREE.Object3D[] = [];
    const movingDots: Array<{ mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; speed: number; offset: number; kind: "cell" | "power" }> = [];
    const cellAnchors: THREE.Vector3[] = [];
    const cellXs = Array.from({ length: 8 }, (_, index) => (index - 3.5) * 0.82);

    const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], position: THREE.Vector3Tuple, castShadow = true) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      scene.add(mesh);
      meshes.push(mesh);
      return mesh;
    };
    const addBox = (size: THREE.Vector3Tuple, material: THREE.Material, position: THREE.Vector3Tuple) => addMesh(new THREE.BoxGeometry(...size), material, position);
    const addCylinder = (radius: number, height: number, material: THREE.Material, position: THREE.Vector3Tuple) => addMesh(new THREE.CylinderGeometry(radius, radius, height, 28), material, position);
    const makeCurve = (points: THREE.Vector3Tuple[]) => new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const addCable = (points: THREE.Vector3Tuple[], radius: number, material: THREE.Material, segments = 64) => {
      const curve = makeCurve(points);
      const tube = addMesh(new THREE.TubeGeometry(curve, segments, radius, 10, false), material, [0, 0, 0]);
      tube.castShadow = true;
      return curve;
    };
    const addMovingDot = (curve: THREE.CatmullRomCurve3, kind: "cell" | "power", offset: number, material: THREE.Material, radius: number, speed: number) => {
      const dot = addMesh(new THREE.SphereGeometry(radius, 16, 16), material, [0, 0, 0], false) as THREE.Mesh;
      movingDots.push({ mesh: dot, curve, speed, offset, kind });
    };

    addBox([7.2, 0.08, 2.35], new THREE.MeshStandardMaterial({ color: 0xe6edf3, roughness: 0.7 }), [0, -0.05, 0]);
    addBox([0.22, 1.85, 2.35], wood, [-3.48, 0.78, 0]);
    addBox([0.22, 1.85, 2.35], wood, [3.48, 0.78, 0]);
    addBox([7.15, 0.22, 0.14], wood, [0, 0.12, 1.14]);
    addBox([7.15, 0.18, 0.12], wood, [0, 0.16, -1.12]);

    for (const [index, x] of cellXs.entries()) {
      addBox([0.68, 1.38, 1.86], blue, [x, 0.7, 0]);
      addBox([0.64, 0.08, 1.76], black, [x, 1.43, 0]);
      addBox([0.18, 0.08, 0.12], new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 }), [x, 1.52, 0.84]);
      addCylinder(0.12, 0.16, metal, [x - 0.18, 1.58, -0.46]);
      addCylinder(0.12, 0.16, metal, [x + 0.18, 1.58, 0.46]);
      addCylinder(0.055, 0.18, metal, [x - 0.18, 1.72, -0.46]);
      addCylinder(0.055, 0.18, metal, [x + 0.18, 1.72, 0.46]);
      cellAnchors.push(new THREE.Vector3(x, 2.15 + (index % 2) * 0.04, 0.12));
    }
    addBox([6.4, 0.07, 0.13], metal, [0, 1.75, -0.46]);
    addBox([6.4, 0.07, 0.13], metal, [0, 1.75, 0.46]);

    const bmsAnchor = new THREE.Vector3(-1.85, 0.95, 1.38);
    addBox([1.35, 0.82, 0.22], black, [-1.55, 0.52, 1.2]);
    addBox([0.18, 0.54, 0.08], metal, [-0.78, 0.55, 1.35]);

    const negativeCurve = addCable([[-3.05, 1.67, 0.46], [-3.35, 1.08, 1.08], [-2.65, 0.32, 1.48], [-2.15, 0.45, 1.37]], 0.055, cableBlack, 72);
    const positiveCurve = addCable([[3.05, 1.67, 0.46], [3.32, 1.05, 1.18], [1.55, 0.28, 1.52], [-1.0, 0.35, 1.4]], 0.06, red, 96);
    addMovingDot(negativeCurve, "power", 0.15, glowOrange, 0.055, 0.28);
    addMovingDot(positiveCurve, "power", 0.65, glowOrange, 0.055, 0.28);

    for (const [index, x] of cellXs.entries()) {
      const bmsX = -2.08 + index * 0.14;
      const curve = addCable([[x, 1.05, 0.98], [x - 0.04, 0.78, 1.28], [Math.min(x, -0.25), 0.52, 1.44], [bmsX, 0.64, 1.36]], 0.014, wireRed, 42);
      addMovingDot(curve, "cell", index * 0.12, glowRed, 0.026, 0.42);
    }

    const frameId = { current: 0 };
    let lastAnchorJson = "";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock();

    const projectAnchors = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      const project = (point: THREE.Vector3): BatteryAnchorPosition => {
        const projected = point.clone().project(camera);
        return {
          left: `${((projected.x + 1) / 2) * 100}%`,
          top: `${((1 - projected.y) / 2) * 100}%`,
        };
      };
      if (!width || !height) return;
      const rawCells = cellAnchors.map(project);
      if (width < 620) {
        const rowLefts = [
          [8, 34, 60, 86],
          [20, 45, 70, 94],
        ];
        const cells = rawCells.map((_, index) => ({
          left: `${rowLefts[index % 2][Math.floor(index / 2)]}%`,
          top: `${20 + (index % 2) * 38}%`,
        }));
        const next = { cells, bms: { left: "19%", top: "84%" } };
        const json = JSON.stringify(next);
        if (json !== lastAnchorJson) {
          lastAnchorJson = json;
          onAnchorsChange(next);
        }
        return;
      }
      const leftValues = rawCells.map(anchor => Number(anchor.left.replace("%", "")));
      for (let index = 1; index < leftValues.length; index += 1) {
        leftValues[index] = Math.max(leftValues[index], leftValues[index - 1] + 8.4);
      }
      const overflow = Math.max(0, leftValues[leftValues.length - 1] - 88);
      const cells = rawCells.map((anchor, index) => {
        const row = index % 2;
        const column = Math.floor(index / 2);
        return {
          left: `${Math.min(92, Math.max(8, leftValues[index] - overflow))}%`,
          top: `${16 + row * 20 + column * 2}%`,
        };
      });
      const next = { cells, bms: project(bmsAnchor) };
      const json = JSON.stringify(next);
      if (json !== lastAnchorJson) {
        lastAnchorJson = json;
        onAnchorsChange(next);
      }
    };

    const resize = () => {
      const width = container.clientWidth || 960;
      const height = container.clientHeight || 540;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      projectAnchors();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      for (const dot of movingDots) {
        const active = dot.kind === "cell" ? bmsOnline : flowState !== "idle";
        dot.mesh.visible = active && !reducedMotion;
        if (!dot.mesh.visible) continue;
        let t = (elapsed * dot.speed + dot.offset) % 1;
        if (dot.kind === "power" && flowState === "discharging") t = 1 - t;
        dot.mesh.position.copy(dot.curve.getPoint(t));
      }
      renderer.render(scene, camera);
      projectAnchors();
      frameId.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId.current);
      observer.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      for (const object of meshes) {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      }
    };
  }, [bmsOnline, flowState, onAnchorsChange]);

  return <div className="battery-3d-canvas" ref={containerRef} aria-hidden="true" />;
}

function OverviewRow({ icon, label, value, note, progress, compact = false }: { icon: IconName; label: string; value: string; note?: string; progress?: number; compact?: boolean }) {
  return <div className="overview-row"><EnergyIcon name={icon} /><div><span>{label}</span><strong className={compact ? "compact" : ""}>{value}</strong>{progress !== undefined && <i className="soc-meter"><b style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></i>}{note && <small>{note}</small>}</div></div>;
}

function BmsCellHealth({ bms, i18n }: { bms?: BmsStatus | null } & I18nProps) {
  if (!bms?.enabled) return null;
  const cells = bms.cells || [];
  const minVoltage = cells.length ? Math.min(...cells.map(cell => cell.voltage)) : null;
  const maxVoltage = cells.length ? Math.max(...cells.map(cell => cell.voltage)) : null;
  return <article className={`panel bms-health ${bms.connected ? "online" : "offline"} ${bms.stale ? "stale" : ""}`}>
    <div className="bms-health-head"><div><h3>{i18n.t("battery.jkCells")}</h3><p>{bms.name || bms.address || i18n.t("battery.bluetoothBms")} · {bms.protocol || "JK"}</p></div><span className={bms.connected && !bms.stale ? "live on" : "live"}>{bms.stale ? i18n.t("status.stale") : bms.connected ? i18n.t("status.live") : i18n.t("status.offline")}</span></div>
    <div className="bms-health-stats">
      <BmsStat label={i18n.t("label.pack")} value={display(bms.voltage, " V", 2)} />
      <BmsStat label={i18n.t("label.soc")} value={display(bms.capacity_percent, "%", 0)} />
      <BmsStat label={i18n.t("label.current")} value={display(bms.current_a, " A", 2)} />
      <BmsStat label={i18n.t("label.delta")} value={display(bms.delta_cell_voltage, " V", 3)} />
      <BmsStat label={i18n.t("label.temp")} value={display(bms.mos_temperature_c ?? bms.battery_t1_c, "°C", 1)} />
    </div>
    {bms.error && <p className="error">{bms.error}</p>}
    {!bms.error && bms.stale && <p className="bms-note">{i18n.t("battery.staleNote")}</p>}
    {cells.length === 0 ? <p>{i18n.t("battery.noCellData")}</p> : <div className="bms-cell-grid">{cells.map(cell => {
      const fill = cellVoltageFill(cell.voltage);
      const edge = cell.voltage === minVoltage ? "low" : cell.voltage === maxVoltage ? "high" : "";
      return <div className={`bms-cell ${edge}`} key={cell.index}><span>{i18n.t("battery.cellPadded", { index: String(cell.index).padStart(2, "0") })}</span><strong>{display(cell.voltage, " V", 3)}</strong><i><b style={{ width: `${fill}%` }} /></i></div>;
    })}</div>}
  </article>;
}

function BmsStat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function cellVoltageFill(value: number) {
  return Math.min(100, Math.max(0, ((value - 2.8) / (3.65 - 2.8)) * 100));
}

function batterySourceLabel(value: number | string | null | undefined, bms: BmsStatus | null | undefined, i18n: I18n) {
  if (value === "bms") return bms?.stale ? i18n.t("batterySource.jkbmsLastGood") : i18n.t("batterySource.jkbms");
  if (bms?.enabled && bms.error) return i18n.t("batterySource.inverterFallback");
  return i18n.t("batterySource.inverter");
}

type IconName = "sun" | "home" | "battery" | "tower" | "panel" | "pulse" | "temp" | "inverter";

function EnergyIcon({ name }: { name: IconName }) {
  if (name === "sun") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="8"/><path d="M24 4v8M24 36v8M4 24h8M36 24h8M10 10l6 6M32 32l6 6M38 10l-6 6M16 32l-6 6"/></svg>;
  if (name === "home") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 25 24 10l16 15v17H29V30H19v12H8Z"/></svg>;
  if (name === "battery") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 10h18v30H15ZM20 6h8v4M20 30h8M20 36h8"/></svg>;
  if (name === "tower") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 10 43M24 5l14 38M15 30h18M13 38h22M18 19h12M24 5v38"/></svg>;
  if (name === "panel") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 16h32v24H8ZM8 24h32M16 16v24M24 16v24M32 16v24M14 8v8M34 8v8"/></svg>;
  if (name === "pulse") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 29h9l6-18 8 30 5-16h8"/></svg>;
  if (name === "inverter") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 8h24v32H12ZM18 16h12M18 24h12M18 32h6M31 32h1"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8v32M16 18h16M16 30h16M12 40h24"/></svg>;
}

type PendingSetting = { key: string; value: string } | null;
type CurrentSettings = Record<string, string | undefined>;

const factorySafeDefaults = {
  output_source_priority: "utility",
  charger_source_priority: "solar_first",
};

const priorityAliases: Record<string, Record<string, string>> = {
  output_source_priority: { "0": "utility", "00": "utility", utility: "utility", "1": "solar", "01": "solar", solar: "solar", "2": "sbu", "02": "sbu", sbu: "sbu" },
  charger_source_priority: { "0": "utility", "00": "utility", utility: "utility", "1": "solar_first", "01": "solar_first", solar_first: "solar_first", "2": "solar_utility", "02": "solar_utility", solar_utility: "solar_utility", "3": "solar", "03": "solar", solar: "solar" },
};

function Settings({ authenticated, capabilities, currentSettings, pendingSetting, login, password, setPassword, logout, onChange, onResetDefaults, i18n }: { authenticated: boolean; capabilities: Capability[]; currentSettings: CurrentSettings; pendingSetting: PendingSetting; login: (event: FormEvent) => Promise<void>; password: string; setPassword: (v: string) => void; logout: () => Promise<void>; onChange: (key: string, value: string) => Promise<void>; onResetDefaults: () => Promise<void> } & I18nProps) {
  if (!authenticated) return <section className="panel login"><h2>{i18n.t("settings.adminSignIn")}</h2><p>{i18n.t("settings.signInRequired")}</p><form onSubmit={login}><input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder={i18n.t("settings.password")}/><button>{i18n.t("settings.signIn")}</button></form></section>;
  const resetDisabled = Boolean(pendingSetting) || capabilities.length === 0;
  return <section className="settings-page">
    <div className="section-title"><div><h2>{i18n.t("settings.title")}</h2><p>{i18n.t("settings.subtitle")}</p></div><div className="settings-actions"><button className="quiet danger" disabled={resetDisabled} onClick={() => void onResetDefaults()}>{pendingSetting ? i18n.t("settings.applying") : i18n.t("settings.resetDefaults")}</button><button className="quiet" onClick={() => void logout()}>{i18n.t("settings.signOut")}</button></div></div>
    {capabilities.length === 0 && <div className="panel settings-empty"><b>{i18n.t("settings.noPriorities")}</b><p>{i18n.t("settings.noPrioritiesDetail")}</p></div>}
    {capabilities.map(capability => <SettingCard key={capability.key} capability={capability} currentValue={currentSettings[capability.key]} pendingSetting={pendingSetting} onChange={onChange} i18n={i18n} />)}
  </section>;
}

function SettingCard({ capability, currentValue, pendingSetting, onChange, i18n }: { capability: Capability; currentValue?: string; pendingSetting: PendingSetting; onChange: (key: string, value: string) => Promise<void> } & I18nProps) {
  const currentChoice = capability.choices.find(choice => choice.value === currentValue);
  const pendingForCard = pendingSetting?.key === capability.key;
  const diagramValue = currentValue || capability.choices[0]?.value || "";
  const capabilityLabel = settingTitleLabel(i18n, capability.key);
  const capabilityWarning = settingWarningLabel(i18n, capability.key, capability.warning);
  const currentChoiceLabel = currentChoice ? settingChoiceLabel(i18n, capability.key, currentChoice.value, currentChoice.label) : i18n.t("settings.unavailable");
  return <article className={`panel setting rich-setting ${pendingForCard ? "applying" : ""}`}>
    <div className="setting-layout">
      <div className="setting-main">
        <div className="setting-card-head"><div><h3>{capabilityLabel}</h3><p>{capabilityWarning}</p></div><span className={currentChoice ? "current-badge" : "current-badge muted"}>{i18n.t("settings.current", { value: currentChoiceLabel })}</span></div>
        <PriorityDiagram settingKey={capability.key} value={diagramValue} i18n={i18n} />
        <div className="choice-grid">{capability.choices.map(choice => {
          const selected = choice.value === currentValue;
          const applying = pendingSetting?.key === capability.key && pendingSetting.value === choice.value;
          const choiceLabel = settingChoiceLabel(i18n, capability.key, choice.value, choice.label);
          const description = settingDetailLabel(i18n, capability.key, choice.value);
          return <button key={choice.value} className={`choice-card ${selected ? "selected" : ""}`} disabled={pendingForCard} onClick={() => { if (window.confirm(i18n.t("confirm.applyChoice", { warning: capabilityWarning, choice: choiceLabel }))) void onChange(capability.key, choice.value); }}>
            <span>{choiceLabel}</span>
            {applying && <i className="spinner" aria-label={i18n.t("settings.applying")} />}
            <small>{description}</small>
          </button>;
        })}</div>
      </div>
      <aside className="setting-reset-note"><b>{i18n.t("settings.default")}</b><span>{settingResetLabel(i18n, capability.key)}</span></aside>
    </div>
  </article>;
}

function PriorityDiagram({ settingKey, value, i18n }: { settingKey: string; value: string } & I18nProps) {
  const output = settingKey === "output_source_priority";
  const active = output ? outputPrioritySources(value) : chargerPrioritySources(value);
  return <div className="priority-diagram" aria-label={i18n.t("settings.flow", { setting: settingTitle(settingKey, i18n) })}>
    <img className="priority-diagram-bg" src={settingsPriorityDiagram} alt="" aria-hidden="true" />
    <div className="priority-diagram-shade" />
    <svg className="priority-lines" viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">
      <path className={`diagram-line solar ${active.includes("solar") ? "active" : ""}`} d="M 21 14 C 32 17 41 24 48 31" />
      <path className={`diagram-line grid ${active.includes("grid") ? "active" : ""}`} d="M 16 39 C 30 39 40 36 48 31" />
      <path className="diagram-line target active" d={output ? "M 55 31 C 65 29 73 25 82 22" : "M 55 34 C 63 39 70 43 78 43"} />
      {output && <path className={`diagram-line battery ${active.includes("battery") ? "active" : ""}`} d="M 78 43 C 69 43 61 39 55 34" />}
    </svg>
    <DiagramNode name={i18n.t("label.grid")} icon="tower" active={active.includes("grid")} className="grid-node" />
    <DiagramNode name={i18n.t("label.solar")} icon="sun" active={active.includes("solar")} className="solar-node" />
    <div className="diagram-center"><EnergyIcon name="inverter" /><span>{i18n.t("label.inverter")}</span></div>
    <DiagramNode name={output ? i18n.t("label.home") : i18n.t("label.battery")} icon={output ? "home" : "battery"} active className={output ? "home-target" : "battery-target"} />
    {output && <DiagramNode name={i18n.t("label.battery")} icon="battery" active={active.includes("battery")} className="battery-source" />}
  </div>;
}

function DiagramNode({ name, icon, active, className = "" }: { name: string; icon: IconName; active: boolean; className?: string }) {
  return <div className={`diagram-node ${name.toLowerCase()} ${className} ${active ? "active" : ""}`}><EnergyIcon name={icon} /><span>{name}</span></div>;
}

function outputPrioritySources(value: string) {
  if (value === "utility") return ["grid", "solar", "battery"];
  if (value === "sbu") return ["solar", "battery", "grid"];
  return ["solar", "grid", "battery"];
}

function chargerPrioritySources(value: string) {
  if (value === "solar_utility") return ["solar", "grid"];
  if (value === "solar") return ["solar"];
  return ["solar", "grid"];
}

function currentPrioritySettings(diagnostics: Record<string, unknown>): CurrentSettings {
  const rating = recordValue(diagnostics.rating);
  return {
    output_source_priority: normalizePriorityValue("output_source_priority", rating?.output_source_priority),
    charger_source_priority: normalizePriorityValue("charger_source_priority", rating?.charger_source_priority),
  };
}

function normalizePriorityValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const raw = String(value).trim();
  const aliases = priorityAliases[key] || {};
  return aliases[raw] || aliases[raw.toLowerCase()] || aliases[raw.toUpperCase()];
}

function settingDisplayLabel(key: string, value: string, i18n: I18n) {
  return ratingValueLabel(key, value, i18n) || value;
}

function settingTitle(key: string, i18n: I18n) {
  if (key === "output_source_priority" || key === "charger_source_priority") return settingTitleLabel(i18n, key);
  return i18n.t("setting.generic");
}

function Diagnostics({ authenticated, i18n }: { authenticated: boolean } & I18nProps) {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"" | "load" | "refresh">("");
  const diagnostics = data?.diagnostics || {};
  const latest = data?.latest;
  const protocol = textValue(diagnostics.QPI);
  const protocolError = errorValue(diagnostics.QPI) || textValue(diagnostics.protocol_error);
  const protocolOk = Boolean(protocol?.startsWith("PI")) && !protocolError;
  const flags = latest?.status.status_flags || [];
  const activeFlags = flags.filter(flag => flag.active);
  const inactiveFlags = flags.filter(flag => !flag.active);
  const rating = recordValue(diagnostics.rating);
  const bms = data?.bms || latest?.bms || null;

  const load = async () => {
    setLoading("load");
    try {
      const next = await api.diagnostics();
      setData(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : i18n.t("diagnostics.signInFirst"));
    } finally {
      setLoading("");
    }
  };
  useEffect(() => {
    if (authenticated) {
      void load();
    } else {
      setData(null);
      setError("");
      setLoading("");
    }
  }, [authenticated]);

  const refresh = async () => {
    setLoading("refresh");
    try {
      const refreshed = await api.refreshDiagnostics();
      let latestStatus = data?.latest;
      try {
        latestStatus = await api.status();
      } catch {
        // Fresh discovery data is still useful if the live status poll is unavailable.
      }
      setData({ diagnostics: refreshed.diagnostics, latest: latestStatus, bms: refreshed.bms });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : i18n.t("diagnostics.refreshError"));
    } finally {
      setLoading("");
    }
  };

  return <section className="diagnostics">
    <div className="section-title"><div><h2>{i18n.t("diagnostics.title")}</h2><p>{i18n.t("diagnostics.subtitle")}</p></div>{authenticated && <div className="diagnostics-actions"><button className="quiet" disabled={Boolean(loading)} onClick={() => void refresh()}>{loading === "refresh" ? i18n.t("diagnostics.refreshing") : i18n.t("diagnostics.refreshDiscovery")}</button></div>}</div>
    {!authenticated && <div className="panel diagnostics-empty"><b>{i18n.t("diagnostics.signInRequired")}</b><p>{i18n.t("diagnostics.signInDetail")}</p></div>}
    {authenticated && loading === "load" && !data && <div className="panel diagnostics-empty"><b>{i18n.t("diagnostics.loading")}</b><p>{i18n.t("diagnostics.loadingDetail")}</p></div>}
    {error && <p className="error">{error}</p>}
    {data && <>
      <div className="diagnostics-summary">
        <DiagnosticsSummaryCard label={i18n.t("diagnostics.connection")} value={latest?.connected ? i18n.t("status.connected") : i18n.t("status.offline")} tone={latest?.connected ? "ok" : "warn"} detail={latest?.error || latest?.warnings || i18n.t("diagnostics.liveTelemetry")} />
        <DiagnosticsSummaryCard label="JK-BMS" value={bmsLabel(bms, i18n)} tone={bms?.enabled ? bms.connected ? "ok" : "warn" : "neutral"} detail={bmsDetail(bms, i18n)} />
        <DiagnosticsSummaryCard label={i18n.t("diagnostics.mode")} value={formatInverterMode(latest?.mode, i18n)} detail={formatDate(latest?.captured_at, i18n)} />
        <DiagnosticsSummaryCard label={i18n.t("diagnostics.protocol")} value={protocolOk ? i18n.t("diagnostics.pipCompatible") : i18n.t("diagnostics.needsAttention")} tone={protocolOk ? "ok" : "warn"} detail={protocol || protocolError || i18n.t("diagnostics.noProtocolReply")} />
        <DiagnosticsSummaryCard label={i18n.t("diagnostics.activeFlags")} value={String(activeFlags.length)} tone={activeFlags.length ? "warn" : "ok"} detail={activeFlags.length ? activeFlags.map(flag => statusFlagLabel(i18n, flag.key, flag.label)).join(", ") : i18n.t("diagnostics.noActiveFlags")} />
      </div>
      <div className="diagnostics-grid">
        <DiagnosticsPanel title={i18n.t("diagnostics.identity")} rows={[
          [i18n.t("diagnostics.protocol"), protocol || errorValue(diagnostics.QPI) || "—"],
          [i18n.t("diagnostics.serial"), textValue(diagnostics.QID) || errorValue(diagnostics.QID) || "—"],
          [i18n.t("diagnostics.firmware"), textValue(diagnostics.QVFW) || errorValue(diagnostics.QVFW) || "—"],
          [i18n.t("diagnostics.secondaryFirmware"), textValue(diagnostics.QVFW2) || errorValue(diagnostics.QVFW2) || "—"],
          ...(protocolError ? [[i18n.t("diagnostics.protocolIssue"), protocolError] as [string, string]] : []),
        ]} />
        <DiagnosticsPanel title={i18n.t("diagnostics.ratedConfig")} rows={ratingRows.map(row => [i18n.t(row.labelKey), formatRating(row.key, rating?.[row.key], row.unit, row.digits, i18n)])} />
        <DiagnosticsPanel title={i18n.t("diagnostics.jkbmsBluetooth")} rows={bmsRows(bms, i18n)} />
      </div>
      <article className="panel diagnostics-flags"><h3>{i18n.t("diagnostics.statusFlags")}</h3>{flags.length ? <><div className="flag-list">{activeFlags.map(flag => <span className="flag-chip active" key={flag.key} title={statusFlagDescription(i18n, flag.key, flag.description)}>{statusFlagLabel(i18n, flag.key, flag.label)}</span>)}{activeFlags.length === 0 && <span className="flag-chip calm">{i18n.t("diagnostics.noActiveFlags")}</span>}</div>{inactiveFlags.length > 0 && <div className="flag-list muted">{inactiveFlags.map(flag => <span className="flag-chip" key={flag.key} title={statusFlagDescription(i18n, flag.key, flag.description)}>{statusFlagLabel(i18n, flag.key, flag.label)}</span>)}</div>}</> : <p>{i18n.t("diagnostics.noDecodedFlags")}</p>}</article>
      <details className="panel raw-replies"><summary>{i18n.t("diagnostics.rawReplies")}</summary><dl>{rawCommands.map(command => <div key={command}><dt>{command}</dt><dd>{formatRawValue(diagnostics[command], i18n)}</dd></div>)}</dl></details>
    </>}
  </section>;
}

function DiagnosticsSummaryCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "ok" | "warn" }) {
  return <article className={`diagnostics-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function DiagnosticsPanel({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <article className="panel diagnostics-panel"><h3>{title}</h3><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>;
}

function bmsLabel(bms: BmsStatus | null, i18n: I18n) {
  if (!bms?.enabled) return i18n.t("status.disabled");
  if (bms.stale) return i18n.t("status.stale");
  return bms.connected ? i18n.t("status.connected") : i18n.t("status.offline");
}

function bmsDetail(bms: BmsStatus | null, i18n: I18n) {
  if (!bms?.enabled) return i18n.t("diagnostics.bmsDisabled");
  return bms.error || bms.last_error || `${bms.address || i18n.t("diagnostics.noAddress")} · ${formatDate(bms.captured_at, i18n)}`;
}

function bmsRows(bms: BmsStatus | null, i18n: I18n): Array<[string, string]> {
  const rawSummary = recordValue(bms?.raw_summary);
  const rawKeys = Array.isArray(rawSummary?.keys) ? rawSummary.keys.map(String).join(", ") : "—";
  return [
    [i18n.t("diagnostics.mode"), bms?.enabled ? bms.source : i18n.t("status.disabled")],
    [i18n.t("diagnostics.connection"), bms?.connected ? i18n.t("status.connected") : i18n.t("status.offline")],
    [i18n.t("diagnostics.address"), bms?.address || "—"],
    [i18n.t("diagnostics.name"), bms?.name || "—"],
    [i18n.t("diagnostics.protocol"), bms?.protocol || "—"],
    [i18n.t("overview.lastUpdate"), formatDate(bms?.captured_at, i18n)],
    [i18n.t("diagnostics.lastPollError"), bms?.last_error || "—"],
    [i18n.t("diagnostics.lastErrorTime"), formatDate(bms?.last_error_at, i18n)],
    [i18n.t("diagnostics.packVoltage"), display(bms?.voltage, " V", 2)],
    [i18n.t("label.current"), display(bms?.current_a, " A", 2)],
    [i18n.t("label.soc"), display(bms?.capacity_percent, "%", 0)],
    [i18n.t("diagnostics.cells"), bms?.cells?.length ? String(bms.cells.length) : "—"],
    [i18n.t("diagnostics.cellDelta"), display(bms?.delta_cell_voltage, " V", 3)],
    [i18n.t("diagnostics.rawCommand"), textValue(rawSummary?.command) || "—"],
    [i18n.t("diagnostics.rawKeys"), rawKeys],
    [i18n.t("diagnostics.error"), bms?.error || "—"],
  ];
}

const rawCommands = ["QPI", "QID", "QVFW", "QVFW2", "QPIRI", "QFLAG"] as const;
type RatingRow = { key: string; labelKey: TranslationKey; unit?: string; digits?: number };
const ratingRows: RatingRow[] = [
  { key: "grid_rating_voltage", labelKey: "rating.grid_rating_voltage", unit: " V" },
  { key: "grid_rating_current", labelKey: "rating.grid_rating_current", unit: " A" },
  { key: "output_rating_voltage", labelKey: "rating.output_rating_voltage", unit: " V" },
  { key: "output_rating_frequency", labelKey: "rating.output_rating_frequency", unit: " Hz" },
  { key: "output_rating_current", labelKey: "rating.output_rating_current", unit: " A" },
  { key: "output_rating_apparent_power_va", labelKey: "rating.output_rating_apparent_power_va", unit: " VA", digits: 0 },
  { key: "output_rating_active_power_w", labelKey: "rating.output_rating_active_power_w", unit: " W", digits: 0 },
  { key: "battery_rating_voltage", labelKey: "rating.battery_rating_voltage", unit: " V" },
  { key: "battery_recharge_voltage", labelKey: "rating.battery_recharge_voltage", unit: " V" },
  { key: "battery_under_voltage", labelKey: "rating.battery_under_voltage", unit: " V" },
  { key: "battery_bulk_voltage", labelKey: "rating.battery_bulk_voltage", unit: " V" },
  { key: "battery_float_voltage", labelKey: "rating.battery_float_voltage", unit: " V" },
  { key: "battery_type", labelKey: "rating.battery_type" },
  { key: "max_ac_charge_current", labelKey: "rating.max_ac_charge_current", unit: " A", digits: 0 },
  { key: "max_charge_current", labelKey: "rating.max_charge_current", unit: " A", digits: 0 },
  { key: "input_voltage_range", labelKey: "rating.input_voltage_range" },
  { key: "output_source_priority", labelKey: "rating.output_source_priority" },
  { key: "charger_source_priority", labelKey: "rating.charger_source_priority" },
];

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function errorValue(value: unknown): string | null {
  const record = recordValue(value);
  return typeof record?.error === "string" ? record.error : null;
}

const ratingValueLabelKeys: Record<string, Record<string, TranslationKey>> = {
  battery_type: { "0": "rating.agm", "1": "rating.flooded", "2": "rating.userDefined", AGM: "rating.agm", FLOODED: "rating.flooded", USER: "rating.userDefined" },
  input_voltage_range: { UPS: "rating.upsRange", APL: "rating.applianceRange", "0": "rating.applianceRange", "1": "rating.upsRange" },
  output_source_priority: { "0": "rating.utilityFirst", "00": "rating.utilityFirst", "1": "rating.solarFirst", "01": "rating.solarFirst", "2": "rating.sbuPriority", "02": "rating.sbuPriority", utility: "rating.utilityFirst", solar: "rating.solarFirst", sbu: "rating.sbuPriority" },
  charger_source_priority: { "0": "rating.utilityFirst", "00": "rating.utilityFirst", "1": "rating.solarFirst", "01": "rating.solarFirst", "2": "rating.solarAndUtility", "02": "rating.solarAndUtility", "3": "rating.solarOnly", "03": "rating.solarOnly", solar_first: "rating.solarFirst", solar_utility: "rating.solarAndUtility", solar: "rating.solarOnly" },
};

const inverterModeLabelKeys: Record<string, TranslationKey> = {
  P: "mode.P",
  S: "mode.S",
  L: "mode.L",
  B: "mode.B",
  F: "mode.F",
  H: "mode.H",
};

function ratingValueLabel(key: string, raw: string, i18n: I18n) {
  const labelKey = ratingValueLabelKeys[key]?.[raw] || ratingValueLabelKeys[key]?.[raw.toUpperCase()];
  return labelKey ? i18n.t(labelKey) : null;
}

function formatRating(key: string, value: unknown, unit = "", digits = 1, i18n: I18n) {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value);
  const label = ratingValueLabel(key, raw, i18n);
  if (label && (key === "output_source_priority" || key === "charger_source_priority")) return `${label} (${raw})`;
  if (label) return label;
  if (!unit) return String(value);
  return display(typeof value === "number" || typeof value === "string" ? value : null, unit, digits);
}

function formatInverterMode(value: string | null | undefined, i18n: I18n) {
  if (!value) return i18n.t("status.unknown");
  const raw = value.trim();
  const labelKey = inverterModeLabelKeys[raw.toUpperCase()];
  return labelKey ? `${i18n.t(labelKey)} (${raw})` : i18n.t("mode.unknownRaw", { raw });
}

function formatRawValue(value: unknown, i18n: I18n) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string") return value;
  const error = errorValue(value);
  return error ? i18n.t("diagnostics.rawError", { error }) : JSON.stringify(value);
}

function formatDate(value: string | null | undefined, i18n: I18n) {
  return i18n.date(value);
}

createRoot(document.getElementById("root")!).render(<BrowserRouter><App /></BrowserRouter>);
