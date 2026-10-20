import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grantory — 지원사업 탐색과 신청 준비",
  description: "공고 수집부터 기업 프로필 매칭, 검토와 신청 준비까지.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
