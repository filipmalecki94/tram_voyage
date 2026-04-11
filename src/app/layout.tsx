import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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
  title: "Tramwajarz",
  description: "Webowa pijacka gra karciana na imprezę",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <span className="fixed top-2 right-2 z-50 text-[10px] text-muted-foreground/50 font-mono select-none pointer-events-none">
          v0.1.1
        </span>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
