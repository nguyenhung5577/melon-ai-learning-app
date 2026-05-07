import type { Metadata } from "next";
import { Lexend_Mega, Space_Grotesk } from "next/font/google";
import { AppProviders } from "@/lib/core/providers";
import "./globals.css";

const lexendMega = Lexend_Mega({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Melon — AI Learning for Kids",
  description:
    "Melon is an AI-powered adaptive learning platform for children. Interactive lessons, gamified progress, and a personal AI tutor.",
  keywords: ["kids learning", "AI tutor", "gamified education", "adaptive learning"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lexendMega.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-nb-bg text-nb-black font-body">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
