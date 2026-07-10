import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Blog",
  description: "Tags are now handled as filters inside Blog.",
  openGraph: {
    title: "Blog | Derek Hub",
    description: "Tags are now handled as filters inside Blog.",
    url: "/blog",
    images: [
      {
        url: "/og-default.svg",
        width: 1200,
        height: 630,
        alt: "Blog Open Graph Image"
      }
    ]
  }
};

export default function TagsPage() {
  redirect("/blog");
}
