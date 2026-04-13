"use client";

import dynamic from "next/dynamic";

const ProtocolChart = dynamic(() => import("./ProtocolChart"), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{
        color: "rgba(0,232,237,0.4)",
        fontFamily: "var(--font-jetbrains-mono)",
        fontSize: 11,
      }}
    >
      Loading...
    </div>
  ),
});

interface ProtocolChartDynamicProps {
  http2: number;
  http3: number;
  other: number;
}

export default function ProtocolChartDynamic({
  http2,
  http3,
  other,
}: ProtocolChartDynamicProps) {
  return <ProtocolChart http2={http2} http3={http3} other={other} />;
}
