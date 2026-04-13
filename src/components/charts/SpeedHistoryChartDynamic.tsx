"use client";

import dynamic from "next/dynamic";
import type { SpeedTestResult } from "@/lib/types";

const SpeedHistoryChart = dynamic(() => import("./SpeedHistoryChart"), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{
        color: "rgba(0,232,237,0.4)",
        fontFamily: "var(--font-jetbrains-mono)",
        fontSize: 12,
      }}
    >
      Loading chart...
    </div>
  ),
});

interface SpeedHistoryChartDynamicProps {
  data: SpeedTestResult[];
}

export default function SpeedHistoryChartDynamic({
  data,
}: SpeedHistoryChartDynamicProps) {
  return <SpeedHistoryChart data={data} />;
}
