import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const ogImage = `${protocol}://${host}/og.png`;
  const title = "玄机｜四柱八字与紫微命盘";
  const description = "输入出生信息，自动校准真太阳时，生成四柱八字、紫微命盘、大运走势与双盘合参解读。";
  return {
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", images: [{ url: ogImage, width: 1731, height: 905, alt: "玄机 · 四柱八字与紫微斗数双盘合参" }] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><script src="/iztro.min.js" />{children}</body></html>;
}
