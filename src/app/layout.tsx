import type { Metadata, Viewport } from "next";
import { Geist_Mono, Nunito } from "next/font/google";

import { InteractionPerfBootstrap } from "@/components/perf/interaction-perf-bootstrap";
import { HuiSerwistProvider } from "@/components/serwist-provider";
import { THEME_INIT_SCRIPT } from "@/lib/ui/theme";
import { HUI_PWA_DESCRIPTION } from "@/lib/pwa/manifest";

import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  display: "swap",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1612" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <HuiSerwistProvider>
          <InteractionPerfBootstrap />
          {children}
        </HuiSerwistProvider>
      </body>
    </html>
  );
}
