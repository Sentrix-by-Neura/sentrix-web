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

function DynamicSensorStatusBadge({ device }: { device: Device }) {
  if (device.archivedAt) return <span className={styles.status}>Transferred, history only</span>;
  if (hasRecentContact(device) && device.status === "CALIBRATING") {
    return (
      <span className={styles.status} data-state="calibrating">
        Calibrating
      </span>
    );
  }

  if (hasRecentContact(device) && device.status === "ACTIVE") {
    return (
      <span className={styles.status} data-state="connected">
        Connected
      </span>
    );
  }

  return (
    <span className={styles.status} data-state="unavailable">
      Unavailable
    </span>
  );
}

function SensorAnalyticsContent() {
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
        Loading…
      </p>
    );
  }

  if (!group || !device || device.groupId !== group.id) {
    return (
      <div className={`${styles.page} py-24 text-center`}>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Sensor Not Found</h1>
        <p className="mb-4 mt-1 text-xs text-[var(--text-muted)]">
          The requested sensor could not be located.
        </p>
        <Link
          href={group ? `/dashboard/${group.slug}` : "/dashboard"}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Return to {group ? group.name : "Dashboard"}
        </Link>
      </div>
    );
  }

  const localAlerts = alerts
    .filter((a) => a.deviceId === device.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className={`${styles.page} space-y-6`}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 text-sm text-[var(--text-secondary)]">
        <Link href="/dashboard" className="hover:text-[var(--text-primary)]">
          Dashboard
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

      <OperatingMetrics device={device} {...operating} expectedMin={latestTelemetry?.lowerBound ?? null} expectedMax={latestTelemetry?.upperBound ?? null} />

      <TelemetryChart key={device.id} deviceId={device.id} />

      <section aria-label="Anomaly history" className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div className="flex items-center gap-2">
            <h2>Anomaly history</h2>
          </div>
          <Link
            href="/alerts"
          >
            All alerts
          </Link>
        </div>

        {localAlerts.length === 0 ? (
          <div className={styles.empty}>
            No anomalies recorded.
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
                      {new Date(alert.timestamp).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {alert.isResolved && (
                      <span className="text-[var(--sensor-positive)]">
                        Resolved
                      </span>
                    )}
                  </div>
                  <p className="tabular-nums">
                    <strong>{alert.actualValue.toFixed(2)} A</strong> <span className="text-[var(--text-secondary)]">(range {alert.expectedMin.toFixed(2)} to {alert.expectedMax.toFixed(2)} A)</span>
                  </p>
                </div>

                <div className={styles.alertActions}>
                  {device.archivedAt ? null : alert.userFeedback !== null ? (
                    <span className="text-[var(--text-secondary)]">
                      {alert.userFeedback ? "Valid Issue" : "False Alarm"}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { void submitAlertFeedback(alert.id, true).catch(() => {}); }}
                        className={styles.control}
                      >
                        Valid Issue
                      </button>
                      <button
                        type="button"
                        onClick={() => { void submitAlertFeedback(alert.id, false).catch(() => {}); }}
                        className={styles.control}
                      >
                        False Alarm
                      </button>
                    </>
                  )}
                  {!device.archivedAt && !alert.isResolved && (
                    <button
                      type="button"
                      onClick={() => { void resolveAlert(alert.id).catch(() => {}); }}
                      className={`${styles.control} ${styles.resolve}`}
                    >
                      Resolve
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
          Loading…
        </p>
      }
    >
      <SensorAnalyticsContent />
    </Suspense>
  );
}
