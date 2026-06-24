import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Supra Integration — AI Systems for Modern Business",
  description:
    "Supra Integration designs, builds, and deploys AI automation and agent systems that plug directly into the tools your business already runs on.",
  openGraph: {
    title: "Supra Integration — AI Systems for Modern Business",
    description:
      "AI automation and agent systems that plug directly into the tools your business already runs on.",
    url: "https://supraintegration.ai",
    siteName: "Supra Integration",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Supra Integration — AI Systems for Modern Business",
    description:
      "AI automation and agent systems that plug directly into the tools your business already runs on.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
