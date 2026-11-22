import { hasRecentContact, hasRecentReading, type Device } from "../../../lib/sentrix-store";
import type { OperatingReading } from "../../../lib/sentrix-api";
import styles from "./sensor-detail.module.css";
import { useLanguage } from "../../../lib/language-context";

function temperature(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}°C` : "Unknown";
}

export function OperatingMetrics({ device, reading, loading, error, expectedMin, expectedMax }: {
  device: Device; reading: OperatingReading | null; loading: boolean; error: string | null;
  expectedMin: number | null; expectedMax: number | null;
}) {
  const { t } = useLanguage();
  const available = !!device.archivedAt || (hasRecentContact(device) && hasRecentReading(reading));
  const power = !available ? "Unknown" : reading?.remote_power_on === true ? "ON" : reading?.remote_power_on === false ? "OFF" : "Unknown";
  const pending = loading && !reading;
  return (
    <section aria-label={t("AC operating information")} aria-busy={pending}>
      <dl className={styles.metrics}>
        <div>
          <dt>{t("RMS Current")}</dt>
          <dd className={pending ? styles.skeleton : undefined}>
            {pending ? <span className="sr-only">{t("Loading current")}</span> : typeof reading?.rms_current === "number" && Number.isFinite(reading.rms_current) ? <>{reading.rms_current.toFixed(2)} <span className={styles.unit}>A</span></> : t("Unknown")}
          </dd>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{t("AC electrical draw")}</p>
        </div>
        <div>
          <dt>{t("Room Temperature")}</dt>
          <dd className={pending ? styles.skeleton : undefined}>{pending ? <span className="sr-only">{t("Loading room temperature")}</span> : t(temperature(reading?.current_temperature))}</dd>
        </div>
        <div>
          <dt>{t("Target Temperature")}</dt>
          <dd className={pending ? styles.skeleton : undefined}>{pending ? <span className="sr-only">{t("Loading target temperature")}</span> : t(temperature(reading?.target_temperature))}</dd>
        </div>
        <div>
          <dt>{t("AC Power")}</dt>
          <dd className={pending ? styles.skeleton : undefined}>{pending ? <span className="sr-only">{t("Loading AC power")}</span> : t(power)}</dd>
        </div>
        <div className={styles.normalRange}>
          <dt>{t("Normal RMS Current Range")}</dt>
          <dd>{expectedMin !== null && expectedMax !== null && Number.isFinite(expectedMin) && Number.isFinite(expectedMax) ? <>{expectedMin.toFixed(2)} {t("to")} {expectedMax.toFixed(2)} <span className={styles.unit}>A</span></> : t("Unknown")}</dd>
          <p className="w-full text-xs text-[var(--text-secondary)]">{t("Expected safe operating band for this AC")}</p>
        </div>
      </dl>
      {error && <p role="status" className={styles.message}>{t("Could not refresh readings.")} {t(error)}</p>}
    </section>
  );
}
