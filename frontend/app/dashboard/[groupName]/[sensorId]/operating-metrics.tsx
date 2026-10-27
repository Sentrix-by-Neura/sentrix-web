import { hasRecentContact, hasRecentReading, type Device } from "../../../lib/sentrix-store";
import type { OperatingReading } from "../../../lib/sentrix-api";

function temperature(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}°C` : "Unknown";
}

export function OperatingMetrics({ device, reading, loading, error, expectedMin, expectedMax }: {
  device: Device; reading: OperatingReading | null; loading: boolean; error: string | null;
  expectedMin: string; expectedMax: string;
}) {
  const available = hasRecentContact(device) && hasRecentReading(reading);
  const unavailable = !device.archivedAt && (!hasRecentContact(device) || (!!reading && !hasRecentReading(reading)));
  const power = reading?.remote_power_on === true ? "On" : reading?.remote_power_on === false ? "Off" : "Unknown";
  const activity = unavailable ? "Unavailable" : reading?.load_active === true ? "Active" : reading?.load_active === false ? "Low / standby" : "Unknown";
  const timestamp = reading ? new Date(reading.timestamp) : null;
  const observed = reading?.remote_power_observed_at ? new Date(reading.remote_power_observed_at) : null;
  return (
    <section aria-label="AC operating information" className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card rounded-xl border border-[var(--border)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">{device.archivedAt || !available ? "Last recorded RMS current" : "RMS current"}</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[var(--text-primary)]">
            {typeof reading?.rms_current === "number" ? reading.rms_current.toFixed(2) : "—"} <span className="text-sm font-normal text-[var(--text-secondary)]">A</span>
          </p>
        </div>
        <div className="surface-card rounded-xl border border-[var(--border)] p-5">
          <dl className="space-y-3">
            <div><dt className="text-xs text-[var(--text-secondary)]">Room temperature</dt><dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{temperature(reading?.current_temperature)}</dd></div>
            <div><dt className="text-xs text-[var(--text-secondary)]">Last target setpoint</dt><dd className="mt-1 font-mono text-lg tabular-nums text-[var(--text-primary)]">{temperature(reading?.target_temperature)}</dd></div>
          </dl>
        </div>
        <div className="surface-card rounded-xl border border-[var(--border)] p-5">
          <dl className="space-y-3">
            <div><dt className="text-xs text-[var(--text-secondary)]">Last remote power command</dt><dd className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{power}</dd></div>
            <div><dt className="text-xs text-[var(--text-secondary)]">{device.archivedAt ? "Last measured activity" : "Measured current activity"}</dt><dd className="mt-1 text-sm text-[var(--text-primary)]">{activity}</dd></div>
          </dl>
          {observed && Number.isFinite(observed.getTime()) && <p className="mt-3 text-xs text-[var(--text-secondary)]">Command heard <time dateTime={reading!.remote_power_observed_at!}>{observed.toLocaleString()}</time></p>}
        </div>
        <div className="surface-card rounded-xl border border-[var(--border)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">Expected safe range</p>
          <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">{expectedMin} – {expectedMax} <span className="text-xs font-normal text-[var(--text-secondary)]">A</span></p>
        </div>
      </div>
      <div className="space-y-1 text-xs text-[var(--text-secondary)]" role="status">
        {error && <p>Could not refresh operating information. {error}</p>}
        <p>{loading ? "Loading operating information…" : timestamp && Number.isFinite(timestamp.getTime()) ? <>{device.archivedAt ? "Last recorded" : "Last received"} <time dateTime={reading!.timestamp}>{timestamp.toLocaleString()}</time>{unavailable ? " · Unavailable; showing last reported values." : ""}</> : "No operating readings recorded yet."}</p>
        <p>Room temperature is measured; the target and power command are last heard from the remote. Low current can include standby or a paused compressor.</p>
      </div>
    </section>
  );
}
