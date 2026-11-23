"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState, type ChangeEvent, type FormEvent } from "react";
import { useSentrix, useTelemetry, useOperatingState, findGroup, hasRecentContact, type Device } from "../../../lib/sentrix-store";
import { resizeLocationPhoto } from "../../../lib/device-location-meta";
import { TelemetryChart } from "./telemetry-chart";
import { OperatingMetrics } from "./operating-metrics";
import { TelemetryExport } from "./telemetry-export";
import styles from "./sensor-detail.module.css";
import "./tokens.css";
import { T, useLanguage } from "../../../lib/language-context";
import { HelpPopover } from "../../../components/help-popover";

function EditLocationModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const { t } = useLanguage();
  const { updateDeviceLocation } = useSentrix();
  const [unitName, setUnitName] = useState(device.unitName ?? "");
  const [roomLocation, setRoomLocation] = useState(device.roomLocation ?? "");
  const [photoUrl, setPhotoUrl] = useState(device.locationPhotoUrl ?? "");
  const [error, setError] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessingPhoto(true);
    setError("");
    try {
      const dataUrl = await resizeLocationPhoto(file);
      setPhotoUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load image preview.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      updateDeviceLocation(device.id, {
        unitName,
        roomLocation,
        locationPhotoUrl: photoUrl || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save location details.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-ac-location-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="surface-card w-full max-w-md space-y-4 rounded-2xl border border-[var(--border)] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="edit-ac-location-title" className="text-lg font-semibold text-[var(--text-primary)]">
            {t("AC Unit & Room Location")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close dialog")}
            className="flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            ✕
          </button>
        </div>

        <label className="block text-sm font-medium text-[var(--text-primary)]">
          {t("AC Unit Name")}
          <input
            type="text"
            maxLength={80}
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder={t("e.g. Lab 302 · Split AC #2")}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-base font-normal text-[var(--text-primary)] sm:text-sm"
          />
        </label>

        <label className="block text-sm font-medium text-[var(--text-primary)]">
          {t("Room / Floor Location")}
          <input
            type="text"
            maxLength={120}
            value={roomLocation}
            onChange={(e) => setRoomLocation(e.target.value)}
            placeholder={t("e.g. Building B, 3rd Floor, North Wall")}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-base font-normal text-[var(--text-primary)] sm:text-sm"
          />
        </label>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="ac-unit-photo-input" className="text-sm font-medium text-[var(--text-primary)]">
              {t("Room / Unit Photo (Optional)")}
            </label>
            <HelpPopover label={t("Room / Unit Photo (Optional)")} title={t("Room / Unit Photo (Optional)")}>
              <p>{t("Shown on alerts so technicians can find the exact room and AC unit.")}</p>
            </HelpPopover>
          </div>
          <input
            id="ac-unit-photo-input"
            type="file"
            accept="image/*"
            onChange={(e) => { void handlePhotoChange(e); }}
            className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border file:border-[var(--border)] file:bg-[var(--surface-hover)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--text-primary)]"
          />
          {processingPhoto && <p className="text-xs text-[var(--text-secondary)]">{t("Processing photo…")}</p>}
          {photoUrl && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={unitName || device.name}
                className="max-h-40 w-full rounded-lg border border-[var(--border)] object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotoUrl("")}
                className="text-xs font-medium text-red-500 hover:underline"
              >
                {t("Remove photo")}
              </button>
            </div>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-red-500">{t(error)}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={processingPhoto}
            className="min-h-10 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#20170a] hover:bg-amber-400 disabled:opacity-50"
          >
            {t("Save location")}
          </button>
        </div>
      </form>
    </div>
  );
}

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
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
              {device.unitName || device.name}
            </h1>
            <div className="inline-flex items-center gap-1.5">
              <DynamicSensorStatusBadge device={device} />
              {!device.archivedAt && !hasRecentContact(device) && (
                <HelpPopover
                  label={t("Sensor connection checklist")}
                  title={t("Sensor unavailable — what to check")}
                >
                  <p>{t("This sensor hasn't sent a recent reading. You usually do not need to re-enter Wi-Fi credentials.")}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>{t("Check that the sensor has power and its indicator LED is on.")}</li>
                    <li>{t("Check that your 2.4 GHz Wi-Fi router is online, then wait 1–2 minutes for automatic reconnection.")}</li>
                    <li>{t("Only re-setup Wi-Fi (hold BOOT for 5 seconds, then Add Device) if your Wi-Fi name or password changed.")}</li>
                  </ul>
                </HelpPopover>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            {device.unitName ? `${device.name} · ` : ""}{device.macAddress}
          </p>
          {device.roomLocation && (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              📍 {device.roomLocation}
            </p>
          )}
        </div>

        <div className={styles.headerActions}>
          {!device.archivedAt && (
            <button
              type="button"
              onClick={() => setShowEditLocation(true)}
              className={styles.control}
            >
              {t("Edit AC & Room")}
            </button>
          )}
          <TelemetryExport key={device.id} deviceId={device.id} deviceName={device.unitName || device.name} />
        </div>
      </div>

      {device.locationPhotoUrl && (
        <div className="surface-card rounded-xl border border-[var(--border)] p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {t("Room & AC photo")}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {t("Tap photo to enlarge")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            aria-label={t("View room photo")}
            className="block w-full max-w-md overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={device.locationPhotoUrl}
              alt={device.unitName || device.name}
              className="h-48 w-full object-cover transition hover:opacity-95 sm:h-56"
            />
          </button>
        </div>
      )}

      {showPhotoModal && device.locationPhotoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={device.unitName || device.name}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowPhotoModal(false);
          }}
        >
          <div className="surface-card w-full max-w-2xl space-y-3 rounded-2xl border border-[var(--border)] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)]">{device.unitName || device.name}</p>
                {device.roomLocation && (
                  <p className="text-xs text-[var(--text-secondary)]">📍 {device.roomLocation}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                aria-label={t("Close dialog")}
                className="flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                ✕
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={device.locationPhotoUrl}
              alt={device.unitName || device.name}
              className="max-h-[75vh] w-full rounded-xl border border-[var(--border)] object-contain"
            />
          </div>
        </div>
      )}

      {showEditLocation && (
        <EditLocationModal device={device} onClose={() => setShowEditLocation(false)} />
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
