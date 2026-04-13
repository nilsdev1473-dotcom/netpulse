"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FlaggedItem } from "@/components/TrafficCanvas";
import { LiquidGlassButton } from "@/components/ui/LiquidGlassButton";
import { getHistory, VPNDetector } from "@/lib/network";
import type { SpeedTestResult, VPNStatus } from "@/lib/types";

// Dynamic imports — SSR safe
const SpeedLineChart = dynamic(
  () => import("@/components/charts/SpeedLineChartDynamic"),
  { ssr: false },
);
const TrafficCanvas = dynamic(() => import("@/components/TrafficCanvas"), {
  ssr: false,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface SpeedPoint {
  value: number;
}

// ─── Country flags helper ────────────────────────────────────────────────────
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

// ─── Zone label ──────────────────────────────────────────────────────────────
function ZoneLabel({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: "var(--font-jetbrains-mono)",
        color: "rgba(0,232,237,0.45)",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

// ─── Separator ───────────────────────────────────────────────────────────────
function Separator() {
  return (
    <div
      style={{
        width: "100%",
        height: 1,
        background:
          "linear-gradient(90deg, transparent, rgba(0,232,237,0.18) 15%, rgba(0,232,237,0.18) 85%, transparent)",
      }}
    />
  );
}

// ─── VPN Detection Box ───────────────────────────────────────────────────────
function VPNBox() {
  const [status, setStatus] = useState<VPNStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const detector = new VPNDetector();
      const result = await detector.detect();
      setStatus(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    timerRef.current = setInterval(run, 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [run]);

  const maskedIP = status?.publicIP
    ? status.publicIP.replace(/(\d+\.\d+)\.\d+\.\d+/, "$1.xxx.xxx")
    : "—";

  return (
    <div
      style={{
        background: "#0D0D10",
        border: "1px solid rgba(0,232,237,0.12)",
        padding: "16px 20px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <ZoneLabel label="VPN SHIELD" />

      {loading && !status ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "rgba(0,232,237,0.5)",
              animation: "pulse-dot 1s ease-in-out infinite",
              display: "inline-block",
            }}
          />
          <span
            style={{
              color: "rgba(0,232,237,0.5)",
              fontSize: 11,
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            SCANNING...
          </span>
        </div>
      ) : (
        <>
          {/* Status pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                padding: "3px 10px",
                border: `1px solid ${status?.detected ? "#FF3B3B" : "#00FF94"}`,
                background: status?.detected
                  ? "rgba(255,59,59,0.1)"
                  : "rgba(0,255,148,0.1)",
                fontSize: 11,
                fontFamily: "var(--font-jetbrains-mono)",
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: status?.detected ? "#FF3B3B" : "#00FF94",
              }}
            >
              {status?.detected ? "DETECTED" : "CLEAN"}
            </div>
            {/* Method badge */}
            <div
              style={{
                padding: "2px 8px",
                border: "1px solid rgba(0,232,237,0.2)",
                fontSize: 9,
                fontFamily: "var(--font-jetbrains-mono)",
                color: "rgba(0,232,237,0.6)",
                letterSpacing: "0.08em",
              }}
            >
              WebRTC
            </div>
          </div>

          {/* Details */}
          {status?.detected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>
                  {countryFlag(status.country)}
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 12,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  {status.country}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "rgba(0,232,237,0.6)",
                }}
              >
                {maskedIP}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "rgba(255,59,59,0.8)",
                }}
              >
                CONF: {status.confidence}%
              </div>
            </div>
          )}

          {!status?.detected && (
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-jetbrains-mono)",
                color: "rgba(0,232,237,0.5)",
              }}
            >
              {maskedIP}
            </div>
          )}

          {/* Speed impact */}
          {status?.detected && (
            <div
              style={{
                marginTop: "auto",
                padding: "6px 10px",
                background: "rgba(255,59,59,0.07)",
                border: "1px solid rgba(255,59,59,0.15)",
                fontSize: 10,
                fontFamily: "var(--font-jetbrains-mono)",
                color: "#FF3B3B",
              }}
            >
              −{Math.round(status.confidence * 0.3)}% slower vs baseline
            </div>
          )}

          {!status?.detected && (
            <div
              style={{
                marginTop: "auto",
                padding: "6px 10px",
                background: "rgba(0,255,148,0.05)",
                border: "1px solid rgba(0,255,148,0.12)",
                fontSize: 10,
                fontFamily: "var(--font-jetbrains-mono)",
                color: "#00FF94",
              }}
            >
              No speed impact detected
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Speed Meter + Graph ──────────────────────────────────────────────────────
function SpeedMeter() {
  const [mbps, setMbps] = useState(0);
  const [history, setHistory] = useState<SpeedPoint[]>(
    Array.from({ length: 60 }, () => ({ value: 0 })),
  );

  useEffect(() => {
    const tick = () => {
      const conn = (
        navigator as Navigator & { connection?: { downlink?: number } }
      ).connection;
      const val = conn?.downlink ?? 0;
      setMbps(val);
      setHistory((prev) => {
        const next = [...prev.slice(1), { value: val }];
        return next;
      });
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  const color = mbps > 50 ? "#00FF94" : mbps > 10 ? "#00E8ED" : "#FF3B3B";

  return (
    <div
      style={{
        background: "#0D0D10",
        border: "1px solid rgba(0,232,237,0.12)",
        padding: "16px 20px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <ZoneLabel label="VELOCITY" />

      {/* Big number */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1,
            color,
            textShadow: `0 0 20px ${color}55`,
            transition: "color 0.3s ease",
          }}
        >
          {mbps.toFixed(1)}
        </span>
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 14,
            color: "rgba(0,232,237,0.6)",
          }}
        >
          Mbps
        </span>
      </div>

      {/* Neon chart */}
      <div className="h-[150px]" style={{ flex: 1, minHeight: 150 }}>
        <SpeedLineChart data={history} />
      </div>
    </div>
  );
}

// ─── WiFi History Log ─────────────────────────────────────────────────────────
function WiFiHistoryLog() {
  const [items, setItems] = useState<SpeedTestResult[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    setItems(getHistory());
  }, []);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDoubleClick = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleEditDone = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connectionName: editName } : i)),
    );
    setEditingId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <ZoneLabel label="SIGNAL HISTORY" />

      {items.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 0",
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 12,
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            Run a speed test to start logging
          </span>
          <LiquidGlassButton
            className="text-[10px] px-4 py-1.5"
            style={{
              color: "#00E8ED",
              border: "1px solid rgba(0,232,237,0.3)",
            }}
          >
            START TEST
          </LiquidGlassButton>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 8,
            // Fade edges
            maskImage:
              "linear-gradient(90deg, transparent, black 40px, black calc(100% - 40px), transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, black 40px, black calc(100% - 40px), transparent)",
          }}
          className="scrollbar-hide"
        >
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                flexShrink: 0,
                background: "#0D0D10",
                border: "1px solid rgba(0,232,237,0.1)",
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 140,
              }}
            >
              {editingId === item.id ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleEditDone(item.id)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleEditDone(item.id)
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(0,232,237,0.4)",
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 11,
                    fontFamily: "var(--font-jetbrains-mono)",
                    outline: "none",
                    width: "100%",
                  }}
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() =>
                    handleDoubleClick(item.id, item.connectionName)
                  }
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "rgba(255,255,255,0.8)",
                    cursor: "text",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 120,
                  }}
                  title="Double-click to edit"
                >
                  {item.connectionName || "Unknown"}
                </button>
              )}

              <div style={{ display: "flex", gap: 6 }}>
                <span
                  style={{
                    padding: "1px 6px",
                    background: "rgba(0,255,148,0.1)",
                    border: "1px solid rgba(0,255,148,0.2)",
                    fontSize: 9,
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "#00FF94",
                  }}
                >
                  ↑ {item.download.toFixed(0)}
                </span>
                <span
                  style={{
                    padding: "1px 6px",
                    background: "rgba(255,59,59,0.1)",
                    border: "1px solid rgba(255,59,59,0.2)",
                    fontSize: 9,
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "#FF3B3B",
                  }}
                >
                  ↓ {item.upload.toFixed(0)}
                </span>
              </div>

              <span
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "rgba(0,232,237,0.4)",
                }}
              >
                {formatDate(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Flagged Items Feed ───────────────────────────────────────────────────────
function FlaggedFeed({ items }: { items: FlaggedItem[] }) {
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest (top)
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, []);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const typeColor: Record<FlaggedItem["type"], string> = {
    tracker: "#FF3B3B",
    large: "#FFB800",
    http3: "#00FF94",
    http2: "#00E8ED",
    normal: "rgba(255,255,255,0.4)",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "100%",
      }}
    >
      <ZoneLabel label="THREAT FEED" />

      {items.length === 0 ? (
        <div
          style={{
            color: "rgba(255,255,255,0.2)",
            fontSize: 11,
            fontFamily: "var(--font-jetbrains-mono)",
            padding: "12px 0",
          }}
        >
          Monitoring traffic... items will appear as resources load.
        </div>
      ) : (
        <div
          ref={feedRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            maxHeight: 220,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {items.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "6px 10px",
                background: idx === 0 ? "rgba(0,232,237,0.04)" : "transparent",
                border: `1px solid ${idx === 0 ? "rgba(0,232,237,0.12)" : "rgba(0,232,237,0.04)"}`,
                animation: idx === 0 ? "slide-in 0.25s ease-out" : "none",
                transition: "background 0.3s ease",
              }}
            >
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>
                {item.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontWeight: 600,
                      color: typeColor[item.type],
                    }}
                  >
                    {item.domain}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: "rgba(255,255,255,0.25)",
                    }}
                  >
                    {formatTime(item.timestamp)}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "rgba(255,255,255,0.55)",
                    margin: 0,
                    marginTop: 2,
                  }}
                >
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function Page() {
  const [flaggedItems, setFlaggedItems] = useState<FlaggedItem[]>([]);

  const handleFlaggedItem = useCallback((item: FlaggedItem) => {
    setFlaggedItems((prev) => [item, ...prev].slice(0, 20));
  }, []);

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(ellipse at 50% 30%, #070710 0%, #000000 100%)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 28px",
            borderBottom: "1px solid rgba(0,232,237,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 13,
                fontWeight: 700,
                color: "#00E8ED",
                letterSpacing: "0.15em",
                textShadow: "0 0 12px rgba(0,232,237,0.5)",
              }}
            >
              NETPULSE
            </span>
            <span
              style={{
                width: 1,
                height: 16,
                background: "rgba(0,232,237,0.2)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 9,
                color: "rgba(0,232,237,0.4)",
                letterSpacing: "0.12em",
              }}
            >
              NETWORK OPS
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00FF94",
                boxShadow: "0 0 6px #00FF94",
                animation: "pulse-dot 2s ease-in-out infinite",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 9,
                color: "rgba(0,232,237,0.5)",
                letterSpacing: "0.1em",
              }}
            >
              LIVE
            </span>
          </div>
        </div>

        {/* ── ZONE 1: VPN + Speed ── */}
        <div style={{ padding: "20px 28px 0" }}>
          <div style={{ display: "flex", gap: 16, height: 260 }}>
            {/* Left 40% — VPN */}
            <div style={{ flex: "0 0 40%" }}>
              <VPNBox />
            </div>
            {/* Right 60% — Speed */}
            <div style={{ flex: "0 0 calc(60% - 16px)" }}>
              <SpeedMeter />
            </div>
          </div>
        </div>

        {/* Separator */}
        <div style={{ padding: "20px 28px 0" }}>
          <Separator />
        </div>

        {/* ── ZONE 2: WiFi History ── */}
        <div style={{ padding: "16px 28px 0" }}>
          <WiFiHistoryLog />
        </div>

        {/* Separator */}
        <div style={{ padding: "16px 28px 0" }}>
          <Separator />
        </div>

        {/* ── ZONE 3: Packet Flow ── */}
        <div style={{ padding: "16px 28px 0" }}>
          <ZoneLabel label="PACKET FLOW" />
          <div
            style={{
              marginTop: 8,
              border: "1px solid rgba(0,232,237,0.1)",
              background: "#08080C",
              overflow: "hidden",
            }}
          >
            <TrafficCanvas onFlaggedItem={handleFlaggedItem} />
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {[
              { label: "HTTP/2", color: "#00E8ED" },
              { label: "HTTP/3", color: "#00FF94" },
              { label: "TRACKER", color: "#FF3B3B" },
              { label: "LARGE FILE", color: "#FFB800" },
              { label: "NORMAL", color: "rgba(255,255,255,0.3)" },
            ].map((t) => (
              <div
                key={t.label}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: t.color,
                    borderRadius: 1,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontSize: 8,
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div style={{ padding: "16px 28px 0" }}>
          <Separator />
        </div>

        {/* ── ZONE 4: Flagged Items ── */}
        <div style={{ padding: "16px 28px 24px" }}>
          <FlaggedFeed items={flaggedItems} />
        </div>
      </div>
    </>
  );
}
