import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { InteractionPerfBootstrap } from "@/components/perf/interaction-perf-bootstrap";
import { HuiSerwistProvider } from "@/components/serwist-provider";
import { HUI_PWA_DESCRIPTION } from "@/lib/pwa/manifest";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hui",
  description: HUI_PWA_DESCRIPTION,
  applicationName: "Hui",
  appleWebApp: {
    capable: true,
    title: "Hui",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#b85c42",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <HuiSerwistProvider>
          <InteractionPerfBootstrap />
          {children}
        </HuiSerwistProvider>
      </body>
    </html>
  );
}
