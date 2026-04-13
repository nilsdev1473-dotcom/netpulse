"use client";

import dynamic from "next/dynamic";

const SpeedLineChart = dynamic(() => import("./SpeedLineChart"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <span
        style={{
          color: "rgba(0,232,237,0.3)",
          fontSize: 11,
          fontFamily: "var(--font-jetbrains-mono)",
        }}
      >
        LOADING...
      </span>
    </div>
  ),
});

export default SpeedLineChart;
