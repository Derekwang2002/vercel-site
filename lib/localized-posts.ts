import { promises as fs } from "node:fs";
import path from "node:path";
import type { ContentLocale } from "./locale";
import { getAllPosts, getPostBySlug, type Post } from "./posts";

export async function getAllLocalizedPosts(locale: ContentLocale): Promise<Post[]> {
  const posts = await getAllPosts();
  const localized = await Promise.all(
    posts.map((post) => getLocalizedPostBySlug(post.slug, locale))
  );
  return localized.filter((post): post is Post => post !== null);
}

export async function getLocalizedPostBySlug(
  slug: string,
  locale: ContentLocale
): Promise<Post | null> {
  const post = await getPostBySlug(slug);
  if (!post) return null;

  const translationPath = path.join(
    process.cwd(),
    "content",
    "translations",
    locale,
    "posts",
    path.basename(post.fileName)
  );

  try {
    const source = await fs.readFile(translationPath, "utf8");
    const translation = parseTranslation(source, translationPath);
    return { ...post, ...translation, fileName: translationPath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return getSourceLocale(slug) === locale ? post : null;
    }
    throw error;
  }
}

function getSourceLocale(slug: string): ContentLocale {
  return slug === "hello-next" ? "en" : "zh";
}

function parseTranslation(source: string, fileName: string): Pick<Post, "title" | "summary" | "content"> {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/.exec(source.replace(/\r\n/g, "\n"));
  if (!match) throw new Error(`Invalid translation frontmatter in ${fileName}.`);
  const fields = Object.fromEntries(
    match[1].split("\n").flatMap((line) => {
      const field = /^(title|summary):\s*["']?(.*?)["']?\s*$/.exec(line);
      return field ? [[field[1], field[2]]] : [];
    })
  );
  if (!fields.title || !fields.summary) throw new Error(`Missing title or summary in ${fileName}.`);
  return { title: fields.title, summary: fields.summary, content: match[2].trim() };
}
