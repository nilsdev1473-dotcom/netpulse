import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { TrafficEvent } from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const body: { session_id: string; events: TrafficEvent[] } = await req.json();
  const { events } = body;

  if (!events || events.length === 0) {
    return NextResponse.json({ error: "events required" }, { status: 400 });
  }

  const prompt = `Analyze these browser network requests and provide: 1) A 2-sentence plain English summary of what kind of internet traffic is flowing, 2) A threat score 0-100 (0=clean, 100=highly suspicious), 3) Specific flags if any (tracker detected, insecure HTTP, unusually large data transfer). Be concise and technical but readable by a non-expert. Return JSON: {summary: string, threat_score: number, flags: string[]}

Network requests:
${JSON.stringify(events.slice(0, 50), null, 2)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(completion.choices[0].message.content || "{}");

  return NextResponse.json({
    summary: result.summary || "",
    threat_score: result.threat_score ?? 0,
    flags: result.flags || [],
  });
}
