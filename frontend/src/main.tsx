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
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const pvPower = numeric(values.pv_input_voltage) * numeric(values.pv_input_current);
  const loadPower = numeric(values.output_active_power_w);
  const chargePower = numeric(values.battery_voltage) * numeric(values.battery_charge_current);
  const dischargePower = numeric(values.battery_voltage) * numeric(values.battery_discharge_current);
  const batteryPower = chargePower ? chargePower : -dischargePower;
  const gridPower = loadPower + Math.max(0, batteryPower) - pvPower - Math.max(0, -batteryPower);
  const batteryPercent = Math.min(100, Math.max(0, numeric(values.battery_capacity_percent)));
  const updatePanels = (count: number) => { const safeCount = Math.min(24, Math.max(1, count || 1)); setPanelCount(safeCount); localStorage.setItem("sako_panel_count", String(safeCount)); };
  const hour = clock.getHours() + clock.getMinutes() / 60;
  const isNight = hour < 6 || hour >= 18;
  const daylight = Math.min(1, Math.max(0, (hour - 6) / 12));
  const skyX = isNight ? (hour < 6 ? 100 + hour * 26 : 1050 - (hour - 18) * 26) : 80 + daylight * 1040;
  const skyY = isNight ? 70 : 105 - Math.sin(daylight * Math.PI) * 60;
  const solarActive = pvPower > 1;
  const gridActive = Math.abs(gridPower) > 1;
  const batteryActive = Math.abs(batteryPower) > 1;
  const loadActive = loadPower > 1;
  const gridVoltage = numeric(values.grid_voltage);
  const solarLine = "M 744 242 V 300 H 610 V 370";
  const gridLine = "M 175 456 H 396 L 460 370 H 522";
  const batteryLine = "M 566 407 V 430";
  const loadLine = "M 610 370 H 705 V 418 H 840";
  const panelColumns = Math.min(6, Math.ceil(Math.sqrt(panelCount * 1.5)));
  const panelRows = Math.ceil(panelCount / panelColumns);
  const panelPoint = (column: number, row: number) => {
    const origin = { x: 590, y: 154 };
    const across = { x: 158, y: -93 };
    const down = { x: 152, y: 88 };
    return `${origin.x + across.x * column + down.x * row},${origin.y + across.y * column + down.y * row}`;
  };

  return <section className={`energy-flow panel ${isNight ? "night" : "day"}`} aria-label="Live energy flow">
    <div className="energy-flow-heading"><div><p className="eyebrow">Live energy flow</p><h2>Where your power is going</h2></div><label className="panel-count">Roof panels <input aria-label="Number of solar panels" type="number" min="1" max="24" value={panelCount} onChange={event => updatePanels(Number(event.target.value))} /></label></div>
    <div className="energy-diagram"><svg viewBox="30 25 1110 575" role="img" aria-label="House energy system: solar panels, CEB utility, battery and home load">
      <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter><linearGradient id="roof" x1="0" x2="1"><stop stopColor="#30586a"/><stop offset="1" stopColor="#1c3948"/></linearGradient><linearGradient id="wall" x1="0" x2="1"><stop stopColor="#b4d1cf"/><stop offset="1" stopColor="#dce9df"/></linearGradient></defs>
      <g className="sky-object" transform={`translate(${skyX} ${skyY})`}>{isNight ? <><circle r="18" className="moon" /><circle cx="8" cy="-6" r="18" className="moon-cut" /></> : <><circle r="12" className="sun" />{Array.from({ length: 8 }, (_, i) => <line key={i} x1="0" y1="-20" x2="0" y2="-28" transform={`rotate(${i * 45})`} />)}</>}</g>
      <g className="external-wires"><path className="wire-underlay" d={gridLine} /><path className={`wire grid-wire ${gridActive ? "active" : ""} ${gridPower < 0 ? "reverse" : ""}`} d={gridLine} /></g>
      <g className="source-label grid-label"><text x="56" y="488">CEB UTILITY</text><text className="source-reading" x="56" y="510">{gridVoltage ? <><tspan className="data-value">{gridVoltage.toFixed(0)} V</tspan><tspan> · </tspan><tspan className={gridActive ? "data-value" : "state-value"}>{gridActive ? watts(Math.abs(gridPower)) : "Standby"}</tspan></> : <tspan className="state-value">Unavailable</tspan>}</text></g><g className="source-label battery-label"><text x="515" y="523">BATTERY</text><text className="source-reading" x="515" y="545"><tspan className="data-value">{values.battery_capacity_percent ?? "—"}%</tspan><tspan> · </tspan><tspan className={batteryActive ? "data-value" : "state-value"}>{batteryActive ? watts(Math.abs(batteryPower)) : "Idle"}</tspan></text></g>
      <g className="grid-asset" transform="translate(90 372)"><path d="M 0 84 H 85 M 23 0 V 84 M 61 0 V 84 M 12 24 H 72 M 12 49 H 72" /><circle cx="23" cy="0" r="4"/><circle cx="61" cy="0" r="4"/></g>
      <g className="house"><path className="house-shadow" d="M 432 508 H 1090"/><path className="house-wall" d="M 460 245 L 750 90 L 1055 250 V 508 H 460 Z"/><path className="house-roof" d="M 424 254 L 748 54 L 1090 250 L 1057 276 L 750 122 L 454 277 Z"/><g className="roof-panel-array"><path className="roof-panels" d="M 590 154 L 748 61 L 900 149 L 742 242 Z"/>{Array.from({ length: panelCount }, (_, index) => {
          const column = index % panelColumns;
          const row = Math.floor(index / panelColumns);
          const gapX = 0.012;
          const gapY = 0.04;
          const left = column / panelColumns + gapX;
          const right = (column + 1) / panelColumns - gapX;
          const top = row / panelRows + gapY;
          const bottom = (row + 1) / panelRows - gapY;
          return <polygon key={index} className="roof-panel-cell" points={`${panelPoint(left, top)} ${panelPoint(right, top)} ${panelPoint(right, bottom)} ${panelPoint(left, bottom)}`} />;
        })}<path className="roof-panel-grid" d={`M ${panelPoint(.5, 0)} L ${panelPoint(.5, 1)} M ${panelPoint(0, .5)} L ${panelPoint(1, .5)}`} /></g><path className="house-trim" d="M 460 245 L 750 90 L 1055 250 M 750 90 V 508"/><rect className="door" x="862" y="372" width="78" height="136" rx="3"/><rect className="window" x="650" y="330" width="62" height="58" rx="3"/><path className="window-lines" d="M 681 330 V 388 M 650 359 H 712"/><rect className="window" x="964" y="330" width="48" height="52" rx="3"/><path className="window-lines" d="M 988 330 V 382 M 964 356 H 1012"/>
        <g className="house-wires"><path className="wire-underlay" d={solarLine} /><path className={`wire solar-wire ${solarActive ? "active" : ""}`} d={solarLine} /><path className="wire-underlay" d="M 460 370 H 522" /><path className={`wire grid-wire ${gridActive ? "active" : ""} ${gridPower < 0 ? "reverse" : ""}`} d="M 460 370 H 522" /><path className="wire-underlay" d={batteryLine} /><path className={`wire battery-wire ${batteryActive ? "active" : ""} ${batteryPower < 0 ? "reverse" : ""}`} d={batteryLine} /><path className="wire-underlay" d={loadLine} /><path className={`wire load-wire ${loadActive ? "active" : ""}`} d={loadLine} /></g>
        <g className="wire-nodes"><circle className="solar-node" cx="744" cy="242" r="5"/><circle className="solar-node" cx="610" cy="370" r="5"/><circle className="grid-node" cx="460" cy="370" r="5"/><circle className="battery-node" cx="566" cy="430" r="5"/><circle className="load-node" cx="705" cy="418" r="5"/><circle className="load-node" cx="840" cy="418" r="5"/></g>
        <g className="wall-inverter" transform="translate(522 332)"><rect width="88" height="75" rx="8"/><circle cx="44" cy="30" r="15"/><path d="M 44 18 L 35 35 H 46 L 41 45 L 54 27 H 44 Z"/><text x="44" y="63">INVERTER</text></g><g className="battery-asset" transform="translate(515 430)"><rect width="102" height="38" rx="6"/><rect className="battery-level" width={Math.max(3, batteryPercent * .9)} height="26" x="5" y="6" rx="2"/><path d="M 103 11 H 110 V 27 H 103" /></g><g className="metric-panel battery-metrics" transform="translate(332 445)"><rect width="164" height="82" rx="7"/><text x="12" y="24"><tspan>Voltage </tspan><tspan className="metric-value">{display(values.battery_voltage, " V")}</tspan></text><text x="12" y="45"><tspan>Charge </tspan><tspan className="metric-value">{display(values.battery_charge_current, " A", 0)}</tspan></text><text x="12" y="66"><tspan>Discharge </tspan><tspan className="metric-value">{display(values.battery_discharge_current, " A", 0)}</tspan></text></g><text className="home-title" x="805" y="514">HOME USAGE</text><text className="home-value" x="805" y="538">{loadPower > 1 ? watts(loadPower) : "No load data"}</text><g className="metric-panel load-metrics" transform="translate(730 548)"><rect width="152" height="46" rx="7"/><text x="12" y="28"><tspan>Load </tspan><tspan className="metric-value">{display(values.load_percent, "%", 0)}</tspan></text></g></g>
      <g className="metric-panel solar-metrics" transform="translate(790 250)"><rect width="180" height="82" rx="7"/><text className="metric-title" x="12" y="20">PV INPUT</text><text x="12" y="43"><tspan>Voltage </tspan><tspan className="metric-value">{display(values.pv_input_voltage, " V")}</tspan></text><text x="12" y="63"><tspan>Current </tspan><tspan className="metric-value">{display(values.pv_input_current, " A")}</tspan></text></g>
      <g className="metric-panel grid-metrics" transform="translate(124 514)"><rect width="168" height="64" rx="7"/><text x="12" y="24"><tspan>Freq </tspan><tspan className="metric-value">{display(values.grid_frequency, " Hz")}</tspan></text><text x="12" y="45"><tspan>Flow </tspan><tspan className="metric-value">{gridActive ? watts(Math.abs(gridPower)) : "0 W"}</tspan></text></g>
      <g className="wire-label"><g className="wire-tag" transform="translate(634 300)"><rect x="-66" y="-16" width="132" height="28" rx="5"/><text>{solarActive ? `${watts(pvPower)} solar` : "Solar standby"}</text></g><g className="wire-tag" transform="translate(302 432)"><rect x="-76" y="-16" width="152" height="28" rx="5"/><text>{gridActive ? `${gridPower < 0 ? "Exporting" : "Importing"} ${watts(Math.abs(gridPower))}` : "Grid standby"}</text></g></g>
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
