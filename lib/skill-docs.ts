import { getPublicResourceByHref, getPublicSkillDocResources } from "./resources";
import { readMarkdownSource } from "./markdown-sources";

const SKILL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SkillDoc = {
  slug: string;
  content: string;
  sourceId: string;
  sourceUrl?: string;
};

export async function getAllSkillDocSlugs(): Promise<string[]> {
  const resources = await getPublicSkillDocResources();
  const slugs = resources
    .map((resource) => ({
      href: resource.href,
      slug: getSkillSlugFromHref(resource.href)
    }))
    .filter((item): item is { href: string; slug: string } => Boolean(item.slug));

  assertUniqueSkillDocSlugs(slugs);

  return slugs.map((item) => item.slug).sort((a, b) => a.localeCompare(b, "en"));
}

export async function getSkillDocBySlug(slug: string, locale: ContentLocale = "zh"): Promise<SkillDoc | null> {
  if (!SKILL_SLUG_PATTERN.test(slug)) {
    return null;
  }

  const resource = await getPublicResourceByHref(`/hub/skills/${slug}`);
  if (!resource?.docSource) {
    return null;
  }

  const source = await readMarkdownSource(resource.docSource, resource.href);

  if (locale === "en") {
    const translationPath = path.join(process.cwd(), "content", "translations", "en", "resources", `${slug}.md`);
    try {
      const content = await fs.readFile(translationPath, "utf8");
      return { slug, content, sourceId: `local:${translationPath}`, sourceUrl: source.sourceUrl };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  const doc: SkillDoc = {
    slug,
    sourceId: source.sourceId,
    content: source.content
  };

  if (source.sourceUrl) {
    doc.sourceUrl = source.sourceUrl;
  }

  return doc;
}

function getSkillSlugFromHref(href: string): string | null {
  const match = /^\/hub\/skills\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(href);
  return match?.[1] ?? null;
}

function assertUniqueSkillDocSlugs(items: Array<{ href: string; slug: string }>): void {
  const seen = new Map<string, string>();

  for (const item of items) {
    const existingHref = seen.get(item.slug);
    if (existingHref) {
      throw new Error(
        `Duplicate skill doc slug "${item.slug}" in "${existingHref}" and "${item.href}". Each hub article must use exactly one Markdown source.`
      );
    }

    seen.set(item.slug, item.href);
  }
}
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ContentLocale } from "./locale";
