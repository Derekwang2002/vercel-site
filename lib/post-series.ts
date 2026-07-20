import { promises as fs } from "node:fs";
import path from "node:path";

export type PostSeriesLocale = "zh" | "en";

export type PostSeriesDefinition = {
  directoryName: string;
  parentPostSlug: string;
  slug: string;
};

export type PostSeriesDocument = {
  content: string;
  fileName: string;
  order: number;
  seriesSlug: string;
  slug: string;
  summary: string;
  title: string;
};

export type PostSeriesNavigation = {
  label: string;
  items: Array<{
    current: boolean;
    href: string;
    label: string;
    order: number;
  }>;
};

const SERIES_DEFINITIONS: PostSeriesDefinition[] = [
  {
    directoryName: "calle-agentic-goal",
    parentPostSlug: "calle-agentic-goal",
    slug: "calle-agentic-goal"
  }
];

const SERIES_FILE_PATTERN = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

type ParsedFileName = ReturnType<typeof parsePostSeriesFileName>;

type ParsedMarkdown = {
  content: string;
  summary: string;
  title: string;
};

export function parsePostSeriesFileName(fileName: string) {
  const match = SERIES_FILE_PATTERN.exec(fileName);
  if (!match) {
    throw new Error(`Invalid post-series filename "${fileName}". Expected NN-lowercase-kebab-slug.md.`);
  }
  return { fileName, order: Number.parseInt(match[1], 10), slug: match[2] };
}

export function getPostSeriesDefinition(seriesSlug: string): PostSeriesDefinition | null {
  return SERIES_DEFINITIONS.find((definition) => definition.slug === seriesSlug) ?? null;
}

export function getPostSeriesDefinitionByParentPostSlug(
  parentPostSlug: string
): PostSeriesDefinition | null {
  return (
    SERIES_DEFINITIONS.find(
      (definition) => definition.parentPostSlug === parentPostSlug
    ) ?? null
  );
}

export function toPostSeriesNavigation(input: {
  currentSlug: string | null;
  documents: PostSeriesDocument[];
  label: string;
  locale: PostSeriesLocale;
  parentHref: string;
  parentTitle: string;
  seriesSlug: string;
}): PostSeriesNavigation {
  const documentItems = [...input.documents]
    .sort((a, b) => a.order - b.order)
    .map((document) => ({
      current: input.currentSlug === document.slug,
      href: `/${input.locale === "zh" ? "zh/" : ""}blog/${input.seriesSlug}/${document.slug}`,
      label: document.title,
      order: document.order
    }));

  if (
    input.currentSlug !== null &&
    documentItems.filter((item) => item.current).length !== 1
  ) {
    throw new Error(`Exactly one document must match current slug "${input.currentSlug}".`);
  }

  return {
    label: input.label,
    items: [
      {
        current: input.currentSlug === null,
        href: input.parentHref,
        label: input.parentTitle,
        order: 0
      },
      ...documentItems
    ]
  };
}

export async function loadPostSeriesDocumentsFromRoots(input: {
  canonicalDirectory: string;
  localizedDirectory: string;
  locale: PostSeriesLocale;
  seriesSlug: string;
}): Promise<PostSeriesDocument[]> {
  const canonicalFileNames = await listMarkdownFileNames(input.canonicalDirectory);
  const canonicalFiles = validateCanonicalFileNames(canonicalFileNames);
  const canonicalDocuments = await Promise.all(
    canonicalFiles.map(async (file) => ({
      ...file,
      ...(await readPostSeriesMarkdown(input.canonicalDirectory, file.fileName)),
      seriesSlug: input.seriesSlug
    }))
  );

  if (input.locale === "zh") {
    return canonicalDocuments;
  }

  const localizedFileNames = await listMarkdownFileNames(input.localizedDirectory);
  assertEnglishMirrorParity(canonicalFileNames, localizedFileNames);

  return Promise.all(
    canonicalDocuments.map(async (canonicalDocument) => ({
      ...canonicalDocument,
      ...(await readPostSeriesMarkdown(input.localizedDirectory, canonicalDocument.fileName))
    }))
  );
}

export async function getPostSeriesDocuments(
  seriesSlug: string,
  locale: PostSeriesLocale
): Promise<PostSeriesDocument[]> {
  const definition = getPostSeriesDefinition(seriesSlug);
  if (!definition) {
    return [];
  }

  return loadPostSeriesDocumentsFromRoots({
    canonicalDirectory: path.join(
      process.cwd(),
      "content",
      "post-series",
      definition.directoryName
    ),
    localizedDirectory: path.join(
      process.cwd(),
      "content",
      "translations",
      "en",
      "post-series",
      definition.directoryName
    ),
    locale,
    seriesSlug
  });
}

export async function getPostSeriesDocument(
  seriesSlug: string,
  docSlug: string,
  locale: PostSeriesLocale
): Promise<PostSeriesDocument | null> {
  const documents = await getPostSeriesDocuments(seriesSlug, locale);
  return documents.find((document) => document.slug === docSlug) ?? null;
}

export async function getAllPostSeriesDocuments(
  locale: PostSeriesLocale
): Promise<PostSeriesDocument[]> {
  const documentGroups = await Promise.all(
    SERIES_DEFINITIONS.map((definition) => getPostSeriesDocuments(definition.slug, locale))
  );
  return documentGroups.flat();
}

async function listMarkdownFileNames(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));
}

function validateCanonicalFileNames(fileNames: string[]): ParsedFileName[] {
  const files = fileNames.map(parsePostSeriesFileName).sort((a, b) => a.order - b.order);
  const orders = new Set<number>();
  const slugs = new Set<string>();

  for (const file of files) {
    if (orders.has(file.order)) {
      throw new Error(`Duplicate order ${file.order} in post series.`);
    }
    if (slugs.has(file.slug)) {
      throw new Error(`Duplicate slug "${file.slug}" in post series.`);
    }

    orders.add(file.order);
    slugs.add(file.slug);
  }

  files.forEach((file, index) => {
    const expectedOrder = index + 1;
    if (file.order !== expectedOrder) {
      throw new Error(
        `Post-series documents must be contiguous: expected order ${expectedOrder}, found ${file.order} in "${file.fileName}".`
      );
    }
  });

  return files;
}

function assertEnglishMirrorParity(
  canonicalFileNames: string[],
  localizedFileNames: string[]
): void {
  const localizedSet = new Set(localizedFileNames);
  const missingFileName = canonicalFileNames.find((fileName) => !localizedSet.has(fileName));
  if (missingFileName) {
    throw new Error(`Missing en translation for "${missingFileName}".`);
  }

  const canonicalSet = new Set(canonicalFileNames);
  const orphanFileName = localizedFileNames.find((fileName) => !canonicalSet.has(fileName));
  if (orphanFileName) {
    throw new Error(`Orphan en translation "${orphanFileName}".`);
  }
}

async function readPostSeriesMarkdown(
  directory: string,
  fileName: string
): Promise<ParsedMarkdown> {
  const source = await fs.readFile(path.join(directory, fileName), "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(source);
  if (!match) {
    throw new Error(`${fileName}: expected YAML frontmatter.`);
  }

  const title = readRequiredFrontmatterValue(match[1], "title", fileName);
  const summary = readRequiredFrontmatterValue(match[1], "summary", fileName);
  const content = match[2].trim();
  if (!content) {
    throw new Error(`${fileName}: body is empty.`);
  }

  return { content, summary, title };
}

function readRequiredFrontmatterValue(
  frontmatter: string,
  key: "title" | "summary",
  fileName: string
): string {
  const line = frontmatter
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${key}:`));
  const rawValue = line?.slice(key.length + 1).trim() ?? "";
  const value = unquote(rawValue).trim();

  if (!value) {
    throw new Error(`${fileName}: ${key} is empty.`);
  }

  return value;
}

function unquote(value: string): string {
  const firstCharacter = value[0];
  const lastCharacter = value[value.length - 1];
  if (
    value.length >= 2 &&
    ((firstCharacter === '"' && lastCharacter === '"') ||
      (firstCharacter === "'" && lastCharacter === "'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
