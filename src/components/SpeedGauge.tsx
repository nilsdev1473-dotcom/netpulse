"use client";

import { useId } from "react";

interface SpeedGaugeProps {
  value: number;
  max: number;
  unit: string;
  label: string;
  color: string;
}

const RADIUS = 80;
const HALF_CIRC = Math.PI * RADIUS; // ≈ 251.33

// Half-circle arc path: from left (20,100) → right (180,100) sweeping upward
const ARC_PATH = `M 20 100 A ${RADIUS} ${RADIUS} 0 0 1 180 100`;

export default function SpeedGauge({
  value,
  max,
  unit,
  label,
  color,
}: SpeedGaugeProps) {
  const uid = useId().replace(/:/g, "");
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const progressLen = ratio * HALF_CIRC;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* SVG gauge — viewBox crops to just the arc area + text */}
      <svg
        viewBox="0 0 200 130"
        className="w-full max-w-[280px]"
        aria-label={`${label}: ${value.toFixed(1)} ${unit}`}
      >
        <defs>
          <filter
            id={`glow-${uid}`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="6"
              floodColor={color}
              floodOpacity="0.75"
            />
          </filter>
        </defs>

        {/* Dark track (full half-circle) */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke="#0D0D10"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Dim colour track (background tint so gauge has a base) */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeOpacity="0.12"
          strokeDasharray={`${HALF_CIRC} ${HALF_CIRC}`}
        />

        {/* Progress arc */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${progressLen} ${HALF_CIRC}`}
          style={{
            transition: "stroke-dasharray 0.6s ease-out",
            filter: `drop-shadow(0 0 12px ${color})`,
          }}
        />

        {/* Value number */}
        <text
          x="100"
          y="78"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="38"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          fill="rgba(255,255,255,0.92)"
        >
          {value.toFixed(1)}
        </text>

        {/* Unit label */}
        <text
          x="100"
          y="100"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="500"
          letterSpacing="2"
          fill={color}
          opacity="0.8"
        >
          {unit.toUpperCase()}
        </text>
      </svg>

      {/* Gauge label below SVG */}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: "rgba(255,255,255,0.35)",
          fontSize: "11px",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}
