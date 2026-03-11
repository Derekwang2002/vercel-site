import type { MetadataRoute } from "next";
import { getAllPosts, getAllTagsWithCounts, normalizeTagSlug } from "../../lib/posts";

export const dynamic = "force-static";

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function toAbsoluteUrl(siteUrl: string, pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteUrl}${normalized}`;
}

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const [posts, tags] = await Promise.all([getAllPosts(), getAllTagsWithCounts()]);

  const latestPostDate = posts.length > 0 ? toDate(posts[0].date) : undefined;

  const latestTagDateBySlug = new Map<string, Date>();
  for (const post of posts) {
    const postDate = toDate(post.date);

    for (const tag of post.tags) {
      const slug = normalizeTagSlug(tag);
      if (!slug) continue;

      const current = latestTagDateBySlug.get(slug);
      if (!current || postDate > current) {
        latestTagDateBySlug.set(slug, postDate);
      }
    }
  }

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: toAbsoluteUrl(siteUrl, "/"),
      lastModified: latestPostDate,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: toAbsoluteUrl(siteUrl, "/blog"),
      lastModified: latestPostDate,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: toAbsoluteUrl(siteUrl, "/tags"),
      lastModified: latestPostDate,
      changeFrequency: "weekly",
      priority: 0.8
    }
  ];

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: toAbsoluteUrl(siteUrl, `/blog/${post.slug}`),
    lastModified: toDate(post.date),
    changeFrequency: "monthly",
    priority: 0.7
  }));

  const tagEntries: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: toAbsoluteUrl(siteUrl, `/tags/${tag.slug}`),
    lastModified: latestTagDateBySlug.get(tag.slug),
    changeFrequency: "weekly",
    priority: 0.6
  }));

  return [...staticEntries, ...postEntries, ...tagEntries];
}
