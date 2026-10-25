"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSentrix, useTelemetry, type Group, type DeviceClaim } from "../../lib/sentrix-store";
import { authenticateSentrixHardware, scanSentrixHardware, scanSentrixWifi, provisionSentrixHardware, validateSentrixNetwork, type ScanResult, type SentrixHardware } from "../../lib/sentrix-bluetooth";

const inputClass = "mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none focus:border-amber-500";
const buttonClass = "min-h-11 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50 disabled:cursor-wait";
const setupSteps = ["Sensor", "PIN", "Wi-Fi", "Finish"];

export function BleOnboardingModal({ group, onClose, initialScan }: { group: Group; onClose: () => void; initialScan?: Promise<ScanResult> }) {
  const { claimDevice, getDeviceClaim, devices, refreshData, userId } = useSentrix();
  const [step, setStep] = useState<"scan" | "pin" | "wifi" | "saved">("scan");
  const [hardware, setHardware] = useState<SentrixHardware | null>(null);
  const hardwareRef = useRef<SentrixHardware | null>(null);
  const mounted = useRef(false);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [networks, setNetworks] = useState<string[]>([]);
  const [wifiMessage, setWifiMessage] = useState("");
  const [busy, setBusy] = useState(!!initialScan);
  const [scanningWifi, setScanningWifi] = useState(false);
  const [error, setError] = useState("");
  const [claimedId, setClaimedId] = useState("");
  const [pendingClaim, setPendingClaim] = useState<Pick<DeviceClaim, "id" | "expires_at"> | null>(null);
  const [claimExpired, setClaimExpired] = useState(false);
  const [setupStartedAt, setSetupStartedAt] = useState(0);
  const { points } = useTelemetry(claimedId, "1h");
  const device = devices.find(d => d.id === claimedId);
  const backendSeen = !!device?.lastSeen && Date.parse(device.lastSeen) >= setupStartedAt;
  const telemetrySeen = !!claimedId && points.some(p => Date.parse(p.timestamp) >= setupStartedAt);
  const currentStep = { scan: 0, pin: 1, wifi: 2, saved: 3 }[step];
  const setupComplete = step === "saved" && telemetrySeen;
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
  useEffect(() => {
    if (step !== "saved" || !pendingClaim || claimedId || claimExpired || owner.current !== userId) return;
    const claim = pendingClaim;
    let cancelled = false, polling = false;
    const controller = new AbortController();
    async function poll() {
      if (cancelled || polling) return;
      polling = true;
      try {
        const result = await getDeviceClaim(group.id, claim.id, controller.signal);
        if (cancelled) return;
        setError("");
        if (result.status === "confirmed" && result.device) {
          setClaimedId(result.device.id);
          setPendingClaim(null);
          void refreshData();
        } else if (result.status === "expired") {
          setClaimExpired(true);
        }
      } catch (error) {
        if (!cancelled) {
          if (Date.now() >= Date.parse(claim.expires_at)) setClaimExpired(true);
          else setError((error instanceof Error ? error.message : "Could not check device confirmation.") + " Keep the sensor powered; confirmation will retry automatically.");
        }
      } finally { polling = false; }
    }
    const timer = setInterval(poll, 2000);
    void poll();
    return () => { cancelled = true; controller.abort(); clearInterval(timer); };
  }, [step, pendingClaim, claimedId, claimExpired, group.id, userId, getDeviceClaim, refreshData]);
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
      if (mounted.current) { setNetworks(names); setWifiMessage(names.length ? `${names.length} network${names.length === 1 ? "" : "s"} found.` : "No networks found. Enter the network name manually."); }
    } catch (error) { if (mounted.current) setWifiMessage(error instanceof Error ? error.message : "Wi-Fi scan failed. Enter the network name manually."); }
    finally { if (mounted.current) setScanningWifi(false); }
  }
  async function provision(event: FormEvent) {
    event.preventDefault();
    if (!hardware || busy || scanningWifi) return;
    setBusy(true); setError("");
    let phase: "verify" | "claim" | "transfer" = "verify";
    try {
      if (!/^[0-9A-F]{12}$/.test(group.meshId)) throw new Error("This group has no valid mesh ID. Refresh the dashboard.");
      validateSentrixNetwork({ ssid, password, pin, mesh_id: group.meshId });
      await authenticateSentrixHardware(hardware, pin);
      if (!mounted.current) return;
      const started = Date.now();
      setSetupStartedAt(started);
      phase = "claim";
      const claim = await claimDevice(group.id, { name: name.trim(), macAddress: hardware.macAddress });
      if (!mounted.current) return;
      phase = "transfer";
      await provisionSentrixHardware(hardware, { ssid, password, pin, mesh_id: group.meshId, setup_token: claim.setup_token });
      if (!mounted.current) return;
      setPendingClaim({ id: claim.id, expires_at: claim.expires_at }); setClaimExpired(false);
      setPassword(""); setShowPassword(false); setPin(""); setStep("saved");
      void refreshData();
    } catch (error) {
      if (mounted.current) setError((error instanceof Error ? error.message : "Setup failed.") + (phase === "transfer" ? " Keep the sensor powered and check this group before retrying; it may still finish setup. For recovery, hold BOOT for 5 seconds and release, then scan again in this group." : ""));
    } finally { if (mounted.current) setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" onKeyDown={e => { if (e.key === "Escape" && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="setup-title" className="surface-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id="setup-title" className="text-lg font-semibold">Set up sensor in {group.name}</h2>
          <button type="button" aria-label="Close setup" disabled={busy} onClick={onClose} className="min-h-11 min-w-11 rounded-lg p-2 focus-visible:outline-2 focus-visible:outline-amber-500 disabled:opacity-50">×</button>
        </div>
        <ol aria-label="Setup progress" className="mt-4 grid grid-cols-4 gap-2">
          {setupSteps.map((label, index) => {
            const complete = index < currentStep || setupComplete;
            const current = index === currentStep && !setupComplete;
            return <li key={label} aria-current={current ? "step" : undefined} className={`flex items-center gap-1.5 border-b-2 pb-3 text-xs ${current ? "border-amber-500 font-semibold" : complete ? "border-[var(--text-secondary)] text-[var(--text-secondary)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>
              {complete ? <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 8 3 3 7-7" /></svg> : <span aria-hidden="true">{index + 1}</span>}
              {label}{complete && <span className="sr-only"> complete</span>}
            </li>;
          })}
        </ol>
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
          <p className="text-sm">Connect the sensor to a 2.4 GHz Wi-Fi network.</p>
          <p className="text-xs text-[var(--text-secondary)]">Setup assigns this sensor to {group.name}. Previous account history stays private.</p>
          <div>
            <div className="flex items-center justify-between gap-3">
              <p id="nearby-networks" className="text-sm font-medium">Nearby networks</p>
              <button type="button" onClick={scanWifi} disabled={busy || scanningWifi} className="min-h-11 rounded-lg px-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-wait disabled:opacity-50">{scanningWifi ? "Scanning…" : "Scan Wi-Fi"}</button>
            </div>
            <div role="status" className="flex min-h-6 items-center gap-2 text-xs text-[var(--text-secondary)]">
              {scanningWifi ? <><span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--border)] border-t-amber-600 motion-reduce:animate-none" />Scanning nearby networks…</> : wifiMessage}
            </div>
            {networks.length > 0 && <div role="group" aria-labelledby="nearby-networks" className="mt-3 flex flex-wrap gap-2">
              {networks.map(network => <button key={network} type="button" aria-pressed={ssid === network} disabled={busy} onClick={() => setSsid(network)} className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-50 ${ssid === network ? "border-amber-600 bg-amber-500/10" : "border-[var(--border)] hover:border-[var(--text-muted)]"}`}>
                {ssid === network && <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 8 3 3 7-7" /></svg>}
                <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{network}</span>
              </button>)}
            </div>}
          </div>
          <div>
            <label htmlFor="wifi-network" className="block text-sm">Wi-Fi network</label>
            <input id="wifi-network" autoFocus required value={ssid} onChange={e => setSsid(e.target.value)} aria-describedby="wifi-network-help" className={inputClass} />
            <p id="wifi-network-help" className="mt-2 text-xs text-[var(--text-secondary)]">Choose a network above or enter its name manually.</p>
          </div>
          <div>
            <label htmlFor="wifi-password" className="block text-sm">Wi-Fi password</label>
            <div className="relative">
              <input id="wifi-password" type={showPassword ? "text" : "password"} autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} aria-describedby="wifi-password-help" className={`${inputClass} pr-14`} />
              <button type="button" aria-label={showPassword ? "Hide Wi-Fi password" : "Show Wi-Fi password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-0 bottom-0 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-amber-500">
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg>
              </button>
            </div>
            <p id="wifi-password-help" className="mt-2 text-xs text-[var(--text-secondary)]">Leave empty only for an open network.</p>
          </div>
          <button type="submit" disabled={busy || scanningWifi} className={`${buttonClass} w-full`}>{busy ? "Registering and saving settings…" : "Register and connect"}</button>
        </form>}
        {step === "saved" && <div className="mt-5 space-y-4 text-sm">
          <p role="status" className="font-semibold">{claimExpired ? "Setup confirmation expired" : telemetrySeen ? "Telemetry received" : backendSeen ? "Backend contact confirmed; waiting for telemetry" : claimedId ? "Registration confirmed; waiting for backend contact" : "Wi-Fi settings saved; waiting for device confirmation"}</p>
          {claimExpired ? <p>Check this group first in case registration already completed. If the sensor is still missing, hold BOOT for 5 seconds and release, then set it up again in this group.</p> : <>
            <p>{claimedId ? "The sensor is registered. " : "Keep the sensor powered while registration is confirmed. "}It restarts with Bluetooth off and reconnects using saved Wi-Fi settings. Readings start after Go confirmation; the first batch can take over a minute. This page updates automatically.</p>
            {!backendSeen && <p>If it keeps waiting, check Wi-Fi, the MQTT service, and the backend deployment. You can return to the group; the sensor can finish registration without this page.</p>}
          </>}
          <button type="button" onClick={onClose} className={buttonClass}>Return to group</button>
        </div>}
      </section>
    </div>
  );
}
