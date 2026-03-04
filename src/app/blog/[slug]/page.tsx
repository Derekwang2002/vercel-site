import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, normalizeTagSlug } from "../../../../lib/posts";
import styles from "./page.module.css";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

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
              <Link className={styles.tagLink} href={`/tags/${normalizeTagSlug(tag)}`}>
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <article className={styles.content}>{renderMarkdown(post.content)}</article>
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

function renderMarkdown(markdown: string): React.ReactNode[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const codeFence = /^```([A-Za-z0-9_-]+)?\s*$/.exec(trimmed);
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

      blocks.push(
        <pre className={styles.codeBlock} key={`block-${key}`}>
          <code data-lang={language}>{codeLines.join("\n")}</code>
        </pre>
      );
      key += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];

      if (level === 1) {
        blocks.push(
          <h1 className={styles.h1} key={`block-${key}`}>
            {parseInline(text, `inline-${key}`)}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2 className={styles.h2} key={`block-${key}`}>
            {parseInline(text, `inline-${key}`)}
          </h2>
        );
      } else if (level === 3) {
        blocks.push(
          <h3 className={styles.h3} key={`block-${key}`}>
            {parseInline(text, `inline-${key}`)}
          </h3>
        );
      } else {
        blocks.push(
          <h4 className={styles.h4} key={`block-${key}`}>
            {parseInline(text, `inline-${key}`)}
          </h4>
        );
      }

      key += 1;
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: React.ReactNode[] = [];

      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^[-*]\s+/, "");
        items.push(<li key={`li-${key}-${items.length}`}>{parseInline(text, `li-${key}-${items.length}`)}</li>);
        i += 1;
      }

      blocks.push(
        <ul className={styles.list} key={`block-${key}`}>
          {items}
        </ul>
      );
      key += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: React.ReactNode[] = [];

      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^\d+\.\s+/, "");
        items.push(<li key={`ol-${key}-${items.length}`}>{parseInline(text, `ol-${key}-${items.length}`)}</li>);
        i += 1;
      }

      blocks.push(
        <ol className={styles.list} key={`block-${key}`}>
          {items}
        </ol>
      );
      key += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i].trim()) &&
      !/^(#{1,6})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
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

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
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
    }

    lastIndex = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
