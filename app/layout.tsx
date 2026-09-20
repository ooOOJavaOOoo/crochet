import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const DEFAULT_APP_URL = "https://crochetcanvas.com";

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    return DEFAULT_APP_URL;
  }

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_APP_URL;
  }
}

const siteUrl = getSiteUrl();

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Crochet Canvas",
  title: 'Crochet Canvas — Turn a photo into a stitch-ready crochet chart',
  description:
    'Turn a reference photo into a stitch-ready crochet chart with yarn-aware planning, chart previews, and instant PDF delivery.',
  keywords: [
    'crochet pattern generator',
    'tapestry crochet',
    'crochet chart maker',
    'image to crochet pattern',
    'AI crochet pattern',
    'crochet chart from photo',
    'photo to crochet pattern',
  ],
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'Crochet Canvas',
    title: 'Crochet Canvas — Turn a photo into a stitch-ready crochet chart',
    description:
      'Turn a reference photo into a stitch-ready crochet chart with yarn-aware settings, preview tools, and instant PDF delivery.',
    images: [
      {
        // Prefer a raster social preview for better compatibility with crawlers
        url: `${siteUrl}/og-home.png`,
        width: 1200,
        height: 630,
        alt: 'Crochet Canvas app preview showing generated tapestry crochet chart',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crochet Canvas — Turn a photo into a stitch-ready crochet chart',
    description:
      'Turn a reference photo into a stitch-ready crochet chart with yarn-aware settings and instant PDF delivery.',
    images: [`${siteUrl}/og-home.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${fraunces.variable} ${spaceMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
