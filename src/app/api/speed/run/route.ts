import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// VPN ISP fingerprint list
const VPN_ORGS = [
  "datacamp",
  "packethub",
  "digitalocean",
  "amazon",
  "google cloud",
  "microsoft azure",
  "linode",
  "vultr",
  "hetzner",
  "ovh",
  "cloudflare",
  "mullvad",
  "nordvpn",
  "expressvpn",
  "protonvpn",
  "m247",
  "aeza",
  "leaseweb",
  "choopa",
  "quadranet",
  "cogent",
  "zayo",
  "level 3",
  "hurricane electric",
  "tzulo",
  "path network",
  "constant",
  "sharktech",
  "hostinger",
  "serverius",
  "terrahost",
  "frantech",
  "blix",
  "servperso",
  "global telecom",
  "ipxo",
  "velocity-networks",
  "serverstack",
  "hostkey",
  "selectel",
  "serverius",
  "fdcservers",
  "nocser",
  "cyberlogitec",
  "bandwidth.com",
  "as60068",
  "as20473",
  "as14061",
  "as16509",
];

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Get client IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "";

  // Fetch ISP info
  const geoRes = await fetch(
    `http://ip-api.com/json/${ip}?fields=status,isp,org,country,city,query`,
  );
  const geo = await geoRes.json();

  const orgLower = `${geo.org || ""} ${geo.isp || ""}`.toLowerCase();
  const vpn_detected = VPN_ORGS.some((v) => orgLower.includes(v));
  const vpn_confidence = vpn_detected ? 85 : 5;

  const maskedIp = ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.xxx.xxx");

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("speed_results")
    .insert({
      session_id: body.session_id,
      download_mbps: body.download_mbps,
      upload_mbps: body.upload_mbps,
      ping_ms: body.ping_ms,
      jitter_ms: body.jitter_ms || 0,
      connection_type: body.connection_type || "unknown",
      isp: geo.isp || "Unknown",
      org: geo.org || "Unknown",
      ip_masked: maskedIp,
      city: geo.city || "Unknown",
      country: geo.country || "Unknown",
      vpn_detected,
      vpn_confidence,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
