import { hasRecentContact, hasRecentReading, type Device } from "../../../lib/sentrix-store";
import type { OperatingReading } from "../../../lib/sentrix-api";
import styles from "./sensor-detail.module.css";
import { useLanguage } from "../../../lib/language-context";
import { HelpPopover } from "../../../components/help-popover";

function temperature(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}°C` : "Unknown";
}

export function OperatingMetrics({ device, reading, loading, error }: {
  device: Device; reading: OperatingReading | null; loading: boolean; error: string | null;
}) {
  const { t } = useLanguage();
  const available = !!device.archivedAt || (hasRecentContact(device) && hasRecentReading(reading));
  const status = !available ? "Unknown" : reading?.remote_power_on === true ? "ON" : reading?.remote_power_on === false ? "OFF" : "Unknown";
  const pending = loading && !reading;
  return (
    <section aria-label={t("AC operating information")} aria-busy={pending}>
      <dl className={styles.metrics}>
        <div>
          <dt className="flex items-center gap-1.5">
            <span>{t("RMS Current")}</span>
            <HelpPopover label={t("RMS Current")} title={t("RMS Current")}>
              <p>{t("AC electrical draw")}</p>
            </HelpPopover>
          </dt>
          <dd className={pending ? styles.skeleton : undefined}>
            {pending ? <span className="sr-only">{t("Loading current")}</span> : typeof reading?.rms_current === "number" && Number.isFinite(reading.rms_current) ? <>{reading.rms_current.toFixed(2)} <span className={styles.unit}>A</span></> : t("Unknown")}
          </dd>
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
          <dt className="flex items-center gap-1.5">
            <span>{t("AC Status")}</span>
            <HelpPopover label={t("About AC status")} title={t("AC Status")}>
              <p>{t("Shows whether the AC is on or off. Electrical power in watts (W) is not displayed here.")}</p>
            </HelpPopover>
          </dt>
          <dd className={pending ? styles.skeleton : undefined}>{pending ? <span className="sr-only">{t("Loading AC status")}</span> : t(status)}</dd>
        </div>
      </dl>
      {error && <p role="status" className={styles.message}>{t("Could not refresh readings.")} {t(error)}</p>}
    </section>
  );
}
