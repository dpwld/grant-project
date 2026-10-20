import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grant Project — Discover grants and prepare applications",
  description: "Collect announcements, match your company profile, and prepare applications.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
