"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import SpeedHistoryChartDynamic from "@/components/charts/SpeedHistoryChartDynamic";
import { clearHistory, getHistory } from "@/lib/network";
import type { SpeedTestResult } from "@/lib/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function ratingStars(download: number): string {
  if (download >= 100) return "⭐⭐⭐⭐⭐";
  if (download >= 50) return "⭐⭐⭐⭐";
  if (download >= 20) return "⭐⭐⭐";
  if (download >= 5) return "⭐⭐";
  return "⭐";
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMbps(v: number): string {
  return `${v.toFixed(1)} Mbps`;
}

// ── stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

function StatCard({ label, value, accent = false }: StatCardProps) {
  return (
    <div
      style={{
        background: "#0D0D10",
        border: `1px solid ${accent ? "rgba(0,232,237,0.25)" : "rgba(0,232,237,0.1)"}`,
        borderRadius: 4,
        padding: "16px 20px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <p
        style={{
          color: "rgba(255,255,255,0.35)",
          fontSize: 11,
          fontFamily: "var(--font-space-grotesk)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <p
        style={{
          color: accent ? "#00E8ED" : "rgba(255,255,255,0.92)",
          fontSize: 22,
          fontFamily: "var(--font-jetbrains-mono)",
          fontWeight: 600,
        }}
      >
        {value}
      </p>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<SpeedTestResult[]>([]);
  const [filterLocation, setFilterLocation] = useState<string>("__all__");
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(() => {
    setHistory(getHistory());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Derived stats
  const totalTests = history.length;
  const bestDl = history.length
    ? Math.max(...history.map((r) => r.download))
    : 0;
  const worstDl = history.length
    ? Math.min(...history.map((r) => r.download))
    : 0;
  const avgDl = history.length
    ? history.reduce((acc, r) => acc + r.download, 0) / history.length
    : 0;

  // Location names for filter
  const locationNames = Array.from(
    new Set(history.map((r) => r.connectionName).filter(Boolean)),
  );

  // Filtered rows
  const filtered =
    filterLocation === "__all__"
      ? history
      : history.filter((r) => r.connectionName === filterLocation);

  // Clear handler
  function handleClear() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearHistory();
    setHistory([]);
    setConfirmClear(false);
  }

  // ── empty state ──────────────────────────────────────────────────────────
  if (totalTests === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen"
        style={{ padding: "0 32px" }}
      >
        <div
          style={{
            color: "rgba(0,232,237,0.4)",
            fontSize: 48,
            marginBottom: 16,
          }}
        >
          ◎
        </div>
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontFamily: "var(--font-space-grotesk)",
            fontSize: 16,
            marginBottom: 24,
          }}
        >
          No tests yet. Run your first speed test.
        </p>
        <button
          type="button"
          onClick={() => router.push("/speedtest")}
          style={{
            background: "rgba(0,232,237,0.1)",
            border: "1px solid rgba(0,232,237,0.35)",
            borderRadius: 4,
            color: "#00E8ED",
            fontFamily: "var(--font-space-grotesk)",
            fontSize: 14,
            fontWeight: 600,
            padding: "10px 24px",
            cursor: "pointer",
            letterSpacing: "0.05em",
          }}
        >
          Run Speed Test
        </button>
      </div>
    );
  }

  // ── main layout ──────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "32px", maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 24,
              fontWeight: 700,
              color: "rgba(255,255,255,0.92)",
              marginBottom: 4,
            }}
          >
            Speed History
          </h1>
          <p
            style={{
              color: "rgba(0,232,237,0.7)",
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 12,
            }}
          >
            {totalTests} test{totalTests !== 1 ? "s" : ""} recorded
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Location filter */}
          {locationNames.length > 0 && (
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              style={{
                background: "#0D0D10",
                border: "1px solid rgba(0,232,237,0.15)",
                borderRadius: 4,
                color: "rgba(255,255,255,0.7)",
                fontFamily: "var(--font-space-grotesk)",
                fontSize: 13,
                padding: "6px 10px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="__all__">All Locations</option>
              {locationNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

          {/* Clear history */}
          <button
            type="button"
            onClick={handleClear}
            onBlur={() => setConfirmClear(false)}
            style={{
              background: confirmClear ? "rgba(255,59,59,0.15)" : "transparent",
              border: `1px solid ${confirmClear ? "rgba(255,59,59,0.4)" : "rgba(255,59,59,0.2)"}`,
              borderRadius: 4,
              color: confirmClear ? "#FF3B3B" : "rgba(255,59,59,0.6)",
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 13,
              fontWeight: 500,
              padding: "6px 14px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {confirmClear ? "Confirm Clear" : "Clear History"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <StatCard label="Best Download" value={fmtMbps(bestDl)} accent />
        <StatCard label="Worst Download" value={fmtMbps(worstDl)} />
        <StatCard label="Average Download" value={fmtMbps(avgDl)} />
        <StatCard label="Total Tests" value={String(totalTests)} />
      </div>

      {/* Area chart */}
      <div
        style={{
          background: "#0D0D10",
          border: "1px solid rgba(0,232,237,0.1)",
          borderRadius: 4,
          padding: "20px",
          marginBottom: 24,
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
          Download Speed Over Time
        </p>
        <div className="h-[300px] w-full">
          <SpeedHistoryChartDynamic data={history} />
        </div>
      </div>

      {/* History table */}
      <div
        style={{
          background: "#0D0D10",
          border: "1px solid rgba(0,232,237,0.1)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                background: "#141418",
                borderBottom: "1px solid rgba(0,232,237,0.08)",
              }}
            >
              {["Date", "Location", "Download", "Upload", "Ping", "Rating"].map(
                (col) => (
                  <th
                    key={col}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      color: "rgba(255,255,255,0.35)",
                      fontFamily: "var(--font-space-grotesk)",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={row.id}
                style={{
                  borderBottom:
                    i < filtered.length - 1
                      ? "1px solid rgba(0,232,237,0.05)"
                      : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    "#141418")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    "transparent")
                }
              >
                <td
                  style={{
                    padding: "10px 16px",
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 12,
                  }}
                >
                  {fmtDate(row.timestamp)}
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    color: "rgba(0,232,237,0.7)",
                    fontFamily: "var(--font-space-grotesk)",
                    fontSize: 13,
                  }}
                >
                  {row.connectionName || "—"}
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    color: "#00E8ED",
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {fmtMbps(row.download)}
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 13,
                  }}
                >
                  {fmtMbps(row.upload)}
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 13,
                  }}
                >
                  {row.ping} ms
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                  }}
                >
                  {ratingStars(row.download)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
