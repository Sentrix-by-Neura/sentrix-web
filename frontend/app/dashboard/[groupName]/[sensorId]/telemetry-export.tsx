"use client";

import { useEffect, useRef, useState } from "react";
import { telemetryCsv } from "../../../lib/sentrix-api";
import styles from "./sensor-detail.module.css";

export function TelemetryExport({ deviceId }: { deviceId: string }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => { pending.current?.abort(); }, []);

  async function download() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setExporting(true);
    setError(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const blob = await telemetryCsv(deviceId, timeZone, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sentrix-${deviceId}-${timeZone.replaceAll("/", "-")}.csv`;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        // Give the browser time to start consuming the download before cleanup.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Please try again.");
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setExporting(false);
    }
  }

  return (
    <div className={styles.export}>
      <button type="button" className={styles.control} onClick={() => { void download(); }} disabled={exporting} aria-busy={exporting}>
        {exporting ? "Exporting…" : "Export all data (CSV)"}
      </button>
      {error && <p role="alert" className={styles.exportError}>Could not export recorded data. {error}</p>}
    </div>
  );
}
