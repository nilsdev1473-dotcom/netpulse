"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export interface SpeedPoint {
  value: number;
  label: string;
}

interface SpeedLineChartProps {
  data: SpeedPoint[];
}

export default function SpeedLineChart({ data }: SpeedLineChartProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const yMax = maxVal * 1.2;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <filter id="speed-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <XAxis
          dataKey="label"
          tick={{
            fill: "rgba(0,232,237,0.4)",
            fontSize: 8,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
          tickLine={false}
          axisLine={false}
          interval={4}
        />
        <YAxis
          domain={[0, yMax]}
          tick={{
            fill: "rgba(0,232,237,0.4)",
            fontSize: 8,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
          tickLine={false}
          axisLine={false}
          width={32}
          ticks={[0, Math.round(maxVal / 2), Math.round(maxVal)]}
          interval={0}
        />
        <ReferenceLine y={0} stroke="rgba(0,232,237,0.06)" />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#00E8ED"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: "#00E8ED", strokeWidth: 0 }}
          isAnimationActive={false}
          filter="url(#speed-glow)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
