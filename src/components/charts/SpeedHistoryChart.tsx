"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SpeedTestResult } from "@/lib/types";

interface SpeedHistoryChartProps {
  data: SpeedTestResult[];
}

interface TooltipPayload {
  value: number;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: "#0D0D10",
        border: "1px solid rgba(0,232,237,0.25)",
        borderRadius: 4,
        padding: "8px 12px",
        fontFamily: "var(--font-jetbrains-mono)",
        fontSize: 12,
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#00E8ED" }}>{payload[0]?.value?.toFixed(1)} Mbps</p>
    </div>
  );
}

export default function SpeedHistoryChart({ data }: SpeedHistoryChartProps) {
  const chartData = [...data].reverse().map((r) => ({
    date: new Date(r.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    download: parseFloat(r.download.toFixed(1)),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00E8ED" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#00E8ED" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(0,232,237,0.08)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
          tick={{
            fill: "rgba(255,255,255,0.35)",
            fontSize: 11,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
          axisLine={{ stroke: "rgba(0,232,237,0.1)" }}
          tickLine={false}
        />
        <YAxis
          tick={{
            fill: "rgba(255,255,255,0.35)",
            fontSize: 11,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}`}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="download"
          stroke="#00E8ED"
          strokeWidth={2}
          fill="url(#speedGradient)"
          dot={false}
          activeDot={{
            r: 4,
            fill: "#00E8ED",
            stroke: "#050507",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
