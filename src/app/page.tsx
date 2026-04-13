"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpeedPoint } from "@/components/charts/SpeedLineChart";
import SpeedGauge from "@/components/SpeedGauge";
import type { FlaggedItem } from "@/components/TrafficCanvas";
import { LiquidGlassButton } from "@/components/ui/LiquidGlassButton";

// Dynamic imports — Recharts + Canvas need client-only rendering
const SpeedLineChartDynamic = dynamic(
  () => import("@/components/charts/SpeedLineChartDynamic"),
  { ssr: false },
);
const TrafficCanvas = dynamic(() => import("@/components/TrafficCanvas"), {
  ssr: false,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "ping" | "download" | "upload";

interface ISPInfo {
  ip: string;
  city: string;
  country: string;
  org: string;
  vpn_detected?: boolean;
  vpn_confidence?: number;
  vpn_reason?: string | null;
}

interface NetRequest {
  id: string;
  domain: string;
  sizeKB: number;
  durationMs: number;
  protocol: string;
  isTracker: boolean;
}

interface ConnDetails {
  effectiveType: string;
  protocol: string;
  dnsMs: number | null;
  ttfbMs: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GAUGE_MAX = 300;
const AUTO_INTERVAL_MS = 30_000;
const TRACKER_PATTERNS = [
  "googlesyndication",
  "doubleclick",
  "facebook.com/tr",
  "analytics",
  "gtag",
  "hotjar",
  "clarity.ms",
];

// ─── Speed measurement ────────────────────────────────────────────────────────

async function measurePing(): Promise<number> {
  const start = Date.now();
  await fetch("https://speed.cloudflare.com/cdn-cgi/trace", {
    cache: "no-store",
  });
  return Date.now() - start;
}

async function measureDownload(
  onProgress: (mbps: number) => void,
): Promise<number> {
  const dlStart = Date.now();
  const response = await fetch(
    "https://speed.cloudflare.com/__down?bytes=5000000",
    { cache: "no-store" },
  );
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  let bytes = 0;
  let lastUpdate = Date.now();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    const now = Date.now();
    if (now - lastUpdate >= 200) {
      const elapsed = (now - dlStart) / 1000;
      onProgress((bytes * 8) / (elapsed * 1_000_000));
      lastUpdate = now;
    }
  }
  const elapsed = (Date.now() - dlStart) / 1000;
  return (bytes * 8) / (elapsed * 1_000_000);
}

function measureUpload(onProgress: (mbps: number) => void): Promise<number> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const data = new ArrayBuffer(2_000_000); // 2MB
    const blob = new Blob([data]);
    let startTime = 0;
    xhr.upload.onloadstart = () => {
      startTime = Date.now();
    };
    xhr.upload.onprogress = (e) => {
      if (e.loaded > 0 && startTime > 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const mbps = (e.loaded * 8) / (elapsed * 1_000_000);
        onProgress(mbps);
      }
    };
    xhr.upload.onload = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      resolve((blob.size * 8) / (elapsed * 1_000_000));
    };
    xhr.upload.onerror = () => resolve(0);
    xhr.open("POST", "https://speed.cloudflare.com/__up");
    xhr.send(blob);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.split("/")[0] ?? url;
  }
}

function isTrackerUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return TRACKER_PATTERNS.some((p) => lower.includes(p));
}

function protocolBadge(
  proto: string,
  isTracker: boolean,
): { label: string; color: string } {
  if (isTracker) return { label: "TRACKER", color: "#FF3B3B" };
  if (proto.includes("h3") || proto === "quic")
    return { label: "HTTP/3", color: "#00FF94" };
  if (proto.includes("h2")) return { label: "HTTP/2", color: "#00E8ED" };
  if (proto.includes("http/1")) return { label: "HTTP/1", color: "#FFB800" };
  return { label: proto.toUpperCase() || "—", color: "rgba(255,255,255,0.4)" };
}

function speedColor(mbps: number): string {
  if (mbps > 50) return "#00FF94";
  if (mbps > 10) return "#00E8ED";
  if (mbps > 1) return "#FFB800";
  if (mbps > 0) return "#FF3B3B";
  return "#00E8ED";
}

function pingColor(ms: number): string {
  if (ms <= 0) return "rgba(255,255,255,0.2)";
  if (ms < 50) return "#00FF94";
  if (ms < 100) return "#FFB800";
  return "#FF3B3B";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function InfoCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "#0D0D10",
        border: "1px solid rgba(0,232,237,0.1)",
        padding: "10px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flex: 1,
        minWidth: 0,
      }}
    >
      <ZoneLabel label={label} />
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: 15,
          fontWeight: 600,
          color: accent ?? "rgba(255,255,255,0.85)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Connection detail cards (PerformanceNavigationTiming) ────────────────────

function ConnectionDetails() {
  const [details, setDetails] = useState<ConnDetails>({
    effectiveType: "—",
    protocol: "—",
    dnsMs: null,
    ttfbMs: null,
  });

  useEffect(() => {
    const entries = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    const nav = entries[0];
    const conn = (
      navigator as Navigator & { connection?: { effectiveType?: string } }
    ).connection;

    setDetails({
      effectiveType: conn?.effectiveType?.toUpperCase() ?? "—",
      protocol:
        (nav as PerformanceNavigationTiming & { nextHopProtocol?: string })
          ?.nextHopProtocol ?? "—",
      dnsMs:
        nav && nav.domainLookupEnd > 0
          ? Math.round(nav.domainLookupEnd - nav.domainLookupStart)
          : null,
      ttfbMs:
        nav && nav.responseStart > 0
          ? Math.round(nav.responseStart - nav.requestStart)
          : null,
    });
  }, []);

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <InfoCard label="CONN TYPE" value={details.effectiveType} />
      <InfoCard label="PROTOCOL" value={details.protocol} accent="#00E8ED" />
      <InfoCard
        label="DNS TIME"
        value={details.dnsMs !== null ? `${details.dnsMs}ms` : "—"}
        accent={
          details.dnsMs !== null && details.dnsMs < 50 ? "#00FF94" : "#FFB800"
        }
      />
      <InfoCard
        label="TTFB"
        value={details.ttfbMs !== null ? `${details.ttfbMs}ms` : "—"}
        accent={
          details.ttfbMs !== null
            ? details.ttfbMs < 100
              ? "#00FF94"
              : details.ttfbMs < 300
                ? "#FFB800"
                : "#FF3B3B"
            : undefined
        }
      />
    </div>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────

export default function Page() {
  // Measurement state
  const [phase, setPhase] = useState<Phase>("idle");
  const [dlLive, setDlLive] = useState(0);
  const [ulLive, setUlLive] = useState(0);
  const [finalDownload, setFinalDownload] = useState(0);
  const [finalUpload, setFinalUpload] = useState(0);
  const [ping, setPing] = useState(0);

  // UI state
  const [countdown, setCountdown] = useState(AUTO_INTERVAL_MS / 1000);
  const [history, setHistory] = useState<SpeedPoint[]>([]);
  const [isp, setIsp] = useState<ISPInfo | null>(null);
  const [requests, setRequests] = useState<NetRequest[]>([]);
  const [flaggedItems, setFlaggedItems] = useState<FlaggedItem[]>([]);

  // Session ID — persisted in localStorage so history survives page reloads
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return "ssr";
    const stored = localStorage.getItem("np_session");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("np_session", id);
    return id;
  });

  // Refs
  const historyRef = useRef<SpeedPoint[]>([]);
  const isRunningRef = useRef(false);
  const runTestRef = useRef<(() => void) | null>(null);
  const scheduleNextRef = useRef<(() => void) | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureCountRef = useRef(0);

  // ── Load speed history from backend on mount ────────────────────────────
  useEffect(() => {
    if (!sessionId || sessionId === "ssr") return;
    fetch(`/api/speed/history?session_id=${sessionId}`)
      .then((r) => r.json())
      .then(
        (
          data: Array<{
            download_mbps: number;
            ping_ms: number;
            timestamp: string;
          }>,
        ) => {
          if (Array.isArray(data) && data.length > 0) {
            const points: SpeedPoint[] = data.reverse().map((d, i) => ({
              value: parseFloat(d.download_mbps.toFixed(2)),
              label: i === 0 ? "now" : `${i * 30}s`,
            }));
            historyRef.current = points;
            setHistory(points);
            measureCountRef.current = points.length;
          }
        },
      )
      .catch(() => {});
  }, [sessionId]);

  // ── Fetch ISP info — also refresh every 30s to detect VPN toggle ──
  const fetchNetworkInfo = useCallback(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset();
    fetch(
      `/api/network/info?tz=${encodeURIComponent(tz)}&offset=${offset}&t=${Date.now()}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((d: Record<string, string | boolean | number | null>) => {
        setIsp({
          ip: String(d.ip_masked ?? "—"),
          city: String(d.city ?? "—"),
          country: String(d.country ?? "—"),
          org: String(d.isp ?? "—"),
          vpn_detected: Boolean(d.vpn_detected),
          vpn_confidence: Number(d.vpn_confidence ?? 0),
          vpn_reason: d.vpn_reason ? String(d.vpn_reason) : null,
        });
      })
      .catch(() => {});
  }, []);

  // Re-fetch network info every 30s to detect VPN toggle
  useEffect(() => {
    fetchNetworkInfo();
    const t = setInterval(fetchNetworkInfo, 30_000);
    return () => clearInterval(t);
  }, [fetchNetworkInfo]);

  // ── PerformanceObserver: network requests ──────────────────────────────────
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    let obs: PerformanceObserver;
    try {
      obs = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        const next: NetRequest[] = entries
          .filter((e) => e.initiatorType !== "beacon")
          .map((e) => ({
            id: `${e.startTime.toFixed(0)}-${e.name.slice(-40)}`,
            domain: extractDomain(e.name),
            sizeKB: Math.round(e.transferSize / 1024),
            durationMs: Math.round(e.duration),
            protocol:
              (
                e as PerformanceResourceTiming & {
                  nextHopProtocol?: string;
                }
              ).nextHopProtocol ?? "",
            isTracker: isTrackerUrl(e.name),
          }));
        if (next.length > 0) {
          setRequests((prev) => [...next, ...prev].slice(0, 10));
        }
      });
      obs.observe({ type: "resource", buffered: true });
    } catch {
      // PerformanceObserver not supported
    }
    return () => obs?.disconnect();
  }, []);

  // ── Run full speed test ────────────────────────────────────────────────────
  const runTest = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);

    setDlLive(0);
    setUlLive(0);

    try {
      // PING
      setPhase("ping");
      const p = await measurePing();
      setPing(p);

      // DOWNLOAD
      setPhase("download");
      const dl = await measureDownload(setDlLive);
      setFinalDownload(dl);
      setDlLive(dl);

      // UPLOAD
      setPhase("upload");
      const ul = await measureUpload(setUlLive);
      setFinalUpload(ul);
      setUlLive(ul);

      // History point (use count as label basis)
      const idx = measureCountRef.current++;
      const label = idx === 0 ? "now" : `${idx * 30}s`;
      const point: SpeedPoint = {
        value: parseFloat(dl.toFixed(2)),
        label,
      };
      historyRef.current = [...historyRef.current, point].slice(-20);
      setHistory([...historyRef.current]);

      // Save to backend
      fetch("/api/speed/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          download_mbps: dl,
          upload_mbps: ul,
          ping_ms: p,
        }),
      }).catch(() => {}); // silent fail
    } catch (err) {
      console.error("Speed test error:", err);
    } finally {
      setPhase("idle");
      isRunningRef.current = false;
      scheduleNextRef.current?.();
    }
  }, [sessionId]);

  // Keep runTest ref in sync
  useEffect(() => {
    runTestRef.current = runTest;
  }, [runTest]);

  // ── Schedule next auto-run ─────────────────────────────────────────────────
  const scheduleNext = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);

    setCountdown(AUTO_INTERVAL_MS / 1000);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    autoRunTimerRef.current = setTimeout(() => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      runTestRef.current?.();
    }, AUTO_INTERVAL_MS);
  }, []);

  // Keep scheduleNext ref in sync
  useEffect(() => {
    scheduleNextRef.current = scheduleNext;
  }, [scheduleNext]);

  // ── Auto-run on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    runTest();
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
    };
  }, [runTest]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const isActive = phase !== "idle";
  const dlDisplay = phase === "download" ? dlLive : finalDownload;
  const ulDisplay = phase === "upload" ? ulLive : finalUpload;
  const dlCol = speedColor(dlDisplay);

  const phaseLabel =
    phase === "ping"
      ? "MEASURING PING..."
      : phase === "download"
        ? "DOWNLOADING..."
        : phase === "upload"
          ? "UPLOADING..."
          : "LIVE";

  const maskedIP = isp?.ip
    ? isp.ip.replace(/^(\d+)\..+$/, "$1.xxx.xxx.xxx")
    : "—";

  const handleFlaggedItem = useCallback((item: FlaggedItem) => {
    setFlaggedItems((prev) => [item, ...prev].slice(0, 20));
  }, []);

  // Generate plain English traffic summary
  const trafficSummary = useMemo(() => {
    if (requests.length === 0) return null;
    const total = requests.length;
    const trackers = requests.filter((r) => r.protocol === "TRACKER").length;
    const h3 = requests.filter((r) => r.protocol === "HTTP/3").length;
    const avgMs = Math.round(
      requests.reduce((s, r) => s + r.durationMs, 0) / total,
    );
    const totalKB = Math.round(requests.reduce((s, r) => s + r.sizeKB, 0));
    const hasWarning = trackers > 0 || avgMs > 500;
    let msg = `${total} requests · ${totalKB}KB transferred · avg ${avgMs}ms`;
    if (h3 > 0) msg += ` · ${Math.round((h3 / total) * 100)}% HTTP/3`;
    if (trackers > 0)
      msg += ` · ⚠ ${trackers} tracker${trackers > 1 ? "s" : ""} detected`;
    else msg += " · No trackers detected";
    return { msg, warning: hasWarning };
  }, [requests]);

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes scanline-sweep {
          0%   { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#050507",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-space-grotesk)",
        }}
      >
        {/* ─── HEADER ────────────────────────────────────────────────────── */}
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

          {/* Status indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 9,
                letterSpacing: "0.1em",
                color: isActive ? "#00E8ED" : "rgba(0,232,237,0.5)",
              }}
            >
              {phaseLabel}
            </span>
            {!isActive && countdown > 0 && (
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 9,
                  color: "rgba(0,232,237,0.3)",
                  letterSpacing: "0.06em",
                }}
              >
                next: {countdown}s
              </span>
            )}
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isActive ? "#00E8ED" : "#00FF94",
                boxShadow: `0 0 8px ${isActive ? "#00E8ED" : "#00FF94"}`,
                animation: "pulse-dot 2s ease-in-out infinite",
                display: "inline-block",
              }}
            />
          </div>
        </div>

        {/* ─── HERO: GAUGES ──────────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "36px 28px 24px",
            gap: 28,
            overflow: "hidden",
          }}
        >
          {/* Scanline overlay during active test */}
          {isActive && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,232,237,0.018) 2px, rgba(0,232,237,0.018) 4px)",
                animation: "scanline-sweep 0.4s linear infinite",
                zIndex: 0,
              }}
            />
          )}

          {/* Dual gauge row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 48,
              position: "relative",
              zIndex: 1,
            }}
          >
            {/* Download */}
            <div
              style={{
                opacity: phase === "upload" ? 0.45 : 1,
                transition: "opacity 0.5s ease",
              }}
            >
              <SpeedGauge
                value={dlDisplay}
                max={GAUGE_MAX}
                unit="Mbps"
                label="DOWNLOAD"
                color={dlCol}
              />
            </div>

            {/* Divider */}
            <div
              style={{
                width: 1,
                height: 72,
                alignSelf: "center",
                marginBottom: 32,
                background:
                  "linear-gradient(180deg, transparent, rgba(0,232,237,0.2), transparent)",
              }}
            />

            {/* Upload */}
            <div
              style={{
                opacity: phase === "download" || phase === "ping" ? 0.45 : 1,
                transition: "opacity 0.5s ease",
              }}
            >
              <SpeedGauge
                value={ulDisplay}
                max={GAUGE_MAX}
                unit="Mbps"
                label="UPLOAD"
                color="#00FF94"
              />
            </div>
          </div>

          {/* Stats row: PING / DOWNLOAD / UPLOAD */}
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              gap: 1,
              background: "rgba(0,232,237,0.06)",
              border: "1px solid rgba(0,232,237,0.1)",
              position: "relative",
              zIndex: 1,
            }}
          >
            {[
              {
                label: "PING",
                value: ping > 0 ? `${ping}ms` : "—",
                color: pingColor(ping),
              },
              {
                label: "↓ DOWNLOAD",
                value:
                  finalDownload > 0 ? `${finalDownload.toFixed(2)} Mbps` : "—",
                color: speedColor(finalDownload),
              },
              {
                label: "↑ UPLOAD",
                value: finalUpload > 0 ? `${finalUpload.toFixed(2)} Mbps` : "—",
                color: "#00FF94",
              },
            ].map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                  padding: "14px 36px",
                  background: "#0D0D10",
                  borderLeft: i > 0 ? "1px solid rgba(0,232,237,0.08)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 8,
                    color: "rgba(0,232,237,0.4)",
                    letterSpacing: "0.18em",
                  }}
                >
                  {stat.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color:
                      stat.value === "—"
                        ? "rgba(255,255,255,0.18)"
                        : stat.color,
                    textShadow:
                      stat.value !== "—" ? `0 0 16px ${stat.color}66` : "none",
                    transition: "color 0.3s ease",
                  }}
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          {/* RUN TEST button */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <LiquidGlassButton
              onClick={runTest}
              disabled={isActive}
              className="text-[11px] px-10 py-2.5 tracking-widest"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: isActive ? "rgba(0,232,237,0.35)" : "#00E8ED",
                border: `1px solid ${isActive ? "rgba(0,232,237,0.12)" : "rgba(0,232,237,0.35)"}`,
                opacity: isActive ? 0.55 : 1,
                cursor: isActive ? "not-allowed" : "pointer",
              }}
            >
              {isActive ? phaseLabel : "RUN TEST"}
            </LiquidGlassButton>
          </div>
        </div>

        {/* ─── SEPARATOR ─────────────────────────────────────────────────── */}
        <div style={{ padding: "0 28px" }}>
          <Separator />
        </div>

        {/* ─── ISP / CONNECTION INFO ──────────────────────────────────────── */}
        <div style={{ padding: "20px 28px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 0,
              background: "#0D0D10",
              border: "1px solid rgba(0,232,237,0.1)",
            }}
          >
            {[
              { label: "ISP", value: isp?.org ?? "—" },
              {
                label: "LOCATION",
                value: isp ? `${isp.city}, ${isp.country}` : "—",
              },
              { label: "IP", value: maskedIP },
              {
                label: "VPN STATUS",
                value: isp?.vpn_detected ? "⚠ VPN ON" : "✓ DIRECT",
                color: isp?.vpn_detected ? "#FFB800" : "#00FF94",
              },
            ].map((item, i) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "12px 20px",
                  borderLeft: i > 0 ? "1px solid rgba(0,232,237,0.07)" : "none",
                  flex: "1 1 auto",
                  minWidth: 120,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 8,
                    color: "rgba(0,232,237,0.35)",
                    letterSpacing: "0.18em",
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 12,
                    fontWeight: 600,
                    color:
                      item.color ??
                      (item.value === "—"
                        ? "rgba(255,255,255,0.18)"
                        : "rgba(255,255,255,0.82)"),
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 4 DETAIL CARDS ────────────────────────────────────────────── */}
        <div style={{ padding: "8px 28px 0" }}>
          <ConnectionDetails />
        </div>

        {/* ─── SEPARATOR ─────────────────────────────────────────────────── */}
        <div style={{ padding: "20px 28px 0" }}>
          <Separator />
        </div>

        {/* ─── SPEED HISTORY GRAPH ───────────────────────────────────────── */}
        <div style={{ padding: "16px 28px 0" }}>
          <ZoneLabel label="SPEED HISTORY" />
          <div
            style={{
              marginTop: 10,
              background: "#0D0D10",
              border: "1px solid rgba(0,232,237,0.1)",
              padding: "12px 8px 8px",
            }}
          >
            <div className="h-[200px] w-full">
              {history.length > 1 ? (
                <SpeedLineChartDynamic data={history} />
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(0,232,237,0.25)",
                    fontSize: 11,
                    fontFamily: "var(--font-jetbrains-mono)",
                    letterSpacing: "0.12em",
                  }}
                >
                  {isActive ? "MEASURING..." : "COLLECTING DATA..."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── SEPARATOR ─────────────────────────────────────────────────── */}
        <div style={{ padding: "20px 28px 0" }}>
          <Separator />
        </div>

        {/* ─── TRAFFIC FEED ──────────────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 28px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <ZoneLabel label="PACKET FLOW" />

          {/* Canvas (compact) */}
          <div
            style={{
              border: "1px solid rgba(0,232,237,0.1)",
              background: "#08080C",
              overflow: "hidden",
            }}
          >
            <div className="h-[120px] w-full">
              <TrafficCanvas onFlaggedItem={handleFlaggedItem} />
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "HTTP/2", color: "#00E8ED" },
              { label: "HTTP/3", color: "#00FF94" },
              { label: "TRACKER", color: "#FF3B3B" },
              { label: "LARGE", color: "#FFB800" },
            ].map((t) => (
              <div
                key={t.label}
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    background: t.color,
                    borderRadius: 1,
                    display: "inline-block",
                    boxShadow: `0 0 4px ${t.color}88`,
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

          {/* Network requests list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <ZoneLabel label="RECENT REQUESTS" />
            {trafficSummary && (
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  color: trafficSummary.warning
                    ? "#FFB800"
                    : "rgba(0,232,237,0.6)",
                  padding: "6px 4px 10px",
                  letterSpacing: "0.03em",
                }}
              >
                {trafficSummary.msg}
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              {requests.length === 0 ? (
                <div
                  style={{
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 10,
                    fontFamily: "var(--font-jetbrains-mono)",
                    padding: "10px 0",
                    letterSpacing: "0.1em",
                  }}
                >
                  MONITORING...
                </div>
              ) : (
                requests.map((req) => {
                  const badge = protocolBadge(req.protocol, req.isTracker);
                  return (
                    <div
                      key={req.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "5px 10px",
                        background: req.isTracker
                          ? "rgba(255,59,59,0.03)"
                          : "rgba(0,232,237,0.015)",
                        border: `1px solid ${req.isTracker ? "rgba(255,59,59,0.1)" : "rgba(0,232,237,0.05)"}`,
                        marginBottom: 1,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontSize: 10,
                          color: req.isTracker
                            ? "#FF3B3B"
                            : "rgba(255,255,255,0.7)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {req.domain}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontSize: 9,
                          color: "rgba(0,232,237,0.45)",
                          flexShrink: 0,
                        }}
                      >
                        {req.sizeKB > 0 ? `${req.sizeKB}KB` : "—"}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontSize: 9,
                          color: "rgba(255,255,255,0.3)",
                          flexShrink: 0,
                        }}
                      >
                        {req.durationMs}ms
                      </span>
                      <span
                        style={{
                          padding: "1px 6px",
                          border: `1px solid ${badge.color}44`,
                          background: `${badge.color}11`,
                          fontSize: 8,
                          fontFamily: "var(--font-jetbrains-mono)",
                          color: badge.color,
                          letterSpacing: "0.06em",
                          flexShrink: 0,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Flagged items (from TrafficCanvas) — show if any */}
          {flaggedItems.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginTop: 8,
              }}
            >
              <ZoneLabel label="FLAGGED" />
              <div style={{ marginTop: 6 }}>
                {flaggedItems.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 10px",
                      background:
                        idx === 0 ? "rgba(0,232,237,0.04)" : "transparent",
                      border: `1px solid rgba(0,232,237,0.06)`,
                      marginBottom: 1,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{item.icon}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        fontSize: 10,
                        color:
                          item.type === "tracker"
                            ? "#FF3B3B"
                            : item.type === "large"
                              ? "#FFB800"
                              : "rgba(255,255,255,0.65)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.domain}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        fontSize: 9,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      {item.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
