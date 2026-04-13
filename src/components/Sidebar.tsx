"use client";

import { Activity, BarChart2, LayoutDashboard, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={16} /> },
  { label: "Speed Test", href: "/speedtest", icon: <Zap size={16} /> },
  { label: "History", href: "/history", icon: <BarChart2 size={16} /> },
  { label: "Traffic", href: "/traffic", icon: <Activity size={16} /> },
];

// navigator.connection is not yet in the official TS lib
interface NetworkInformation {
  effectiveType?: string;
  type?: string;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [ip, setIp] = useState<string>("---.---.---.---");
  const [connType, setConnType] = useState<string>("unknown");

  // Online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch IP + connection type
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((data: { ip?: string }) => {
        if (data.ip) setIp(data.ip);
      })
      .catch(() => {});

    const conn = navigator.connection;
    if (conn) {
      setConnType(conn.effectiveType ?? conn.type ?? "unknown");
    }
  }, []);

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        background: "#050507",
        borderRight: "1px solid rgba(0,232,237,0.1)",
        position: "fixed",
        top: 0,
        left: 0,
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
        // Subtle scan-line texture
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,232,237,0.015) 2px,
            rgba(0,232,237,0.015) 4px
          )
        `,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid rgba(0,232,237,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Pulsing status dot */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isOnline ? "#00FF94" : "#FF3B3B",
            display: "inline-block",
            boxShadow: isOnline
              ? "0 0 6px #00FF94, 0 0 12px rgba(0,255,148,0.4)"
              : "0 0 6px #FF3B3B, 0 0 12px rgba(255,59,59,0.4)",
            animation: "netpulse-dot 2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily:
              "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          NETPULSE
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                textDecoration: "none",
                color: isActive ? "#00E8ED" : "rgba(255,255,255,0.5)",
                background: isActive ? "rgba(0,232,237,0.06)" : "transparent",
                borderLeft: isActive
                  ? "2px solid #00E8ED"
                  : "2px solid transparent",
                transition: "color 0.15s, background 0.15s, border-color 0.15s",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                fontFamily:
                  "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "rgba(0,232,237,0.04)";
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "rgba(255,255,255,0.75)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "rgba(255,255,255,0.5)";
                }
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.6, display: "flex" }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — IP + connection info */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid rgba(0,232,237,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.08em",
            marginBottom: 6,
            fontFamily:
              "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
            textTransform: "uppercase",
          }}
        >
          Connection
        </div>
        <div
          style={{
            fontFamily:
              "var(--font-jetbrains-mono, 'JetBrains Mono', monospace)",
            fontSize: 11,
            color: "rgba(0,232,237,0.7)",
            marginBottom: 4,
            wordBreak: "break-all",
          }}
        >
          {ip}
        </div>
        <div
          style={{
            fontFamily:
              "var(--font-jetbrains-mono, 'JetBrains Mono', monospace)",
            fontSize: 10,
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {connType}
        </div>
      </div>
    </aside>
  );
}
