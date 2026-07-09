import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { codeToHtml } from "shiki";
import { PostBodyLayout } from "@/components/post-body-layout";
import type { TocItem } from "@/components/post-toc";
import { getAllPosts, getPostBySlug, normalizeTagSlug } from "../../../../lib/posts";
import styles from "./page.module.css";

const SITE_NAME = "Personal Website";
const DEFAULT_OG_IMAGE = "/og-default.svg";

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
      description: "The requested post could not be found."
    };
  }

  const absoluteUrl = `${SITE_URL}/blog/${post.slug}`;

  return {
    title: `${post.title} | ${SITE_NAME}`,
    description: post.summary,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      url: absoluteUrl,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${post.title} Open Graph Image`
        }
      ],
      publishedTime: `${post.date}T00:00:00.000Z`
    }
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const tocItems = getMarkdownHeadings(post.content);
  const renderedContent = await renderMarkdown(post.content, tocItems);

  return (
    <main className={styles.postPage}>
      <p className={styles.backWrap}>
        <Link className={styles.backLink} href="/blog">
          Back to Blog
        </Link>
      </p>

      <header className={styles.header}>
        <h1 className={styles.title}>{post.title}</h1>
        <time className={styles.date} dateTime={post.date}>
          {formatPostDate(post.date)}
        </time>
        <ul className={styles.tags}>
          {post.tags.map((tag) => (
            <li key={tag}>
              <Link className={styles.tagLink} href={`/blog?tag=${normalizeTagSlug(tag)}`}>
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <PostBodyLayout tocItems={tocItems}>{renderedContent}</PostBodyLayout>
    </main>
  );
}

function formatPostDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}

async function renderMarkdown(markdown: string, headings: TocItem[]): Promise<React.ReactNode[]> {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  let headingIndex = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const codeFence = /^```\s*([^\s`]+)?(?:\s+.*)?$/.exec(trimmed);
    if (codeFence) {
      const language = codeFence[1] ?? "";
      const codeLines: string[] = [];
      i += 1;

      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }

      if (i < lines.length) {
        i += 1;
      }

      blocks.push(await renderCodeBlock(codeLines.join("\n"), language, `block-${key}`));
      key += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const headingId = headings[headingIndex]?.id;
      headingIndex += 1;

      if (level === 1) {
        blocks.push(
          <h1 className={styles.h1} id={headingId} key={`block-${key}`}>
            {parseInline(text, `inline-${key}`)}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2 className={styles.h2} id={headingId} key={`block-${key}`}>
            {parseInline(text, `inline-${key}`)}
          </h2>
        );
      } else if (level === 3) {
        blocks.push(
          <h3 className={styles.h3} id={headingId} key={`block-${key}`}>
            {parseInline(text, `inline-${key}`)}
          </h3>
        );
      } else {
        blocks.push(
          <h4 className={styles.h4} id={headingId} key={`block-${key}`}>
            {parseInline(text, `inline-${key}`)}
          </h4>
        );
      }

      key += 1;
      i += 1;
      continue;
    }

    const listMarker = parseListMarker(line);
    if (listMarker) {
      const listBlock = parseListBlock(lines, i, listMarker.indent, `block-${key}`);
      blocks.push(listBlock.node);
      i = listBlock.nextIndex;
      key += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i].trim()) &&
      !/^(#{1,6})\s+/.test(lines[i].trim()) &&
      !parseListMarker(lines[i])
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }

    blocks.push(
      <p className={styles.paragraph} key={`block-${key}`}>
        {parseInline(paragraphLines.join(" "), `p-${key}`)}
      </p>
    );
    key += 1;
  }

  return blocks;
}

type ListMarker = {
  content: string;
  indent: number;
  ordered: boolean;
};

type ListBlock = {
  nextIndex: number;
  node: React.ReactNode;
};

function parseListBlock(
  lines: string[],
  startIndex: number,
  baseIndent: number,
  keyPrefix: string
): ListBlock {
  const firstMarker = parseListMarker(lines[startIndex]);
  const ordered = firstMarker?.ordered ?? false;
  const items: React.ReactNode[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const marker = parseListMarker(lines[i]);
    if (!marker || marker.indent !== baseIndent || marker.ordered !== ordered) {
      break;
    }

    const itemKey = `${keyPrefix}-item-${items.length}`;
    const itemChildren: React.ReactNode[] = [
      <span key={`${itemKey}-text`}>{parseInline(marker.content, `${itemKey}-text`)}</span>
    ];

    i += 1;

    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed) {
        i += 1;
        break;
      }

      const nextMarker = parseListMarker(rawLine);
      if (nextMarker) {
        if (nextMarker.indent <= baseIndent) {
          break;
        }

        const nestedList = parseListBlock(
          lines,
          i,
          nextMarker.indent,
          `${itemKey}-nested-${itemChildren.length}`
        );
        itemChildren.push(nestedList.node);
        i = nestedList.nextIndex;
        continue;
      }

      const continuationIndent = getIndentWidth(rawLine);
      if (continuationIndent <= baseIndent) {
        break;
      }

      itemChildren.push(
        <span className={styles.listContinuation} key={`${itemKey}-cont-${itemChildren.length}`}>
          {parseInline(trimmed, `${itemKey}-cont-${itemChildren.length}`)}
        </span>
      );
      i += 1;
    }

    items.push(<li key={itemKey}>{itemChildren}</li>);
  }

  const ListTag = ordered ? "ol" : "ul";

  return {
    nextIndex: i,
    node: (
      <ListTag className={styles.list} key={keyPrefix}>
        {items}
      </ListTag>
    )
  };
}

function parseListMarker(line: string): ListMarker | null {
  const marker = /^([ \t]*)([-*+]|\d+\.)\s+(.+)$/.exec(line);
  if (!marker) {
    return null;
  }

  return {
    content: marker[3],
    indent: getIndentWidth(marker[1]),
    ordered: /^\d+\.$/.test(marker[2])
  };
}

function getIndentWidth(line: string): number {
  const indent = /^([ \t]*)/.exec(line)?.[1] ?? "";
  return indent.replace(/\t/g, "    ").length;
}

async function renderCodeBlock(
  code: string,
  language: string,
  key: string
): Promise<React.ReactNode> {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const highlightedCode = await highlightCode(code, normalizedLanguage);
  const label = getCodeLanguageLabel(language, normalizedLanguage);

  return (
    <figure className={styles.codeFigure} key={key}>
      {label ? (
        <figcaption className={styles.codeHeader}>
          <span>{label}</span>
        </figcaption>
      ) : null}
      <div
        className={styles.codeBody}
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </figure>
  );
}

async function highlightCode(code: string, language: string): Promise<string> {
  try {
    return await codeToHtml(code, {
      lang: language,
      themes: {
        light: "github-light",
        dark: "github-dark"
      },
      defaultColor: false
    });
  } catch {
    return codeToHtml(code, {
      lang: "text",
      themes: {
        light: "github-light",
        dark: "github-dark"
      },
      defaultColor: false
    });
  }
}

function normalizeCodeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  const aliases: Record<string, string> = {
    cplusplus: "cpp",
    js: "javascript",
    md: "markdown",
    mysql: "sql",
    plaintext: "text",
    psql: "sql",
    py: "python",
    shell: "bash",
    sh: "bash",
    ts: "typescript",
    yml: "yaml",
    zsh: "bash"
  };

  return aliases[normalized] ?? (normalized || "text");
}

function getCodeLanguageLabel(language: string, normalizedLanguage: string): string {
  const rawLanguage = language.trim();
  if (!rawLanguage) {
    return "";
  }

  const labels: Record<string, string> = {
    bash: "Bash",
    cpp: "C++",
    css: "CSS",
    html: "HTML",
    java: "Java",
    javascript: "JavaScript",
    json: "JSON",
    markdown: "Markdown",
    python: "Python",
    sql: "SQL",
    text: "Text",
    tsx: "TSX",
    typescript: "TypeScript",
    yaml: "YAML"
  };

  return labels[normalizedLanguage] ?? rawLanguage;
}

function getMarkdownHeadings(markdown: string): TocItem[] {
  const usedIds = new Map<string, number>();
  const items: TocItem[] = [];
  let inCodeFence = false;

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    if (/^```\s*/.test(line.trim())) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!heading) {
      continue;
    }

    const level = heading[1].length;
    const text = stripInlineMarkdown(heading[2]);
    const baseId = slugifyHeading(text) || `section-${items.length + 1}`;
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);

    items.push({
      id: count === 0 ? baseId : `${baseId}-${count + 1}`,
      level,
      text
    });
  }

  return items;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern =
    /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      nodes.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={match[1]}
          className={styles.image}
          decoding="async"
          fetchPriority="low"
          key={`${keyPrefix}-img-${match.index}`}
          loading="lazy"
          src={match[2]}
        />
      );
    } else if (match[3] !== undefined && match[4] !== undefined) {
      const href = match[4];
      const isExternal = /^https?:\/\//i.test(href);

      nodes.push(
        <a
          className={styles.inlineLink}
          href={href}
          key={`${keyPrefix}-link-${match.index}`}
          rel={isExternal ? "noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          {match[3]}
        </a>
      );
    } else if (match[5] !== undefined) {
      nodes.push(
        <code className={styles.inlineCode} key={`${keyPrefix}-code-${match.index}`}>
          {match[5]}
        </code>
      );
    } else if (match[6] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${match.index}`}>
          {parseInline(match[6], `${keyPrefix}-strong-${match.index}`)}
        </strong>
      );
    } else if (match[7] !== undefined) {
      nodes.push(
        <em key={`${keyPrefix}-em-${match.index}`}>
          {parseInline(match[7], `${keyPrefix}-em-${match.index}`)}
        </em>
      );
    }

    lastIndex = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
