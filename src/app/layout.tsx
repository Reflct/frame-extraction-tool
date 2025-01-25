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
  title: "Sharp Frames Tool",
  description: "Extract clear frames from videos or image directories with precision. A powerful web-based tool for video frame extraction and image analysis.",
  icons: {
    icon: "/Favicon-reflct.png",
  },
  openGraph: {
    title: "Sharp Frames Tool",
    description: "Extract clear frames from videos or image directories with precision. A powerful web-based tool for video frame extraction and image analysis.",
    type: "website",
    images: [
      {
        url: "/Reflct-og.jpg",
      },
    ],
  },
  twitter: {
    title: "Sharp Frames Tool",
    description: "Extract clear frames from videos or image directories with precision. A powerful web-based tool for video frame extraction and image analysis.",
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
