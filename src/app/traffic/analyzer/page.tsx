"use client";

import { useEffect, useRef, useState } from "react";
import ProtocolChartDynamic from "@/components/charts/ProtocolChartDynamic";
import type { TrafficEntry } from "@/lib/types";

// ── tracker list ──────────────────────────────────────────────────────────────
const TRACKER_PATTERNS = [
  "googlesyndication",
  "doubleclick",
  "facebook.com/tr",
  "connect.facebook",
  "analytics.google",
  "google-analytics",
  "adservice.google",
  "googletag",
  "ads.twitter",
  "pixel.twitter",
  "bat.bing",
  "scorecardresearch",
];

function isTracker(domain: string): boolean {
  return TRACKER_PATTERNS.some((p) => domain.includes(p));
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getProtocol(entry: PerformanceResourceTiming): string {
  const np = entry.nextHopProtocol ?? "";
  if (np === "h3" || np === "h3-29" || np === "quic") return "HTTP/3";
  if (np === "h2") return "HTTP/2";
  if (np === "http/1.1") return "HTTP/1.1";
  return np || "unknown";
}

// ── resource type badge ───────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    script: "rgba(0,232,237,0.15)",
    stylesheet: "rgba(0,255,148,0.12)",
    fetch: "rgba(255,184,0,0.12)",
    xmlhttprequest: "rgba(255,184,0,0.12)",
    img: "rgba(255,255,255,0.06)",
    font: "rgba(255,255,255,0.06)",
    other: "rgba(255,255,255,0.04)",
  };
  const bg = colorMap[type] ?? colorMap.other ?? "#555555";
  return (
    <span
      style={{
        background: bg,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 3,
        padding: "1px 6px",
        fontSize: 10,
        fontFamily: "var(--font-jetbrains-mono)",
        color: "rgba(255,255,255,0.5)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {type}
    </span>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function TrafficAnalyzerPage() {
  const [entries, setEntries] = useState<TrafficEntry[]>([]);
  const observerRef = useRef<PerformanceObserver | null>(null);
  const entriesRef = useRef<TrafficEntry[]>([]);

  // PerformanceObserver setup
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;

    const handler = (list: PerformanceObserverEntryList) => {
      const newItems: TrafficEntry[] = [];

      for (const raw of list.getEntries()) {
        const entry = raw as PerformanceResourceTiming;
        if (!entry.name || entry.name.startsWith("data:")) continue;

        const domain = getDomain(entry.name);
        const protocol = getProtocol(entry);
        const size = entry.transferSize ? entry.transferSize / 1024 : 0;
        const duration = entry.duration;
        const cached = entry.transferSize === 0 && entry.decodedBodySize > 0;

        const item: TrafficEntry = {
          domain,
          url: entry.name,
          duration: Math.round(duration),
          size: parseFloat(size.toFixed(1)),
          protocol,
          cached,
          timestamp: Date.now(),
        };
        newItems.push(item);
      }

      if (newItems.length === 0) return;

      const updated = [...newItems, ...entriesRef.current].slice(0, 50);
      entriesRef.current = updated;
      setEntries([...updated]);
    };

    try {
      const obs = new PerformanceObserver(handler);
      obs.observe({ type: "resource", buffered: true });
      observerRef.current = obs;
    } catch {
      // Not supported
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // ── derived stats ─────────────────────────────────────────────────────────
  const now = Date.now();
  const window60 = entries.filter((e) => now - e.timestamp < 60_000);

  const domains60 = new Set(window60.map((e) => e.domain)).size;
  const http2Count = window60.filter((e) => e.protocol === "HTTP/2").length;
  const http3Count = window60.filter((e) => e.protocol === "HTTP/3").length;
  const protoTotal = http2Count + http3Count;
  const http2Pct =
    protoTotal > 0 ? Math.round((http2Count / protoTotal) * 100) : 0;
  const http3Pct = protoTotal > 0 ? 100 - http2Pct : 0;
  const avgDuration =
    window60.length > 0
      ? Math.round(
          window60.reduce((a, e) => a + e.duration, 0) / window60.length,
        )
      : 0;
  const trackerDomains = new Set(
    window60.map((e) => e.domain).filter(isTracker),
  ).size;

  // ── security flags ────────────────────────────────────────────────────────
  const httpInsecure = entries.filter(
    (e) => e.url.startsWith("http://") && !e.url.startsWith("http://localhost"),
  );
  const largeResponses = entries.filter((e) => e.size > 5120); // >5MB
  const trackerEntries = entries.filter((e) => isTracker(e.domain));

  const hasFlags =
    httpInsecure.length > 0 ||
    largeResponses.length > 0 ||
    trackerEntries.length > 0;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "32px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontSize: 24,
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            marginBottom: 4,
          }}
        >
          Traffic Analyzer
        </h1>
        <p
          style={{
            color: "rgba(0,232,237,0.7)",
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 12,
          }}
        >
          {entries.length} resource{entries.length !== 1 ? "s" : ""} captured
          &nbsp;·&nbsp; live feed
        </p>
      </div>

      {/* Top row: summary + chart */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {/* Summary card */}
        <div
          style={{
            flex: 1,
            background: "#0D0D10",
            border: "1px solid rgba(0,232,237,0.1)",
            borderRadius: 4,
            padding: "20px",
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.35)",
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            Last 60 Seconds
          </p>
          {window60.length === 0 ? (
            <p
              style={{
                color: "rgba(255,255,255,0.3)",
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 13,
              }}
            >
              Waiting for activity…
            </p>
          ) : (
            <p
              style={{
                color: "rgba(255,255,255,0.75)",
                fontFamily: "var(--font-space-grotesk)",
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              Your browser made{" "}
              <span style={{ color: "#00E8ED", fontWeight: 700 }}>
                {window60.length} requests
              </span>{" "}
              from{" "}
              <span style={{ color: "#00E8ED", fontWeight: 700 }}>
                {domains60} domain{domains60 !== 1 ? "s" : ""}
              </span>
              .{" "}
              <span style={{ color: "rgba(255,255,255,0.5)" }}>
                {http2Pct}% used HTTP/2.
              </span>{" "}
              Average response:{" "}
              <span
                style={{
                  color: "#00E8ED",
                  fontFamily: "var(--font-jetbrains-mono)",
                }}
              >
                {avgDuration}ms
              </span>
              .{" "}
              <span
                style={{
                  color: trackerDomains > 0 ? "#FFB800" : "#00FF94",
                }}
              >
                {trackerDomains} third-party tracker domain
                {trackerDomains !== 1 ? "s" : ""} detected.
              </span>
            </p>
          )}
        </div>

        {/* Protocol donut */}
        <div
          style={{
            width: 220,
            background: "#0D0D10",
            border: "1px solid rgba(0,232,237,0.1)",
            borderRadius: 4,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.35)",
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Protocol Mix
          </p>
          <div className="h-[200px] w-full">
            <ProtocolChartDynamic http2={http2Pct} http3={http3Pct} other={0} />
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 11,
                color: "#00E8ED",
              }}
            >
              ● HTTP/2 {http2Pct}%
            </span>
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 11,
                color: "#00FF94",
              }}
            >
              ● HTTP/3 {http3Pct}%
            </span>
          </div>
        </div>
      </div>

      {/* Security flags */}
      {hasFlags && (
        <div
          style={{
            background: "rgba(255,59,59,0.05)",
            border: "1px solid rgba(255,59,59,0.2)",
            borderRadius: 4,
            padding: "16px 20px",
            marginBottom: 20,
          }}
        >
          <p
            style={{
              color: "#FF3B3B",
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            ⚠ Security Flags
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {httpInsecure.slice(0, 3).map((e, i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <span
                  style={{
                    color: "#FF3B3B",
                    fontSize: 10,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  HTTP
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  {e.domain}
                </span>
                <span style={{ color: "rgba(255,59,59,0.6)", fontSize: 11 }}>
                  — insecure request
                </span>
              </div>
            ))}
            {largeResponses.slice(0, 3).map((e, i) => (
              <div
                key={`lg-${i}`}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <span
                  style={{
                    color: "#FFB800",
                    fontSize: 10,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  LARGE
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  {e.domain}
                </span>
                <span style={{ color: "rgba(255,184,0,0.6)", fontSize: 11 }}>
                  — {e.size.toFixed(0)} KB
                </span>
              </div>
            ))}
            {trackerEntries.slice(0, 3).map((e, i) => (
              <div
                key={`tr-${i}`}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <span
                  style={{
                    color: "#FFB800",
                    fontSize: 10,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  TRACKER
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  {e.domain}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live feed table */}
      <div
        style={{
          background: "#0D0D10",
          border: "1px solid rgba(0,232,237,0.1)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            background: "#141418",
            borderBottom: "1px solid rgba(0,232,237,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#00FF94",
              boxShadow: "0 0 8px #00FF94",
            }}
          />
          <span
            style={{
              color: "rgba(255,255,255,0.35)",
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Live Request Feed — last {entries.length} / 50
          </span>
        </div>

        {entries.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "rgba(255,255,255,0.25)",
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 13,
            }}
          >
            Waiting for network activity…
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#141418" }}>
                  {[
                    "Domain",
                    "Type",
                    "Size",
                    "Duration",
                    "Protocol",
                    "Cached",
                  ].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "8px 14px",
                        textAlign: "left",
                        color: "rgba(255,255,255,0.3)",
                        fontFamily: "var(--font-space-grotesk)",
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: "1px solid rgba(0,232,237,0.06)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const tracker = isTracker(entry.domain);
                  const insecure =
                    entry.url.startsWith("http://") &&
                    !entry.url.startsWith("http://localhost");
                  const rowColor = insecure
                    ? "rgba(255,59,59,0.06)"
                    : tracker
                      ? "rgba(255,184,0,0.04)"
                      : "transparent";

                  return (
                    <tr
                      key={i}
                      style={{
                        background: rowColor,
                        borderBottom:
                          i < entries.length - 1
                            ? "1px solid rgba(0,232,237,0.04)"
                            : "none",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 14px",
                          color: tracker
                            ? "#FFB800"
                            : insecure
                              ? "#FF3B3B"
                              : "rgba(255,255,255,0.65)",
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontSize: 12,
                          maxWidth: 260,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.domain}
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <TypeBadge
                          type={
                            entry.url.includes("fetch") ? "fetch" : "resource"
                          }
                        />
                      </td>
                      <td
                        style={{
                          padding: "8px 14px",
                          color:
                            entry.size > 5120
                              ? "#FF3B3B"
                              : "rgba(255,255,255,0.5)",
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.size > 0 ? `${entry.size} KB` : "—"}
                      </td>
                      <td
                        style={{
                          padding: "8px 14px",
                          color:
                            entry.duration > 1000
                              ? "#FF3B3B"
                              : entry.duration > 300
                                ? "#FFB800"
                                : "#00FF94",
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.duration}ms
                      </td>
                      <td
                        style={{
                          padding: "8px 14px",
                          color:
                            entry.protocol === "HTTP/3"
                              ? "#00FF94"
                              : entry.protocol === "HTTP/2"
                                ? "#00E8ED"
                                : "rgba(255,255,255,0.35)",
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.protocol}
                      </td>
                      <td
                        style={{
                          padding: "8px 14px",
                          color: entry.cached
                            ? "#00FF94"
                            : "rgba(255,255,255,0.25)",
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontSize: 11,
                        }}
                      >
                        {entry.cached ? "✓" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
