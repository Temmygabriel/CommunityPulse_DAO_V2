import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "CommunityPulse V2",
  description: "On-chain community treasury governed by AI. Pool funds. Propose. Let the constitution decide. Now with Sybil resistance via USDC stake.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "CommunityPulse V2",
    description: "AI-enforced community treasury with Sybil resistance. One address, one voice. No whales.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
