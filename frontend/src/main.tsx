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
  return <section><div className="summary">{Object.entries(labels).map(([key, label]) => <article key={key}><span>{label}</span><strong>{values[key] ?? "—"}</strong><small>{key.includes("power") ? "W" : key.includes("temperature") ? "°C" : key.includes("percent") ? "%" : "V"}</small></article>)}</div>
    <div className="panel"><h2>24-hour voltage trend</h2><div className="chart"><ResponsiveContainer><LineChart data={points}><XAxis dataKey="at" minTickGap={36}/><YAxis/><Tooltip/><Line type="monotone" dataKey="battery_voltage" stroke="#f7c948" dot={false}/><Line type="monotone" dataKey="pv_input_voltage" stroke="#50c878" dot={false}/></LineChart></ResponsiveContainer></div></div>
    <div className="panel details"><h2>Current state</h2><p>Mode: <b>{status?.mode || "—"}</b> · Last update: {status?.captured_at ? new Date(status.captured_at).toLocaleString() : "—"}</p>{activeFlags.length > 0 && <p>Status: {activeFlags.map(flag => <span key={flag.key} title={flag.description}><b>{flag.label}</b>{" "}</span>)}</p>}{status?.warnings && <p>Warnings: <code>{status.warnings}</code></p>}{status?.error && <p className="error">{status.error}</p>}</div>
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
