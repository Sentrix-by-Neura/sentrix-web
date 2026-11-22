"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { supabase } from "./supabase-browser";
import { apiRequest, authenticatedSession, joinTelemetry, type GroupRow, type DeviceRow, type AlertRow, type ReadingRow, type BoundRow, type OperatingReading } from "./sentrix-api";
import type { TelemetryHistoryResponse } from "./sentrix-api";
import { loadAllDeviceLocationMeta, saveDeviceLocationMeta, type DeviceLocationMeta } from "./device-location-meta";

export type Group = { id: string; name: string; slug: string; meshId: string; description: string };
export type DeviceStatus = "CALIBRATING" | "ACTIVE" | "OFFLINE";
export type Device = {
  id: string; groupId: string; name: string; macAddress: string; status: DeviceStatus;
  calibrationStartedAt: string; calibrationEndsAt: string; lastSeen: string | null;
  archivedAt: string | null;
  mqttConnected: boolean | null;
  unitName?: string;
  roomLocation?: string;
  locationPhotoUrl?: string;
};
export type DeviceClaim = { id: string; setup_token: string; expires_at: string };
export type DeviceClaimStatus = { id: string; status: "pending" | "confirmed" | "expired"; expires_at: string; device?: DeviceRow };
export type AlertSeverity = "WARNING" | "CRITICAL";
export type Alert = {
  id: string; deviceId: string; groupId: string; timestamp: string; actualValue: number;
  expectedMax: number; expectedMin: number; severity: AlertSeverity; isResolved: boolean;
  userFeedback: boolean | null;
};
export type TelemetryRange = "1h" | "24h" | "7d";
export type TelemetryPoint = ReturnType<typeof joinTelemetry>[number];
export type UserProfile = { name: string; email: string; avatarUrl?: string; role: string; phone?: string; department?: string };
export const DEFAULT_USER_PROFILE: UserProfile = { name: "User", email: "", role: "Operator", department: "", phone: "", avatarUrl: "" };
type StoreState = { groups: Group[]; devices: Device[]; alerts: Alert[]; userProfile: UserProfile; ready: boolean; error: string | null; userId: string | null };
const empty = (): StoreState => ({ groups: [], devices: [], alerts: [], userProfile: DEFAULT_USER_PROFILE, ready: false, error: null, userId: null });
let state = empty();
let epoch = 0;
let refreshSequence = 0;
const listeners = new Set<() => void>();
const pendingMutations = new Set<string>();
const serverSnapshot = empty();
function publish(next: StoreState) { state = next; listeners.forEach(l => l()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function resetAccount(userId: string | null) { epoch++; refreshSequence++; publish({ ...empty(), userId }); }
const message = (error: unknown) => error instanceof Error ? error.message : "Sentrix request failed. Try again.";
const mac = (value: string) => value.replace(/[:-]/g, "").trim().toUpperCase();
export const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "group";
export function findGroup(groups: Group[], route: string) {
  const exact = groups.find(g => g.id === route || g.slug === route);
  if (exact) return exact;
  const legacy = groups.filter(g => slugify(g.name) === route);
  return legacy.length === 1 ? legacy[0] : undefined;
}
const mapGroup = (g: GroupRow): Group => ({ id: g.id, name: g.name, slug: `${slugify(g.name)}-${g.id}`, meshId: g.mesh_id, description: g.description ?? "" });
const mapDevice = (d: DeviceRow, localMeta?: DeviceLocationMeta): Device => ({
  id: d.id, groupId: d.group_id ?? "", name: d.name || `Sensor ${d.mac_address}`,
  macAddress: mac(d.mac_address).match(/../g)?.join(":") ?? d.mac_address,
  status: d.status === "UNCLAIMED" ? "OFFLINE" : d.status,
  calibrationStartedAt: d.calibration_started_at ?? "", calibrationEndsAt: d.calibration_ends_at ?? "", lastSeen: d.last_seen,
  archivedAt: d.archived_at ?? null,
  mqttConnected: d.mqtt_connected ?? null,
  unitName: localMeta?.unitName ?? d.unit_name ?? undefined,
  roomLocation: localMeta?.roomLocation ?? d.room_location ?? undefined,
  locationPhotoUrl: localMeta?.locationPhotoUrl ?? d.location_photo_url ?? undefined,
});
const mapAlert = (a: AlertRow): Alert => ({ id: a.id, deviceId: a.device_id, groupId: a.group_id, timestamp: a.timestamp,
  actualValue: a.actual_value, expectedMax: a.expected_max, expectedMin: a.expected_min, severity: a.severity, isResolved: a.is_resolved, userFeedback: a.user_feedback });

export async function refreshData() {
  let owner = epoch;
  let sequence = ++refreshSequence;
  try {
    const session = await authenticatedSession();
    if (owner !== epoch || sequence !== refreshSequence) return;
    if (state.userId !== session.user.id) {
      resetAccount(session.user.id);
      owner = epoch;
      sequence = ++refreshSequence;
    }
    const groups = (await apiRequest<GroupRow[]>("/groups", {}, session)).map(mapGroup);
    const [deviceLists, alerts, profile] = await Promise.all([
      Promise.all(groups.map(g => apiRequest<DeviceRow[]>(`/groups/${g.id}/devices`, {}, session))),
      apiRequest<AlertRow[]>("/alerts?status=all&limit=200", {}, session),
      supabase!.from("users").select("name,role").eq("id", session.user.id).maybeSingle(),
    ]);
    if (owner !== epoch || sequence !== refreshSequence) return;
    if (profile.error) throw new Error("Could not load your profile. Try refreshing.");
    const localMetaMap = loadAllDeviceLocationMeta(session.user.id);
    publish({ groups, devices: deviceLists.flat().map(d => mapDevice(d, localMetaMap[d.id])), alerts: alerts.map(mapAlert), ready: true, error: null, userId: session.user.id,
      userProfile: { ...DEFAULT_USER_PROFILE, name: session.user.user_metadata?.full_name || profile.data?.name || "User", email: session.user.email ?? "", role: profile.data?.role === "ADMIN" ? "System Administrator" : "Operator", avatarUrl: session.user.user_metadata?.avatar_url ?? "" } });
  } catch (error) {
    if (owner === epoch && sequence === refreshSequence) publish({ ...state, ready: true, error: message(error) });
  }
}

async function mutation<T>(path: string, init: RequestInit, apply: (result: T) => void) {
  const owner = epoch;
  const pendingKey = `${owner}:${path}`;
  if (pendingMutations.has(pendingKey)) throw new Error("This request is already in progress.");
  pendingMutations.add(pendingKey);
  try {
    const session = await authenticatedSession();
    if (owner !== epoch || state.userId !== session.user.id) throw new Error("Account changed. Refresh before continuing.");
    const result = await apiRequest<T>(path, init, session);
    if (owner !== epoch) throw new Error("Account changed. Refresh before continuing.");
    refreshSequence++; // An older list request must not overwrite this completed mutation.
    apply(result);
    return result;
  } catch (error) {
    if (owner === epoch) publish({ ...state, error: message(error) });
    throw error;
  } finally {
    pendingMutations.delete(pendingKey);
  }
}

async function createGroup(name: string, description = ""): Promise<Group> {
  const row = await mutation<GroupRow>("/groups", { method: "POST", body: JSON.stringify({ name: name.trim(), description: description.trim() }) }, row => {
    publish({ ...state, error: null, groups: [...state.groups, mapGroup(row)] });
  });
  return mapGroup(row);
}
export async function claimDevice(groupId: string, payload: { name: string; macAddress: string }): Promise<DeviceClaim> {
  return mutation<DeviceClaim>(`/groups/${groupId}/devices`, { method: "POST", body: JSON.stringify({ name: payload.name, mac: payload.macAddress }) }, claim => {
    if (!claim?.id || !/^[0-9a-f]{64}$/.test(claim.setup_token) || !Number.isFinite(Date.parse(claim.expires_at)) || Date.parse(claim.expires_at) <= Date.now()) {
      throw new Error("Invalid setup challenge. Check that the backend is updated, then restart sensor setup.");
    }
    publish({ ...state, error: null });
  });
}
export async function getDeviceClaim(groupId: string, claimId: string, signal?: AbortSignal): Promise<DeviceClaimStatus> {
  const owner = epoch;
  const session = await authenticatedSession();
  if (owner !== epoch || state.userId !== session.user.id) throw new Error("Account changed. Refresh before continuing.");
  const result = await apiRequest<DeviceClaimStatus>(`/groups/${groupId}/device-claims/${encodeURIComponent(claimId)}`, { signal }, session);
  if (owner !== epoch) throw new Error("Account changed. Refresh before continuing.");
  if (result?.id !== claimId || !["pending", "confirmed", "expired"].includes(result.status) ||
      (result.status === "confirmed" && (!result.device?.id || result.device.group_id !== groupId || !!result.device.archived_at))) {
    throw new Error("Invalid device confirmation. Refresh the dashboard before retrying.");
  }
  if (result.status === "confirmed" && result.device) {
    const device = mapDevice(result.device);
    refreshSequence++;
    publish({ ...state, devices: [...state.devices.filter(d => d.id !== device.id), device] });
  }
  return result;
}
async function deleteGroup(id: string) {
  await mutation<void>(`/groups/${id}`, { method: "DELETE" }, () => publish({ ...state, error: null, groups: state.groups.filter(g => g.id !== id) }));
}
async function deleteDevice(id: string) {
  await mutation<void>(`/devices/${id}`, { method: "DELETE" }, () => publish({ ...state, error: null, devices: state.devices.filter(d => d.id !== id), alerts: state.alerts.filter(a => a.deviceId !== id) }));
}
async function submitAlertFeedback(id: string, feedback: boolean) {
  await mutation<AlertRow>(`/alerts/${id}/feedback`, { method: "PATCH", body: JSON.stringify({ user_feedback: feedback }) }, row => publish({ ...state, error: null, alerts: state.alerts.map(a => a.id === id ? mapAlert(row) : a) }));
}
async function resolveAlert(id: string) {
  await mutation<AlertRow>(`/alerts/${id}/resolve`, { method: "PATCH" }, row => publish({ ...state, error: null, alerts: state.alerts.map(a => a.id === id ? mapAlert(row) : a) }));
}

async function updateUserProfile(updates: Partial<UserProfile>) {
  const owner = epoch;
  const session = await authenticatedSession();
  if (owner !== epoch || session.user.id !== state.userId) throw new Error("Account changed. Refresh before continuing.");
  const { data, error } = await supabase!.auth.updateUser({ data: { full_name: updates.name ?? state.userProfile.name, avatar_url: updates.avatarUrl ?? state.userProfile.avatarUrl } });
  if (error) throw new Error(error.message);
  if (owner !== epoch || data.user.id !== state.userId) throw new Error("Account changed. Refresh before continuing.");
  const userProfile = { ...state.userProfile, ...updates, email: data.user.email ?? state.userProfile.email };
  publish({ ...state, userProfile });
  return userProfile;
}
const clearUserAvatar = () => updateUserProfile({ avatarUrl: "" });
const resetUserProfile = () => updateUserProfile({ avatarUrl: "" });

export function useTelemetry(deviceId: string, range: TelemetryRange) {
  const { userId } = useSentrix();
  const [result, setResult] = useState<{ key: string; points: TelemetryPoint[]; loading: boolean; error: string | null }>({ key: "", points: [], loading: true, error: null });
  const key = `${userId}:${epoch}:${deviceId}:${range}`;
  useEffect(() => {
    if (!userId || !deviceId) return;
    let cancelled = false;
    const controller = new AbortController();
    const owner = epoch;
    async function load() {
      try {
        const session = await authenticatedSession();
        if (cancelled || owner !== epoch || session.user.id !== userId) return;
        const [readings, bounds] = await Promise.all([
          apiRequest<{ points: ReadingRow[] }>(`/devices/${deviceId}/telemetry?range=${range}`, { signal: controller.signal }, session),
          apiRequest<{ bounds: BoundRow[] }>(`/devices/${deviceId}/bounds?range=${range}`, { signal: controller.signal }, session),
        ]);
        if (!cancelled && owner === epoch) setResult({ key, points: joinTelemetry(readings.points, bounds.bounds), loading: false, error: null });
      } catch (error) {
        if (!cancelled && owner === epoch) setResult({ key, points: [], loading: false, error: message(error) });
      }
    }
    void load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); };
  }, [userId, deviceId, range, key]);
  return result.key === key ? result : { points: [], loading: !!userId, error: null };
}

type HistoryWindow = {
  start: number; end: number; oldest: number | null; latest: number | null;
  range: TelemetryRange; points: TelemetryPoint[];
};

export function useTelemetryHistory(deviceId: string, range: TelemetryRange, end: number | null, windowCount: number) {
  const { userId } = useSentrix();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    scope: string; key: string; history: HistoryWindow | null; error: string | null;
  }>();
  const scope = `${userId}:${epoch}:${deviceId}`;
  const key = `${scope}:${range}:${end}:${windowCount}:${attempt}`;

  useEffect(() => {
    if (!userId || !deviceId) return;
    const controller = new AbortController();
    const owner = epoch;
    const path = `/devices/${encodeURIComponent(deviceId)}/history`;
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const session = await authenticatedSession();
        if (controller.signal.aborted || owner !== epoch || session.user.id !== userId) return;
        function loadWindow(until: number | null) {
          const query = new URLSearchParams({ range });
          if (until !== null) query.set("end", new Date(until).toISOString());
          return apiRequest<TelemetryHistoryResponse>(`${path}?${query}`, { signal: controller.signal }, session);
        }

        const data = await loadWindow(end);
        let start = Date.parse(data.start);
        const oldest = data.oldest === null ? null : Date.parse(data.oldest);
        const samples = new Map(joinTelemetry(data.points, data.bounds).map(point => [point.timestamp, point]));
        for (let i = 1; i < windowCount && oldest !== null && start > oldest; i++) {
          const previous = await loadWindow(start - 1);
          const previousStart = Date.parse(previous.start);
          if (previousStart >= start) break;
          for (const point of joinTelemetry(previous.points, previous.bounds)) {
            if (!samples.has(point.timestamp)) samples.set(point.timestamp, point);
          }
          start = previousStart;
        }
        if (controller.signal.aborted || owner !== epoch) return;
        setResult({
          scope, key, error: null,
          history: {
            start, end: Date.parse(data.end), oldest, range,
            latest: data.latest === null ? null : Date.parse(data.latest),
            points: [...samples.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
          },
        });
      } catch (error) {
        if (!controller.signal.aborted && owner === epoch) {
          setResult(previous => ({
            scope, key, history: previous?.scope === scope ? previous.history : null, error: message(error),
          }));
        }
      }
      if (end === null && !controller.signal.aborted && owner === epoch) timer = setTimeout(load, 60000);
    }

    timer = setTimeout(load, end === null && windowCount === 1 ? 0 : 150);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [userId, deviceId, range, end, windowCount, scope, key]);

  return {
    history: result?.scope === scope ? result.history : null,
    loading: !!userId && result?.key !== key,
    error: result?.key === key ? result.error : null,
    retry: () => setAttempt(value => value + 1),
  };
}

export function hasRecentContact(device: Device) {
  const now = Date.now();
  const seen = device.lastSeen ? Date.parse(device.lastSeen) : NaN;
  return !device.archivedAt && device.status !== "OFFLINE" && device.mqttConnected !== false &&
    Number.isFinite(seen) && seen <= now + 5000 && now - seen < 90000;
}

export function hasRecentReading(reading: OperatingReading | null) {
  const now = Date.now(), timestamp = reading ? Date.parse(reading.timestamp) : NaN;
  return Number.isFinite(timestamp) && timestamp <= now + 5000 && now - timestamp < 90000;
}

export function useOperatingState(deviceId: string) {
  const { userId } = useSentrix();
  const key = `${userId}:${epoch}:${deviceId}`;
  const [result, setResult] = useState<{ key: string; reading: OperatingReading | null; loading: boolean; error: string | null }>({ key: "", reading: null, loading: true, error: null });
  useEffect(() => {
    if (!userId || !deviceId) return;
    let cancelled = false, pending = false;
    const controller = new AbortController(), owner = epoch;
    async function load() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const session = await authenticatedSession();
        if (cancelled || owner !== epoch || session.user.id !== userId) return;
        const { reading } = await apiRequest<{ reading: OperatingReading | null }>(`/devices/${deviceId}/state`, { signal: controller.signal }, session);
        if (!cancelled && owner === epoch) setResult({ key, reading, loading: false, error: null });
      } catch (error) {
        if (!cancelled && owner === epoch) setResult(previous => ({ key, reading: previous.key === key ? previous.reading : null, loading: false, error: message(error) }));
      } finally { pending = false; }
    }
    void load();
    const timer = setInterval(load, 15000);
    document.addEventListener("visibilitychange", load);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, [userId, deviceId, key]);
  if (result.key !== key) return { reading: null, loading: !!userId, error: null };

  const { reading, loading, error } = result;
  return { reading, loading, error };
}
function updateDeviceLocation(deviceId: string, meta: DeviceLocationMeta) {
  const all = saveDeviceLocationMeta(state.userId, deviceId, meta);
  const nextMeta = all[deviceId];
  publish({
    ...state,
    devices: state.devices.map(d =>
      d.id === deviceId
        ? {
            ...d,
            unitName: nextMeta?.unitName,
            roomLocation: nextMeta?.roomLocation,
            locationPhotoUrl: nextMeta?.locationPhotoUrl,
          }
        : d
    ),
  });
}

const actions = { createGroup, deleteGroup, claimDevice, getDeviceClaim, deleteDevice, updateDeviceLocation, submitAlertFeedback, resolveAlert, updateUserProfile, resetUserProfile, clearUserAvatar, refreshData };
type SentrixContextValue = StoreState & typeof actions;
const SentrixContext = createContext<SentrixContextValue | null>(null);
export function SentrixProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => serverSnapshot);
  useEffect(() => {
    // Drop old demo snapshots and secrets rather than migrating them into production.
    try { localStorage.removeItem("sentrix-store-v2"); localStorage.removeItem("sentrix-demo-session"); sessionStorage.removeItem("sentrix-demo-session"); } catch { /* Storage may be disabled. */ }
    void refreshData();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      publish({ ...state }); // Reevaluate freshness even when the next request fails or stalls.
      void refreshData();
    };
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (state.userId !== (session?.user.id ?? null)) resetAccount(session?.user.id ?? null);
      // Supabase auth callbacks must release their lock before querying auth again.
      setTimeout(() => { void refreshData(); }, 0);
    }).data.subscription;
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); subscription?.unsubscribe(); resetAccount(null); };
  }, []);
  const value = useMemo(() => ({ ...snapshot, ...actions }), [snapshot]);
  return <SentrixContext.Provider value={value}>{children}</SentrixContext.Provider>;
}
export function useSentrix() {
  const context = useContext(SentrixContext);
  if (!context) throw new Error("useSentrix must be used inside <SentrixProvider>");
  return context;
}
