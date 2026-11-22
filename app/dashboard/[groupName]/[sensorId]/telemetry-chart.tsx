"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTelemetryHistory, type TelemetryPoint, type TelemetryRange } from "../../../lib/sentrix-store";
import styles from "./sensor-detail.module.css";
import { useLanguage } from "../../../lib/language-context";

interface TelemetryChartProps {
  deviceId: string;
}

const minute = 60_000;
const timeframes = {
  "1h": { span: 60 * minute, maxGap: 3 * minute },
  "24h": { span: 24 * 60 * minute, maxGap: 15 * minute },
  "7d": { span: 7 * 24 * 60 * minute, maxGap: 45 * minute },
} satisfies Record<TelemetryRange, { span: number; maxGap: number }>;

const defaultSpan = timeframes["24h"].span;
const minimumSpan = minute;
const maximumSpan = 4 * timeframes["7d"].span;
const chartMargin = { top: 10, right: 10, left: 0, bottom: 0 };
const yAxisWidth = 48;
const xAxisHeight = 30;

type Viewport = { end: number | null; zoomSpan: number | null };
type CurrentDomain = [minimum: number, maximum: number];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function viewportEnd(end: number | null, span: number, oldest: number, latest: number) {
  return clamp(Math.round(end ?? latest), Math.min(oldest + span, latest), latest);
}

function wheelPixels(delta: number, mode: number, pageHeight: number) {
  return delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
}

type ChartPoint = {
  time: number; timestamp?: string; timeLabel?: string; rmsCurrent: number | null;
  bounds: [number, number] | null; lowerBound: number | null; upperBound: number | null;
  isAnomaly?: boolean; isolated?: boolean;
};

function makeChartPoints(points: TelemetryPoint[], start: number, maxGap: number) {
  const items: ChartPoint[] = [];
  const times = points.map(point => Math.max(start, Date.parse(point.timestamp)));
  points.forEach((point, index) => {
    const time = times[index];
    const hasPrevious = time - times[index - 1] <= maxGap;
    const hasNext = times[index + 1] - time <= maxGap;
    if (index > 0 && !hasPrevious) {
      items.push({ time: (time + times[index - 1]) / 2, rmsCurrent: null, bounds: null, lowerBound: null, upperBound: null });
    }
    items.push({
      ...point, time, isolated: !hasPrevious && !hasNext,
      bounds: point.lowerBound === null || point.upperBound === null ? null : [point.lowerBound, point.upperBound],
    });
  });
  return items;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartPoint;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  const { t, language } = useLanguage();
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data || data.rmsCurrent === null) return null;
  const safeRange = data.lowerBound === null || data.upperBound === null
    ? "Unknown"
    : `${data.lowerBound.toFixed(2)}–${data.upperBound.toFixed(2)} A`;

  return (
    <div className={styles.tooltip}>
      <p>{new Date(data.time).toLocaleString(language === "id" ? "id-ID" : "en-GB")}{data.isAnomaly ? ` (${t("anomaly")})` : ""}</p>
      <dl>
        <dt>{t("Current")}</dt><dd>{data.rmsCurrent.toFixed(2)} A</dd>
        <dt>{t("Safe range")}</dt><dd>{t(safeRange)}</dd>
      </dl>
    </div>
  );
}

export function TelemetryChart({ deviceId }: TelemetryChartProps) {
  const { t, language } = useLanguage();
  const { windowDate, axisDate, axisDateTime, axisTime } = useMemo(() => {
    const locale = language === "id" ? "id-ID" : "en-GB";
    return {
      windowDate: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
      axisDate: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }),
      axisDateTime: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      axisTime: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }),
    };
  }, [language]);
  const [viewport, setViewport] = useState<Viewport>({ end: null, zoomSpan: null });
  const [currentDomain, setCurrentDomain] = useState<CurrentDomain | null>(null);
  const [previewEnd, setPreviewEnd] = useState<number | null>(null);
  const [pointerInteraction, setPointerInteraction] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; origin: number; end: number; moved: boolean } | null>(null);
  const touchPan = useRef<{ x: number; y: number; origin: number; end: number; moved: boolean } | null>(null);
  const pinch = useRef<{ distance: number; span: number; end: number; fraction: number } | null>(null);
  const span = viewport.zoomSpan ?? defaultSpan;
  const fetchRange = span <= timeframes["1h"].span ? "1h" : span <= timeframes["24h"].span ? "24h" : "7d";
  const windowCount = Math.ceil(span / timeframes[fetchRange].span);
  const { history, loading, error, retry } = useTelemetryHistory(deviceId, fetchRange, viewport.end, windowCount);
  const latest = history?.latest ?? 0;
  const oldest = history?.oldest ?? latest;
  const earliestEnd = Math.min(latest, oldest + span);
  const displayedEnd = previewEnd ?? (history?.latest == null ? history?.end ?? 0 : viewportEnd(viewport.end, span, oldest, latest));
  const displayedStart = displayedEnd - span;
  const timeTicks = Array.from({ length: 5 }, (_, index) => displayedStart + span * index / 4);
  const tickFormat = span >= 4 * timeframes["24h"].span ? axisDate : span > timeframes["24h"].span ? axisDateTime : axisTime;
  const canPan = latest > earliestEnd;

  function navigateTo(time: number) {
    const end = viewportEnd(time, span, oldest, latest);
    setViewport(previous => ({ ...previous, end: end === latest ? null : end }));
  }

  function resetZoom() {
    setViewport({ end: null, zoomSpan: null });
    setCurrentDomain(null);
  }

  function zoomBy(factor: number, fraction = 0.5) {
    if (history?.latest == null) return;
    setPointerInteraction(true);
    setViewport(previous => {
      const width = previous.zoomSpan ?? defaultSpan;
      const zoomSpan = clamp(Math.round(width * factor), minimumSpan, maximumSpan);
      if (zoomSpan === width) return previous;
      const edge = viewportEnd(previous.end, width, oldest, latest);
      const end = viewportEnd(edge + (1 - fraction) * (zoomSpan - width), zoomSpan, oldest, latest);
      return { zoomSpan, end: end === latest ? null : end };
    });
  }

  function panBy(direction: -1 | 1) {
    if (!canPan) return;
    setPointerInteraction(true);
    navigateTo(displayedEnd + direction * (span / 2));
  }

  const canZoomIn = history?.latest != null && span > minimumSpan;
  const canZoomOut = history?.latest != null && span < maximumSpan;
  const canPanEarlier = canPan && displayedEnd > earliestEnd;
  const canPanLater = canPan && displayedEnd < latest;
  const isModified = viewport.zoomSpan !== null || viewport.end !== null || currentDomain !== null;

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    setPointerInteraction(true);
    if (event.pointerType === "touch" || !canPan || !event.isPrimary || event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: displayedEnd, end: displayedEnd, moved: false };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.id) return;
    const dx = event.clientX - current.x;
    if (!current.moved) {
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(event.clientY - current.y)) return;
      event.currentTarget.setPointerCapture(current.id);
      current.moved = true;
    }
    const width = Math.max(1, event.currentTarget.clientWidth - yAxisWidth - chartMargin.right);
    current.end = clamp(current.origin - dx * span / width, earliestEnd, latest);
    setPreviewEnd(current.end);
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const current = drag.current;
    if (!current || event.pointerId !== current.id) return;
    drag.current = null;
    if (!current.moved) return;
    setPreviewEnd(null);
    if (commit) navigateTo(current.end);
  }

  const chartData = useMemo(() => history ? makeChartPoints(history.points, history.start, timeframes[history.range].maxGap) : [], [history]);
  const visiblePoints = chartData.filter(point => point.rmsCurrent !== null && point.time >= displayedStart && point.time <= displayedEnd);
  const allValues = visiblePoints
    .flatMap((d) => [d.rmsCurrent, d.lowerBound, d.upperBound])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const minY = allValues.length > 0 ? Math.max(0, Math.floor(Math.min(...allValues) - 1)) : 0;
  const maxY = allValues.length > 0 ? Math.ceil(Math.max(...allValues) + 1.5) : 25;
  const wheel = useEffectEvent((event: WheelEvent, frame: HTMLDivElement) => {
    if (history?.latest == null || drag.current?.moved || event.ctrlKey) return;
    const bounds = frame.getBoundingClientRect();
    const dx = wheelPixels(event.deltaX, event.deltaMode, bounds.height);
    const dy = wheelPixels(event.deltaY, event.deltaMode, bounds.height);
    if (!dx && !dy) return;
    event.preventDefault();
    setPointerInteraction(true);

    const plotWidth = Math.max(1, bounds.width - yAxisWidth - chartMargin.right);
    const overAxis = event.clientX - bounds.left < yAxisWidth;
    if (event.shiftKey || Math.abs(dx) > Math.abs(dy)) {
      setViewport(previous => {
        const width = previous.zoomSpan ?? defaultSpan;
        const edge = viewportEnd(previous.end, width, oldest, latest);
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        const end = viewportEnd(edge + delta * width / plotWidth, width, oldest, latest);
        return { ...previous, end: end === latest ? null : end };
      });
      return;
    }

    const factor = Math.exp(clamp(dy, -500, 500) / 400);
    if (overAxis && chartData.length > 0) {
      const plotHeight = Math.max(1, bounds.height - chartMargin.top - xAxisHeight);
      const fraction = clamp(1 - (event.clientY - bounds.top - chartMargin.top) / plotHeight, 0, 1);
      setCurrentDomain(previous => {
        const [min, max] = previous ?? [minY, maxY];
        const height = clamp((max - min) * factor, 0.1, Math.max(100, maxY * 64));
        const lower = Math.max(0, min + fraction * (max - min - height));
        return [lower, lower + height];
      });
      return;
    }

    const fraction = clamp((event.clientX - bounds.left - yAxisWidth) / plotWidth, 0, 1);
    setViewport(previous => {
      const width = previous.zoomSpan ?? defaultSpan;
      const zoomSpan = clamp(Math.round(width * factor), minimumSpan, maximumSpan);
      if (zoomSpan === width) return previous;
      const edge = viewportEnd(previous.end, width, oldest, latest);
      const end = viewportEnd(edge + (1 - fraction) * (zoomSpan - width), zoomSpan, oldest, latest);
      return { zoomSpan, end: end === latest ? null : end };
    });
  });

  const handleTouchStart = useEffectEvent((event: TouchEvent, frame: HTMLDivElement) => {
    if (history?.latest == null) return;
    if (event.touches.length === 1) {
      pinch.current = null;
      if (!canPan) return;
      const touch = event.touches[0];
      touchPan.current = { x: touch.clientX, y: touch.clientY, origin: displayedEnd, end: displayedEnd, moved: false };
      return;
    }
    if (event.touches.length !== 2) return;
    drag.current = null;
    touchPan.current = null;
    setPreviewEnd(null);
    const [a, b] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    if (distance < 10) return;
    const bounds = frame.getBoundingClientRect();
    const plotWidth = Math.max(1, bounds.width - yAxisWidth - chartMargin.right);
    const midX = (a.clientX + b.clientX) / 2;
    const fraction = clamp((midX - bounds.left - yAxisWidth) / plotWidth, 0, 1);
    pinch.current = { distance, span, end: displayedEnd, fraction };
  });

  const handleTouchMove = useEffectEvent((event: TouchEvent, frame: HTMLDivElement) => {
    if (event.touches.length === 1 && touchPan.current && canPan) {
      const touch = event.touches[0];
      const dx = touch.clientX - touchPan.current.x;
      const dy = touch.clientY - touchPan.current.y;
      if (!touchPan.current.moved) {
        if (Math.abs(dx) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          touchPan.current = null;
          return;
        }
        touchPan.current.moved = true;
      }
      event.preventDefault();
      const width = Math.max(1, frame.clientWidth - yAxisWidth - chartMargin.right);
      touchPan.current.end = clamp(touchPan.current.origin - dx * span / width, earliestEnd, latest);
      setPreviewEnd(touchPan.current.end);
      return;
    }
    const activePinch = pinch.current;
    if (!activePinch || event.touches.length !== 2 || history?.latest == null) return;
    event.preventDefault();
    const [a, b] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    if (distance < 10) return;
    const factor = activePinch.distance / distance;
    const zoomSpan = clamp(Math.round(activePinch.span * factor), minimumSpan, maximumSpan);
    const end = viewportEnd(activePinch.end + (1 - activePinch.fraction) * (zoomSpan - activePinch.span), zoomSpan, oldest, latest);
    setViewport({ zoomSpan, end: end === latest ? null : end });
  });

  const handleTouchEnd = useEffectEvent((event: TouchEvent, commit: boolean) => {
    if (event.touches.length < 2) pinch.current = null;
    if (event.touches.length === 0 && touchPan.current) {
      const current = touchPan.current;
      touchPan.current = null;
      if (current.moved) {
        setPreviewEnd(null);
        if (commit) navigateTo(current.end);
      }
    }
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const handleWheel = (event: WheelEvent) => wheel(event, frame);
    const onTouchStart = (event: TouchEvent) => handleTouchStart(event, frame);
    const onTouchMove = (event: TouchEvent) => handleTouchMove(event, frame);
    const onTouchEnd = (event: TouchEvent) => handleTouchEnd(event, true);
    const onTouchCancel = (event: TouchEvent) => handleTouchEnd(event, false);
    frame.addEventListener("wheel", handleWheel, { passive: false });
    frame.addEventListener("touchstart", onTouchStart, { passive: true });
    frame.addEventListener("touchmove", onTouchMove, { passive: false });
    frame.addEventListener("touchend", onTouchEnd, { passive: true });
    frame.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      frame.removeEventListener("wheel", handleWheel);
      frame.removeEventListener("touchstart", onTouchStart);
      frame.removeEventListener("touchmove", onTouchMove);
      frame.removeEventListener("touchend", onTouchEnd);
      frame.removeEventListener("touchcancel", onTouchCancel);
    };
  }, []);

  return (
    <section aria-label={t("Current history")} className={`${styles.panel} space-y-5`}>
      <div className={styles.sectionHeader}>
        <h2>{t("Current history")}</h2>
        <div role="group" aria-label={t("Chart zoom and pan controls")} className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={styles.control}
            onClick={() => panBy(-1)}
            disabled={!canPanEarlier}
            aria-label={t("Pan earlier")}
            title={t("Pan earlier")}
          >
            ←
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={() => panBy(1)}
            disabled={!canPanLater}
            aria-label={t("Pan later")}
            title={t("Pan later")}
          >
            →
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={() => zoomBy(2)}
            disabled={!canZoomOut}
            aria-label={t("Zoom out")}
            title={t("Zoom out")}
          >
            −
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={() => zoomBy(0.5)}
            disabled={!canZoomIn}
            aria-label={t("Zoom in")}
            title={t("Zoom in")}
          >
            +
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={resetZoom}
            disabled={!isModified}
          >
            {t("Reset zoom")}
          </button>
        </div>
      </div>

      <div className={styles.legend}>
        <span><i aria-hidden="true" className={styles.currentKey} />{t("Current (AC power draw)")}</span>
        <span><i aria-hidden="true" className={styles.rangeKey} />{t("Safe range (normal band)")}</span>
        <span><i aria-hidden="true" className={styles.anomalyKey} />{t("Anomaly (outside safe range)")}</span>
      </div>

      <details className="rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-3.5 py-2.5 text-sm text-[var(--text-secondary)]">
        <summary className="cursor-pointer select-none font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400">
          {t("How to read this chart (Normal vs. Anomaly)")}
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {t("Sample normal reading")}
            </p>
            <p className="mt-1 font-mono text-xs text-[var(--text-primary)]">
              4.20 A · {t("Safe range")} 3.50–5.00 A
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              {t("RMS Current measures how hard the AC is working. When the line stays inside the shaded Safe Range, the AC is running normally.")}
            </p>
          </div>
          <div className="rounded-lg border border-red-500/25 bg-[var(--surface)] p-3">
            <p className="flex items-center gap-2 font-semibold text-red-500">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
              {t("Sample anomaly")}
            </p>
            <p className="mt-1 font-mono text-xs text-[var(--text-primary)]">
              7.40 A · {t("Safe range")} 3.50–5.00 A
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              {t("A red dot marks a spike or drop outside the Safe Range — a sign to check for dirty filters, icing, or compressor strain.")}
            </p>
          </div>
        </div>
      </details>

      <div
        ref={frameRef}
        className={`relative h-80 w-full ${styles.chartFrame} ${canPan ? styles.panChart : ""}`}
        data-dragging={previewEnd !== null || undefined}
        data-pointer-interaction={pointerInteraction || undefined}
        onFocusCapture={event => {
          if (event.target.matches(":focus-visible")) setPointerInteraction(false);
        }}
        onKeyDownCapture={event => {
          if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) setPointerInteraction(false);
          if (!canPan || !event.shiftKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          event.preventDefault();
          event.stopPropagation();
          navigateTo(displayedEnd + (event.key === "ArrowLeft" ? -1 : 1) * span / 4);
        }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={event => finishDrag(event, true)}
        onPointerCancel={event => finishDrag(event, false)}
        onPointerLeave={event => {
          if (!drag.current?.moved) finishDrag(event, false);
        }}
        onLostPointerCapture={event => {
          if (event.target === event.currentTarget) finishDrag(event, false);
        }}
      >
        {history?.oldest != null && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={chartMargin} aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight">
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={[displayedStart, displayedEnd]}
              height={xAxisHeight}
              allowDataOverflow
              ticks={timeTicks}
              tickFormatter={value => tickFormat.format(value)}
              stroke="var(--chart-label)"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              className={styles.zoomAxis}
              width={yAxisWidth}
              stroke="var(--chart-label)"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              domain={currentDomain ?? [minY, maxY]}
              allowDataOverflow={currentDomain !== null}
              unit=" A"
            />
            {previewEnd === null && <Tooltip content={<CustomTooltip />} />}

            {/* Shaded Auto-ARIMA Confidence Interval Area */}
            <Area
              type="monotone"
              dataKey="bounds"
              stroke="none"
              fill="var(--sensor-accent)"
              fillOpacity={0.16}
              isAnimationActive={false}
            />

            {/* Expected Upper & Lower Bound Boundary Guidelines */}
            <Line
              type="monotone"
              dataKey="upperBound"
              stroke="var(--sensor-accent)"
              strokeOpacity={0.35}
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="lowerBound"
              stroke="var(--sensor-accent)"
              strokeOpacity={0.35}
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />

            {/* Live Electrical RMS Telemetry Data Line */}
            <Line
              type="monotone"
              dataKey="rmsCurrent"
              stroke="var(--chart-line)"
              strokeWidth={2}
              isAnimationActive={false}
              activeDot={{ r: 6, fill: "var(--chart-line)", stroke: "var(--surface)", strokeWidth: 2 }}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (!(payload?.isAnomaly || payload?.isolated) || cx == null || cy == null) return <g key={`empty-${props.index}`} />;
                return (
                  <g key={`anomaly-${payload.timestamp}`}>
                    <circle cx={cx} cy={cy} r={payload.isAnomaly ? 4.5 : 2.5} fill={payload.isAnomaly ? "var(--sensor-danger)" : "var(--chart-line)"} stroke="var(--surface)" strokeWidth={1.5} />
                  </g>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        )}
        {visiblePoints.length === 0 && previewEnd === null && (
          <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--text-secondary)]">
            {t(loading ? "Loading current history…" : error ? "Current history is unavailable." : "No readings in this window.")}
          </div>
        )}
      </div>
      {history?.oldest != null && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <p>{windowDate.formatRange(displayedStart, displayedEnd)}</p>
          <p>{t("Pinch or use + / − to zoom · Drag or use arrows to pan · Tap any point for details")}</p>
        </div>
      )}
      {loading && visiblePoints.length > 0 && <p role="status" className={styles.message}>{t("Loading current history…")}</p>}
      {error && (
        <div className={styles.message}>
          <p role="status">{t("Could not refresh current history.")} {t(error)}</p>
          <button type="button" className={styles.control} onClick={retry}>{t("Retry")}</button>
        </div>
      )}
    </section>
  );
}
