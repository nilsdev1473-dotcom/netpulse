"use client";

import type {
  ConnectionMetrics,
  PingResult,
  SpeedStats,
  SpeedTestResult,
  VPNStatus,
} from "./types";

// ---------------------------------------------------------------------------
// Type guard for navigator.connection (NetworkInformation API — non-standard)
// ---------------------------------------------------------------------------
interface NetworkInformation {
  effectiveType?: "2g" | "3g" | "4g" | "slow-2g";
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

function getNetworkInformation(): NetworkInformation | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

// ---------------------------------------------------------------------------
// SpeedTestEngine
// ---------------------------------------------------------------------------
const DOWNLOAD_URL = "https://speed.cloudflare.com/__down?bytes=25000000";
const UPLOAD_URL = "https://speed.cloudflare.com/__up";
const PING_URL = "https://speed.cloudflare.com/__ping";
const PARALLEL_STREAMS = 4;
const PROGRESS_INTERVAL_MS = 200;

export type ProgressCallback = (mbps: number) => void;

interface SpeedResult {
  download: number;
  upload: number;
  ping: number;
  jitter: number;
}

export class SpeedTestEngine {
  private onProgress: ProgressCallback | null = null;

  setProgressCallback(cb: ProgressCallback): void {
    this.onProgress = cb;
  }

  private measureStream(): Promise<{ bytesPerMs: number }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();
      let lastReportTime = startTime;
      let lastBytes = 0;

      xhr.open("GET", `${DOWNLOAD_URL}&_=${Date.now()}`, true);
      xhr.responseType = "arraybuffer";

      xhr.onprogress = (event) => {
        const now = Date.now();
        const elapsed = now - lastReportTime;

        if (elapsed >= PROGRESS_INTERVAL_MS) {
          const deltaBytes = event.loaded - lastBytes;
          const mbps = (deltaBytes * 8) / (elapsed * 1000);
          this.onProgress?.(mbps);
          lastReportTime = now;
          lastBytes = event.loaded;
        }
      };

      xhr.onload = () => {
        const totalMs = Date.now() - startTime;
        const totalBytes = xhr.response
          ? (xhr.response as ArrayBuffer).byteLength
          : 0;
        resolve({ bytesPerMs: totalBytes / Math.max(totalMs, 1) });
      };

      xhr.onerror = () => reject(new Error("Download stream failed"));
      xhr.send();
    });
  }

  private async measureUpload(): Promise<number> {
    const UPLOAD_BYTES = 5_000_000;
    const blob = new Blob([new Uint8Array(UPLOAD_BYTES)]);
    const start = Date.now();

    await fetch(UPLOAD_URL, {
      method: "POST",
      body: blob,
      mode: "no-cors",
    }).catch(() => null);

    const elapsed = Date.now() - start;
    return (UPLOAD_BYTES * 8) / (elapsed * 1000); // Mbps
  }

  private async measurePingJitter(): Promise<{ ping: number; jitter: number }> {
    const samples: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      try {
        await fetch(`${PING_URL}?_=${Date.now()}`, { mode: "no-cors" });
      } catch {
        // ignore
      }
      samples.push(Date.now() - start);
    }

    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const jitter =
      samples.reduce((acc, ms) => acc + Math.abs(ms - avg), 0) / samples.length;

    return { ping: Math.round(avg), jitter: Math.round(jitter) };
  }

  async run(): Promise<SpeedResult> {
    // Ping + jitter first (fast)
    const { ping, jitter } = await this.measurePingJitter();

    // Parallel download streams
    const streams = await Promise.all(
      Array.from({ length: PARALLEL_STREAMS }, () => this.measureStream()),
    );

    const totalBytesPerMs = streams.reduce((acc, s) => acc + s.bytesPerMs, 0);
    const download = parseFloat(((totalBytesPerMs * 8) / 1000).toFixed(2)); // Mbps

    // Upload (single stream — upload test is one-shot)
    const upload = parseFloat((await this.measureUpload()).toFixed(2));

    return { download, upload, ping, jitter };
  }
}

// ---------------------------------------------------------------------------
// PingMonitor
// ---------------------------------------------------------------------------
export class PingMonitor {
  private samples = 10;

  async measure(): Promise<PingResult> {
    const rtts: number[] = [];

    for (let i = 0; i < this.samples; i++) {
      const start = Date.now();
      try {
        await fetch(`${PING_URL}?_=${Date.now()}`, {
          mode: "no-cors",
          cache: "no-store",
        });
      } catch {
        // treat failed pings as high RTT
        rtts.push(9999);
        continue;
      }
      rtts.push(Date.now() - start);
    }

    const valid = rtts.filter((r) => r < 9999);
    if (valid.length === 0) {
      return { avg: 9999, min: 9999, max: 9999, jitter: 0 };
    }

    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const jitter =
      valid.reduce((acc, r) => acc + Math.abs(r - avg), 0) / valid.length;

    return {
      avg: Math.round(avg),
      min: Math.round(min),
      max: Math.round(max),
      jitter: Math.round(jitter),
    };
  }
}

// ---------------------------------------------------------------------------
// VPNDetector
// ---------------------------------------------------------------------------
interface GeoResponse {
  ip?: string;
  country?: string;
  timezone?: string;
}

export class VPNDetector {
  private extractWebRTCIPs(): Promise<string[]> {
    return new Promise((resolve) => {
      const ips: string[] = [];
      let pc: RTCPeerConnection | null = null;

      try {
        pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel("");

        pc.onicecandidate = (e) => {
          if (!e.candidate) {
            pc?.close();
            resolve([...new Set(ips)]);
            return;
          }

          const match = e.candidate.candidate.match(
            /(\d{1,3}(?:\.\d{1,3}){3})/g,
          );
          if (match) {
            match.forEach((ip) => {
              if (!ips.includes(ip)) ips.push(ip);
            });
          }
        };

        pc.createOffer()
          .then((offer) => pc?.setLocalDescription(offer))
          .catch(() => resolve([]));
      } catch {
        resolve([]);
      }

      // Timeout after 3s
      setTimeout(() => {
        pc?.close();
        resolve([...new Set(ips)]);
      }, 3000);
    });
  }

  private isPrivateIP(ip: string): boolean {
    return (
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    );
  }

  private detectTimezoneCountryMismatch(
    country: string,
    timezone: string,
  ): boolean {
    const _browserOffset = -new Date().getTimezoneOffset();
    // Rough check — a more thorough version would use a country→offset map
    // Basic timezone/country mismatch check
    void timezone.split("/")[0]; // suppress unused warning
    return (
      country !== "" &&
      !timezone.toLowerCase().includes(country.slice(0, 3).toLowerCase())
    );
  }

  async detect(): Promise<VPNStatus> {
    const [localIPs, geoData] = await Promise.all([
      this.extractWebRTCIPs(),
      fetch("https://ipapi.co/json")
        .then((r) => r.json() as Promise<GeoResponse>)
        .catch(() => ({}) as GeoResponse),
    ]);

    const publicIP = geoData.ip ?? "unknown";
    const country = geoData.country ?? "unknown";
    const timezone =
      geoData.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Signal 1: VPN tunnel IPs in WebRTC candidates (10.x / 172.16-31.x)
    const hasVPNSubnet = localIPs.some(
      (ip) => this.isPrivateIP(ip) && ip.startsWith("10."),
    );

    // Signal 2: Timezone/country mismatch
    const mismatch = this.detectTimezoneCountryMismatch(country, timezone);

    // Signal 3: Multiple private IPs suggests tunnel adapter
    const multiplePrivate =
      localIPs.filter((ip) => this.isPrivateIP(ip)).length > 1;

    let confidence = 0;
    if (hasVPNSubnet) confidence += 50;
    if (mismatch) confidence += 30;
    if (multiplePrivate) confidence += 20;

    return {
      detected: confidence >= 50,
      confidence,
      localIPs,
      publicIP,
      country,
      timezone,
      mismatch,
    };
  }
}

// ---------------------------------------------------------------------------
// ConnectionMetrics reader
// ---------------------------------------------------------------------------
export function readConnectionMetrics(): ConnectionMetrics {
  const conn = getNetworkInformation();
  return {
    effectiveType: conn?.effectiveType ?? "unknown",
    downlink: conn?.downlink ?? 0,
    rtt: conn?.rtt ?? 0,
    saveData: conn?.saveData ?? false,
    protocol: "HTTP/2", // PerformanceResourceTiming entries refine this later
  };
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const STORAGE_KEY = "netpulse_history";

export function saveResult(result: SpeedTestResult): void {
  const history = getHistory();
  history.unshift(result);
  // Keep last 50 results
  if (history.length > 50) history.splice(50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getHistory(): SpeedTestResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SpeedTestResult[]) : [];
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getStats(): SpeedStats {
  const history = getHistory();

  if (history.length === 0) {
    return { best: null, worst: null, avg: 0 };
  }

  const sorted = [...history].sort((a, b) => b.download - a.download);
  const best = sorted[0] ?? null;
  const worst = sorted[sorted.length - 1] ?? null;
  const avg = history.reduce((acc, r) => acc + r.download, 0) / history.length;

  return { best, worst, avg: parseFloat(avg.toFixed(2)) };
}
