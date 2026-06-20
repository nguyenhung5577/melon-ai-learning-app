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
  title: "Melon — Học cùng AI cho trẻ",
  description:
    "Melon là nền tảng học tập cá nhân hóa bằng AI cho trẻ, gồm bài học tương tác, tiến độ gamified và gia sư AI.",
  keywords: ["học cho trẻ", "gia sư AI", "học gamified", "học cá nhân hóa"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${lexendMega.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-nb-bg text-nb-black font-body">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
