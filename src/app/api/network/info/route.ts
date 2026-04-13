import { type NextRequest, NextResponse } from "next/server";

// VPN ISP fingerprint list
const VPN_ORGS = [
  "datacamp",
  "digitalocean",
  "amazon aws",
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
  "as-choopa",
  "quadranet",
];

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "";

  const geoRes = await fetch(
    `http://ip-api.com/json/${ip}?fields=status,isp,org,country,city,query,as`,
  );
  const geo = await geoRes.json();

  const orgLower = (geo.org || "").toLowerCase();
  const vpn_detected = VPN_ORGS.some((v) => orgLower.includes(v));
  const vpn_confidence = vpn_detected ? 85 : 5;

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
    asn,
  });
}
