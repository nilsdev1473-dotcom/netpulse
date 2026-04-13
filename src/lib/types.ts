export interface SpeedTestResult {
  id: string;
  timestamp: number;
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  connectionName: string;
  server: string;
}

export interface ConnectionMetrics {
  effectiveType: "2g" | "3g" | "4g" | "slow-2g" | "unknown";
  downlink: number;
  rtt: number;
  saveData: boolean;
  protocol: string;
}

export interface TrafficEntry {
  domain: string;
  url: string;
  duration: number;
  size: number;
  protocol: string;
  cached: boolean;
  timestamp: number;
}

export interface VPNStatus {
  detected: boolean;
  confidence: number;
  localIPs: string[];
  publicIP: string;
  country: string;
  timezone: string;
  mismatch: boolean;
}

export interface PingResult {
  avg: number;
  min: number;
  max: number;
  jitter: number;
}

export interface NetworkSnapshot {
  metrics: ConnectionMetrics;
  ping: PingResult;
  timestamp: number;
}

export interface TrafficEvent {
  domain: string;
  url: string;
  method: string;
  status: number;
  size: number;
  duration: number;
  protocol: string;
  timestamp: number;
  initiator?: string;
}

export interface SpeedStats {
  best: SpeedTestResult | null;
  worst: SpeedTestResult | null;
  avg: number;
}
