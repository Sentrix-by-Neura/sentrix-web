import { hasRecentContact, hasRecentReading, type Device } from "../../../lib/sentrix-store";
import type { OperatingReading } from "../../../lib/sentrix-api";
import styles from "./sensor-detail.module.css";

function temperature(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}°C` : "Unknown";
}

export function OperatingMetrics({ device, reading, loading, error, expectedMin, expectedMax }: {
  device: Device; reading: OperatingReading | null; loading: boolean; error: string | null;
  expectedMin: number | null; expectedMax: number | null;
}) {
  const available = !!device.archivedAt || (hasRecentContact(device) && hasRecentReading(reading));
  const power = !available ? "Unknown" : reading?.remote_power_on === true ? "ON" : reading?.remote_power_on === false ? "OFF" : "Unknown";
  const pending = loading && !reading;
  return (
    <section aria-label="AC operating information" aria-busy={pending}>
      <dl className={styles.metrics}>
        <div>
          <dt>RMS Current</dt>
          <dd className={pending ? styles.skeleton : undefined}>
            {pending ? <span className="sr-only">Loading current</span> : typeof reading?.rms_current === "number" && Number.isFinite(reading.rms_current) ? <>{reading.rms_current.toFixed(2)} <span className={styles.unit}>A</span></> : "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Room Temperature</dt>
          <dd className={pending ? styles.skeleton : undefined}>{pending ? <span className="sr-only">Loading room temperature</span> : temperature(reading?.current_temperature)}</dd>
        </div>
        <div>
          <dt>Target Temperature</dt>
          <dd className={pending ? styles.skeleton : undefined}>{pending ? <span className="sr-only">Loading target temperature</span> : temperature(reading?.target_temperature)}</dd>
        </div>
        <div>
          <dt>AC Power</dt>
          <dd className={pending ? styles.skeleton : undefined}>{pending ? <span className="sr-only">Loading AC power</span> : power}</dd>
        </div>
        <div className={styles.normalRange}>
          <dt>Normal RMS Current Range</dt>
          <dd>{expectedMin !== null && expectedMax !== null && Number.isFinite(expectedMin) && Number.isFinite(expectedMax) ? <>{expectedMin.toFixed(2)} to {expectedMax.toFixed(2)} <span className={styles.unit}>A</span></> : "Unknown"}</dd>
        </div>
      </dl>
      {error && <p role="status" className={styles.message}>Could not refresh readings. {error}</p>}
    </section>
  );
}
