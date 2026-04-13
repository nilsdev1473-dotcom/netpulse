"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

interface Packet {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
  speed: number;
  label: string;
  type: "http2" | "http3" | "tracker" | "large" | "normal";
}

const PACKET_HEIGHT = 14;
const PACKET_COLORS: Record<Packet["type"], string> = {
  http2: "#00E8ED",
  http3: "#00FF94",
  tracker: "#FF3B3B",
  large: "#FFB800",
  normal: "rgba(255,255,255,0.35)",
};

export interface FlaggedItem {
  id: string;
  domain: string;
  type: "http2" | "http3" | "tracker" | "large" | "normal";
  label: string;
  size?: number;
  icon: string;
  timestamp: number;
  description: string;
}

interface TrafficCanvasProps {
  onFlaggedItem?: (item: FlaggedItem) => void;
}

function getDownlink(): number {
  const conn = (navigator as Navigator & { connection?: { downlink?: number } })
    .connection;
  return conn?.downlink ?? 5;
}

function classifyEntry(entry: PerformanceResourceTiming): Packet["type"] {
  const url = entry.name.toLowerCase();
  const trackers = [
    "googlesyndication",
    "doubleclick",
    "facebook",
    "analytics",
    "gtm",
    "hotjar",
  ];
  if (trackers.some((t) => url.includes(t))) return "tracker";
  if (entry.transferSize > 2_000_000) return "large";
  if (entry.nextHopProtocol === "h3" || entry.nextHopProtocol === "http/3")
    return "http3";
  return "http2";
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "").slice(0, 10);
  } catch {
    return url.slice(0, 10);
  }
}

export default function TrafficCanvas({ onFlaggedItem }: TrafficCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packetsRef = useRef<Packet[]>([]);
  const rafRef = useRef<number>(0);

  const laneYPositions = useMemo(() => [28, 56, 84, 112, 148, 172], []);

  const spawnPacket = useCallback(
    (type: Packet["type"], label: string, canvasWidth: number) => {
      const laneY =
        laneYPositions[Math.floor(Math.random() * laneYPositions.length)];
      const width = 22 + Math.random() * 22;
      const downlink = getDownlink();
      const baseSpeed = 1.2 + (downlink / 100) * 3;
      const speed = baseSpeed + Math.random() * 1.5;
      packetsRef.current.push({
        x: canvasWidth + width,
        y: laneY,
        width,
        height: PACKET_HEIGHT,
        color: PACKET_COLORS[type],
        alpha: 1,
        speed,
        label,
        type,
      });
    },
    [laneYPositions],
  );

  const seedMockPackets = useCallback(
    (canvasWidth: number) => {
      const mockEntries: { type: Packet["type"]; label: string }[] = [
        { type: "http2", label: "cdn.js" },
        { type: "normal", label: "api.svc" },
        { type: "tracker", label: "gads.io" },
        { type: "http3", label: "edge.net" },
        { type: "large", label: "img.cdn" },
        { type: "normal", label: "fonts" },
        { type: "http2", label: "chunk.js" },
        { type: "tracker", label: "gtm.io" },
      ];
      mockEntries.forEach((e, i) => {
        setTimeout(() => {
          const lane = laneYPositions[i % laneYPositions.length];
          const width = 24 + Math.random() * 20;
          const speed = 1.5 + Math.random() * 2;
          packetsRef.current.push({
            x: canvasWidth + width + i * 80,
            y: lane,
            width,
            height: PACKET_HEIGHT,
            color: PACKET_COLORS[e.type],
            alpha: 1,
            speed,
            label: e.label,
            type: e.type,
          });
        }, i * 180);
      });
    },
    [laneYPositions],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Seed initial packets
    seedMockPackets(canvas.offsetWidth);

    // PerformanceObserver for real traffic
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType !== "resource") continue;
          const res = entry as PerformanceResourceTiming;
          const type = classifyEntry(res);
          const domain = getDomain(res.name);
          spawnPacket(type, domain, canvas.offsetWidth);
          if (type === "tracker" || type === "large") {
            const icons = {
              tracker: "🛡",
              large: "📦",
              http2: "ℹ",
              http3: "ℹ",
              normal: "ℹ",
            };
            const descs = {
              tracker: `Advertising/tracking script detected (${Math.round(res.transferSize / 1024)}KB)`,
              large: `Large file loaded — may impact performance (${Math.round((res.transferSize / 1024 / 1024) * 10) / 10}MB)`,
              http2: `HTTP/2 resource loaded`,
              http3: `HTTP/3 resource loaded`,
              normal: `Resource loaded`,
            };
            onFlaggedItem?.({
              id: `${Date.now()}-${Math.random()}`,
              domain,
              type,
              label: res.name,
              size: res.transferSize,
              icon: icons[type],
              timestamp: Date.now(),
              description: descs[type],
            });
          }
        }
      });
      observer.observe({ type: "resource", buffered: false });
    } catch {}

    // Mock interval so canvas never looks empty
    const mockInterval = setInterval(() => {
      const mockTypes: Packet["type"][] = [
        "http2",
        "normal",
        "http3",
        "tracker",
      ];
      const mockLabels = [
        "cdn.net",
        "api.io",
        "fonts",
        "img.co",
        "gtm.js",
        "chunk",
        "static",
      ];
      const idx = Math.floor(Math.random() * mockTypes.length);
      spawnPacket(mockTypes[idx], mockLabels[idx], canvas.offsetWidth);
    }, 800);

    // Draw loop
    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // Lane grid lines
      ctx.strokeStyle = "rgba(0,232,237,0.04)";
      ctx.lineWidth = 0.5;
      for (const y of laneYPositions) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Update + draw packets
      packetsRef.current = packetsRef.current.filter((p) => {
        p.x -= p.speed;
        // Fade out near left edge
        if (p.x < 60) p.alpha = Math.max(0, p.x / 60);
        return p.x + p.width > -10 && p.alpha > 0.01;
      });

      for (const p of packetsRef.current) {
        ctx.save();
        ctx.globalAlpha = p.alpha;

        // Glow
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;

        // Packet body
        ctx.fillStyle = p.color.startsWith("rgba") ? p.color : `${p.color}33`;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        const r = 3;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y - p.height / 2, p.width, p.height, r);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.color;
        ctx.font = `9px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.fillText(p.label.slice(0, 7), p.x + p.width / 2, p.y + 3);

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(mockInterval);
      observer?.disconnect();
    };
  }, [laneYPositions, spawnPacket, seedMockPackets, onFlaggedItem]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "200px",
        display: "block",
        background: "transparent",
      }}
      width={1200}
      height={200}
      aria-label="Network traffic visualization"
    />
  );
}
