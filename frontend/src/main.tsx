import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useSearchParams } from "react-router-dom";
import { Brush, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import type { HistoryRequest } from "./api";
import type { BmsStatus, Capability, DiagnosticsResponse, HistorySample, HistoryValue, Status, StatusValues } from "./types";
import "./styles.css";

const energySystemBackground = new URL("./assets/energy-system-background.png", import.meta.url).href;
const settingsPriorityDiagram = new URL("./assets/settings-priority-diagram.png", import.meta.url).href;

function App() {
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
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to reach API"); }
  };
  useEffect(() => { void load(); const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`); socket.onmessage = event => { const data = JSON.parse(event.data); if (data.type === "telemetry" || data.type === "connection") setStatus(data.data); if (data.type === "command_result") setMessage(data.data.ok ? "Inverter setting applied." : `Command failed: ${data.data.error}`); }; return () => socket.close(); }, []);

  const login = async (event: FormEvent) => { event.preventDefault(); try { await api.login(password); setAuthenticated(true); setPassword(""); setMessage("Signed in."); } catch (error) { setMessage(error instanceof Error ? error.message : "Login failed"); } };
  const logout = async () => { await api.logout(); setAuthenticated(false); setMessage("Signed out."); };
  const currentSettings = useMemo(() => currentPrioritySettings(capabilityDiagnostics), [capabilityDiagnostics]);
  const applySetting = async (key: string, value: string) => {
    const label = settingDisplayLabel(key, value);
    setPendingSetting({ key, value });
    try {
      await api.change(key, value);
      await load();
      setMessage(`${settingTitle(key)} updated to ${label}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Change failed");
    } finally {
      setPendingSetting(null);
    }
  };
  const resetDefaults = async () => {
    const defaults = Object.entries(factorySafeDefaults);
    if (!window.confirm(`Reset to factory-safe defaults?\n\nOutput source priority: ${settingDisplayLabel("output_source_priority", factorySafeDefaults.output_source_priority)}\nCharger source priority: ${settingDisplayLabel("charger_source_priority", factorySafeDefaults.charger_source_priority)}`)) return;
    try {
      for (const [key, value] of defaults) {
        if (currentSettings[key] === value) continue;
        setPendingSetting({ key, value });
        await api.change(key, value);
      }
      await load();
      setMessage("Factory-safe defaults applied.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setPendingSetting(null);
    }
  };

  return <main>
    <header><div><h1>Sako Energy</h1><p>Local inverter monitoring and control</p></div><div className={`connection ${status?.connected ? "ok" : "offline"}`}>{status?.connected ? "Inverter connected" : "Inverter offline"}</div></header>
    <nav>{appRoutes.map(route => <NavLink key={route.path} to={route.path} className={({ isActive }) => isActive ? "active" : ""}>{route.label}</NavLink>)}</nav>
    {message && <div className="notice">{message}<button onClick={() => setMessage("")}>×</button></div>}
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<Overview status={status} />} />
      <Route path="/analysis" element={<DataAnalysis />} />
      <Route path="/settings" element={<Settings authenticated={authenticated} capabilities={capabilities} currentSettings={currentSettings} pendingSetting={pendingSetting} login={login} password={password} setPassword={setPassword} logout={logout} onChange={applySetting} onResetDefaults={resetDefaults} />} />
      <Route path="/diagnostics" element={<Diagnostics authenticated={authenticated} />} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  </main>;
}

const appRoutes = [
  { path: "/overview", label: "overview" },
  { path: "/analysis", label: "analysis" },
  { path: "/settings", label: "settings" },
  { path: "/diagnostics", label: "diagnostics" },
];

function Overview({ status }: { status: Status | null }) {
  const values: StatusValues = status?.status || {};
  const activeFlags = values.status_flags?.filter(flag => flag.active) || [];
  const now = useNow(1000);
  return <section><EnergyFlow values={values} connected={Boolean(status?.connected)} />
    <EnergyOverview values={values} connected={Boolean(status?.connected)} />
    <BmsCellHealth bms={status?.bms} />
    <div className="panel details"><h2>Current state</h2><p>Mode: <b>{status?.mode || "—"}</b> · Last update: {formatLastUpdate(status?.captured_at, now)}</p><p>Battery source: <b>{batterySourceLabel(values.battery_source, status?.bms)}</b></p>{activeFlags.length > 0 && <p>Status: {activeFlags.map(flag => <span key={flag.key} title={flag.description}><b>{flag.label}</b>{" "}</span>)}</p>}{status?.warnings && <p>Warnings: <code>{status.warnings}</code></p>}{status?.error && <p className="error">{status.error}</p>}</div>
  </section>;
}

function DataAnalysis() {
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
  const enrichedSamples = useMemo(() => samples.map(enrichSample), [samples]);
  const chartData = useMemo(() => downsample(enrichedSamples, 360).map(sample => ({ ...sample, at: chartTimeLabel(sample.captured_at, analysisState.range) })), [enrichedSamples, historyKey]);
  const stats = useMemo(() => selectedMetrics.map(metric => metricStats(metric, enrichedSamples)), [selectedMetrics, enrichedSamples]);
  const rawRows = useMemo(() => sortedFilteredRows(enrichedSamples, selectedMetrics, rawFilter, rawSort), [enrichedSamples, selectedMetrics, rawFilter, rawSort]);
  const zoomed = Boolean(zoomRange && chartData.length > 0 && (zoomRange.startIndex > 0 || zoomRange.endIndex < chartData.length - 1));
  const activeZoomRange = zoomRange && chartData.length > 0 ? clampZoomRange(zoomRange, chartData.length) : null;
  const zoomLabel = activeZoomRange ? zoomRangeLabel(chartData, activeZoomRange) : "Full selected range";
  const customRangeError = customDateRangeError(customStart, customEnd);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const history = await api.history(historyRequest);
      setSamples(history.samples);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load telemetry history");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadHistory(); }, [historyKey]);
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

  return <section className="analysis-page">
    <div className="section-title"><div><h2>Data analysis</h2><p>Compare inverter telemetry by parameter group and time range.</p></div><button className="quiet" disabled={loading} onClick={() => void loadHistory()}>{loading ? "Loading..." : "Refresh"}</button></div>
    <div className="analysis-controls panel">
      <div><span>Range</span><div className="segmented">{timeRanges.map(range => <button key={range.hours} className={analysisState.range.mode === "preset" && analysisState.range.hours === range.hours ? "active" : ""} onClick={() => selectPresetRange(range)}>{range.label}</button>)}</div>
        <div className="custom-range">
          <label><span>Start</span><input type="datetime-local" value={customStart} onChange={event => setCustomStart(event.target.value)} /></label>
          <label><span>End</span><input type="datetime-local" value={customEnd} onChange={event => setCustomEnd(event.target.value)} /></label>
          <button className={analysisState.range.mode === "custom" ? "active" : ""} disabled={!customStart || !customEnd || Boolean(customRangeError)} onClick={applyCustomRange}>Apply</button>
        </div>
        {customRangeError && <small className="custom-range-error">{customRangeError}</small>}
      </div>
      <div><span>Parameter type</span><div className="segmented metric-groups">{metricGroups.map(group => <button key={group.id} className={analysisState.activeGroupId === group.id ? "active" : ""} onClick={() => selectGroup(group)}>{group.label}</button>)}</div></div>
      <div><span>Parameters</span><div className="metric-toggles">{activeGroup.metricIds.map(id => {
        const metric = metricDefinitions[id];
        const checked = analysisState.selectedMetricIds.includes(id);
        return <label key={id} className={checked ? "checked" : ""}><input type="checkbox" checked={checked} onChange={() => toggleMetric(id)} /> <i style={{ background: metric.color }} />{metric.label}</label>;
      })}</div></div>
    </div>
    {error && <p className="error">{error}</p>}
    <div className="analysis-summary">{stats.map(stat => <article key={stat.metric.id} className="analysis-stat"><span>{stat.metric.label}</span><strong>{formatMetricValue(stat.metric, stat.latest)}</strong><small>Avg {formatMetricValue(stat.metric, stat.average)} · Min {formatMetricValue(stat.metric, stat.min)} · Max {formatMetricValue(stat.metric, stat.max)}</small></article>)}</div>
    <div className="panel analysis-chart"><div className="analysis-panel-head"><div><h3>{activeGroup.label} trend</h3><span>{samples.length} samples · {timeRangeLabel(analysisState.range)} · {zoomLabel}</span></div><button className="quiet zoom-reset" disabled={!zoomed} onClick={() => setZoomRange(null)}>Reset zoom</button></div>
      {loading && samples.length === 0 ? <div className="empty-chart">Loading telemetry history...</div> : chartData.length === 0 ? <div className="empty-chart">No telemetry samples found for this range.</div> : <div className="chart"><ResponsiveContainer><LineChart data={chartData}><CartesianGrid stroke="#29404d" strokeDasharray="3 6" /><XAxis dataKey="at" minTickGap={34}/><YAxis/><Tooltip formatter={(value, name) => {
        const metric = metricDefinitions[String(name)];
        return [metric ? formatMetricValue(metric, value as number) : value, metric?.label || name];
      }} /><Legend formatter={(value) => metricDefinitions[String(value)]?.label || value} />{selectedMetrics.map(metric => <Line key={metric.id} type="monotone" dataKey={metric.id} stroke={metric.color} dot={false} strokeWidth={2.4} connectNulls />)}<Brush dataKey="at" height={32} stroke="#55b964" fill="#10202a" travellerWidth={12} startIndex={activeZoomRange?.startIndex ?? 0} endIndex={activeZoomRange?.endIndex ?? chartData.length - 1} onChange={range => setZoomRange(normalizeZoomRange(range, chartData.length))} /></LineChart></ResponsiveContainer></div>}
    </div>
    <details className="panel analysis-table-panel" open={rawDataOpen} onToggle={event => setRawDataOpen(event.currentTarget.open)}><summary><span>Raw telemetry data</span><small>{rawDataOpen ? `${rawRows.length} of ${samples.length} rows` : "Collapsed by default"}</small></summary>
      <div className="raw-data-tools">
        <label><span>Filter</span><input value={rawFilter} onChange={event => setRawFilter(event.target.value)} placeholder="Time or value" /></label>
        <label><span>Sort by</span><select value={rawSort.key} onChange={event => setRawSort(current => ({ ...current, key: event.target.value }))}><option value="captured_at">Captured time</option>{selectedMetrics.map(metric => <option key={metric.id} value={metric.id}>{metric.label}</option>)}</select></label>
        <label><span>Direction</span><select value={rawSort.direction} onChange={event => setRawSort(current => ({ ...current, direction: event.target.value as SortDirection }))}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        {(rawFilter || rawSort.key !== "captured_at" || rawSort.direction !== "desc") && <button className="quiet" onClick={() => { setRawFilter(""); setRawSort({ key: "captured_at", direction: "desc" }); }}>Clear</button>}
      </div>
      {rawRows.length === 0 ? <p>No telemetry rows match the current filter.</p> : <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>Captured</th>{selectedMetrics.map(metric => <th key={metric.id}>{metric.label}</th>)}</tr></thead><tbody>{rawRows.map(row => <tr key={row.captured_at}><td>{formatDate(row.captured_at)}</td>{selectedMetrics.map(metric => <td key={metric.id}>{formatMetricValue(metric, metricValue(row, metric.id))}</td>)}</tr>)}</tbody></table></div>}
    </details>
  </section>;
}

function EnergyOverview({ values, connected }: { values: StatusValues; connected: boolean }) {
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
  const gridDirection = gridActive ? "Importing" : "Standby";

  return <aside className="overview-card overview-below" aria-label="Energy overview">
    <div className="overview-head"><h3>Overview</h3><span className={connected ? "live on" : "live"}>{connected ? "Live" : "Offline"}</span></div>
    <OverviewRow icon="panel" label="PV Input" value={`${display(values.pv_input_voltage, " V")} · ${display(values.pv_input_current, " A")}`} compact />
    <OverviewRow icon="battery" label="Battery SOC" value={`${batteryPercent.toFixed(0)}%`} progress={batteryPercent} />
    <OverviewRow icon="home" label="Home Load" value={loadPower > 1 ? watts(loadPower) : "0 W"} />
    <OverviewRow icon="tower" label="Grid" value={gridActive ? watts(gridPower) : "0 W"} note={`${gridDirection} · ${display(values.grid_voltage, " V", 0)} · ${display(values.grid_frequency, " Hz")}`} />
    <OverviewRow icon="pulse" label="Battery Current" value={`${display(values.battery_charge_current, " A", 0)} / ${display(values.battery_discharge_current, " A", 0)}`} note="charge / discharge" compact />
    <OverviewRow icon="temp" label="Inverter Temp" value={display(values.inverter_temperature_c, "°C")} />
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
const relativeTimeFormatter = new Intl.RelativeTimeFormat([], { numeric: "always" });
const relativeTimeUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatLastUpdate(value: string | null | undefined, now: number) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatRelativeTime(date.getTime(), now)} (${date.toLocaleString()})`;
}

function formatRelativeTime(time: number, now: number) {
  const diffSeconds = Math.round((time - now) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const [unit, secondsPerUnit] = relativeTimeUnits.find(([, seconds]) => absSeconds >= seconds) || ["second", 1];
  return relativeTimeFormatter.format(Math.round(diffSeconds / secondsPerUnit), unit);
}

type MetricDefinition = { id: string; source?: string; label: string; unit: string; digits: number; color: string };
type MetricGroup = { id: string; label: string; metricIds: string[]; defaultMetricIds: string[] };
type AnalysisSample = HistorySample & Record<string, HistoryValue>;
type ChartZoomRange = { startIndex: number; endIndex: number };
type SortDirection = "asc" | "desc";
type RawSort = { key: string; direction: SortDirection };
type TimeRange = { label: string; param: string; hours: number };
type AnalysisRangeState = { mode: "preset"; hours: number; param: string } | { mode: "custom"; start: string; end: string };
type AnalysisUrlState = { activeGroupId: string; selectedMetricIds: string[]; range: AnalysisRangeState };

const bmsCellColors = ["#84cc16", "#06b6d4", "#f59e0b", "#a78bfa", "#22c55e", "#38bdf8", "#fb7185", "#eab308"];
const bmsCellMetricDefinitions: Record<string, MetricDefinition> = Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => {
    const cell = index + 1;
    return [`bms_cell_${String(cell).padStart(2, "0")}_voltage`, { id: `bms_cell_${String(cell).padStart(2, "0")}_voltage`, label: `Cell ${cell}`, unit: " V", digits: 3, color: bmsCellColors[index % bmsCellColors.length] }];
  })
);

const metricDefinitions: Record<string, MetricDefinition> = {
  battery_voltage: { id: "battery_voltage", label: "Battery voltage", unit: " V", digits: 1, color: "#f7c948" },
  pv_input_voltage: { id: "pv_input_voltage", label: "PV voltage", unit: " V", digits: 1, color: "#50c878" },
  grid_voltage: { id: "grid_voltage", label: "Grid voltage", unit: " V", digits: 1, color: "#7dd3fc" },
  output_voltage: { id: "output_voltage", label: "Output voltage", unit: " V", digits: 1, color: "#c084fc" },
  output_active_power_w: { id: "output_active_power_w", label: "Output power", unit: " W", digits: 0, color: "#fb923c" },
  output_apparent_power_va: { id: "output_apparent_power_va", label: "Apparent power", unit: " VA", digits: 0, color: "#f472b6" },
  pv_power_w: { id: "pv_power_w", label: "PV power", unit: " W", digits: 0, color: "#22c55e" },
  battery_capacity_percent: { id: "battery_capacity_percent", label: "Battery SOC", unit: "%", digits: 0, color: "#a3e635" },
  battery_charge_current: { id: "battery_charge_current", label: "Charge current", unit: " A", digits: 0, color: "#14b8a6" },
  battery_discharge_current: { id: "battery_discharge_current", label: "Discharge current", unit: " A", digits: 0, color: "#f97316" },
  pv_input_current: { id: "pv_input_current", label: "PV current", unit: " A", digits: 1, color: "#86efac" },
  grid_frequency: { id: "grid_frequency", label: "Grid frequency", unit: " Hz", digits: 1, color: "#38bdf8" },
  load_percent: { id: "load_percent", label: "Load", unit: "%", digits: 0, color: "#facc15" },
  inverter_temperature_c: { id: "inverter_temperature_c", label: "Inverter temp", unit: "°C", digits: 1, color: "#ef4444" },
  bms_battery_voltage: { id: "bms_battery_voltage", label: "BMS voltage", unit: " V", digits: 2, color: "#f7c948" },
  bms_current_a: { id: "bms_current_a", label: "BMS current", unit: " A", digits: 2, color: "#14b8a6" },
  bms_power_w: { id: "bms_power_w", label: "BMS power", unit: " W", digits: 0, color: "#fb923c" },
  bms_capacity_percent: { id: "bms_capacity_percent", label: "BMS SOC", unit: "%", digits: 0, color: "#a3e635" },
  bms_delta_cell_voltage: { id: "bms_delta_cell_voltage", label: "Cell delta", unit: " V", digits: 3, color: "#f97316" },
  bms_min_cell_voltage: { id: "bms_min_cell_voltage", label: "Min cell", unit: " V", digits: 3, color: "#60a5fa" },
  bms_max_cell_voltage: { id: "bms_max_cell_voltage", label: "Max cell", unit: " V", digits: 3, color: "#c084fc" },
  bms_balance_current_a: { id: "bms_balance_current_a", label: "Balance current", unit: " A", digits: 2, color: "#2dd4bf" },
  bms_battery_t1_c: { id: "bms_battery_t1_c", label: "Battery T1", unit: "°C", digits: 1, color: "#f87171" },
  bms_battery_t2_c: { id: "bms_battery_t2_c", label: "Battery T2", unit: "°C", digits: 1, color: "#fb7185" },
  bms_mos_temperature_c: { id: "bms_mos_temperature_c", label: "MOS temp", unit: "°C", digits: 1, color: "#ef4444" },
  bms_remaining_capacity_ah: { id: "bms_remaining_capacity_ah", label: "Remaining Ah", unit: " Ah", digits: 1, color: "#99f6e4" },
  bms_nominal_capacity_ah: { id: "bms_nominal_capacity_ah", label: "Nominal Ah", unit: " Ah", digits: 1, color: "#bfdbfe" },
  bms_cycle_count: { id: "bms_cycle_count", label: "Cycles", unit: "", digits: 0, color: "#fde047" },
  ...bmsCellMetricDefinitions,
};

const bmsCellMetricIds = Array.from({ length: 8 }, (_, index) => `bms_cell_${String(index + 1).padStart(2, "0")}_voltage`);
const metricGroups: MetricGroup[] = [
  { id: "voltage", label: "Voltage", metricIds: ["battery_voltage", "pv_input_voltage", "grid_voltage", "output_voltage"], defaultMetricIds: ["battery_voltage", "pv_input_voltage"] },
  { id: "power", label: "Power", metricIds: ["output_active_power_w", "output_apparent_power_va", "pv_power_w"], defaultMetricIds: ["output_active_power_w", "pv_power_w"] },
  { id: "battery", label: "Battery", metricIds: ["battery_capacity_percent", "battery_voltage", "battery_charge_current", "battery_discharge_current"], defaultMetricIds: ["battery_capacity_percent", "battery_voltage"] },
  { id: "bms", label: "BMS", metricIds: ["bms_capacity_percent", "bms_battery_voltage", "bms_current_a", "bms_power_w", "bms_delta_cell_voltage", "bms_mos_temperature_c", "bms_battery_t1_c", "bms_battery_t2_c", "bms_balance_current_a"], defaultMetricIds: ["bms_capacity_percent", "bms_battery_voltage", "bms_delta_cell_voltage"] },
  { id: "cells", label: "Cells", metricIds: bmsCellMetricIds, defaultMetricIds: bmsCellMetricIds.slice(0, 8) },
  { id: "pv", label: "PV", metricIds: ["pv_input_voltage", "pv_input_current", "pv_power_w"], defaultMetricIds: ["pv_input_voltage", "pv_power_w"] },
  { id: "grid", label: "Grid", metricIds: ["grid_voltage", "grid_frequency"], defaultMetricIds: ["grid_voltage", "grid_frequency"] },
  { id: "load", label: "Load", metricIds: ["load_percent", "output_active_power_w", "output_apparent_power_va"], defaultMetricIds: ["load_percent", "output_active_power_w"] },
  { id: "temperature", label: "Temperature", metricIds: ["inverter_temperature_c"], defaultMetricIds: ["inverter_temperature_c"] },
];

const timeRanges: TimeRange[] = [
  { label: "1h", param: "1h", hours: 1 },
  { label: "6h", param: "6h", hours: 6 },
  { label: "12h", param: "12h", hours: 12 },
  { label: "24h", param: "24h", hours: 24 },
  { label: "3d", param: "3d", hours: 72 },
  { label: "7d", param: "7d", hours: 168 },
  { label: "30d", param: "30d", hours: 720 },
];

const defaultAnalysisGroupId = "voltage";
const defaultTimeRange = timeRanges[0];

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

function customDateRangeError(start: string, end: string) {
  if (!start && !end) return "";
  if (!start || !end) return "Select both start and end.";
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return "Select valid dates.";
  if (startTime > endTime) return "Start must be before end.";
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

function sortedFilteredRows(samples: AnalysisSample[], metrics: MetricDefinition[], filter: string, sort: RawSort) {
  const query = filter.trim().toLowerCase();
  const filtered = query ? samples.filter(sample => rawRowText(sample, metrics).includes(query)) : samples;
  return [...filtered].sort((left, right) => compareRows(left, right, sort));
}

function rawRowText(sample: AnalysisSample, metrics: MetricDefinition[]) {
  return [
    formatDate(sample.captured_at),
    sample.captured_at,
    ...metrics.flatMap(metric => [metric.label, formatMetricValue(metric, metricValue(sample, metric.id))]),
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

function zoomRangeLabel(rows: Array<AnalysisSample & { at: string }>, range: ChartZoomRange) {
  const start = rows[range.startIndex]?.captured_at;
  const end = rows[range.endIndex]?.captured_at;
  if (!start || !end) return "Full selected range";
  return `Zoom ${shortDateTime(start)} to ${shortDateTime(end)}`;
}

function chartTimeLabel(value: string, range: AnalysisRangeState) {
  const date = new Date(value);
  const hours = range.mode === "preset" ? range.hours : (new Date(range.end).getTime() - new Date(range.start).getTime()) / 3_600_000;
  return hours > 24 ? date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit" }) : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortDateTime(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeRangeLabel(range: AnalysisRangeState) {
  if (range.mode === "custom") return `${shortDateTime(range.start)} to ${shortDateTime(range.end)}`;
  const hours = range.hours;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours / 24} day${hours === 24 ? "" : "s"}`;
}

function EnergyFlow({ values, connected }: { values: StatusValues; connected: boolean }) {
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
  const gridDirection = gridActive ? "Importing" : "Standby";
  const batteryDirection = batteryCharging ? "Charging" : batteryDischarging ? "Discharging" : "Idle";

  return <section className="energy-flow panel" aria-label="Live energy flow">
    <div className="energy-flow-heading"><div><p className="eyebrow">Live energy flow</p><h2>Where your power is going</h2></div><div className={`diagram-status ${connected ? "online" : "offline"}`}><span />{connected ? "Live" : "Offline"}</div></div>
    <div className="energy-diagram">
      <div className="energy-stage">
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
        <MetricCard className="pv-card" icon="sun" title="PV" value={pvPower > 1 ? watts(pvPower) : "0 W"} details={[
          ["Voltage", display(values.pv_input_voltage, " V")],
          ["Current", display(values.pv_input_current, " A")],
        ]} />
        <MetricCard className="load-card" icon="home" title="Load" value={loadPower > 1 ? watts(loadPower) : "0 W"} details={[
          ["Load", display(values.load_percent, "%", 0)],
          ["Output", `${display(values.output_voltage, " V")} · ${display(values.output_frequency, " Hz")}`],
          ["Apparent", display(values.output_apparent_power_va, " VA", 0)],
        ]} />
        <MetricCard className="battery-card" icon="battery" title="Battery" value={batteryActive ? watts(Math.abs(batteryPower)) : "0 W"} details={[
          ["SOC", `${batteryPercent.toFixed(0)}% · ${batteryDirection}`],
          ["Voltage", display(values.battery_voltage, " V")],
          ["Charge", display(values.battery_charge_current, " A", 0)],
          ["Discharge", display(values.battery_discharge_current, " A", 0)],
        ]} />
        <MetricCard className="grid-card" icon="tower" title="Grid" value={gridActive ? watts(gridPower) : "0 W"} details={[
          ["Status", gridDirection],
          ["Voltage", display(values.grid_voltage, " V")],
          ["Frequency", display(values.grid_frequency, " Hz")],
        ]} />
      </div>
    </div>
    <div className="flow-legend"><span><i className="legend-dot solar" />Solar production</span><span><i className="legend-dot battery" />Battery storage</span><span><i className="legend-dot grid" />CEB utility</span><span>Live values update automatically</span></div>
  </section>;
}

function MetricCard({ className, icon, title, value, details }: { className: string; icon: IconName; title: string; value: string; details: Array<[string, string]> }) {
  return <article className={`metric-card ${className}`}><EnergyIcon name={icon} /><div><span>{title}</span><strong>{value}</strong><dl>{details.map(([label, detail]) => <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl></div></article>;
}

function OverviewRow({ icon, label, value, note, progress, compact = false }: { icon: IconName; label: string; value: string; note?: string; progress?: number; compact?: boolean }) {
  return <div className="overview-row"><EnergyIcon name={icon} /><div><span>{label}</span><strong className={compact ? "compact" : ""}>{value}</strong>{progress !== undefined && <i className="soc-meter"><b style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></i>}{note && <small>{note}</small>}</div></div>;
}

function BmsCellHealth({ bms }: { bms?: BmsStatus | null }) {
  if (!bms?.enabled) return null;
  const cells = bms.cells || [];
  const minVoltage = cells.length ? Math.min(...cells.map(cell => cell.voltage)) : null;
  const maxVoltage = cells.length ? Math.max(...cells.map(cell => cell.voltage)) : null;
  return <article className={`panel bms-health ${bms.connected ? "online" : "offline"}`}>
    <div className="bms-health-head"><div><h3>JK-BMS cells</h3><p>{bms.name || bms.address || "Bluetooth BMS"} · {bms.protocol || "JK"}</p></div><span className={bms.connected ? "live on" : "live"}>{bms.connected ? "Live" : "Offline"}</span></div>
    <div className="bms-health-stats">
      <BmsStat label="Pack" value={display(bms.voltage, " V", 2)} />
      <BmsStat label="SOC" value={display(bms.capacity_percent, "%", 0)} />
      <BmsStat label="Current" value={display(bms.current_a, " A", 2)} />
      <BmsStat label="Delta" value={display(bms.delta_cell_voltage, " V", 3)} />
      <BmsStat label="Temp" value={display(bms.mos_temperature_c ?? bms.battery_t1_c, "°C", 1)} />
    </div>
    {bms.error && <p className="error">{bms.error}</p>}
    {cells.length === 0 ? <p>No cell voltage data is available yet.</p> : <div className="bms-cell-grid">{cells.map(cell => {
      const fill = cellVoltageFill(cell.voltage);
      const edge = cell.voltage === minVoltage ? "low" : cell.voltage === maxVoltage ? "high" : "";
      return <div className={`bms-cell ${edge}`} key={cell.index}><span>Cell {String(cell.index).padStart(2, "0")}</span><strong>{display(cell.voltage, " V", 3)}</strong><i><b style={{ width: `${fill}%` }} /></i></div>;
    })}</div>}
  </article>;
}

function BmsStat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function cellVoltageFill(value: number) {
  return Math.min(100, Math.max(0, ((value - 2.8) / (3.65 - 2.8)) * 100));
}

function batterySourceLabel(value: number | string | null | undefined, bms?: BmsStatus | null) {
  if (value === "bms") return "JK-BMS Bluetooth";
  if (bms?.enabled && bms.error) return "Inverter fallback";
  return "Inverter";
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

const settingExplainers: Record<string, { resetNote: string; choices: Record<string, string> }> = {
  output_source_priority: {
    resetNote: "Factory-safe reset uses utility first so the home load prefers the grid.",
    choices: {
      utility: "Grid feeds the home first; solar and battery support when utility is not available.",
      solar: "Solar feeds the home first; utility supports the load when solar is low.",
      sbu: "Solar feeds first, then battery, then utility as the final backup.",
    },
  },
  charger_source_priority: {
    resetNote: "Factory-safe reset uses solar first charging.",
    choices: {
      solar_first: "Solar charges the battery first; utility can assist when needed.",
      solar_utility: "Solar and utility can charge the battery together.",
      solar: "Only solar charges the battery; utility charging stays off.",
    },
  },
};

function Settings({ authenticated, capabilities, currentSettings, pendingSetting, login, password, setPassword, logout, onChange, onResetDefaults }: { authenticated: boolean; capabilities: Capability[]; currentSettings: CurrentSettings; pendingSetting: PendingSetting; login: (event: FormEvent) => Promise<void>; password: string; setPassword: (v: string) => void; logout: () => Promise<void>; onChange: (key: string, value: string) => Promise<void>; onResetDefaults: () => Promise<void> }) {
  if (!authenticated) return <section className="panel login"><h2>Administrator sign in</h2><p>Settings require the local administrator password.</p><form onSubmit={login}><input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"/><button>Sign in</button></form></section>;
  const resetDisabled = Boolean(pendingSetting) || capabilities.length === 0;
  return <section className="settings-page">
    <div className="section-title"><div><h2>Inverter settings</h2><p>Priority changes can transfer load or change battery charging behavior.</p></div><div className="settings-actions"><button className="quiet danger" disabled={resetDisabled} onClick={() => void onResetDefaults()}>{pendingSetting ? "Applying..." : "Reset defaults"}</button><button className="quiet" onClick={() => void logout()}>Sign out</button></div></div>
    {capabilities.length === 0 && <div className="panel settings-empty"><b>No configurable priorities available</b><p>The inverter capability check has not confirmed supported priority settings yet.</p></div>}
    {capabilities.map(capability => <SettingCard key={capability.key} capability={capability} currentValue={currentSettings[capability.key]} pendingSetting={pendingSetting} onChange={onChange} />)}
  </section>;
}

function SettingCard({ capability, currentValue, pendingSetting, onChange }: { capability: Capability; currentValue?: string; pendingSetting: PendingSetting; onChange: (key: string, value: string) => Promise<void> }) {
  const currentChoice = capability.choices.find(choice => choice.value === currentValue);
  const pendingForCard = pendingSetting?.key === capability.key;
  const diagramValue = currentValue || capability.choices[0]?.value || "";
  return <article className={`panel setting rich-setting ${pendingForCard ? "applying" : ""}`}>
    <div className="setting-layout">
      <div className="setting-main">
        <div className="setting-card-head"><div><h3>{capability.label}</h3><p>{capability.warning}</p></div><span className={currentChoice ? "current-badge" : "current-badge muted"}>Current: {currentChoice?.label || "Unavailable"}</span></div>
        <PriorityDiagram settingKey={capability.key} value={diagramValue} />
        <div className="choice-grid">{capability.choices.map(choice => {
          const selected = choice.value === currentValue;
          const applying = pendingSetting?.key === capability.key && pendingSetting.value === choice.value;
          const description = settingExplainers[capability.key]?.choices[choice.value] || "Apply this supported inverter priority.";
          return <button key={choice.value} className={`choice-card ${selected ? "selected" : ""}`} disabled={pendingForCard} onClick={() => { if (window.confirm(`${capability.warning}\n\nApply "${choice.label}"?`)) void onChange(capability.key, choice.value); }}>
            <span>{choice.label}</span>
            {applying && <i className="spinner" aria-label="Applying setting" />}
            <small>{description}</small>
          </button>;
        })}</div>
      </div>
      <aside className="setting-reset-note"><b>Default</b><span>{settingExplainers[capability.key]?.resetNote || "Reset returns this setting to the factory-safe value."}</span></aside>
    </div>
  </article>;
}

function PriorityDiagram({ settingKey, value }: { settingKey: string; value: string }) {
  const output = settingKey === "output_source_priority";
  const active = output ? outputPrioritySources(value) : chargerPrioritySources(value);
  return <div className="priority-diagram" aria-label={`${settingTitle(settingKey)} flow`}>
    <img className="priority-diagram-bg" src={settingsPriorityDiagram} alt="" aria-hidden="true" />
    <div className="priority-diagram-shade" />
    <svg className="priority-lines" viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">
      <path className={`diagram-line solar ${active.includes("solar") ? "active" : ""}`} d="M 21 14 C 32 17 41 24 48 31" />
      <path className={`diagram-line grid ${active.includes("grid") ? "active" : ""}`} d="M 16 39 C 30 39 40 36 48 31" />
      <path className="diagram-line target active" d={output ? "M 55 31 C 65 29 73 25 82 22" : "M 55 34 C 63 39 70 43 78 43"} />
      {output && <path className={`diagram-line battery ${active.includes("battery") ? "active" : ""}`} d="M 78 43 C 69 43 61 39 55 34" />}
    </svg>
    <DiagramNode name="Grid" icon="tower" active={active.includes("grid")} className="grid-node" />
    <DiagramNode name="Solar" icon="sun" active={active.includes("solar")} className="solar-node" />
    <div className="diagram-center"><EnergyIcon name="inverter" /><span>Inverter</span></div>
    <DiagramNode name={output ? "Home" : "Battery"} icon={output ? "home" : "battery"} active className={output ? "home-target" : "battery-target"} />
    {output && <DiagramNode name="Battery" icon="battery" active={active.includes("battery")} className="battery-source" />}
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

function settingDisplayLabel(key: string, value: string) {
  return ratingValueLabels[key]?.[value] || value;
}

function settingTitle(key: string) {
  if (key === "output_source_priority") return "Output source priority";
  if (key === "charger_source_priority") return "Charger source priority";
  return "Setting";
}

function Diagnostics({ authenticated }: { authenticated: boolean }) {
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
      setError(e instanceof Error ? e.message : "Sign in first");
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
      setError(e instanceof Error ? e.message : "Unable to refresh diagnostics");
    } finally {
      setLoading("");
    }
  };

  return <section className="diagnostics">
    <div className="section-title"><div><h2>Diagnostics</h2><p>Identity, firmware, ratings, flags, and raw protocol replies are restricted to the administrator.</p></div>{authenticated && <div className="diagnostics-actions"><button className="quiet" disabled={Boolean(loading)} onClick={() => void refresh()}>{loading === "refresh" ? "Refreshing..." : "Refresh discovery"}</button></div>}</div>
    {!authenticated && <div className="panel diagnostics-empty"><b>Administrator sign in required</b><p>Sign in from Settings to view inverter diagnostics.</p></div>}
    {authenticated && loading === "load" && !data && <div className="panel diagnostics-empty"><b>Loading diagnostics</b><p>Reading system information from the inverter.</p></div>}
    {error && <p className="error">{error}</p>}
    {data && <>
      <div className="diagnostics-summary">
        <DiagnosticsSummaryCard label="Connection" value={latest?.connected ? "Connected" : "Offline"} tone={latest?.connected ? "ok" : "warn"} detail={latest?.error || latest?.warnings || "Live telemetry available"} />
        <DiagnosticsSummaryCard label="JK-BMS" value={bmsLabel(bms)} tone={bms?.enabled ? bms.connected ? "ok" : "warn" : "neutral"} detail={bmsDetail(bms)} />
        <DiagnosticsSummaryCard label="Mode" value={formatInverterMode(latest?.mode)} detail={formatDate(latest?.captured_at)} />
        <DiagnosticsSummaryCard label="Protocol" value={protocolOk ? "PIP compatible" : "Needs attention"} tone={protocolOk ? "ok" : "warn"} detail={protocol || protocolError || "No protocol reply"} />
        <DiagnosticsSummaryCard label="Active flags" value={String(activeFlags.length)} tone={activeFlags.length ? "warn" : "ok"} detail={activeFlags.length ? activeFlags.map(flag => flag.label).join(", ") : "No active status flags"} />
      </div>
      <div className="diagnostics-grid">
        <DiagnosticsPanel title="Inverter identity" rows={[
          ["Protocol", protocol || errorValue(diagnostics.QPI) || "—"],
          ["Serial / ID", textValue(diagnostics.QID) || errorValue(diagnostics.QID) || "—"],
          ["Firmware", textValue(diagnostics.QVFW) || errorValue(diagnostics.QVFW) || "—"],
          ["Secondary firmware", textValue(diagnostics.QVFW2) || errorValue(diagnostics.QVFW2) || "—"],
          ...(protocolError ? [["Protocol issue", protocolError] as [string, string]] : []),
        ]} />
        <DiagnosticsPanel title="Rated configuration" rows={ratingRows.map(row => [row.label, formatRating(row.key, rating?.[row.key], row.unit, row.digits)])} />
        <DiagnosticsPanel title="JK-BMS Bluetooth" rows={bmsRows(bms)} />
      </div>
      <article className="panel diagnostics-flags"><h3>Status flags</h3>{flags.length ? <><div className="flag-list">{activeFlags.map(flag => <span className="flag-chip active" key={flag.key} title={flag.description}>{flag.label}</span>)}{activeFlags.length === 0 && <span className="flag-chip calm">No active flags</span>}</div>{inactiveFlags.length > 0 && <div className="flag-list muted">{inactiveFlags.map(flag => <span className="flag-chip" key={flag.key} title={flag.description}>{flag.label}</span>)}</div>}</> : <p>No decoded status flags are available from the latest telemetry.</p>}</article>
      <details className="panel raw-replies"><summary>Raw protocol replies</summary><dl>{rawCommands.map(command => <div key={command}><dt>{command}</dt><dd>{formatRawValue(diagnostics[command])}</dd></div>)}</dl></details>
    </>}
  </section>;
}

function DiagnosticsSummaryCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "ok" | "warn" }) {
  return <article className={`diagnostics-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function DiagnosticsPanel({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <article className="panel diagnostics-panel"><h3>{title}</h3><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>;
}

function bmsLabel(bms: BmsStatus | null) {
  if (!bms?.enabled) return "Disabled";
  return bms.connected ? "Connected" : "Offline";
}

function bmsDetail(bms: BmsStatus | null) {
  if (!bms?.enabled) return "BMS polling is disabled";
  return bms.error || `${bms.address || "No address"} · ${formatDate(bms.captured_at)}`;
}

function bmsRows(bms: BmsStatus | null): Array<[string, string]> {
  const rawSummary = recordValue(bms?.raw_summary);
  const rawKeys = Array.isArray(rawSummary?.keys) ? rawSummary.keys.map(String).join(", ") : "—";
  return [
    ["Mode", bms?.enabled ? bms.source : "Disabled"],
    ["Connection", bms?.connected ? "Connected" : "Offline"],
    ["Address", bms?.address || "—"],
    ["Name", bms?.name || "—"],
    ["Protocol", bms?.protocol || "—"],
    ["Last update", formatDate(bms?.captured_at)],
    ["Pack voltage", display(bms?.voltage, " V", 2)],
    ["Current", display(bms?.current_a, " A", 2)],
    ["SOC", display(bms?.capacity_percent, "%", 0)],
    ["Cells", bms?.cells?.length ? String(bms.cells.length) : "—"],
    ["Cell delta", display(bms?.delta_cell_voltage, " V", 3)],
    ["Raw command", textValue(rawSummary?.command) || "—"],
    ["Raw keys", rawKeys],
    ["Error", bms?.error || "—"],
  ];
}

const rawCommands = ["QPI", "QID", "QVFW", "QVFW2", "QPIRI", "QFLAG"] as const;
type RatingRow = { key: string; label: string; unit?: string; digits?: number };
const ratingRows: RatingRow[] = [
  { key: "grid_rating_voltage", label: "Grid voltage", unit: " V" },
  { key: "grid_rating_current", label: "Grid current", unit: " A" },
  { key: "output_rating_voltage", label: "Output voltage", unit: " V" },
  { key: "output_rating_frequency", label: "Output frequency", unit: " Hz" },
  { key: "output_rating_current", label: "Output current", unit: " A" },
  { key: "output_rating_apparent_power_va", label: "Apparent power", unit: " VA", digits: 0 },
  { key: "output_rating_active_power_w", label: "Active power", unit: " W", digits: 0 },
  { key: "battery_rating_voltage", label: "Battery voltage", unit: " V" },
  { key: "battery_recharge_voltage", label: "Recharge voltage", unit: " V" },
  { key: "battery_under_voltage", label: "Low battery voltage", unit: " V" },
  { key: "battery_bulk_voltage", label: "Bulk charge voltage", unit: " V" },
  { key: "battery_float_voltage", label: "Float charge voltage", unit: " V" },
  { key: "battery_type", label: "Battery type" },
  { key: "max_ac_charge_current", label: "Max AC charge", unit: " A", digits: 0 },
  { key: "max_charge_current", label: "Max total charge", unit: " A", digits: 0 },
  { key: "input_voltage_range", label: "Input range" },
  { key: "output_source_priority", label: "Output priority" },
  { key: "charger_source_priority", label: "Charger priority" },
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

const ratingValueLabels: Record<string, Record<string, string>> = {
  battery_type: { "0": "AGM", "1": "Flooded", "2": "User-defined", AGM: "AGM", FLOODED: "Flooded", USER: "User-defined" },
  input_voltage_range: { UPS: "UPS / narrow input range", APL: "Appliance / wide input range", "0": "Appliance / wide input range", "1": "UPS / narrow input range" },
  output_source_priority: { "0": "Utility first", "00": "Utility first", "1": "Solar first", "01": "Solar first", "2": "SBU priority", "02": "SBU priority", utility: "Utility first", solar: "Solar first", sbu: "SBU priority" },
  charger_source_priority: { "0": "Utility first", "00": "Utility first", "1": "Solar first", "01": "Solar first", "2": "Solar and utility", "02": "Solar and utility", "3": "Solar only", "03": "Solar only", solar_first: "Solar first", solar_utility: "Solar and utility", solar: "Solar only" },
};

const inverterModeLabels: Record<string, string> = {
  P: "Power on",
  S: "Standby",
  L: "Line mode",
  B: "Battery mode",
  F: "Fault mode",
  H: "Power saving mode",
};

function formatRating(key: string, value: unknown, unit = "", digits = 1) {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value);
  const label = ratingValueLabels[key]?.[raw] || ratingValueLabels[key]?.[raw.toUpperCase()];
  if (label && (key === "output_source_priority" || key === "charger_source_priority")) return `${label} (${raw})`;
  if (label) return label;
  if (!unit) return String(value);
  return display(typeof value === "number" || typeof value === "string" ? value : null, unit, digits);
}

function formatInverterMode(value: string | null | undefined) {
  if (!value) return "Unknown";
  const raw = value.trim();
  const label = inverterModeLabels[raw.toUpperCase()];
  return label ? `${label} (${raw})` : `Unknown (${raw})`;
}

function formatRawValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string") return value;
  const error = errorValue(value);
  return error ? `Error: ${error}` : JSON.stringify(value);
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "No live update yet";
}

createRoot(document.getElementById("root")!).render(<BrowserRouter><App /></BrowserRouter>);
