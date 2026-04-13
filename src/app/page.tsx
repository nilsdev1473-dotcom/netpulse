"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CpuArchitecture } from "@/components/ui/CpuArchitecture";
import { getHistory, getStats } from "@/lib/network";
import type { SpeedStats, SpeedTestResult } from "@/lib/types";

// ─── Nav Timing ─────────────────────────────────────────────────────────────

interface NavTiming {
  dns: number;
  tcp: number;
  ttfb: number;
  domLoad: number;
  pageLoad: number;
  protocol: string;
}

function readNavTiming(): NavTiming | null {
  if (typeof window === "undefined") return null;
  const entries = performance.getEntriesByType("navigation");
  if (!entries.length) return null;
  const nav = entries[0] as PerformanceNavigationTiming;
  if (!nav.loadEventEnd) return null; // not fully loaded yet
  return {
    dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
    tcp: Math.round(nav.connectEnd - nav.connectStart),
    ttfb: Math.round(nav.responseStart - nav.requestStart),
    domLoad: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
    pageLoad: Math.round(nav.loadEventEnd - nav.startTime),
    protocol: nav.nextHopProtocol || "unknown",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dlColor(mbps: number): string {
  if (mbps >= 100) return "var(--success)";
  if (mbps >= 25) return "#00E8ED";
  if (mbps >= 5) return "var(--warning)";
  return "var(--danger)";
}

function pingColor(ms: number): string {
  if (ms < 30) return "var(--success)";
  if (ms < 80) return "#00E8ED";
  if (ms < 150) return "var(--warning)";
  return "var(--danger)";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<SpeedStats | null>(null);
  const [history, setHistory] = useState<SpeedTestResult[]>([]);
  const [navTiming, setNavTiming] = useState<NavTiming | null>(null);
  const [online, setOnline] = useState(true);
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    // Load stored data
    setStats(getStats());
    setHistory(getHistory().slice(0, 5));

    // Online status
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Nav timing — read after full load
    const doReadTiming = () => {
      const t = readNavTiming();
      if (t) setNavTiming(t);
    };
    if (document.readyState === "complete") {
      doReadTiming();
    } else {
      window.addEventListener("load", doReadTiming, { once: true });
      // fallback: try after 500ms in case load already fired
      setTimeout(doReadTiming, 600);
    }

    // Live clock
    const clock = setInterval(() => setTime(new Date()), 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(clock);
    };
  }, []);

  const last = history[0] ?? null;
  const hasHistory = history.length > 0;

  const timeStr = time.toTimeString().slice(0, 8);
  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div style={{ padding: "32px", minHeight: "100vh" }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "32px",
          paddingBottom: "20px",
          borderBottom: "1px solid rgba(0,232,237,0.1)",
        }}
      >
        {/* Left: brand + status */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div>
            <div
              style={{ display: "flex", alignItems: "baseline", gap: "10px" }}
            >
              <h1
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "22px",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  color: "#00E8ED",
                  margin: 0,
                  textShadow: "0 0 24px rgba(0,232,237,0.45)",
                }}
              >
                NETPULSE
              </h1>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "10px",
                  color: "rgba(0,232,237,0.5)",
                  border: "1px solid rgba(0,232,237,0.25)",
                  borderRadius: "4px",
                  padding: "1px 6px",
                  letterSpacing: "0.08em",
                }}
              >
                v1.0
              </span>
            </div>
            <p
              style={{
                margin: "4px 0 0",
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "10px",
                color: "rgba(255,255,255,0.25)",
                letterSpacing: "0.12em",
              }}
            >
              NETWORK OPERATIONS CENTER
            </p>
          </div>

          {/* Status dot */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className={`status-dot ${
                online ? "status-dot-online" : "status-dot-error"
              }`}
            />
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "11px",
                letterSpacing: "0.1em",
                color: online ? "var(--success)" : "var(--danger)",
              }}
            >
              {online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Right: clock + CpuArchitecture decorative */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "22px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1,
                letterSpacing: "0.04em",
              }}
            >
              {timeStr}
            </div>
            <div
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "11px",
                color: "rgba(255,255,255,0.3)",
                marginTop: "3px",
                letterSpacing: "0.06em",
              }}
            >
              {dateStr}
            </div>
          </div>

          {/* CpuArchitecture — small decorative element */}
          <div
            style={{
              width: "110px",
              height: "55px",
              opacity: 0.65,
              flexShrink: 0,
            }}
          >
            <CpuArchitecture
              width={110}
              height={55}
              text="NP"
              animateLines
              animateMarkers
              animateText
              className="text-cyan-400"
            />
          </div>
        </div>
      </header>

      {/* ── Metric Cards ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <MetricCard
          label="DOWNLOAD"
          value={last ? last.download.toFixed(1) : "—"}
          unit="Mbps"
          color={last ? dlColor(last.download) : "rgba(255,255,255,0.2)"}
          pulse={!!(last && last.download >= 100)}
          glow={!!(last && last.download >= 50)}
        />
        <MetricCard
          label="UPLOAD"
          value={last ? last.upload.toFixed(1) : "—"}
          unit="Mbps"
          color={last ? dlColor(last.upload) : "rgba(255,255,255,0.2)"}
          pulse={false}
          glow={false}
        />
        <MetricCard
          label="PING"
          value={last ? String(last.ping) : "—"}
          unit="ms"
          color={last ? pingColor(last.ping) : "rgba(255,255,255,0.2)"}
          pulse={!!(last && last.ping < 30)}
          glow={!!(last && last.ping < 30)}
        />
        <MetricCard
          label="JITTER"
          value={last ? String(last.jitter) : "—"}
          unit="ms"
          color={
            last
              ? last.jitter < 5
                ? "var(--success)"
                : last.jitter < 20
                  ? "var(--warning)"
                  : "var(--danger)"
              : "rgba(255,255,255,0.2)"
          }
          pulse={false}
          glow={false}
        />
      </div>

      {/* ── Main Two-Column Grid ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
        {/* ── Connection Timing (PerformanceNavigationTiming) ── */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(0,232,237,0.1)",
            borderRadius: "4px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "18px",
            }}
          >
            <SectionLabel>Connection Timing</SectionLabel>
            {navTiming && (
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "10px",
                  color: "#00E8ED",
                  background: "rgba(0,232,237,0.08)",
                  border: "1px solid rgba(0,232,237,0.2)",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  letterSpacing: "0.06em",
                }}
              >
                {navTiming.protocol.toUpperCase()}
              </span>
            )}
          </div>

          {navTiming ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <TimingRow
                label="DNS Lookup"
                value={navTiming.dns}
                unit="ms"
                color={
                  navTiming.dns < 10
                    ? "var(--success)"
                    : navTiming.dns < 50
                      ? "var(--warning)"
                      : "var(--danger)"
                }
                maxMs={200}
              />
              <TimingRow
                label="TCP Connect"
                value={navTiming.tcp}
                unit="ms"
                color={
                  navTiming.tcp < 30
                    ? "var(--success)"
                    : navTiming.tcp < 100
                      ? "var(--warning)"
                      : "var(--danger)"
                }
                maxMs={300}
              />
              <TimingRow
                label="TTFB"
                value={navTiming.ttfb}
                unit="ms"
                color={
                  navTiming.ttfb < 50
                    ? "var(--success)"
                    : navTiming.ttfb < 200
                      ? "var(--warning)"
                      : "var(--danger)"
                }
                maxMs={500}
              />
              <TimingRow
                label="DOM Ready"
                value={navTiming.domLoad}
                unit="ms"
                color={
                  navTiming.domLoad < 500
                    ? "var(--success)"
                    : navTiming.domLoad < 1500
                      ? "var(--warning)"
                      : "var(--danger)"
                }
                maxMs={3000}
              />
              <TimingRow
                label="Page Load"
                value={navTiming.pageLoad}
                unit="ms"
                color={
                  navTiming.pageLoad < 1000
                    ? "var(--success)"
                    : navTiming.pageLoad < 3000
                      ? "var(--warning)"
                      : "var(--danger)"
                }
                maxMs={5000}
              />
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {[
                "DNS Lookup",
                "TCP Connect",
                "TTFB",
                "DOM Ready",
                "Page Load",
              ].map((lbl) => (
                <div
                  key={lbl}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    {lbl}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.15)",
                      animation: "pulse-testing 1.5s ease-in-out infinite",
                    }}
                  >
                    ...
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(0,232,237,0.1)",
            borderRadius: "4px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <SectionLabel style={{ marginBottom: "16px" }}>
            Quick Actions
          </SectionLabel>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <Link href="/speedtest" style={{ textDecoration: "none" }}>
              <button
                type="button"
                className="neon-btn"
                style={{
                  width: "100%",
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "12px",
                  letterSpacing: "0.12em",
                  padding: "11px 16px",
                  borderRadius: "4px",
                  color: "#00E8ED",
                  border: "1px solid rgba(0,232,237,0.4)",
                  background: "rgba(0,232,237,0.07)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                ▶&nbsp; RUN SPEED TEST
              </button>
            </Link>
            <Link href="/history" style={{ textDecoration: "none" }}>
              <button
                type="button"
                className="neon-btn"
                style={{
                  width: "100%",
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "12px",
                  letterSpacing: "0.12em",
                  padding: "11px 16px",
                  borderRadius: "4px",
                  color: "rgba(0,232,237,0.7)",
                  border: "1px solid rgba(0,232,237,0.2)",
                  background: "rgba(0,232,237,0.04)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                ◷&nbsp; VIEW HISTORY
              </button>
            </Link>
            <Link href="/traffic" style={{ textDecoration: "none" }}>
              <button
                type="button"
                className="neon-btn"
                style={{
                  width: "100%",
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "12px",
                  letterSpacing: "0.12em",
                  padding: "11px 16px",
                  borderRadius: "4px",
                  color: "rgba(0,232,237,0.7)",
                  border: "1px solid rgba(0,232,237,0.2)",
                  background: "rgba(0,232,237,0.04)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                ◈&nbsp; TRAFFIC ANALYZER
              </button>
            </Link>
          </div>

          {/* All-time stats */}
          {stats?.best && (
            <div
              style={{
                marginTop: "auto",
                paddingTop: "18px",
                borderTop: "1px solid rgba(0,232,237,0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.25)",
                  letterSpacing: "0.12em",
                  marginBottom: "12px",
                }}
              >
                ALL-TIME STATS
              </div>
              <div style={{ display: "flex", gap: "20px" }}>
                <StatMini
                  label="BEST"
                  value={stats.best.download.toFixed(1)}
                  unit="Mbps"
                  color="var(--success)"
                />
                <StatMini
                  label="AVG"
                  value={stats.avg.toFixed(1)}
                  unit="Mbps"
                  color="#00E8ED"
                />
                <StatMini
                  label="RUNS"
                  value={String(getHistory().length)}
                  unit=""
                  color="rgba(255,255,255,0.6)"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Results Table ─────────────────────────────────────────── */}
      {hasHistory ? (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(0,232,237,0.1)",
            borderRadius: "4px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <SectionLabel>Recent Tests</SectionLabel>
            <Link
              href="/history"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "11px",
                color: "rgba(0,232,237,0.55)",
                textDecoration: "none",
                letterSpacing: "0.08em",
              }}
            >
              VIEW ALL →
            </Link>
          </div>

          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1fr 80px 80px",
              gap: "8px",
              paddingBottom: "8px",
              borderBottom: "1px solid rgba(0,232,237,0.07)",
              marginBottom: "4px",
            }}
          >
            {["TIMESTAMP", "DOWNLOAD", "UPLOAD", "PING", "JITTER"].map(
              (col) => (
                <span
                  key={col}
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.22)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {col}
                </span>
              ),
            )}
          </div>

          {history.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1fr 80px 80px",
                gap: "8px",
                padding: "9px 0",
                borderBottom:
                  i < history.length - 1
                    ? "1px solid rgba(255,255,255,0.04)"
                    : "none",
                opacity: Math.max(0.4, 1 - i * 0.12),
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.38)",
                }}
              >
                {fmtTs(r.timestamp)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: dlColor(r.download),
                }}
              >
                {r.download.toFixed(1)}{" "}
                <span
                  style={{ fontSize: "10px", opacity: 0.55, fontWeight: 400 }}
                >
                  Mbps
                </span>
              </span>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: dlColor(r.upload),
                }}
              >
                {r.upload.toFixed(1)}{" "}
                <span
                  style={{ fontSize: "10px", opacity: 0.55, fontWeight: 400 }}
                >
                  Mbps
                </span>
              </span>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "13px",
                  color: pingColor(r.ping),
                }}
              >
                {r.ping}{" "}
                <span style={{ fontSize: "10px", opacity: 0.55 }}>ms</span>
              </span>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {r.jitter}{" "}
                <span style={{ fontSize: "10px", opacity: 0.55 }}>ms</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        /* ── Empty state ── */
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(0,232,237,0.1)",
            borderRadius: "4px",
            padding: "48px 32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "12px",
              color: "rgba(255,255,255,0.25)",
              letterSpacing: "0.14em",
              marginBottom: "10px",
            }}
          >
            NO TEST DATA FOUND
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.18)",
              marginBottom: "24px",
              margin: "0 0 24px",
            }}
          >
            Run your first speed test to populate the dashboard.
          </p>
          <Link href="/speedtest" style={{ textDecoration: "none" }}>
            <button
              type="button"
              className="neon-btn"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "12px",
                letterSpacing: "0.12em",
                padding: "10px 28px",
                borderRadius: "4px",
                color: "#00E8ED",
                border: "1px solid rgba(0,232,237,0.4)",
                background: "rgba(0,232,237,0.07)",
                cursor: "pointer",
              }}
            >
              ▶&nbsp; RUN FIRST TEST
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-space-grotesk)",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.4)",
        margin: 0,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

function MetricCard({
  label,
  value,
  unit,
  color,
  pulse,
  glow,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  pulse: boolean;
  glow: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(0,232,237,0.1)",
        borderRadius: "4px",
        padding: "18px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle top edge glow when active */}
      {glow && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "15%",
            right: "15%",
            height: "1px",
            background: `linear-gradient(to right, transparent, ${color}, transparent)`,
            opacity: 0.6,
          }}
        />
      )}

      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: "10px",
          color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.12em",
          marginBottom: "10px",
        }}
      >
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: "32px",
            fontWeight: 700,
            lineHeight: 1,
            color,
            textShadow: glow ? `0 0 22px ${color}55` : "none",
            animation: pulse ? "pulse-online 2s ease-in-out infinite" : "none",
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: "12px",
            color: "rgba(255,255,255,0.25)",
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}

function TimingRow({
  label,
  value,
  unit,
  color,
  maxMs,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  maxMs: number;
}) {
  const pct = Math.min(100, (value / maxMs) * 100);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "5px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "13px",
              fontWeight: 600,
              color,
            }}
          >
            {value}
          </span>
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "10px",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            {unit}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div
        style={{
          height: "2px",
          background: "rgba(255,255,255,0.06)",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 6px ${color}88`,
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

function StatMini({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: "9px",
          color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.1em",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: "20px",
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "10px",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
