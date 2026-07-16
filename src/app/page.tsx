import type { Metadata } from "next";
import { HomeContent } from "@/components/home-content";

export const metadata: Metadata = {
  title: "Home",
  description: "Home page for Derek with profile, writing, and featured resources.",
  alternates: { canonical: "/", languages: { en: "/", "zh-CN": "/zh" } },
  openGraph: { title: "Home | Derek Hub", description: "Home page for Derek with profile, writing, and featured resources.", url: "/", images: [{ url: "/og-default.svg", width: 1200, height: 630, alt: "Derek Hub Open Graph Image" }] }
};

export default function HomePage() { return <HomeContent locale="en" />; }
