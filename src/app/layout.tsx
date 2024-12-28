import type { Metadata } from "next";
import "./globals.css";
import { DM_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "Frame Extraction",
  description: "Extract frames from videos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={dmMono.variable}>
      <body className="min-h-screen bg-[#E0E0E0] font-roobert antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
