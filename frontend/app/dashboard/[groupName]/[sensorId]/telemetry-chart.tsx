"use client";

import { useState } from "react";
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
import { useTelemetry, type TelemetryPoint, type TelemetryRange } from "../../../lib/sentrix-store";
import styles from "./sensor-detail.module.css";

interface TelemetryChartProps {
  deviceId: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: TelemetryPoint & { bounds: [number, number] };
  }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className={styles.tooltip}>
      <p>{data.timeLabel}{data.isAnomaly ? " (anomaly)" : ""}</p>
      <dl>
        <dt>Current</dt><dd>{data.rmsCurrent.toFixed(2)} A</dd>
        <dt>Safe range</dt><dd>{data.lowerBound?.toFixed(2) ?? "Unknown"} to {data.upperBound?.toFixed(2) ?? "Unknown"} A</dd>
      </dl>
    </div>
  );
}

export function TelemetryChart({ deviceId }: TelemetryChartProps) {
  const [timeframe, setTimeframe] = useState<TelemetryRange>("24h");

  const { points: rawData, loading, error } = useTelemetry(deviceId, timeframe);

  // Map to chart items with dual-bound array for shaded Area
  const chartData = rawData.map((pt) => ({
    ...pt,
    bounds: pt.lowerBound === null || pt.upperBound === null ? null : [pt.lowerBound, pt.upperBound],
  }));

  // Find min/max for dynamic Y-Axis scale safely
  const allValues = rawData
    .flatMap((d) => [d.rmsCurrent, d.lowerBound, d.upperBound])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const minY = allValues.length > 0 ? Math.max(0, Math.floor(Math.min(...allValues) - 1)) : 0;
  const maxY = allValues.length > 0 ? Math.ceil(Math.max(...allValues) + 1.5) : 25;

  return (
    <section aria-label="Current history" className={`${styles.panel} space-y-5`}>
      <div className={styles.sectionHeader}>
        <h2>Current history</h2>
        <div aria-label="Chart timeframe" className={styles.ranges}>
          {(
            [
              { id: "1h", label: "1 Hour" },
              { id: "24h", label: "24 Hours" },
              { id: "7d", label: "7 Days" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              id={`toggle-timeframe-${item.id}`}
              aria-pressed={timeframe === item.id}
              onClick={() => setTimeframe(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.legend}>
        <span><i aria-hidden="true" className={styles.currentKey} />Current</span>
        <span><i aria-hidden="true" className={styles.rangeKey} />Safe range</span>
        <span><i aria-hidden="true" className={styles.anomalyKey} />Anomaly</span>
      </div>

      <div className="h-80 w-full">
        {chartData.length === 0 ? (
          <div role="status" className="flex h-full items-center justify-center text-sm text-[var(--text-secondary)]">
            {error || (loading ? "Loading current history…" : "No readings in this timeframe.")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="timeLabel"
              stroke="var(--chart-label)"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              stroke="var(--chart-label)"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              domain={[minY, maxY]}
              unit=" A"
            />
            <Tooltip content={<CustomTooltip />} />

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
                if (!payload?.isAnomaly || cx == null || cy == null) return <g key={`empty-${props.index}`} />;
                return (
                  <g key={`anomaly-${payload.timestamp}`}>
                    <circle cx={cx} cy={cy} r={4.5} fill="var(--sensor-danger)" stroke="var(--surface)" strokeWidth={1.5} />
                  </g>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        )}
      </div>
      {error && chartData.length > 0 && <p role="status" className={styles.message}>Could not refresh current history. {error}</p>}
    </section>
  );
}
