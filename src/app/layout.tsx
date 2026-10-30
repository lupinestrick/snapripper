import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapRipper - Sidebery 标签页快照智能整理工具",
  description: "本地安全解析 Sidebery 快照、树状可视化整理与 AI 标签比例分类工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="light" data-theme="park-light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
