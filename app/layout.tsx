import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import ToastProvider from "./_components/ToastProvider";
import { isWorklogEnabled } from "@/lib/worklog/flags";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

// The manifest (installability, push) is only meaningful behind the worklog flag —
// with it off, the app must look/behave exactly as before, PWA-ness included.
export const metadata: Metadata = {
  title: "iMarc Attendance",
  description: "GPS-verified staff attendance for iMarcProjects",
  ...(isWorklogEnabled() ? { manifest: "/manifest.json", themeColor: "#0A0A0C" } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${body.variable}`}>
      <body className="font-body min-h-screen">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
