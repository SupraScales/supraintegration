import type { Metadata } from "next";
import { Saira, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display — Saira. design.md §2.1 (weights 300–800)
const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Body — Inter. design.md §2.1 (weights 300–700)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Mono — JetBrains Mono. design.md §2.1 (weights 400, 500)
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Supra Integration — Autonomous Business Systems",
  description:
    "Supra designs and installs connected business systems for lead response, follow-up, operations, reporting, and owner-independent execution.",
  openGraph: {
    title: "Supra Integration — Autonomous Business Systems",
    description:
      "Connect lead response, follow-up, operations, reporting, and team accountability in one custom business command center.",
    url: "https://supraintegration.ai",
    siteName: "Supra Integration",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Supra Integration — Autonomous Business Systems",
    description:
      "Connected business systems for revenue operations, management visibility, and less owner-dependent execution.",
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
      className={`${saira.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
