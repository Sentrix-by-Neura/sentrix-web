import { supabase } from "./supabase-browser";
import type { Session } from "@supabase/supabase-js";

export type GroupRow = { id: string; name: string; mesh_id: string; description: string | null };
export type DeviceRow = {
  id: string; group_id: string | null; mac_address: string; name: string | null;
  status: "UNCLAIMED" | "CALIBRATING" | "ACTIVE" | "OFFLINE";
  calibration_started_at: string | null; calibration_ends_at: string | null;
  last_seen: string | null;
  archived_at?: string | null;
};
export type AlertRow = {
  id: string; device_id: string; group_id: string; timestamp: string;
  actual_value: number; expected_max: number; expected_min: number;
  severity: "WARNING" | "CRITICAL"; is_resolved: boolean; user_feedback: boolean | null;
};
export type ReadingRow = { timestamp: string; rms_current: number; max_rms_current: number };
export type BoundRow = { timestamp: string; lower_bound: number; upper_bound: number };

export async function authenticatedSession(): Promise<Session> {
  if (!supabase) throw new Error("Authentication is not configured. Contact your administrator.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Your session has expired. Log in again.");
  return data.session;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, session?: Session): Promise<T> {
  const base = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_GO_API_URL)?.replace(/\/$/, "");
  if (!base) throw new Error("The API address is not configured. Contact your administrator.");
  const auth = session ?? await authenticatedSession();
  let response: Response;
  try {
    response = await fetch(`${base}/api${path}`, {
      ...init, cache: "no-store", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${auth.access_token}` },
    });
  } catch {
    throw new Error("Cannot reach Sentrix. Check your connection and try again.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Sentrix request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function joinTelemetry(readings: ReadingRow[], bounds: BoundRow[]) {
  const hourly = new Map(bounds.map(b => [Date.parse(b.timestamp), b]));
  return readings.map(r => {
    const b = hourly.get(Math.floor(Date.parse(r.timestamp) / 3600000) * 3600000);
    return {
      timestamp: r.timestamp,
      timeLabel: new Date(r.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      rmsCurrent: r.rms_current,
      upperBound: b?.upper_bound ?? null, lowerBound: b?.lower_bound ?? null,
      isAnomaly: !!b && (r.rms_current > b.upper_bound || r.rms_current < b.lower_bound),
    };
  });
}
