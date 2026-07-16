import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "ویرایشگر سند حرفه‌ای | ساخت PDF و Word با استایل سایت",
  description:
    "ساخت و خروجی گرفتن از اسناد حرفه‌ای PDF و Word با تم و فونت سایت. افزودن و جابجایی بلوک‌ها و عکس‌ها با درگ اند دراپ.",
  keywords: [
    "ویرایشگر سند",
    "PDF",
    "Word",
    "Vazirmatn",
    "ساخت PDF",
    "خروجی سند",
  ],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
