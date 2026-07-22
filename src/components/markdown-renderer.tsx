import type { ReactNode } from "react";
import { renderToString } from "katex";
import { codeToHtml } from "shiki";
import type { TocItem } from "./post-toc";
import styles from "../app/blog/[slug]/page.module.css";

export async function renderMarkdown(
  markdown: string,
  headings: TocItem[]
): Promise<ReactNode[]> {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
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

    const mathBlock = parseMathBlock(lines, i);
    if (mathBlock) {
      blocks.push(
        <div
          className={styles.mathBlock}
          dangerouslySetInnerHTML={{ __html: renderMath(mathBlock.expression, true) }}
          key={`block-${key}`}
        />
      );
      i = mathBlock.nextIndex;
      key += 1;
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

    if (isThematicBreak(line)) {
      blocks.push(<hr className={styles.thematicBreak} key={`block-${key}`} />);
      key += 1;
      i += 1;
      continue;
    }

    const tableBlock = parseTableBlock(lines, i, `block-${key}`);
    if (tableBlock) {
      blocks.push(tableBlock.node);
      i = tableBlock.nextIndex;
      key += 1;
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      const quoteLines: string[] = [];

      while (i < lines.length) {
        const quoteLine = /^>\s?(.*)$/.exec(lines[i].trim());
        if (!quoteLine) {
          break;
        }

        quoteLines.push(quoteLine[1]);
        i += 1;
      }

      blocks.push(
        <blockquote className={styles.blockquote} key={`block-${key}`}>
          {parseInline(quoteLines.join(" "), `quote-${key}`)}
        </blockquote>
      );
      key += 1;
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
      !isThematicBreak(lines[i]) &&
      !isTableStart(lines, i) &&
      !/^>\s?/.test(lines[i].trim()) &&
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

type MathBlock = {
  expression: string;
  nextIndex: number;
};

function parseMathBlock(lines: string[], startIndex: number): MathBlock | null {
  const opening = lines[startIndex].trim();
  const delimiter = opening.startsWith("$$") ? "$$" : opening.startsWith("\\[") ? "\\[" : null;

  if (!delimiter) {
    return null;
  }

  const closing = delimiter === "$$" ? "$$" : "\\]";
  const firstLine = opening.slice(delimiter.length);
  if (firstLine.endsWith(closing) && firstLine.length >= closing.length) {
    return { expression: firstLine.slice(0, -closing.length).trim(), nextIndex: startIndex + 1 };
  }

  const expressionLines = [firstLine];
  let i = startIndex + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimEnd().endsWith(closing)) {
      expressionLines.push(line.trimEnd().slice(0, -closing.length));
      return { expression: expressionLines.join("\n").trim(), nextIndex: i + 1 };
    }

    expressionLines.push(line);
    i += 1;
  }

  return null;
}

function renderMath(expression: string, displayMode: boolean): string {
  return renderToString(expression, {
    displayMode,
    output: "html",
    strict: false,
    throwOnError: false
  });
}

function isThematicBreak(line: string): boolean {
  const trimmed = line.trim();
  const leadingWhitespaceLength = line.length - line.trimStart().length;

  if (leadingWhitespaceLength > 3) {
    return false;
  }

  return (
    /^(?:\*[\t ]*){3,}$/.test(trimmed) ||
    /^(?:_[\t ]*){3,}$/.test(trimmed) ||
    /^(?:-[\t ]*){3,}$/.test(trimmed)
  );
}

type TableBlock = {
  nextIndex: number;
  node: ReactNode;
};

function parseTableBlock(
  lines: string[],
  startIndex: number,
  keyPrefix: string
): TableBlock | null {
  if (!isTableStart(lines, startIndex)) {
    return null;
  }

  const headers = parseTableRow(lines[startIndex]);
  const separators = parseTableRow(lines[startIndex + 1]);
  const alignments = separators.map((separator) => {
    const value = separator.trim();
    const left = value.startsWith(":");
    const right = value.endsWith(":");

    if (left && right) {
      return "center" as const;
    }

    if (right) {
      return "right" as const;
    }

    return "left" as const;
  });
  const rows: string[][] = [];
  let i = startIndex + 2;

  while (i < lines.length && isTableRow(lines[i])) {
    const cells = parseTableRow(lines[i]);
    if (cells.length !== headers.length) {
      break;
    }

    rows.push(cells);
    i += 1;
  }

  return {
    nextIndex: i,
    node: (
      <div className={styles.tableScroll} key={keyPrefix}>
        <table className={styles.table}>
          <thead>
            <tr>
              {headers.map((header, columnIndex) => (
                <th
                  key={`${keyPrefix}-head-${columnIndex}`}
                  style={{ textAlign: alignments[columnIndex] }}
                >
                  {parseInline(header, `${keyPrefix}-head-${columnIndex}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${keyPrefix}-row-${rowIndex}`}>
                {row.map((cell, columnIndex) => (
                  <td
                    key={`${keyPrefix}-cell-${rowIndex}-${columnIndex}`}
                    style={{ textAlign: alignments[columnIndex] }}
                  >
                    {parseInline(cell, `${keyPrefix}-cell-${rowIndex}-${columnIndex}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  };
}

function isTableStart(lines: string[], index: number): boolean {
  if (index + 1 >= lines.length || !isTableRow(lines[index])) {
    return false;
  }

  const headers = parseTableRow(lines[index]);
  const separators = parseTableRow(lines[index + 1]);

  return (
    headers.length > 0 &&
    headers.length === separators.length &&
    separators.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

type ListMarker = {
  content: string;
  indent: number;
  ordered: boolean;
};

type ListBlock = {
  nextIndex: number;
  node: ReactNode;
};

function parseListBlock(
  lines: string[],
  startIndex: number,
  baseIndent: number,
  keyPrefix: string
): ListBlock {
  const firstMarker = parseListMarker(lines[startIndex]);
  const ordered = firstMarker?.ordered ?? false;
  const items: ReactNode[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const marker = parseListMarker(lines[i]);
    if (!marker || marker.indent !== baseIndent || marker.ordered !== ordered) {
      break;
    }

    const itemKey = `${keyPrefix}-item-${items.length}`;
    const itemChildren: ReactNode[] = [
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
): Promise<ReactNode> {
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
        light: "github-dark",
        dark: "github-dark"
      },
      defaultColor: false
    });
  } catch {
    return codeToHtml(code, {
      lang: "text",
      themes: {
        light: "github-dark",
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

export function getMarkdownHeadings(markdown: string): TocItem[] {
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

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|<((?:https?:\/\/|mailto:)[^>\s]+)>|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|(?<!\\)\$((?:\\.|[^$\n])+?)(?<!\\)\$/g;
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
      const href = match[5];
      const isExternal = /^https?:\/\//i.test(href);

      nodes.push(
        <a
          className={styles.inlineLink}
          href={href}
          key={`${keyPrefix}-autolink-${match.index}`}
          rel={isExternal ? "noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          {href}
        </a>
      );
    } else if (match[6] !== undefined) {
      nodes.push(
        <code className={styles.inlineCode} key={`${keyPrefix}-code-${match.index}`}>
          {match[6]}
        </code>
      );
    } else if (match[7] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${match.index}`}>
          {parseInline(match[7], `${keyPrefix}-strong-${match.index}`)}
        </strong>
      );
    } else if (match[8] !== undefined) {
      nodes.push(
        <em key={`${keyPrefix}-em-${match.index}`}>
          {parseInline(match[8], `${keyPrefix}-em-${match.index}`)}
        </em>
      );
    } else if (match[9] !== undefined) {
      nodes.push(
        <span
          className={styles.inlineMath}
          dangerouslySetInnerHTML={{ __html: renderMath(match[9], false) }}
          key={`${keyPrefix}-math-${match.index}`}
        />
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
