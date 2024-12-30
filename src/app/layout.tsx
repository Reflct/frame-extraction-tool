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
  title: "Frame Extractor - Reflct",
  description: "Extract clear frames from videos with precision. A powerful web-based tool for video frame extraction.",
  icons: {
    icon: "/Favicon-reflct.png",
  },
  openGraph: {
    title: "Frame Extractor - Reflct",
    description: "Extract clear frames from videos with precision. A powerful web-based tool for video frame extraction.",
    type: "website",
    images: [
      {
        url: "/Reflct-og.jpg",
      },
    ],
  },
  twitter: {
    title: "Frame Extractor - Reflct",
    description: "Extract clear frames from videos with precision. A powerful web-based tool for video frame extraction.",
    card: "summary_large_image",
    images: ["/Reflct-og.jpg"],
  },
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
