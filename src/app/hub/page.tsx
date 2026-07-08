import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Hub",
  description: "Unified entry point for reusable skills and demos.",
  openGraph: {
    title: "Hub | Personal Website",
    description: "Unified entry point for reusable skills and demos.",
    url: "/hub/all",
    images: [
      {
        url: "/og-default.svg",
        width: 1200,
        height: 630,
        alt: "Hub Open Graph Image"
      }
    ]
  }
};

export default function HubPage() {
  redirect("/hub/all");
}
