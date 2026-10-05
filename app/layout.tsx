import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "公基学习台",
  description: "按学科自主学习、连续随机刷题、跨设备同步错题。",
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
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
