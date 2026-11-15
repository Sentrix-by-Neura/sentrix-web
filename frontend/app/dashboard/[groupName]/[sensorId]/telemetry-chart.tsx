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

interface TelemetryChartProps {
  deviceId: string;
}

const minute = 60_000;
const timeframes = {
  "1h": { label: "1 Hour", span: 60 * minute, maxGap: 3 * minute },
  "24h": { label: "24 Hours", span: 24 * 60 * minute, maxGap: 15 * minute },
  "7d": { label: "7 Days", span: 7 * 24 * 60 * minute, maxGap: 45 * minute },
} satisfies Record<TelemetryRange, { label: string; span: number; maxGap: number }>;

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

const windowDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const axisDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const axisDateTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const axisTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

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
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data || data.rmsCurrent === null) return null;
  const safeRange = data.lowerBound === null || data.upperBound === null
    ? "Unknown"
    : `${data.lowerBound.toFixed(2)}–${data.upperBound.toFixed(2)} A`;

  return (
    <div className={styles.tooltip}>
      <p>{data.timeLabel}{data.isAnomaly ? " (anomaly)" : ""}</p>
      <dl>
        <dt>Current</dt><dd>{data.rmsCurrent.toFixed(2)} A</dd>
        <dt>Safe range</dt><dd>{safeRange}</dd>
      </dl>
    </div>
  );
}

export function TelemetryChart({ deviceId }: TelemetryChartProps) {
  const [timeframe, setTimeframe] = useState<TelemetryRange>("24h");
  const [viewport, setViewport] = useState<Viewport>({ end: null, zoomSpan: null });
  const [currentDomain, setCurrentDomain] = useState<CurrentDomain | null>(null);
  const [previewEnd, setPreviewEnd] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; origin: number; end: number; moved: boolean } | null>(null);
  const span = viewport.zoomSpan ?? timeframes[timeframe].span;
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
    setViewport(previous => ({ ...previous, zoomSpan: null }));
    setCurrentDomain(null);
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!canPan || !event.isPrimary || event.button !== 0) return;
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

    const plotWidth = Math.max(1, bounds.width - yAxisWidth - chartMargin.right);
    const overAxis = event.clientX - bounds.left < yAxisWidth;
    if (event.shiftKey || Math.abs(dx) > Math.abs(dy)) {
      setViewport(previous => {
        const width = previous.zoomSpan ?? timeframes[timeframe].span;
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
      const width = previous.zoomSpan ?? timeframes[timeframe].span;
      const zoomSpan = clamp(Math.round(width * factor), minimumSpan, maximumSpan);
      if (zoomSpan === width) return previous;
      const edge = viewportEnd(previous.end, width, oldest, latest);
      const end = viewportEnd(edge + (1 - fraction) * (zoomSpan - width), zoomSpan, oldest, latest);
      return { zoomSpan, end: end === latest ? null : end };
    });
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const handleWheel = (event: WheelEvent) => wheel(event, frame);
    frame.addEventListener("wheel", handleWheel, { passive: false });
    return () => frame.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <section aria-label="Current history" className={`${styles.panel} space-y-5`}>
      <div className={styles.sectionHeader}>
        <h2>Current history</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div aria-label="Chart timeframe" className={styles.ranges}>
            {(Object.keys(timeframes) as TelemetryRange[]).map(id => (
              <button
                key={id}
                type="button"
                id={`toggle-timeframe-${id}`}
                aria-pressed={timeframe === id}
                onClick={() => { setTimeframe(id); resetZoom(); }}
              >
                {timeframes[id].label}
              </button>
            ))}
          </div>
          {(viewport.zoomSpan !== null || currentDomain !== null) && (
            <button type="button" className={styles.control} onClick={resetZoom}>Reset zoom</button>
          )}
        </div>
      </div>

      <div className={styles.legend}>
        <span><i aria-hidden="true" className={styles.currentKey} />Current</span>
        <span><i aria-hidden="true" className={styles.rangeKey} />Safe range</span>
        <span><i aria-hidden="true" className={styles.anomalyKey} />Anomaly</span>
      </div>

      <div
        ref={frameRef}
        className={`relative h-80 w-full ${styles.chartFrame} ${canPan ? styles.panChart : ""}`}
        data-dragging={previewEnd !== null || undefined}
        onKeyDownCapture={event => {
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
            {loading ? "Loading current history…" : error ? "Current history is unavailable." : "No readings in this window."}
          </div>
        )}
      </div>
      {history?.oldest != null && (
        <p className="text-xs text-[var(--text-secondary)]">
          {windowDate.formatRange(displayedStart, displayedEnd)}
        </p>
      )}
      {loading && visiblePoints.length > 0 && <p role="status" className={styles.message}>Loading current history…</p>}
      {error && (
        <div className={styles.message}>
          <p role="status">Could not refresh current history. {error}</p>
          <button type="button" className={styles.control} onClick={retry}>Retry</button>
        </div>
      )}
    </section>
  );
}
