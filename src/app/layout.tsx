import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://www.bepresearch.com";
const SITE_NAME = "BEP Research";
const DEFAULT_TITLE = "BEP Research — AI Infrastructure Intelligence by Ben Pouladian";
const DEFAULT_DESCRIPTION =
  "Independent system-level research on AI infrastructure by Ben Pouladian — covering AI semiconductors, HBM and memory economics, optical interconnects, advanced packaging, NeoCloud datacenters, GPU pricing, inference margins, and the unit economics of intelligence.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | BEP Research",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Ben Pouladian", url: SITE_URL }],
  creator: "Ben Pouladian",
  publisher: "BEP Research",
  category: "technology",
  keywords: [
    "AI infrastructure",
    "AI semiconductors",
    "GPU economics",
    "HBM",
    "high bandwidth memory",
    "NVIDIA",
    "optical interconnects",
    "advanced packaging",
    "CoWoS",
    "NeoCloud",
    "datacenter power",
    "inference economics",
    "token pricing",
    "LLMflation",
    "Ben Pouladian",
    "BEP Research",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "BEP Research — AI Infrastructure Intelligence by Ben Pouladian",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/opengraph-image"],
    creator: "@benitoz",
    site: "@benitoz",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/bep-icon.png", sizes: "512x512" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050505",
  colorScheme: "dark",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/bep-icon.png`,
      sameAs: [
        "https://bepresearch.substack.com",
        "https://x.com/benitoz",
        "https://www.linkedin.com/in/benpouladian",
        "https://www.youtube.com/@bepresearch",
      ],
      founder: { "@id": `${SITE_URL}#person` },
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}#person`,
      name: "Ben Pouladian",
      url: SITE_URL,
      image: `${SITE_URL}/bep-avatar.png`,
      jobTitle: "Independent AI Infrastructure Researcher",
      description:
        "Independent researcher covering the full AI infrastructure stack — semiconductors, optical interconnects, memory architecture, datacenter power, and the unit economics of intelligence.",
      knowsAbout: [
        "AI infrastructure",
        "AI semiconductors",
        "HBM and memory architecture",
        "Optical interconnects",
        "Advanced packaging (CoWoS)",
        "NeoCloud datacenters",
        "GPU economics",
        "Inference margin analysis",
        "Datacenter power",
      ],
      sameAs: [
        "https://bepresearch.substack.com",
        "https://x.com/benitoz",
        "https://www.linkedin.com/in/benpouladian",
        "https://www.youtube.com/@bepresearch",
      ],
      worksFor: { "@id": `${SITE_URL}#organization` },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}#organization` },
      inLanguage: "en-US",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
