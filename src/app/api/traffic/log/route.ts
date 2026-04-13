import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { TrafficEvent } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: { session_id: string; events: TrafficEvent[] } = await req.json();
  const { session_id, events } = body;

  if (!session_id || !events || events.length === 0) {
    return NextResponse.json(
      { error: "session_id and events required" },
      { status: 400 },
    );
  }

  const rows = events.map((event) => ({
    session_id,
    ...event,
  }));

  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("traffic_events")
    .insert(rows)
    .select("id");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: count ?? rows.length });
}
