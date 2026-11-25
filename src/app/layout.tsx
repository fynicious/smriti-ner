import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/layout/BottomNav";
import ClientProviders from "@/components/layout/ClientProviders";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Smriti — Daily Rhythm & Care",
  description: "Elderly cognitive assistance and family care coordination platform for North East India",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Smriti",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFDAB9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased bg-background text-foreground min-h-screen flex flex-col overflow-x-hidden`}
      >
        <ClientProviders>
          <main className="flex-1 pb-24 sm:pb-24">
            {children}
          </main>
          <BottomNav />
        </ClientProviders>
      </body>
    </html>
  );
}
