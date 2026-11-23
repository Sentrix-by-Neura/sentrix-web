"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSentrix, findGroup, hasRecentContact, type Device } from "../../lib/sentrix-store";
import { scanSentrixHardware, type ScanResult } from "../../lib/sentrix-bluetooth";
import { BleOnboardingModal } from "./ble-onboarding-modal";
import { useConfirm } from "../../components/confirm-modal";
import { HelpPopover } from "../../components/help-popover";
import { T, useLanguage } from "../../lib/language-context";

function StatusBadge({ device }: { device: Device }) {
  const { t } = useLanguage();
  if (device.archivedAt) return <span className="text-xs text-[var(--text-secondary)]">{t("Transferred — history only")}</span>;
  if (hasRecentContact(device) && device.status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[0.625rem] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
        {t("Monitoring active")}
      </span>
    );
  }

  if (hasRecentContact(device) && device.status === "CALIBRATING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[0.625rem] font-semibold tracking-wider text-amber-600 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        {t("Calibrating")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-2.5 py-0.5 font-mono text-[0.625rem] font-semibold tracking-wider text-[var(--text-muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
      {t("Unavailable")}
    </span>
  );
}

function LocationDetailContent() {
  const { t } = useLanguage();
  const params = useParams();
  const groupSlug = typeof params?.groupName === "string" ? params.groupName : "";
  const { ready, groups, devices, deleteDevice } = useSentrix();
  const [showBleModal, setShowBleModal] = useState(false);
  const [bleScan, setBleScan] = useState<Promise<ScanResult>>();
  function openBleModal() {
    setBleScan(scanSentrixHardware());
    setShowBleModal(true);
  }
  const confirm = useConfirm();

  if (!ready) {
    return (
      <p className="py-24 text-center font-mono text-xs text-[var(--text-muted)]">
        {t("Loading…")}
      </p>
    );
  }

  const group = findGroup(groups, groupSlug);

  if (!group) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t("Location Not Found")}</h1>
        <p className="mb-4 mt-1 text-xs text-[var(--text-muted)]">
          {t("No location group found matching")} “{groupSlug}”.
        </p>
        <Link
          href="/dashboard"
          className="text-xs text-amber-600 hover:text-amber-500 dark:text-amber-400"
        >
          {t("← Return to Global Overview")}
        </Link>
      </div>
    );
  }

  const groupDevices = devices.filter((d) => d.groupId === group.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label={t("Breadcrumb")} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link href="/dashboard" className="transition hover:text-[var(--text-primary)]">
          {t("Dashboard")}
        </Link>
        <span>/</span>
        <span className="font-medium text-[var(--text-primary)]">{group.name}</span>
      </nav>

      {/* Header Section */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          {group.name}
        </h1>
        <button
          type="button"
          id="add-device-to-group-button"
          onClick={openBleModal}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-semibold text-[#20170a] shadow-sm shadow-amber-500/20 transition hover:bg-amber-400"
        >
          <span aria-hidden="true" className="text-base font-bold leading-none">+</span>
          {t("Add Device")}
        </button>
      </div>

      {/* Sensors Card Grid Section */}
      <section aria-label={t("Sensors")} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="eyebrow">{t("Sensors")}</h2>
            <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
              {groupDevices.length.toString().padStart(2, "0")}
            </span>
            <HelpPopover label={t("What do sensor statuses mean?")} title={t("What do sensor statuses mean?")}>
              <dl className="space-y-1.5">
                <div>
                  <dt className="inline font-semibold text-emerald-600 dark:text-emerald-400">{t("Monitoring active")}: </dt>
                  <dd className="inline">{t("Sensor is online and checking your AC normally.")}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-amber-600 dark:text-amber-400">{t("Calibrating")}: </dt>
                  <dd className="inline">{t("Sensor is online and learning this AC's normal 7-day power pattern.")}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-[var(--text-primary)]">{t("Unavailable")}: </dt>
                  <dd className="inline">{t("No recent signal. Check power and Wi-Fi first — you only need to re-enter Wi-Fi if your network name or password changed.")}</dd>
                </div>
              </dl>
            </HelpPopover>
          </div>
        </div>

        {groupDevices.length === 0 ? (
          <div className="surface-card rounded-xl border border-[var(--border)] p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)]">
              ⚡
            </div>
            <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">
              {t("No sensors connected")}
            </h3>
            <button
              type="button"
              onClick={openBleModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-[#20170a] hover:bg-amber-400"
            >
              {t("+ Add First Device")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupDevices.map((device) => (
              <div
                key={device.id}
                data-context-type="device"
                data-context-id={device.id}
                className="surface-card group relative flex flex-col justify-between rounded-xl border border-[var(--border)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/50 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-amber-500 transition line-clamp-1">
                        <Link
                          href={`/dashboard/${group.slug}/${device.id}`}
                          className="after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-amber-500"
                        >
                          {device.unitName || device.name}
                        </Link>
                      </h3>
                      {device.roomLocation && (
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                          📍 {device.roomLocation}
                        </p>
                      )}
                      <p className="font-mono text-xs text-[var(--text-muted)]">
                        {device.unitName ? `${device.name} · ` : ""}{device.macAddress}
                      </p>
                    </div>
                    <button
                      type="button"
                      id={`delete-device-${device.id}`}
                      title={`${t(device.archivedAt ? "Delete archived history for" : "Delete")} ${device.name}`}
                      aria-label={`${t(device.archivedAt ? "Delete archived history for" : "Delete")} ${device.name}`}
                      onClick={async () => {
                        const ok = await confirm({
                          title: device.archivedAt ? "Delete Archived History" : "Delete Sensor",
                          message: device.archivedAt ? "Permanently delete this archived sensor's telemetry, predictions, and alerts? This does not affect the sensor's current owner." : "Remove this device and permanently delete its telemetry, predictions, and alerts? Hold BOOT for 5 seconds and release before setting it up again.",
                          confirmText: device.archivedAt ? "Delete History" : "Delete Sensor",
                          type: "danger",
                        });
                        if (ok) {
                          try { await deleteDevice(device.id); } catch { return; }
                        }
                      }}
                      className="relative z-10 self-start rounded p-1 text-[var(--text-muted)] opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-5 flex items-center gap-2 border-t border-[var(--border)] pt-4">
                    <StatusBadge device={device} />
                    {!device.archivedAt && !hasRecentContact(device) && (
                      <HelpPopover
                        label={t("Sensor unavailable — what to check")}
                        title={t("Unavailable")}
                        className="relative z-10"
                      >
                        <p>{t("No recent signal — check power and Wi-Fi. No need to re-enter Wi-Fi unless it changed.")}</p>
                      </HelpPopover>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5-Step BLE Onboarding Modal */}
      {showBleModal && (
        <BleOnboardingModal initialScan={bleScan} group={group} onClose={() => setShowBleModal(false)} />
      )}
    </div>
  );
}

export default function GroupLocationPage() {
  return (
    <Suspense
      fallback={
        <p className="py-24 text-center font-mono text-xs text-[var(--text-muted)]">
          <T>Loading location…</T>
        </p>
      }
    >
      <LocationDetailContent />
    </Suspense>
  );
}
