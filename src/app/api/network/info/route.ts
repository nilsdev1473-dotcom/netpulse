import { type NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  // Get real client IP - try multiple headers Vercel sets
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  // Vercel sets the true client IP in x-forwarded-for, first entry
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "";

  // Get browser timezone from query param (sent by frontend)
  const { searchParams } = new URL(req.url);
  const _browserTimezone = searchParams.get("tz") || "";
  const browserOffset = Number(searchParams.get("offset") || "0"); // minutes from UTC

  const geoRes = await fetch(
    `http://ip-api.com/json/${ip}?fields=status,isp,org,country,countryCode,city,timezone,offset,query,as`,
  );
  const geo = await geoRes.json();

  const orgLower = `${geo.org || ""} ${geo.isp || ""}`.toLowerCase();
  const vpn_org = VPN_ORGS.some((v) => orgLower.includes(v));

  // Timezone mismatch detection: compare browser tz offset vs IP tz offset
  // ip-api returns offset in seconds from UTC
  const ipOffsetMinutes = (geo.offset || 0) / 60;
  const tzMismatch = Math.abs(browserOffset - ipOffsetMinutes) > 60; // >1 hour difference

  const vpn_detected = vpn_org || tzMismatch;
  const vpn_confidence = vpn_org ? 90 : tzMismatch ? 75 : 5;
  const vpn_reason = vpn_org
    ? "Known datacenter/VPN ISP"
    : tzMismatch
      ? `Timezone mismatch (browser: UTC${browserOffset >= 0 ? "+" : ""}${Math.round(browserOffset / 60)}, IP: UTC${ipOffsetMinutes >= 0 ? "+" : ""}${Math.round(ipOffsetMinutes / 60)})`
      : "";

  const maskedIp = ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.xxx.xxx");

  // Extract ASN from the "as" field (e.g. "AS12345 Some ISP")
  const asn = geo.as ? geo.as.split(" ")[0] : "Unknown";

  return NextResponse.json({
    isp: geo.isp || "Unknown",
    org: geo.org || "Unknown",
    country: geo.country || "Unknown",
    city: geo.city || "Unknown",
    ip_masked: maskedIp,
    vpn_detected,
    vpn_confidence,
    vpn_reason: vpn_reason || null,
    asn,
  });
}
