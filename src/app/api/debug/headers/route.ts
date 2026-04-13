import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    x_forwarded_for: req.headers.get("x-forwarded-for"),
    x_real_ip: req.headers.get("x-real-ip"),
    cf_connecting_ip: req.headers.get("cf-connecting-ip"),
    x_vercel_forwarded_for: req.headers.get("x-vercel-forwarded-for"),
    all_headers: Object.fromEntries(req.headers.entries()),
  });
}
