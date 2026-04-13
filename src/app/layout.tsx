import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NetPulse",
  description: "Cybernetic network monitor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        style={{ background: "#050507", minHeight: "100vh", margin: 0 }}
        className="flex"
      >
        <Sidebar />
        {/* ml-60 = 240px offset for fixed sidebar */}
        <main
          className="ml-60 min-h-screen"
          style={{ flex: 1, background: "#050507" }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
