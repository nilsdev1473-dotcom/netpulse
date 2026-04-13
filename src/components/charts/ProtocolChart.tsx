"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface ProtocolChartProps {
  http2: number;
  http3: number;
  other: number;
}

interface TooltipPayload {
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div
      style={{
        background: "#0D0D10",
        border: "1px solid rgba(0,232,237,0.25)",
        borderRadius: 4,
        padding: "6px 12px",
        fontFamily: "var(--font-jetbrains-mono)",
        fontSize: 12,
        color: "rgba(255,255,255,0.8)",
      }}
    >
      {item?.name}: {item?.value}%
    </div>
  );
}

const COLORS = {
  "HTTP/2": "#00E8ED",
  "HTTP/3": "#00FF94",
  Other: "#555555",
};

export default function ProtocolChart({
  http2,
  http3,
  other,
}: ProtocolChartProps) {
  const raw = [
    { name: "HTTP/2", value: http2 },
    { name: "HTTP/3", value: http3 },
    { name: "Other", value: other },
  ].filter((d) => d.value > 0);

  const data =
    raw.length === 0
      ? [
          { name: "HTTP/2", value: 50 },
          { name: "HTTP/3", value: 50 },
          { name: "Other", value: 0 },
        ].filter((d) => d.value > 0)
      : raw;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={3}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={COLORS[entry.name as keyof typeof COLORS] ?? "#555555"}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
