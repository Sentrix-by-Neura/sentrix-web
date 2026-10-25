"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSentrix, useTelemetry, type Group } from "../../lib/sentrix-store";
import { authenticateSentrixHardware, scanSentrixHardware, scanSentrixWifi, provisionSentrixHardware, validateSentrixConfiguration, type ScanResult, type SentrixHardware } from "../../lib/sentrix-bluetooth";

const inputClass = "mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none focus:border-amber-500";
const buttonClass = "rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50 disabled:cursor-wait";

export function BleOnboardingModal({ group, onClose, initialScan }: { group: Group; onClose: () => void; initialScan?: Promise<ScanResult> }) {
  const { claimDevice, devices, refreshData, userId } = useSentrix();
  const [step, setStep] = useState<"scan" | "pin" | "wifi" | "saved">("scan");
  const [hardware, setHardware] = useState<SentrixHardware | null>(null);
  const hardwareRef = useRef<SentrixHardware | null>(null);
  const mounted = useRef(false);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [networks, setNetworks] = useState<string[]>([]);
  const [wifiMessage, setWifiMessage] = useState("");
  const [busy, setBusy] = useState(!!initialScan);
  const [scanningWifi, setScanningWifi] = useState(false);
  const [error, setError] = useState("");
  const [claimedId, setClaimedId] = useState("");
  const [setupStartedAt, setSetupStartedAt] = useState(0);
  const { points } = useTelemetry(claimedId, "1h");
  const device = devices.find(d => d.id === claimedId);
  const backendSeen = !!device?.lastSeen && Date.parse(device.lastSeen) >= setupStartedAt;
  const telemetrySeen = points.some(p => Date.parse(p.timestamp) >= setupStartedAt);
  const owner = useRef(userId);
  const existingDeviceName = useRef<(mac: string) => string | undefined>(() => undefined);
  useEffect(() => {
    existingDeviceName.current = mac => devices.find(d => d.macAddress === mac && d.groupId === group.id)?.name;
  }, [devices, group.id]);
  const acceptScan = useCallback((result: ScanResult) => {
    setBusy(false);
    if (typeof result === "string") { setError(result); return; }
    hardwareRef.current = result;
    setHardware(result); setName(existingDeviceName.current(result.macAddress) ?? result.name); setStep("pin"); setError("");
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => { if (!mounted.current) hardwareRef.current?.device.gatt?.disconnect(); });
    };
  }, []);
  useEffect(() => { if (owner.current !== userId) onClose(); }, [userId, onClose]);
  useEffect(() => {
    if (!initialScan) return;
    let cancelled = false;
    initialScan.then(result => {
      if (cancelled) { if (!mounted.current && typeof result !== "string") result.device.gatt?.disconnect(); return; }
      acceptScan(result);
    });
    return () => { cancelled = true; };
  }, [initialScan, acceptScan]);
  async function scan() {
    setBusy(true); setError("");
    hardwareRef.current?.device.gatt?.disconnect();
    // requestDevice starts synchronously inside this click to preserve user activation.
    const result = await scanSentrixHardware();
    if (!mounted.current) { if (typeof result !== "string") result.device.gatt?.disconnect(); return; }
    acceptScan(result);
  }
  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (!hardware || busy) return;
    setBusy(true); setError("");
    try {
      await authenticateSentrixHardware(hardware, pin);
      if (mounted.current) { setStep("wifi"); void scanWifi(); }
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "PIN authentication failed."); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function scanWifi() {
    if (!hardware || scanningWifi) return;
    setScanningWifi(true); setWifiMessage("");
    try {
      const names = await scanSentrixWifi(hardware, pin);
      if (mounted.current) { setNetworks(names); setWifiMessage(names.length ? "Choose a network or enter its name." : "No networks found. Enter the network name manually."); }
    } catch (error) { if (mounted.current) setWifiMessage(error instanceof Error ? error.message : "Wi-Fi scan failed. Enter the network name manually."); }
    finally { if (mounted.current) setScanningWifi(false); }
  }
  async function provision(event: FormEvent) {
    event.preventDefault();
    if (!hardware || busy || scanningWifi) return;
    setBusy(true); setError("");
    try {
      if (!/^[0-9A-F]{12}$/.test(group.meshId)) throw new Error("This group has no valid mesh ID. Refresh the dashboard.");
      validateSentrixConfiguration({ ssid, password, pin, mesh_id: group.meshId });
      await authenticateSentrixHardware(hardware, pin);
      if (!mounted.current) return;
      const started = Date.now();
      setSetupStartedAt(started);
      const claimed = await claimDevice(group.id, { name: name.trim(), macAddress: hardware.macAddress, pin });
      if (!mounted.current) return;
      setClaimedId(claimed.id);
      await provisionSentrixHardware(hardware, { ssid, password, pin, mesh_id: group.meshId });
      if (!mounted.current) return;
      setPassword(""); setPin(""); setStep("saved");
      void refreshData();
    } catch (error) {
      if (mounted.current) setError((error instanceof Error ? error.message : "Setup failed.") + " If Wi-Fi settings were already saved, keep the device powered and check its dashboard before retrying. For recovery, hold BOOT for 5 seconds and release, then scan again in this group.");
    } finally { if (mounted.current) setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" onKeyDown={e => { if (e.key === "Escape" && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="setup-title" className="surface-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="setup-title" className="text-lg font-semibold">Set up sensor in {group.name}</h2>
          <button type="button" aria-label="Close setup" disabled={busy} onClick={onClose} className="p-2 disabled:opacity-50">×</button>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}
        {step === "scan" && <div className="mt-5 space-y-4 text-sm">
          <p>Keep the sensor powered and nearby. Bluetooth is available during initial setup and deliberate recovery only.</p>
          <p>For a configured sensor, hold BOOT for 5 seconds until the LED shows two long flashes, then release. Its firmware and website registration remain intact.</p>
          <button type="button" autoFocus onClick={scan} disabled={busy} className={buttonClass}>{busy ? "Finding sensor…" : "Find sensor"}</button>
        </div>}
        {step === "pin" && <form onSubmit={authenticate} className="mt-5 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">{hardware?.macAddress}</p>
          <label className="block text-sm">Sensor name<input autoFocus required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={inputClass} /></label>
          <label className="block text-sm">Hardware PIN<input type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} aria-describedby="pin-help" className={inputClass} /></label>
          <p id="pin-help" className="text-sm text-[var(--text-muted)]">Enter the six-digit PIN printed on your hardware.</p>
          <button type="submit" disabled={busy || pin.length !== 6} className={buttonClass}>{busy ? "Checking PIN…" : "Verify hardware"}</button>
        </form>}
        {step === "wifi" && <form onSubmit={provision} className="mt-5 space-y-4">
          <p className="text-sm">Use a 2.4 GHz Wi-Fi network. The sensor will be registered in {group.name}.</p>
          {wifiMessage && <p role="status" className="text-sm text-[var(--text-muted)]">{wifiMessage}</p>}
          <label className="block text-sm">Wi-Fi network<input autoFocus list="sentrix-networks" required value={ssid} onChange={e => setSsid(e.target.value)} className={inputClass} /><datalist id="sentrix-networks">{networks.map(n => <option key={n} value={n} />)}</datalist></label>
          <label className="block text-sm">Wi-Fi password<input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} /><span className="mt-2 block text-xs text-[var(--text-muted)]">Leave empty only for an open network.</span></label>
          <div className="flex flex-wrap gap-3"><button type="button" onClick={scanWifi} disabled={busy || scanningWifi} className="text-sm text-amber-500">{scanningWifi ? "Scanning Wi-Fi…" : "Scan Wi-Fi"}</button><button type="submit" disabled={busy || scanningWifi} className={buttonClass}>{busy ? "Registering and saving settings…" : "Register and connect"}</button></div>
        </form>}
        {step === "saved" && <div className="mt-5 space-y-4 text-sm">
          <p role="status" className="font-semibold">{telemetrySeen ? "Telemetry received" : backendSeen ? "Backend contact confirmed; waiting for telemetry" : "Settings saved; waiting for backend contact"}</p>
          <p>The sensor is registered. It restarts with Bluetooth off, reconnects using saved Wi-Fi settings, and waits for Go confirmation before sending readings. This page updates automatically; the first batch can take over a minute.</p>
          {!backendSeen && <p>If it keeps waiting, check Wi-Fi, the MQTT service, and the backend deployment. Settings stay saved through power loss.</p>}
          <button type="button" onClick={onClose} className={buttonClass}>Return to group</button>
        </div>}
      </section>
    </div>
  );
}
