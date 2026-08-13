import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import type { Capability, Status, StatusValues } from "./types";
import "./styles.css";

const labels: Record<string, string> = {
  grid_voltage: "Grid", pv_input_voltage: "PV", battery_voltage: "Battery", output_active_power_w: "Load", load_percent: "Load %", inverter_temperature_c: "Inverter temp"
};

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<Array<Record<string, number | string | null>>>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [tab, setTab] = useState<"overview" | "settings" | "diagnostics">("overview");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(Boolean(sessionStorage.getItem("sako_csrf")));
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [nextStatus, nextHistory, nextCapabilities] = await Promise.all([api.status(), api.history(), api.capabilities()]);
      setStatus(nextStatus); setHistory(nextHistory.samples); setCapabilities(nextCapabilities.capabilities);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to reach API"); }
  };
  useEffect(() => { void load(); const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`); socket.onmessage = event => { const data = JSON.parse(event.data); if (data.type === "telemetry" || data.type === "connection") setStatus(data.data); if (data.type === "command_result") setMessage(data.data.ok ? "Inverter setting applied." : `Command failed: ${data.data.error}`); }; return () => socket.close(); }, []);

  const login = async (event: FormEvent) => { event.preventDefault(); try { await api.login(password); setAuthenticated(true); setPassword(""); setMessage("Signed in."); } catch (error) { setMessage(error instanceof Error ? error.message : "Login failed"); } };
  const logout = async () => { await api.logout(); setAuthenticated(false); setMessage("Signed out."); };
  const points = useMemo(() => history.map((sample) => ({ ...sample, at: new Date(String(sample.captured_at)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })), [history]);

  return <main>
    <header><div><h1>Sako Energy</h1><p>Local inverter monitoring and control</p></div><div className={`connection ${status?.connected ? "ok" : "offline"}`}>{status?.connected ? "Inverter connected" : "Inverter offline"}</div></header>
    <nav>{(["overview", "settings", "diagnostics"] as const).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {message && <div className="notice">{message}<button onClick={() => setMessage("")}>×</button></div>}
    {tab === "overview" && <Overview status={status} points={points} />}
    {tab === "settings" && <Settings authenticated={authenticated} capabilities={capabilities} login={login} password={password} setPassword={setPassword} logout={logout} onChange={async (key, value) => { try { await api.change(key, value); await load(); setMessage("Inverter acknowledged the change."); } catch (e) { setMessage(e instanceof Error ? e.message : "Change failed"); } }} />}
    {tab === "diagnostics" && <Diagnostics authenticated={authenticated} />}
  </main>;
}

function Overview({ status, points }: { status: Status | null; points: Array<Record<string, number | string | null>> }) {
  const values: StatusValues = status?.status || {};
  const activeFlags = values.status_flags?.filter(flag => flag.active) || [];
  return <section><EnergyFlow values={values} connected={Boolean(status?.connected)} />
    <div className="summary">{Object.entries(labels).map(([key, label]) => <article key={key}><span>{label}</span><strong>{values[key] ?? "—"}</strong><small>{key.includes("power") ? "W" : key.includes("temperature") ? "°C" : key.includes("percent") ? "%" : "V"}</small></article>)}</div>
    <div className="panel"><h2>24-hour voltage trend</h2><div className="chart"><ResponsiveContainer><LineChart data={points}><XAxis dataKey="at" minTickGap={36}/><YAxis/><Tooltip/><Line type="monotone" dataKey="battery_voltage" stroke="#f7c948" dot={false}/><Line type="monotone" dataKey="pv_input_voltage" stroke="#50c878" dot={false}/></LineChart></ResponsiveContainer></div></div>
    <div className="panel details"><h2>Current state</h2><p>Mode: <b>{status?.mode || "—"}</b> · Last update: {status?.captured_at ? new Date(status.captured_at).toLocaleString() : "—"}</p>{activeFlags.length > 0 && <p>Status: {activeFlags.map(flag => <span key={flag.key} title={flag.description}><b>{flag.label}</b>{" "}</span>)}</p>}{status?.warnings && <p>Warnings: <code>{status.warnings}</code></p>}{status?.error && <p className="error">{status.error}</p>}</div>
  </section>;
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
  const [panelCount, setPanelCount] = useState(() => Number(localStorage.getItem("sako_panel_count")) || 8);
  const pvPower = numeric(values.pv_input_voltage) * numeric(values.pv_input_current);
  const loadPower = numeric(values.output_active_power_w);
  const chargePower = numeric(values.battery_voltage) * numeric(values.battery_charge_current);
  const dischargePower = numeric(values.battery_voltage) * numeric(values.battery_discharge_current);
  const batteryPower = chargePower ? chargePower : -dischargePower;
  const gridPower = loadPower + Math.max(0, batteryPower) - pvPower - Math.max(0, -batteryPower);
  const batteryPercent = Math.min(100, Math.max(0, numeric(values.battery_capacity_percent)));
  const updatePanels = (count: number) => { const safeCount = Math.min(24, Math.max(1, count || 1)); setPanelCount(safeCount); localStorage.setItem("sako_panel_count", String(safeCount)); };
  const solarActive = pvPower > 1;
  const gridActive = Math.abs(gridPower) > 1;
  const batteryActive = Math.abs(batteryPower) > 1;
  const loadActive = loadPower > 1;
  const gridDirection = gridPower < -1 ? "Exporting" : gridPower > 1 ? "Importing" : "Standby";
  const batteryDirection = chargePower > 1 ? "Charging" : dischargePower > 1 ? "Discharging" : "Idle";
  const panelColumns = Math.min(6, Math.ceil(Math.sqrt(panelCount * 1.35)));
  const panelRows = Math.ceil(panelCount / panelColumns);
  const panelPoint = (column: number, row: number) => {
    const origin = { x: 318, y: 220 };
    const across = { x: 286, y: -39 };
    const down = { x: 78, y: 88 };
    return `${origin.x + across.x * column + down.x * row},${origin.y + across.y * column + down.y * row}`;
  };
  return <section className="energy-flow panel" aria-label="Live energy flow">
    <div className="energy-flow-heading"><div><p className="eyebrow">Live energy flow</p><h2>Where your power is going</h2></div><label className="panel-count">Roof panels <input aria-label="Number of solar panels" type="number" min="1" max="24" value={panelCount} onChange={event => updatePanels(Number(event.target.value))} /></label></div>
    <div className="energy-diagram"><svg viewBox="0 0 1460 760" role="img" aria-label="House energy system with solar, inverter, battery, load and grid telemetry">
      <defs><filter id="card-shadow" x="-30%" y="-40%" width="160%" height="190%"><feDropShadow dx="0" dy="14" stdDeviation="17" floodColor="#1b2935" floodOpacity=".14"/></filter><linearGradient id="roofFace" x1="0" x2="1"><stop stopColor="#dce2e8"/><stop offset="1" stopColor="#bfc9d4"/></linearGradient><linearGradient id="wallFace" x1="0" x2="1"><stop stopColor="#ffffff"/><stop offset="1" stopColor="#eef2f6"/></linearGradient><linearGradient id="ground" x1="0" x2="1"><stop stopColor="#f7f9fb"/><stop offset="1" stopColor="#e8edf2"/></linearGradient></defs>
      <rect className="diagram-canvas" width="1460" height="760"/>
      <ellipse className="diagram-glow" cx="520" cy="438" rx="520" ry="235"/>
      <g className="site-base"><path d="M 78 585 L 427 438 L 833 545 L 502 705 Z"/><path d="M 78 585 V 610 L 502 730 V 705 Z"/><path d="M 502 705 L 833 545 V 570 L 502 730 Z"/></g>
      <g className="house-illustration">
        <path className="house-side" d="M 366 313 L 668 275 L 668 526 L 366 594 Z"/>
        <path className="house-front" d="M 149 334 L 366 313 V 594 L 149 531 Z"/>
        <path className="house-gable" d="M 149 334 L 263 196 L 366 313 Z"/>
        <path className="house-roof-main" d="M 263 196 L 623 147 L 720 264 L 366 313 Z"/>
        <path className="house-roof-left" d="M 108 330 L 263 196 L 366 313 L 149 334 Z"/>
        <path className="roof-panels" d="M 318 220 L 604 181 L 682 269 L 396 308 Z"/>
        <g className="roof-panel-array">{Array.from({ length: panelCount }, (_, index) => {
          const column = index % panelColumns;
          const row = Math.floor(index / panelColumns);
          const gapX = 0.012;
          const gapY = 0.04;
          const left = column / panelColumns + gapX;
          const right = (column + 1) / panelColumns - gapX;
          const top = row / panelRows + gapY;
          const bottom = (row + 1) / panelRows - gapY;
          return <polygon key={index} className="roof-panel-cell" points={`${panelPoint(left, top)} ${panelPoint(right, top)} ${panelPoint(right, bottom)} ${panelPoint(left, bottom)}`} />;
        })}</g>
        <rect className="window" x="205" y="382" width="82" height="70" rx="2"/><path className="window-line" d="M 246 384 V 450 M 206 419 H 285"/>
        <rect className="window small" x="421" y="375" width="52" height="42" rx="2"/><path className="window-line" d="M 447 376 V 417 M 422 397 H 472"/>
        <path className="garage" d="M 690 404 L 812 378 V 515 L 690 548 Z"/><path className="garage-lines" d="M 704 425 L 799 405 M 704 449 L 799 429 M 704 473 L 799 453 M 704 497 L 799 477"/>
        <path className="door" d="M 326 470 L 396 455 V 580 L 326 598 Z"/>
        <g className="inverter" transform="translate(520 342)"><text x="33" y="-18">Inverter</text><rect width="72" height="92" rx="9"/><circle cx="36" cy="25" r="8"/><path d="M 36 15 L 28 29 H 38 L 34 42 L 47 22 H 37 Z"/><rect x="24" y="62" width="30" height="14" rx="3"/></g>
        <g className="battery-device" transform="translate(505 500)"><rect width="84" height="112" rx="10"/><rect x="30" y="46" width="25" height="40" rx="3"/><rect x="36" y="38" width="13" height="8" rx="2"/><rect className="battery-fill" x="35" y={82 - batteryPercent * .32} width="15" height={Math.max(3, batteryPercent * .32)} rx="1"/></g>
      </g>
      <g className="grid-tower" transform="translate(930 470)"><path d="M 50 0 L 10 165 M 50 0 L 90 165 M 25 105 H 75 M 17 137 H 83 M 34 60 H 66 M 30 31 H 70 M 50 0 V 165 M 16 48 H 84 M 0 72 H 100" /></g>
      <g className="flow-paths">
        <path className="flow-path muted" d="M 205 164 V 198 Q 205 220 227 220 H 318"/>
        <path className={`flow-path ${solarActive ? "active" : ""}`} d="M 492 294 L 532 326 Q 548 342 556 342"/>
        <path className={`flow-path ${loadActive ? "active" : ""}`} d="M 592 386 H 756 Q 784 386 784 316 H 811"/>
        <path className={`flow-path ${batteryActive ? "active" : ""} ${batteryPower < 0 ? "reverse" : ""}`} d="M 556 434 V 466 Q 556 492 547 500"/>
        <path className={`flow-path ${gridActive ? "active" : ""} ${gridPower < 0 ? "reverse" : ""}`} d="M 592 416 H 760 Q 792 416 792 470 H 948 Q 980 470 980 502 V 530"/>
      </g>
      <g className="flow-nodes"><circle cx="318" cy="220" r="6"/><circle cx="492" cy="294" r="6"/><circle cx="556" cy="342" r="7"/><circle cx="592" cy="386" r="7"/><circle cx="811" cy="316" r="6"/><circle cx="556" cy="434" r="7"/><circle cx="547" cy="500" r="6"/><circle cx="792" cy="470" r="7"/><circle cx="980" cy="530" r="6"/></g>
      <g className="callout-card pv-card" transform="translate(116 62)"><rect width="178" height="102" rx="12"/><g className="sun-icon" transform="translate(36 42)"><circle r="11"/>{Array.from({ length: 8 }, (_, i) => <line key={i} y1="-20" y2="-28" transform={`rotate(${i * 45})`} />)}</g><text className="card-title" x="74" y="36">PV</text><text className="card-value" x="74" y="72">{pvPower > 1 ? watts(pvPower) : "0 W"}</text><text className="card-detail" x="74" y="94">{display(values.pv_input_voltage, " V")} / {display(values.pv_input_current, " A")}</text></g>
      <g className="callout-card load-card" transform="translate(811 267)"><rect width="176" height="98" rx="12"/><path className="line-icon" d="M 27 51 V 27 L 50 8 L 73 27 V 51 H 58 V 34 H 42 V 51 Z"/><text className="card-title" x="86" y="38">Load</text><text className="card-value" x="86" y="74">{loadPower > 1 ? watts(loadPower) : "0 W"}</text><text className="card-detail" x="86" y="94">{display(values.load_percent, "%", 0)} · {display(values.output_voltage, " V")}</text></g>
      <g className="callout-card battery-card" transform="translate(442 638)"><rect width="190" height="96" rx="12"/><path className="soft-icon" d="M 25 18 H 48 V 62 H 25 Z M 31 12 H 42 V 18 M 31 44 H 42 M 31 53 H 42"/><text className="card-title" x="77" y="33">Battery</text><text className="card-value" x="77" y="68">{batteryActive ? watts(Math.abs(batteryPower)) : "0 W"}</text><text className="card-detail accent" x="77" y="89">{batteryPercent.toFixed(0)}% · {batteryDirection}</text></g>
      <g className="callout-card grid-card" transform="translate(777 638)"><rect width="180" height="96" rx="12"/><path className="soft-icon tower" d="M 40 14 L 20 70 M 40 14 L 60 70 M 28 50 H 52 M 24 62 H 56 M 32 32 H 48 M 40 14 V 70"/><text className="card-title" x="78" y="33">Grid</text><text className="card-value" x="78" y="68">{gridActive ? watts(Math.abs(gridPower)) : "0 W"}</text><text className="card-detail accent" x="78" y="89">{gridDirection}</text></g>
      <g className="overview-card" transform="translate(1074 69)"><rect width="332" height="626" rx="20"/><text className="overview-title" x="36" y="58">Overview</text><circle className={connected ? "live-dot on" : "live-dot"} cx="278" cy="52" r="5"/><text className="live-label" x="292" y="58">{connected ? "Live" : "Offline"}</text>
        <g className="overview-row" transform="translate(26 92)"><rect width="280" height="82" rx="10"/><path className="line-icon" d="M 24 49 V 24 H 62 V 49 M 33 18 V 30 M 53 18 V 30 M 31 35 H 37 M 43 35 H 49 M 55 35 H 61 M 31 44 H 37 M 43 44 H 49 M 55 44 H 61"/><text className="row-label" x="96" y="34">PV Input</text><text className="row-value compact" x="96" y="66">{display(values.pv_input_voltage, " V")} · {display(values.pv_input_current, " A")}</text></g>
        <g className="overview-row" transform="translate(26 174)"><rect width="280" height="82"/><path className="line-icon" d="M 33 18 H 52 V 59 H 33 Z M 38 12 H 47 V 18 M 39 43 H 46"/><text className="row-label" x="96" y="31">Battery SOC</text><text className="row-value" x="96" y="60">{batteryPercent.toFixed(0)}%</text><rect className="soc-track" x="96" y="68" width="160" height="6" rx="3"/><rect className="soc-fill" x="96" y="68" width={Math.max(3, batteryPercent * 1.6)} height="6" rx="3"/></g>
        <g className="overview-row" transform="translate(26 256)"><rect width="280" height="82"/><path className="line-icon" d="M 24 52 V 28 L 44 12 L 64 28 V 52 H 52 V 36 H 36 V 52 Z"/><text className="row-label" x="96" y="32">Home Load</text><text className="row-value" x="96" y="64">{loadPower > 1 ? watts(loadPower) : "0 W"}</text></g>
        <g className="overview-row" transform="translate(26 338)"><rect width="280" height="82"/><path className="line-icon" d="M 44 14 L 24 62 M 44 14 L 64 62 M 31 48 H 57 M 28 59 H 60 M 36 31 H 52 M 44 14 V 62"/><text className="row-label" x="96" y="28">Grid</text><text className="row-value" x="96" y="58">{gridActive ? watts(Math.abs(gridPower)) : "0 W"}</text><text className="row-note" x="96" y="76">{gridDirection} · {display(values.grid_voltage, " V", 0)} · {display(values.grid_frequency, " Hz")}</text></g>
        <g className="overview-row" transform="translate(26 420)"><rect width="280" height="82"/><path className="line-icon" d="M 25 48 H 36 L 43 24 L 51 64 L 59 39 H 69"/><text className="row-label" x="96" y="28">Battery Current</text><text className="row-value compact" x="96" y="58">{display(values.battery_charge_current, " A", 0)} / {display(values.battery_discharge_current, " A", 0)}</text><text className="row-note" x="96" y="76">charge / discharge</text></g>
        <g className="overview-row" transform="translate(26 502)"><rect width="280" height="82" rx="10"/><path className="line-icon" d="M 44 18 V 52 M 35 27 H 53 M 35 43 H 53 M 30 60 H 58"/><text className="row-label" x="96" y="32">Inverter Temp</text><text className="row-value" x="96" y="64">{display(values.inverter_temperature_c, "°C")}</text></g>
      </g>
    </svg></div>
    <div className="flow-legend"><span><i className="legend-dot solar" />Solar production</span><span><i className="legend-dot battery" />Battery storage</span><span><i className="legend-dot grid" />CEB utility</span><span>Live values update automatically</span></div>
  </section>;
}

function Settings({ authenticated, capabilities, login, password, setPassword, logout, onChange }: { authenticated: boolean; capabilities: Capability[]; login: (event: FormEvent) => Promise<void>; password: string; setPassword: (v: string) => void; logout: () => Promise<void>; onChange: (key: string, value: string) => Promise<void> }) {
  if (!authenticated) return <section className="panel login"><h2>Administrator sign in</h2><p>Settings require the local administrator password.</p><form onSubmit={login}><input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"/><button>Sign in</button></form></section>;
  return <section><div className="section-title"><h2>Inverter settings</h2><button className="quiet" onClick={() => void logout()}>Sign out</button></div>{capabilities.map(capability => <article className="panel setting" key={capability.key}><h3>{capability.label}</h3><p>{capability.warning}</p><div>{capability.choices.map(choice => <button key={choice.value} onClick={() => { if (window.confirm(`${capability.warning}\n\nApply “${choice.label}”?`)) void onChange(capability.key, choice.value); }}>{choice.label}</button>)}</div></article>)}</section>;
}

function Diagnostics({ authenticated }: { authenticated: boolean }) {
  const [data, setData] = useState<unknown>(null); const [error, setError] = useState("");
  const load = async () => { try { setData(await api.diagnostics()); } catch (e) { setError(e instanceof Error ? e.message : "Sign in first"); } };
  return <section className="panel"><h2>Diagnostics</h2><p>Identity, firmware, ratings, flags, and raw protocol replies are restricted to the administrator.</p><button disabled={!authenticated} onClick={() => void load()}>Load diagnostics</button>{error && <p className="error">{error}</p>}{data !== null && <pre>{JSON.stringify(data, null, 2)}</pre>}</section>;
}

createRoot(document.getElementById("root")!).render(<App />);
