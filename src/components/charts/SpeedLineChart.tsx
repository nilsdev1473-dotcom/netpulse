"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
} from "recharts";

interface DataPoint {
  value: number;
}

interface SpeedLineChartProps {
  data: DataPoint[];
}

export default function SpeedLineChart({ data }: SpeedLineChartProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <YAxis
          domain={[0, maxVal * 1.2]}
          tick={{
            fill: "rgba(0,232,237,0.5)",
            fontSize: 9,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
          tickLine={false}
          axisLine={false}
          width={28}
          ticks={[0, Math.round(maxVal / 2), Math.round(maxVal)]}
          interval={0}
        />
        <ReferenceLine
          y={0}
          stroke="rgba(0,232,237,0.08)"
          strokeDasharray="0"
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#00E8ED"
          strokeWidth={2}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
          filter="url(#neon-glow)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
