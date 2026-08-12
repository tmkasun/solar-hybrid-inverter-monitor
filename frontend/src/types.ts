export type Status = { connected: boolean; mode: string | null; warnings: string | null; captured_at: string | null; error: string | null; status: Record<string, number | string | null> };
export type Choice = { value: string; label: string; command: string };
export type Capability = { key: string; label: string; warning: string; choices: Choice[] };
