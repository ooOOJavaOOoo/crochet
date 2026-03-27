import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Crochet Pattern Generator — Convert Any Image to Tapestry Crochet',
  description:
    'Upload a photo or generate an image, then get a complete tapestry crochet pattern with stitch chart, yarn requirements, and row-by-row instructions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${nunito.variable} ${fraunces.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
