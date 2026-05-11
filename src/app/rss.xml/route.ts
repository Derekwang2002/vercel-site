import { getAllPosts } from "../../../lib/posts";

export const dynamic = "force-static";

const SITE_TITLE = "Personal Website";
const SITE_DESCRIPTION =
  "Minimal personal website for timeline-first writing and tag-based navigation.";

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  const siteUrl = getSiteUrl();
  const posts = await getAllPosts();

  const itemsXml = posts
    .map((post) => {
      const link = `${siteUrl}/blog/${post.slug}`;
      const pubDate = new Date(`${post.date}T00:00:00.000Z`).toUTCString();

      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid>${escapeXml(link)}</guid>`,
        `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
        `      <description>${escapeXml(post.summary)}</description>`,
        "    </item>"
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(SITE_TITLE)}</title>`,
    `    <description>${escapeXml(SITE_DESCRIPTION)}</description>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    itemsXml,
    "  </channel>",
    "</rss>"
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8"
    }
  });
}
