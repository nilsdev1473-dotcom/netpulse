import { type NextRequest, NextResponse } from "next/server";

// Known VPN/datacenter ASNs and ISP keywords
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
  "fdcservers",
  "nocser",
  "cyberlogitec",
  "as60068",
  "as20473",
  "as14061",
  "as16509",
  "as136787",
];

export async function GET(req: NextRequest) {
  // Use Vercel's pre-computed geo headers — instant, no external API needed
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ipCity = req.headers.get("x-vercel-ip-city") ?? "Unknown";
  const ipCountry = req.headers.get("x-vercel-ip-country") ?? "Unknown";
  const ipTimezone = req.headers.get("x-vercel-ip-timezone") ?? "";
  const asn = req.headers.get("x-vercel-ip-as-number") ?? "";

  // Get browser timezone from query params (sent by frontend)
  const { searchParams } = new URL(req.url);
  const browserOffset = Number(searchParams.get("offset") ?? "0"); // minutes from UTC

  // Fetch ISP name from ip-api (lightweight, just for ISP name)
  let ispName = "Unknown";
  let orgName = "Unknown";
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=isp,org`, {
      signal: AbortSignal.timeout(2000),
    });
    const geo = await geoRes.json();
    ispName = geo.isp ?? "Unknown";
    orgName = geo.org ?? "Unknown";
  } catch {
    // Use ASN as fallback ISP name if ip-api fails
    ispName = asn ? `AS${asn}` : "Unknown";
  }

  const orgLower = `${orgName} ${ispName}`.toLowerCase();

  // Signal 1: Known VPN/datacenter ISP
  const vpnByOrg = VPN_ORGS.some((v) => orgLower.includes(v));

  // Signal 2: IP timezone vs browser timezone offset mismatch
  // Convert IP timezone to offset for comparison
  let ipOffsetMinutes = 0;
  if (ipTimezone) {
    try {
      const now = new Date();
      const ipFormatter = new Intl.DateTimeFormat("en", {
        timeZone: ipTimezone,
        timeZoneName: "shortOffset",
      });
      const parts = ipFormatter.formatToParts(now);
      const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
      // Parse "GMT+5:30" or "GMT-8" etc
      const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
      if (match) {
        const sign = match[1] === "+" ? 1 : -1;
        const hours = parseInt(match[2] ?? "0", 10);
        const mins = parseInt(match[3] ?? "0", 10);
        ipOffsetMinutes = sign * (hours * 60 + mins);
      }
    } catch {
      // ignore
    }
  }

  const tzMismatch =
    ipTimezone !== "" && Math.abs(browserOffset - ipOffsetMinutes) > 90; // >1.5 hour difference

  const vpn_detected = vpnByOrg || tzMismatch;
  const vpn_confidence = vpnByOrg ? 90 : tzMismatch ? 75 : 5;
  const vpn_reason = vpnByOrg
    ? `ISP: ${orgName}`
    : tzMismatch
      ? `Timezone mismatch (browser UTC${browserOffset >= 0 ? "+" : ""}${Math.round(browserOffset / 60)}, IP: ${ipTimezone})`
      : null;

  const maskedIp = ip.replace(/(\d+)\.(\d+)\.\d+\.\d+/, "$1.$2.xxx.xxx");

  return NextResponse.json({
    isp: ispName,
    org: orgName,
    country: ipCountry,
    city: ipTimezone
      ? (ipTimezone.split("/").pop()?.replace(/_/g, " ") ?? ipCity)
      : ipCity,
    ip_masked: maskedIp,
    vpn_detected,
    vpn_confidence,
    vpn_reason,
    asn: `AS${asn}`,
    ip_timezone: ipTimezone,
    browser_offset: browserOffset,
    ip_offset: ipOffsetMinutes,
  });
}
