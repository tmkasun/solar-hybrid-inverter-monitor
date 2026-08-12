export type StatusFlag = { position: number; key: string; label: string; description: string; active: boolean };
export type StatusValues = Record<string, number | string | null> & { status_flags?: StatusFlag[] };
export type Status = { connected: boolean; mode: string | null; warnings: string | null; captured_at: string | null; error: string | null; status: StatusValues };
export type Choice = { value: string; label: string; command: string };
export type Capability = { key: string; label: string; warning: string; choices: Choice[] };
