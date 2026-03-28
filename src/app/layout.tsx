import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BEP Research — AI Infrastructure Intelligence",
  description: "System-level AI infrastructure research by Ben Pouladian. Covering semiconductors, optical interconnects, memory architecture, and the economics of intelligence.",
  openGraph: {
    title: "BEP Research — AI Infrastructure Intelligence",
    description: "Independent research covering the full AI infrastructure stack by Ben Pouladian.",
    siteName: "BEP Research",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
