import type { Metadata } from "next";
import {
  Anton,
  Black_Han_Sans,
  Cinzel,
  Cormorant_Garamond,
  Gowun_Batang,
  Noto_Sans_KR,
  Noto_Serif_KR,
} from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

// 테마마다 다른 글꼴을 쓴다 (themes.ts 의 --font-display / --font-latin)
const notoSans = Noto_Sans_KR({ variable: "--font-noto", subsets: ["latin"], weight: ["400", "500", "700"] });
const notoSerif = Noto_Serif_KR({ variable: "--font-serif-kr", subsets: ["latin"], weight: ["500", "700", "900"] });
const blackHan = Black_Han_Sans({ variable: "--font-black-han", subsets: ["latin"], weight: "400" });
const gowun = Gowun_Batang({ variable: "--font-gowun", subsets: ["latin"], weight: ["400", "700"] });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "700", "900"] });
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "TRPG 세션 툴",
  description: "아리안로드 2E 캠페인용 세션 툴",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fonts = [notoSans, notoSerif, blackHan, gowun, cinzel, anton, cormorant].map((f) => f.variable).join(" ");
  return (
    <html lang="ko" className={`${fonts} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
