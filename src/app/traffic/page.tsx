"use client";

import { useCallback, useState } from "react";
import type { SpeedTestResult, VPNStatus } from "@/lib/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const SCAN_LINES = [
  ">>> Initializing WebRTC probe...",
  ">>> Querying geolocation API...",
  ">>> Analyzing IP fingerprint...",
  ">>> Cross-referencing timezone data...",
  ">>> Computing confidence score...",
];

const MONO =
  "var(--font-jetbrains-mono), 'JetBrains Mono', 'Courier New', monospace";
const GROTESK = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskIP(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.xxx.xxx`;
}

function isPrivateIP(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

function getLastSpeedTest(): SpeedTestResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("netpulse_history");
    if (!raw) return null;
    const history = JSON.parse(raw) as SpeedTestResult[];
    return history[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrafficPage() {
  const [status, setStatus] = useState<"idle" | "scanning" | "done">("idle");
  const [result, setResult] = useState<VPNStatus | null>(null);
  const [visibleLines, setVisibleLines] = useState(0);

  const handleScan = useCallback(async () => {
    setStatus("scanning");
    setVisibleLines(0);
    setResult(null);

    // Kick off detection in parallel with the animation
    const detectionPromise = (async () => {
      const { VPNDetector } = await import("@/lib/network");
      const detector = new VPNDetector();
      return detector.detect();
    })();

    // Reveal terminal lines one by one (400 ms apart)
    for (let i = 0; i < SCAN_LINES.length; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      setVisibleLines(i + 1);
    }

    // Wait for detection result
    try {
      const vpnResult = await detectionPromise;
      setResult(vpnResult);
      // Persist to sessionStorage for dashboard
      sessionStorage.setItem(
        "netpulse_vpn_scan",
        JSON.stringify({ ...vpnResult, timestamp: Date.now() }),
      );
    } catch {
      setResult({
        detected: false,
        confidence: 0,
        localIPs: [],
        publicIP: "unknown",
        country: "unknown",
        timezone: "unknown",
        mismatch: false,
      });
    }

    setStatus("done");
  }, []);

  const lastSpeedTest =
    status === "done" && result?.detected ? getLastSpeedTest() : null;

  // ─── Derived status colors ──────────────────────────────────────────────
  const accentColor = result?.detected ? "#FF3B3B" : "#00FF94";
  const accentBg = result?.detected
    ? "rgba(255,59,59,0.15)"
    : "rgba(0,255,148,0.15)";
  const accentBorder = result?.detected
    ? "rgba(255,59,59,0.35)"
    : "rgba(0,255,148,0.35)";
  const cardGlow = result?.detected
    ? "0 0 30px rgba(255,59,59,0.07)"
    : "0 0 30px rgba(0,255,148,0.07)";

  const confidenceColor =
    (result?.confidence ?? 0) > 60
      ? "#FF3B3B"
      : (result?.confidence ?? 0) > 30
        ? "#FFB800"
        : "#00FF94";

  const confidenceGradient =
    (result?.confidence ?? 0) > 60
      ? "linear-gradient(to right, #FF3B3B, #FF6B6B)"
      : (result?.confidence ?? 0) > 30
        ? "linear-gradient(to right, #FFB800, #FFC933)"
        : "linear-gradient(to right, #00FF94, #00FFAA)";

  // Detection signal badges
  const privateIPs = result?.localIPs.filter(isPrivateIP) ?? [];
  const hasVPNSubnet = privateIPs.some((ip) => ip.startsWith("10."));
  const hasMultiPrivate = privateIPs.length > 1;

  return (
    <div className="flex-1 p-8 min-h-screen" style={{ background: "#050507" }}>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1
          style={{
            fontFamily: GROTESK,
            fontSize: "1.875rem",
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.92)",
            margin: 0,
          }}
        >
          VPN DETECTION
        </h1>
        <p
          style={{
            fontFamily: MONO,
            fontSize: "0.8rem",
            color: "rgba(0,232,237,0.7)",
            marginTop: "0.5rem",
          }}
        >
          WebRTC leak detection · IP fingerprinting · Timezone analysis
        </p>
      </div>

      {/* ── Scan Button ──────────────────────────────────────────────────── */}
      {status !== "scanning" && (
        <div style={{ marginBottom: "2.5rem" }}>
          <button
            type="button"
            onClick={handleScan}
            className="neon-btn"
            style={{
              fontFamily: GROTESK,
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "0.75rem 3.5rem",
            }}
          >
            {status === "done" ? "SCAN AGAIN" : "SCAN NOW"}
          </button>
        </div>
      )}

      {/* ── Terminal Animation ───────────────────────────────────────────── */}
      {(status === "scanning" || status === "done") && (
        <div
          className={status === "scanning" ? "scan-lines" : ""}
          style={{
            background: "#0D0D10",
            border: "1px solid rgba(0,232,237,0.15)",
            borderRadius: "4px",
            padding: "1.5rem",
            maxWidth: "640px",
            overflow: "hidden",
            position: "relative",
            marginBottom: "2rem",
          }}
        >
          {status === "scanning" && <div className="scan-line-sweep" />}

          <div
            style={{ fontFamily: MONO, fontSize: "0.8rem", lineHeight: 1.8 }}
          >
            <div
              style={{ color: "rgba(0,232,237,0.4)", marginBottom: "0.5rem" }}
            >
              {"// NetPulse VPN Analyzer v2.1"}
            </div>

            {SCAN_LINES.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                style={{
                  color:
                    i < visibleLines - 1 || status === "done"
                      ? "rgba(0,255,148,0.9)"
                      : "rgba(0,232,237,0.95)",
                  animation: "npFadeIn 0.2s ease-out",
                }}
              >
                {line}
                {/* Blinking cursor on the last active line */}
                {i === visibleLines - 1 && status === "scanning" && (
                  <span
                    style={{
                      display: "inline-block",
                      width: "7px",
                      height: "14px",
                      background: "rgba(0,232,237,0.9)",
                      marginLeft: "4px",
                      verticalAlign: "middle",
                      animation: "npBlink 0.8s step-end infinite",
                    }}
                  />
                )}
              </div>
            ))}

            {status === "done" && (
              <div
                style={{
                  color: "rgba(0,232,237,0.6)",
                  marginTop: "0.5rem",
                  animation: "npFadeIn 0.3s ease-out",
                }}
              >
                {">>> Analysis complete."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Results Card ─────────────────────────────────────────────────── */}
      {status === "done" && result && (
        <div
          style={{
            background: "#0D0D10",
            border: `1px solid ${accentBorder}`,
            borderRadius: "4px",
            padding: "2rem",
            maxWidth: "640px",
            boxShadow: cardGlow,
          }}
        >
          {/* Status badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1.75rem",
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: "1rem",
                letterSpacing: "0.08em",
                padding: "0.5rem 1.25rem",
                borderRadius: "4px",
                background: accentBg,
                border: `1px solid ${accentBorder}`,
                color: accentColor,
                animation: result.detected
                  ? "npVpnPulse 2s ease-in-out infinite"
                  : "none",
              }}
            >
              {result.detected ? "⚠ VPN DETECTED" : "✓ CONNECTION CLEAN"}
            </span>
            <span
              className="status-dot"
              style={{
                background: accentColor,
                boxShadow: `0 0 8px ${accentColor}`,
                animation: result.detected
                  ? "pulse-error 2s ease-in-out infinite"
                  : "pulse-online 2s ease-in-out infinite",
              }}
            />
          </div>

          {/* Confidence Score */}
          <div style={{ marginBottom: "1.75rem" }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.6rem",
                color: "rgba(0,232,237,0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: "0.5rem",
              }}
            >
              Confidence Score
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "3.25rem",
                fontWeight: 700,
                color: confidenceColor,
                lineHeight: 1,
                marginBottom: "0.75rem",
              }}
            >
              {result.confidence}
              <span
                style={{
                  fontSize: "1rem",
                  color: "rgba(255,255,255,0.3)",
                  marginLeft: "4px",
                }}
              >
                /100
              </span>
            </div>
            {/* CSS progress bar — NO Recharts */}
            <div
              style={{
                height: "6px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${result.confidence}%`,
                  background: confidenceGradient,
                  borderRadius: "2px",
                  transition: "width 0.8s ease-out",
                }}
              />
            </div>
          </div>

          {/* IP Info grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              borderTop: "1px solid rgba(0,232,237,0.08)",
              paddingTop: "1.5rem",
              marginBottom: "1.75rem",
            }}
          >
            {[
              { label: "Public IP", value: maskIP(result.publicIP) },
              { label: "Country", value: result.country || "Unknown" },
              { label: "Timezone", value: result.timezone },
              {
                label: "TZ Mismatch",
                value: result.mismatch ? "YES" : "NO",
                valueColor: result.mismatch ? "#FF3B3B" : "#00FF94",
              },
            ].map(({ label, value, valueColor }) => (
              <div key={label}>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.6rem",
                    color: "rgba(0,232,237,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "0.3rem",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.85rem",
                    color: valueColor ?? "rgba(255,255,255,0.85)",
                    wordBreak: "break-all",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Detection method badges */}
          <div
            style={{
              marginBottom: result.detected && lastSpeedTest ? "1.75rem" : 0,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.6rem",
                color: "rgba(0,232,237,0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "0.75rem",
              }}
            >
              Detection Signals
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {hasVPNSubnet && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.7rem",
                    padding: "0.25rem 0.65rem",
                    borderRadius: "4px",
                    background: "rgba(255,59,59,0.12)",
                    border: "1px solid rgba(255,59,59,0.3)",
                    color: "#FF3B3B",
                  }}
                >
                  VPN Subnet IP
                </span>
              )}
              {result.mismatch && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.7rem",
                    padding: "0.25rem 0.65rem",
                    borderRadius: "4px",
                    background: "rgba(255,59,59,0.12)",
                    border: "1px solid rgba(255,59,59,0.3)",
                    color: "#FF3B3B",
                  }}
                >
                  TZ/Country Mismatch
                </span>
              )}
              {hasMultiPrivate && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.7rem",
                    padding: "0.25rem 0.65rem",
                    borderRadius: "4px",
                    background: "rgba(255,184,0,0.12)",
                    border: "1px solid rgba(255,184,0,0.3)",
                    color: "#FFB800",
                  }}
                >
                  Multiple Private IPs
                </span>
              )}
              {!result.detected && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.7rem",
                    padding: "0.25rem 0.65rem",
                    borderRadius: "4px",
                    background: "rgba(0,255,148,0.1)",
                    border: "1px solid rgba(0,255,148,0.25)",
                    color: "#00FF94",
                  }}
                >
                  No threats detected
                </span>
              )}
            </div>
          </div>

          {/* Speed Impact — only shown when VPN detected + history exists */}
          {result.detected && lastSpeedTest && (
            <div
              style={{
                borderTop: "1px solid rgba(0,232,237,0.08)",
                paddingTop: "1.5rem",
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: "0.6rem",
                  color: "rgba(0,232,237,0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "0.75rem",
                }}
              >
                Speed Impact (vs last clean test)
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.75rem",
                }}
              >
                {[
                  {
                    label: "Download",
                    value: `${lastSpeedTest.download}`,
                    unit: "Mbps",
                  },
                  {
                    label: "Upload",
                    value: `${lastSpeedTest.upload}`,
                    unit: "Mbps",
                  },
                  { label: "Ping", value: `${lastSpeedTest.ping}`, unit: "ms" },
                ].map(({ label, value, unit }) => (
                  <div
                    key={label}
                    style={{
                      background: "#141418",
                      border: "1px solid rgba(0,232,237,0.08)",
                      borderRadius: "4px",
                      padding: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: "0.6rem",
                        color: "rgba(0,232,237,0.5)",
                        marginBottom: "0.3rem",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: "#FFB800",
                      }}
                    >
                      {value}
                      <span
                        style={{
                          fontSize: "0.7rem",
                          marginLeft: "3px",
                          color: "rgba(255,255,255,0.35)",
                        }}
                      >
                        {unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Keyframes ────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes npFadeIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes npBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes npVpnPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(255,59,59,0.3); }
          50%       { box-shadow: 0 0 22px rgba(255,59,59,0.65); }
        }
      `}</style>
    </div>
  );
}
