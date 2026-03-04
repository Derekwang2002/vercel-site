import { promises as fs } from "node:fs";
import path from "node:path";

const POSTS_DIRECTORY = path.join(process.cwd(), "content", "posts");
const FILE_NAME_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  draft: boolean;
  selected?: boolean;
  content: string;
  fileName: string;
};

export type TagCount = {
  tag: string;
  count: number;
  slug: string;
};

type FrontmatterValue = string | boolean | string[];
type Frontmatter = Record<string, FrontmatterValue>;

export async function getAllPosts(): Promise<Post[]> {
  const posts = await loadAllPosts();
  return sortPostsByDateDesc(toPublicPosts(posts));
}

export async function getSelectedPosts(): Promise<Post[]> {
  const posts = await loadAllPosts();
  return sortPostsByDateDesc(toPublicPosts(posts).filter((post) => post.selected === true));
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const tagSlug = normalizeTagSlug(tag);
  if (!tagSlug) {
    return [];
  }

  const posts = await loadAllPosts();
  const matchingPosts = toPublicPosts(posts).filter((post) =>
    post.tags.some((postTag) => normalizeTagSlug(postTag) === tagSlug)
  );

  return sortPostsByDateDesc(matchingPosts);
}

export async function getAllTagsWithCounts(): Promise<TagCount[]> {
  const posts = await loadAllPosts();
  const publicPosts = toPublicPosts(posts);
  const tagMap = new Map<string, { count: number; variants: Set<string> }>();

  for (const post of publicPosts) {
    const uniqueTagsInPost = new Set<string>();

    for (const tag of post.tags) {
      const slug = normalizeTagSlug(tag);
      if (!slug || uniqueTagsInPost.has(slug)) {
        continue;
      }

      uniqueTagsInPost.add(slug);
      const existing = tagMap.get(slug);

      if (existing) {
        existing.count += 1;
        existing.variants.add(tag.trim());
      } else {
        tagMap.set(slug, {
          count: 1,
          variants: new Set([tag.trim()])
        });
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([slug, value]) => ({
      slug,
      count: value.count,
      tag: pickCanonicalTag(value.variants)
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.tag.localeCompare(b.tag, "en", { sensitivity: "base" });
    });
}

async function loadAllPosts(): Promise<Post[]> {
  const entries = await fs.readdir(POSTS_DIRECTORY, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  const posts = await Promise.all(markdownFiles.map((fileName) => readPostFile(fileName)));
  return posts;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const entries = await fs.readdir(POSTS_DIRECTORY, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  for (const fileName of markdownFiles) {
    const fileNameMatch = FILE_NAME_PATTERN.exec(fileName);
    if (!fileNameMatch) {
      continue;
    }

    const postSlug = fileNameMatch[2].trim();
    if (postSlug !== slug) {
      continue;
    }

    const post = await readPostFile(fileName);
    return post.draft ? null : post;
  }

  return null;
}

function toPublicPosts(posts: Post[]): Post[] {
  return posts.filter((post) => !post.draft);
}

function sortPostsByDateDesc(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date, "en");
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.slug.localeCompare(b.slug, "en");
  });
}

export function normalizeTagSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickCanonicalTag(variants: Set<string>): string {
  return Array.from(variants).sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  )[0];
}

async function readPostFile(fileName: string): Promise<Post> {
  const fileNameMatch = FILE_NAME_PATTERN.exec(fileName);
  if (!fileNameMatch) {
    throw new Error(
      `Invalid post filename \"${fileName}\". Expected format: YYYY-MM-DD-slug.md`
    );
  }

  const [, , rawSlug] = fileNameMatch;
  const slug = rawSlug.trim();
  if (!slug) {
    throw new Error(`Invalid post filename \"${fileName}\". Slug segment cannot be empty.`);
  }

  const fullPath = path.join(POSTS_DIRECTORY, fileName);
  const source = await fs.readFile(fullPath, "utf8");
  const { frontmatter, content } = parseFrontmatter(source, fileName);

  const title = readRequiredString(frontmatter, "title", fileName);
  const date = readRequiredString(frontmatter, "date", fileName);
  const summary = readRequiredString(frontmatter, "summary", fileName);
  const tags = readRequiredTags(frontmatter, fileName);
  const draft = readOptionalBoolean(frontmatter, "draft", false, fileName) ?? false;
  const selected = readOptionalBoolean(frontmatter, "selected", undefined, fileName);

  validateDate(date, fileName);

  const post: Post = {
    slug,
    title,
    date,
    summary,
    tags,
    draft,
    content,
    fileName
  };

  if (selected !== undefined) {
    post.selected = selected;
  }

  return post;
}

function parseFrontmatter(source: string, fileName: string): { frontmatter: Frontmatter; content: string } {
  const normalized = source.replace(/^\uFEFF/, "");

  if (!normalized.startsWith("---\n")) {
    throw new Error(
      `Missing frontmatter in \"${fileName}\". Expected file to start with --- block.`
    );
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    throw new Error(
      `Invalid frontmatter in \"${fileName}\". Closing --- delimiter was not found.`
    );
  }

  const block = normalized.slice(4, closingIndex);
  const content = normalized.slice(closingIndex + 5).trimStart();

  return {
    frontmatter: parseFrontmatterBlock(block, fileName),
    content
  };
}

function parseFrontmatterBlock(block: string, fileName: string): Frontmatter {
  const lines = block.split(/\r?\n/);
  const values: Frontmatter = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const keyMatch = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!keyMatch) {
      throw new Error(
        `Invalid frontmatter line in \"${fileName}\" at line ${i + 1}: \"${lines[i]}\"`
      );
    }

    const key = keyMatch[1];
    const rawValue = keyMatch[2].trim();

    if (rawValue === "") {
      const listValues: string[] = [];
      let pointer = i + 1;

      while (pointer < lines.length) {
        const listLine = lines[pointer].trim();
        if (!listLine) {
          pointer += 1;
          continue;
        }

        const listMatch = /^-\s+(.+)$/.exec(listLine);
        if (!listMatch) {
          break;
        }

        listValues.push(unquote(listMatch[1].trim()));
        pointer += 1;
      }

      if (listValues.length > 0) {
        values[key] = listValues;
        i = pointer - 1;
        continue;
      }

      values[key] = "";
      continue;
    }

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      const inner = rawValue.slice(1, -1).trim();
      values[key] =
        inner.length === 0
          ? []
          : inner.split(",").map((part) => unquote(part.trim())).filter((part) => part.length > 0);
      continue;
    }

    if (rawValue === "true" || rawValue === "false") {
      values[key] = rawValue === "true";
      continue;
    }

    values[key] = unquote(rawValue);
  }

  return values;
}

function readRequiredString(frontmatter: Frontmatter, key: string, fileName: string): string {
  const value = frontmatter[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required frontmatter field \"${key}\" in \"${fileName}\".`);
  }
  return value.trim();
}

function readRequiredTags(frontmatter: Frontmatter, fileName: string): string[] {
  const value = frontmatter.tags;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `Missing required frontmatter field \"tags\" in \"${fileName}\". Expected non-empty string[].`
    );
  }

  const tags = value.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  if (tags.length !== value.length) {
    throw new Error(`Invalid \"tags\" in \"${fileName}\". Each tag must be a non-empty string.`);
  }

  return tags;
}

function readOptionalBoolean(
  frontmatter: Frontmatter,
  key: "draft" | "selected",
  defaultValue: boolean | undefined,
  fileName: string
): boolean | undefined {
  const value = frontmatter[key];
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Invalid \"${key}\" in \"${fileName}\". Expected boolean.`);
  }

  return value;
}

function validateDate(date: string, fileName: string): void {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new Error(`Invalid \"date\" in \"${fileName}\": \"${date}\". Expected YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  const valid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  if (!valid) {
    throw new Error(
      `Invalid \"date\" in \"${fileName}\": \"${date}\". Date is not a valid calendar day.`
    );
  }
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
