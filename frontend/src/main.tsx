import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import type { Capability, DiagnosticsResponse, Status, StatusValues } from "./types";
import "./styles.css";

const energySystemBackground = new URL("./assets/energy-system-background.png", import.meta.url).href;
const settingsPriorityDiagram = new URL("./assets/settings-priority-diagram.png", import.meta.url).href;

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<Array<Record<string, number | string | null>>>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [capabilityDiagnostics, setCapabilityDiagnostics] = useState<Record<string, unknown>>({});
  const [tab, setTab] = useState<"overview" | "settings" | "diagnostics">("overview");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(Boolean(sessionStorage.getItem("sako_csrf")));
  const [message, setMessage] = useState("");
  const [pendingSetting, setPendingSetting] = useState<PendingSetting>(null);

  const load = async () => {
    try {
      const [nextStatus, nextHistory, nextCapabilities] = await Promise.all([api.status(), api.history(), api.capabilities()]);
      setStatus(nextStatus); setHistory(nextHistory.samples); setCapabilities(nextCapabilities.capabilities); setCapabilityDiagnostics(nextCapabilities.diagnostics || {});
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to reach API"); }
  };
  useEffect(() => { void load(); const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`); socket.onmessage = event => { const data = JSON.parse(event.data); if (data.type === "telemetry" || data.type === "connection") setStatus(data.data); if (data.type === "command_result") setMessage(data.data.ok ? "Inverter setting applied." : `Command failed: ${data.data.error}`); }; return () => socket.close(); }, []);

  const login = async (event: FormEvent) => { event.preventDefault(); try { await api.login(password); setAuthenticated(true); setPassword(""); setMessage("Signed in."); } catch (error) { setMessage(error instanceof Error ? error.message : "Login failed"); } };
  const logout = async () => { await api.logout(); setAuthenticated(false); setMessage("Signed out."); };
  const points = useMemo(() => history.map((sample) => ({ ...sample, at: new Date(String(sample.captured_at)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })), [history]);
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
    <nav>{(["overview", "settings", "diagnostics"] as const).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {message && <div className="notice">{message}<button onClick={() => setMessage("")}>×</button></div>}
    {tab === "overview" && <Overview status={status} points={points} />}
    {tab === "settings" && <Settings authenticated={authenticated} capabilities={capabilities} currentSettings={currentSettings} pendingSetting={pendingSetting} login={login} password={password} setPassword={setPassword} logout={logout} onChange={applySetting} onResetDefaults={resetDefaults} />}
    {tab === "diagnostics" && <Diagnostics authenticated={authenticated} />}
  </main>;
}

function Overview({ status, points }: { status: Status | null; points: Array<Record<string, number | string | null>> }) {
  const values: StatusValues = status?.status || {};
  const activeFlags = values.status_flags?.filter(flag => flag.active) || [];
  return <section><EnergyFlow values={values} connected={Boolean(status?.connected)} />
    <EnergyOverview values={values} connected={Boolean(status?.connected)} />
    <div className="panel"><h2>24-hour voltage trend</h2><div className="chart"><ResponsiveContainer><LineChart data={points}><XAxis dataKey="at" minTickGap={36}/><YAxis/><Tooltip/><Line type="monotone" dataKey="battery_voltage" stroke="#f7c948" dot={false}/><Line type="monotone" dataKey="pv_input_voltage" stroke="#50c878" dot={false}/></LineChart></ResponsiveContainer></div></div>
    <div className="panel details"><h2>Current state</h2><p>Mode: <b>{status?.mode || "—"}</b> · Last update: {status?.captured_at ? new Date(status.captured_at).toLocaleString() : "—"}</p>{activeFlags.length > 0 && <p>Status: {activeFlags.map(flag => <span key={flag.key} title={flag.description}><b>{flag.label}</b>{" "}</span>)}</p>}{status?.warnings && <p>Warnings: <code>{status.warnings}</code></p>}{status?.error && <p className="error">{status.error}</p>}</div>
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
          <path className="flow-path muted" d="M 13 11.8 V 17.8 Q 13 20 15.2 20 H 25.5" />
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
      setData({ diagnostics: refreshed.diagnostics, latest: latestStatus });
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
        <DiagnosticsSummaryCard label="Mode" value={latest?.mode || "Unknown"} detail={formatDate(latest?.captured_at)} />
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
  output_source_priority: { "0": "Utility first", "1": "Solar first", "2": "SBU priority", utility: "Utility first", solar: "Solar first", sbu: "SBU priority" },
  charger_source_priority: { "0": "Utility first", "1": "Solar first", "2": "Solar and utility", "3": "Solar only", solar_first: "Solar first", solar_utility: "Solar and utility", solar: "Solar only" },
};

function formatRating(key: string, value: unknown, unit = "", digits = 1) {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value);
  const label = ratingValueLabels[key]?.[raw] || ratingValueLabels[key]?.[raw.toUpperCase()];
  if (label) return label;
  if (!unit) return String(value);
  return display(typeof value === "number" || typeof value === "string" ? value : null, unit, digits);
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

createRoot(document.getElementById("root")!).render(<App />);
