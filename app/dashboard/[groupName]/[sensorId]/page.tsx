"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useSentrix, useTelemetry, useOperatingState, findGroup, hasRecentContact, type Device } from "../../../lib/sentrix-store";
import { TelemetryChart } from "./telemetry-chart";
import { OperatingMetrics } from "./operating-metrics";
import { TelemetryExport } from "./telemetry-export";
import styles from "./sensor-detail.module.css";
import "./tokens.css";
import { T, useLanguage } from "../../../lib/language-context";

function DynamicSensorStatusBadge({ device }: { device: Device }) {
  const { t } = useLanguage();
  if (device.archivedAt) return <span className={styles.status}>{t("Transferred, history only")}</span>;
  if (hasRecentContact(device) && device.status === "CALIBRATING") {
    return (
      <span className={styles.status} data-state="calibrating">
        {t("Calibrating")}
      </span>
    );
  }

  if (hasRecentContact(device) && device.status === "ACTIVE") {
    return (
      <span className={styles.status} data-state="connected">
        {t("Connected")}
      </span>
    );
  }

  return (
    <span className={styles.status} data-state="unavailable">
      {t("Unavailable")}
    </span>
  );
}

function SensorAnalyticsContent() {
  const { t, language } = useLanguage();
  const params = useParams();
  const rawGroup = typeof params?.groupName === "string" ? params.groupName : Array.isArray(params?.groupName) ? params.groupName[0] : "";
  const rawSensor = typeof params?.sensorId === "string" ? params.sensorId : Array.isArray(params?.sensorId) ? params.sensorId[0] : "";

  const groupSlug = decodeURIComponent(rawGroup || "");
  const sensorId = decodeURIComponent(rawSensor || "");

  const { ready, groups, devices, alerts, submitAlertFeedback, resolveAlert } = useSentrix();
  const group = findGroup(groups, groupSlug);
  const groupDevices = devices.filter(d => d.groupId === group?.id);
  const device = groupDevices.find(d => d.id === sensorId || d.id === rawSensor)
    ?? groupDevices.find(d => !d.archivedAt && (d.macAddress === sensorId || d.macAddress === rawSensor))
    ?? groupDevices.find(d => d.macAddress === sensorId || d.macAddress === rawSensor);
  const operating = useOperatingState(device?.id ?? "");
  const { points: telemetry } = useTelemetry(device?.id ?? "", "24h");
  const latestTelemetry = telemetry[telemetry.length - 1];

  if (!ready) {
    return (
      <p className={`${styles.page} py-24 text-center text-sm text-[var(--text-secondary)]`}>
        {t("Loading…")}
      </p>
    );
  }

  if (!group || !device || device.groupId !== group.id) {
    return (
      <div className={`${styles.page} py-24 text-center`}>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t("Sensor Not Found")}</h1>
        <p className="mb-4 mt-1 text-xs text-[var(--text-muted)]">
          {t("The requested sensor could not be located.")}
        </p>
        <Link
          href={group ? `/dashboard/${group.slug}` : "/dashboard"}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          {t("Return to")} {group ? group.name : t("Dashboard")}
        </Link>
      </div>
    );
  }

  const localAlerts = alerts
    .filter((a) => a.deviceId === device.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className={`${styles.page} space-y-6`}>
      <nav aria-label={t("Breadcrumb")} className="flex flex-wrap items-center gap-x-2 text-sm text-[var(--text-secondary)]">
        <Link href="/dashboard" className="hover:text-[var(--text-primary)]">
          {t("Dashboard")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/dashboard/${group.slug}`} className="hover:text-[var(--text-primary)]">
          {group.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="break-words font-medium text-[var(--text-primary)]">{device.name}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
              {device.name}
            </h1>
            <DynamicSensorStatusBadge device={device} />
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {device.macAddress}
          </p>
        </div>

        <div className={styles.headerActions}>
          <TelemetryExport key={device.id} deviceId={device.id} />
        </div>
      </div>

      {!device.archivedAt && !hasRecentContact(device) && (
        <aside
          aria-label={t("Sensor connection checklist")}
          className="surface-card rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-[var(--text-primary)]"
        >
          <p className="font-semibold text-amber-700 dark:text-amber-400">
            {t("Sensor unavailable — what to check")}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {t("This sensor hasn't sent a recent reading. You usually do not need to re-enter Wi-Fi credentials.")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
            <li>{t("Check that the sensor has power and its indicator LED is on.")}</li>
            <li>{t("Check that your 2.4 GHz Wi-Fi router is online, then wait 1–2 minutes for automatic reconnection.")}</li>
            <li>{t("Only re-setup Wi-Fi (hold BOOT for 5 seconds, then Add Device) if your Wi-Fi name or password changed.")}</li>
          </ul>
        </aside>
      )}

      <OperatingMetrics device={device} {...operating} expectedMin={latestTelemetry?.lowerBound ?? null} expectedMax={latestTelemetry?.upperBound ?? null} />

      <TelemetryChart key={device.id} deviceId={device.id} />

      <section aria-label={t("Anomaly history")} className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div className="flex items-center gap-2">
            <h2>{t("Anomaly history")}</h2>
          </div>
          <Link
            href="/alerts"
          >
            {t("All alerts")}
          </Link>
        </div>

        {localAlerts.length === 0 ? (
          <div className={styles.empty}>
            {t("No anomalies recorded.")}
          </div>
        ) : (
          <div>
            {localAlerts.map((alert) => (
              <div
                key={alert.id}
                data-context-type="alert"
                data-context-id={alert.id}
                className={styles.alertRow}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <time dateTime={alert.timestamp}>
                      {new Date(alert.timestamp).toLocaleString(language === "id" ? "id-ID" : "en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {alert.isResolved && (
                      <span className="text-[var(--sensor-positive)]">
                        {t("Resolved")}
                      </span>
                    )}
                  </div>
                  <p className="tabular-nums">
                    <strong>{alert.actualValue.toFixed(2)} A</strong> <span className="text-[var(--text-secondary)]">({t("range")} {alert.expectedMin.toFixed(2)} {t("to")} {alert.expectedMax.toFixed(2)} A)</span>
                  </p>
                </div>

                <div className={styles.alertActions}>
                  {device.archivedAt ? null : alert.userFeedback !== null ? (
                    <span className="text-[var(--text-secondary)]">
                      {t(alert.userFeedback ? "Valid Issue" : "False Alarm")}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { void submitAlertFeedback(alert.id, true).catch(() => {}); }}
                        className={styles.control}
                      >
                        {t("Valid Issue")}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void submitAlertFeedback(alert.id, false).catch(() => {}); }}
                        className={styles.control}
                      >
                        {t("False Alarm")}
                      </button>
                    </>
                  )}
                  {!device.archivedAt && !alert.isResolved && (
                    <button
                      type="button"
                      onClick={() => { void resolveAlert(alert.id).catch(() => {}); }}
                      className={`${styles.control} ${styles.resolve}`}
                    >
                      {t("Resolve")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function SensorDetailPage() {
  return (
    <Suspense
      fallback={
        <p className={`${styles.page} py-24 text-center text-sm text-[var(--text-secondary)]`}>
          <T>Loading…</T>
        </p>
      }
    >
      <SensorAnalyticsContent />
    </Suspense>
  );
}
