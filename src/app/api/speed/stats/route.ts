import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");

  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("speed_results")
    .select("download_mbps, upload_mbps, ping_ms")
    .eq("session_id", session_id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data || data.length === 0) {
    return NextResponse.json({
      best_download: 0,
      avg_download: 0,
      worst_download: 0,
      total_tests: 0,
      best_ping: 0,
      avg_ping: 0,
    });
  }

  const downloads = data.map((r) => r.download_mbps);
  const pings = data.map((r) => r.ping_ms);

  const best_download = Math.max(...downloads);
  const worst_download = Math.min(...downloads);
  const avg_download = downloads.reduce((a, b) => a + b, 0) / downloads.length;
  const best_ping = Math.min(...pings);
  const avg_ping = pings.reduce((a, b) => a + b, 0) / pings.length;

  return NextResponse.json({
    best_download: Math.round(best_download * 10) / 10,
    avg_download: Math.round(avg_download * 10) / 10,
    worst_download: Math.round(worst_download * 10) / 10,
    total_tests: data.length,
    best_ping: Math.round(best_ping),
    avg_ping: Math.round(avg_ping),
  });
}
