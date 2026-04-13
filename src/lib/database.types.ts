export interface SpeedResult {
  id: string;
  session_id: string;
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  jitter_ms: number;
  isp: string | null;
  org: string | null;
  ip_masked: string | null;
  city: string | null;
  country: string | null;
  connection_type: string;
  vpn_detected: boolean;
  vpn_confidence: number;
  timestamp: string;
}

export interface TrafficEvent {
  id: string;
  session_id: string;
  domain: string;
  size_kb: number;
  duration_ms: number;
  protocol: string;
  flagged: boolean;
  flag_reason: string | null;
  flag_severity: string;
  timestamp: string;
}

// Insert types (omit auto-generated fields)
export type SpeedResultInsert = Omit<SpeedResult, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};

export type TrafficEventInsert = Omit<TrafficEvent, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};
