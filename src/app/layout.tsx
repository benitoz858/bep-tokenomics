import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tokenomics | BEP Research",
  description: "The unit economics of AI infrastructure — from the cost to produce a token to the price to sell one. By Ben Pouladian, BEP Research.",
  openGraph: {
    title: "Tokenomics | BEP Research",
    description: "AI infrastructure unit economics dashboard — token pricing, GPU costs, inference margins, and the LLMflation Index.",
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
