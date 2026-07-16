import type { Metadata } from "next";
import { HomeContent } from "@/components/home-content";

export const metadata: Metadata = {
  title: "Home",
  description: "Derek 的个人主页、写作与精选资源。",
  alternates: { canonical: "/zh", languages: { en: "/", "zh-CN": "/zh" } }
};

export default function ChineseHomePage() { return <HomeContent locale="zh" />; }
