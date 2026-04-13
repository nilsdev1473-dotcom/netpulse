"use client";

import { useCallback, useState } from "react";
import SpeedGauge from "@/components/SpeedGauge";

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = "idle" | "ping" | "download" | "upload" | "done";

interface TestState {
  phase: Phase;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  progress: number;
}

interface SavedResult {
  id: number;
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  timestamp: string;
}

// ─── Speed Test Functions ────────────────────────────────────────────────────

async function measurePing(): Promise<{ pingMs: number; jitterMs: number }> {
  const samples: number[] = [];
  for (let i = 0; i < 6; i++) {
    const start = performance.now();
    try {
      await fetch("https://speed.cloudflare.com/__down?bytes=0", {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // ignore timeout on individual pings
    }
    samples.push(performance.now() - start);
  }
  // Drop first sample (cold)
  const trimmed = samples.slice(1);
  const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  const jitter = Math.max(...trimmed) - Math.min(...trimmed);
  return { pingMs: Math.round(avg), jitterMs: Math.round(jitter) };
}

async function measureDownload(
  onProgress: (mbps: number) => void,
): Promise<number> {
  const startTime = Date.now();
  let bytesLoaded = 0;
  const response = await fetch(
    "https://speed.cloudflare.com/__down?bytes=25000000",
    { cache: "no-store" },
  );
  if (!response.body) throw new Error("No body");
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesLoaded += value.length;
    const elapsed = (Date.now() - startTime) / 1000;
    const mbps = (bytesLoaded * 8) / (elapsed * 1_000_000);
    onProgress(mbps);
  }
  const totalTime = (Date.now() - startTime) / 1000;
  return (bytesLoaded * 8) / (totalTime * 1_000_000);
}

async function measureUpload(
  onProgress: (mbps: number) => void,
): Promise<number> {
  // 10 MB payload
  const UPLOAD_BYTES = 10 * 1024 * 1024;
  const data = new Uint8Array(UPLOAD_BYTES);
  crypto.getRandomValues(data.slice(0, 1024)); // seed header for non-trivial payload

  const startTime = Date.now();

  // XHR gives us upload progress natively
  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "https://speed.cloudflare.com/__up", true);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.loaded > 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const mbps = (e.loaded * 8) / (elapsed * 1_000_000);
        onProgress(mbps);
      }
    };

    xhr.onload = () => {
      const totalTime = (Date.now() - startTime) / 1000;
      const mbps = (UPLOAD_BYTES * 8) / (totalTime * 1_000_000);
      resolve(mbps);
    };

    xhr.onerror = () => reject(new Error("Upload request failed"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 30_000;

    xhr.send(data.buffer);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<Phase, string> = {
  idle: "READY",
  ping: "MEASURING LATENCY",
  download: "DOWNLOAD TEST",
  upload: "UPLOAD TEST",
  done: "TEST COMPLETE",
};

const PHASE_PROGRESS: Record<Phase, number> = {
  idle: 0,
  ping: 10,
  download: 30,
  upload: 70,
  done: 100,
};

function MetricChip({
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
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: "120px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.15em",
          color: "var(--text-dim)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "24px",
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {value}
        <span
          style={{
            fontSize: "12px",
            fontWeight: 400,
            marginLeft: "4px",
            color: "var(--text-dim)",
          }}
        >
          {unit}
        </span>
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: TestState = {
  phase: "idle",
  downloadMbps: 0,
  uploadMbps: 0,
  pingMs: 0,
  jitterMs: 0,
  progress: 0,
};

export default function SpeedTestPage() {
  const [state, setState] = useState<TestState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isRunning = state.phase !== "idle" && state.phase !== "done";

  const runTest = useCallback(async () => {
    setError(null);
    setSaved(false);
    setState({
      ...INITIAL_STATE,
      phase: "ping",
      progress: PHASE_PROGRESS.ping,
    });

    try {
      // 1. Ping
      const { pingMs, jitterMs } = await measurePing();
      setState((s) => ({
        ...s,
        pingMs,
        jitterMs,
        phase: "download",
        progress: PHASE_PROGRESS.download,
      }));

      // 2. Download
      const downloadMbps = await measureDownload((mbps) => {
        const clampedMbps = Math.min(mbps, 1000);
        setState((s) => ({
          ...s,
          downloadMbps: clampedMbps,
          progress: Math.min(
            PHASE_PROGRESS.download +
              (PHASE_PROGRESS.upload - PHASE_PROGRESS.download) *
                (clampedMbps / 1000) *
                0.9,
            PHASE_PROGRESS.upload - 1,
          ),
        }));
      });

      setState((s) => ({
        ...s,
        downloadMbps,
        phase: "upload",
        progress: PHASE_PROGRESS.upload,
      }));

      // 3. Upload
      const uploadMbps = await measureUpload((mbps) => {
        const clampedMbps = Math.min(mbps, 1000);
        setState((s) => ({
          ...s,
          uploadMbps: clampedMbps,
          progress: Math.min(
            PHASE_PROGRESS.upload +
              (100 - PHASE_PROGRESS.upload) * (clampedMbps / 1000) * 0.9,
            99,
          ),
        }));
      });

      setState((s) => ({
        ...s,
        uploadMbps,
        phase: "done",
        progress: 100,
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Test failed. Check your connection.",
      );
      setState((s) => ({ ...s, phase: "idle", progress: 0 }));
    }
  }, []);

  const saveResult = useCallback(() => {
    const name = window.prompt('Connection name (e.g. "Home WiFi 5GHz"):');
    if (!name?.trim()) return;

    const result: SavedResult = {
      id: Date.now(),
      name: name.trim(),
      downloadMbps: state.downloadMbps,
      uploadMbps: state.uploadMbps,
      pingMs: state.pingMs,
      jitterMs: state.jitterMs,
      timestamp: new Date().toISOString(),
    };

    try {
      const existing: SavedResult[] = JSON.parse(
        localStorage.getItem("netpulse-results") ?? "[]",
      );
      existing.unshift(result);
      localStorage.setItem("netpulse-results", JSON.stringify(existing));
      setSaved(true);
    } catch {
      // localStorage might be unavailable
    }
  }, [state]);

  const qualityColor = (mbps: number) => {
    if (mbps >= 100) return "var(--success)";
    if (mbps >= 25) return "var(--cyan)";
    if (mbps >= 5) return "var(--warning)";
    return "var(--danger)";
  };

  // Gauge max — scale dynamically
  const gaugeMax = Math.max(
    state.downloadMbps * 1.4,
    state.uploadMbps * 1.4,
    100,
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "40px 24px 80px",
        gap: "32px",
      }}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: "center", maxWidth: "640px", width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "8px",
          }}
        >
          {/* Status dot */}
          <span
            className={
              isRunning
                ? "pulse-dot-fast"
                : state.phase === "done"
                  ? "pulse-dot"
                  : ""
            }
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isRunning
                ? "var(--cyan)"
                : state.phase === "done"
                  ? "var(--success)"
                  : "var(--text-dim)",
              boxShadow: isRunning ? "0 0 8px var(--cyan)" : "none",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: isRunning ? "var(--text-secondary)" : "var(--text-dim)",
              textTransform: "uppercase",
            }}
          >
            {PHASE_LABELS[state.phase]}
            {isRunning && (
              <span className="cursor-blink" style={{ marginLeft: "2px" }}>
                _
              </span>
            )}
          </span>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          SPEED TEST
        </h1>
      </div>

      {/* ── Gauges card ── */}
      <div
        className={`cyber-card${isRunning ? " cyber-card-active scanlines" : ""}`}
        style={{
          width: "100%",
          maxWidth: "640px",
          padding: "40px 32px 32px",
          position: "relative",
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "var(--surface-raised)",
            borderRadius: "4px 4px 0 0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${state.progress}%`,
              background: "var(--cyan)",
              boxShadow: "0 0 8px var(--cyan)",
              transition: "width 0.4s ease-out",
            }}
          />
        </div>

        {/* Dual gauges */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
          }}
        >
          <SpeedGauge
            value={state.downloadMbps}
            max={gaugeMax}
            unit="Mbps"
            label="Download"
            color="#00E8ED"
          />
          <SpeedGauge
            value={state.uploadMbps}
            max={gaugeMax}
            unit="Mbps"
            label="Upload"
            color="#00FF94"
          />
        </div>

        {/* Phase subtitle */}
        {isRunning && (
          <div
            style={{
              marginTop: "24px",
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--text-secondary)",
              letterSpacing: "0.15em",
            }}
          >
            {state.phase === "ping" && ">> PINGING CLOUDFLARE EDGE"}
            {state.phase === "download" && ">> DOWNLOADING 25 MB PAYLOAD"}
            {state.phase === "upload" && ">> UPLOADING 10 MB PAYLOAD"}
          </div>
        )}
      </div>

      {/* ── Start / Retest button ── */}
      <button
        type="button"
        className="neon-btn"
        style={{ minWidth: "200px", fontSize: "14px", padding: "14px 40px" }}
        onClick={runTest}
        disabled={isRunning}
      >
        {isRunning ? (
          <>
            <span className="cursor-blink">■</span> SCANNING
          </>
        ) : state.phase === "done" ? (
          "↺  RUN AGAIN"
        ) : (
          "▶  START TEST"
        )}
      </button>

      {/* ── Error ── */}
      {error && (
        <div
          style={{
            background: "rgba(255,59,59,0.08)",
            border: "1px solid rgba(255,59,59,0.3)",
            borderRadius: "4px",
            padding: "12px 20px",
            color: "var(--danger)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            maxWidth: "640px",
            width: "100%",
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* ── Results card (done only) ── */}
      {state.phase === "done" && (
        <div
          className="cyber-card"
          style={{
            width: "100%",
            maxWidth: "640px",
            padding: "28px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.2em",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              marginBottom: "20px",
            }}
          >
            ▸ Results Summary
          </div>

          {/* Metric chips */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <MetricChip
              label="Download"
              value={state.downloadMbps.toFixed(1)}
              unit="Mbps"
              color={qualityColor(state.downloadMbps)}
            />
            <MetricChip
              label="Upload"
              value={state.uploadMbps.toFixed(1)}
              unit="Mbps"
              color={qualityColor(state.uploadMbps)}
            />
            <MetricChip
              label="Ping"
              value={state.pingMs.toFixed(0)}
              unit="ms"
              color={
                state.pingMs < 20
                  ? "var(--success)"
                  : state.pingMs < 60
                    ? "var(--cyan)"
                    : state.pingMs < 150
                      ? "var(--warning)"
                      : "var(--danger)"
              }
            />
            <MetricChip
              label="Jitter"
              value={state.jitterMs.toFixed(0)}
              unit="ms"
              color={
                state.jitterMs < 5
                  ? "var(--success)"
                  : state.jitterMs < 20
                    ? "var(--cyan)"
                    : "var(--warning)"
              }
            />
          </div>

          {/* Save button */}
          <button
            type="button"
            className="neon-btn"
            style={{
              fontSize: "12px",
              padding: "10px 24px",
              opacity: saved ? 0.5 : 1,
            }}
            onClick={saveResult}
            disabled={saved}
          >
            {saved ? "✓  SAVED" : "⊕  SAVE RESULT"}
          </button>
        </div>
      )}
    </main>
  );
}
