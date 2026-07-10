import path from "node:path";
import {
  resourceCollections,
  resources,
  type Resource,
  type ResourceCollection,
  type ResourceType
} from "../content/resources";
import {
  getMarkdownCollectionSourceId,
  getMarkdownSourceId,
  listMarkdownSourcesFromCollection,
  readMarkdownSource,
  type MarkdownSource
} from "./markdown-sources";
export {
  getResourceTypeLabel,
  isExternalResourceHref
} from "./resource-display";

export type ResourceSection = "all" | "skills" | "demos";

export type ResourceSectionDefinition = {
  slug: ResourceSection;
  label: string;
  type?: ResourceType;
  description: string;
};

export const RESOURCE_SECTIONS: ResourceSectionDefinition[] = [
  {
    slug: "all",
    label: "All",
    description: "All public resources in the hub."
  },
  {
    slug: "skills",
    label: "Skills",
    type: "skill",
    description: "Reader-facing skill docs with repository links inside each article."
  },
  {
    slug: "demos",
    label: "Demos",
    type: "demo",
    description: "Temporary HTML demos, explainers, and visual pages."
  }
];

const RESOURCE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let allResourcesPromise: Promise<Resource[]> | undefined;

export async function getPublicResources(): Promise<Resource[]> {
  const allResources = await getAllResources();
  return sortResources(allResources.filter((resource) => resource.status === "public"));
}

export async function getFeaturedResources(): Promise<Resource[]> {
  const publicResources = await getPublicResources();
  return publicResources.filter(
    (resource) => resource.status === "public" && resource.featured === true
  );
}

export async function getResourcesBySection(section: ResourceSection): Promise<Resource[]> {
  const definition = getResourceSection(section);

  if (!definition) {
    return [];
  }

  if (definition.slug === "all") {
    return getPublicResources();
  }

  if (!definition.type) {
    return [];
  }

  const publicResources = await getPublicResources();
  return publicResources.filter((resource) => resource.type === definition.type);
}

export async function getPublicResourceByHref(
  href: string
): Promise<Resource | undefined> {
  const publicResources = await getPublicResources();
  return publicResources.find((resource) => resource.href === href);
}

export async function getPublicSkillDocResources(): Promise<Resource[]> {
  const publicResources = await getPublicResources();
  return publicResources.filter(
    (resource) => resource.type === "skill" && resource.docSource !== undefined
  );
}

export function getResourceSection(slug: string): ResourceSectionDefinition | undefined {
  return RESOURCE_SECTIONS.find((section) => section.slug === slug);
}

function sortResources(items: readonly Resource[]): Resource[] {
  return [...items].sort((a, b) => {
    const aDate = a.date ?? "";
    const bDate = b.date ?? "";

    if (aDate && bDate && aDate !== bDate) {
      return bDate.localeCompare(aDate);
    }

    if (aDate !== bDate) {
      return aDate ? -1 : 1;
    }

    return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
  });
}

async function getAllResources(): Promise<Resource[]> {
  allResourcesPromise ??= loadAllResources();
  return allResourcesPromise;
}

async function loadAllResources(): Promise<Resource[]> {
  const collectionResults = await Promise.allSettled(
    resourceCollections.map(expandResourceCollection)
  );
  const collectionResources = collectionResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    const collection = resourceCollections[index];
    const collectionId = getMarkdownCollectionSourceId(collection.source);
    const reason =
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
    console.warn(
      "[resources] Skipping unavailable collection \"" +
        collectionId +
        "\": " +
        reason
    );
    return [];
  });
  const allResources = [...resources, ...collectionResources];

  assertUniqueResources(allResources);

  return allResources;
}

async function expandResourceCollection(
  collection: ResourceCollection
): Promise<Resource[]> {
  const collectionId = getMarkdownCollectionSourceId(collection.source);
  const sources = await listMarkdownSourcesFromCollection(
    collection.source,
    `content/resources.ts:${collectionId}`
  );

  return Promise.all(
    sources.map((source) => createResourceFromCollectionSource(collection, source))
  );
}

async function createResourceFromCollectionSource(
  collection: ResourceCollection,
  source: MarkdownSource
): Promise<Resource> {
  const slug = getResourceSlugFromMarkdownPath(source.path);
  const href = joinHref(collection.hrefPrefix, slug);
  const markdown = await readMarkdownSource(source, href);
  const metadata = extractMarkdownResourceMetadata(markdown.content, slug);
  const override = collection.overrides?.[slug];
  const title = override?.title ?? metadata.title;
  const description = override?.description ?? metadata.description;
  const tags = override?.tags ?? collection.tags;
  const status = override?.status ?? collection.status;
  const date = override?.date ?? collection.date;
  const featured = override?.featured ?? collection.featured;

  const resource: Resource = {
    title,
    description,
    type: collection.type,
    href,
    docSource: source,
    tags,
    status
  };

  if (date) {
    resource.date = date;
  }

  if (featured !== undefined) {
    resource.featured = featured;
  }

  return resource;
}

function assertUniqueResources(items: readonly Resource[]): void {
  const seenHrefs = new Map<string, Resource>();
  const seenSources = new Map<string, Resource>();

  for (const item of items) {
    const existingHref = seenHrefs.get(item.href);
    if (existingHref) {
      throw new Error(
        `Duplicate resource href "${item.href}" in "${existingHref.title}" and "${item.title}". Each hub article must use exactly one Markdown source.`
      );
    }

    seenHrefs.set(item.href, item);

    if (!item.docSource) {
      continue;
    }

    const sourceId = getMarkdownSourceId(item.docSource);
    const existingSource = seenSources.get(sourceId);
    if (existingSource) {
      throw new Error(
        `Duplicate resource source "${sourceId}" in "${existingSource.href}" and "${item.href}". Each hub article must use exactly one Markdown source.`
      );
    }

    seenSources.set(sourceId, item);
  }
}

function getResourceSlugFromMarkdownPath(markdownPath: string): string {
  const fileName = path.posix.basename(markdownPath);
  const slug = fileName.replace(/\.md$/i, "").trim();

  if (!RESOURCE_SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Invalid resource source "${markdownPath}". Markdown filename must resolve to a lowercase kebab-case slug.`
    );
  }

  return slug;
}

function joinHref(prefix: string, slug: string): string {
  const normalizedPrefix = `/${prefix.replace(/^\/+|\/+$/g, "")}`;
  return `${normalizedPrefix}/${slug}`;
}

function extractMarkdownResourceMetadata(
  content: string,
  slug: string
): Pick<Resource, "title" | "description"> {
  const markdown = stripYamlFrontmatter(content);
  const titleMatch = /^#\s+(.+)$/m.exec(markdown);
  const title = titleMatch
    ? cleanMarkdownInline(titleMatch[1])
    : titleizeSlug(slug);
  const description =
    findFirstMarkdownParagraph(markdown) ?? `Markdown article for ${title}.`;

  return {
    title,
    description: truncateDescription(description)
  };
}

function stripYamlFrontmatter(content: string): string {
  return content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "");
}

function findFirstMarkdownParagraph(content: string): string | null {
  const lines = content.split(/\r?\n/);
  const paragraph: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    if (!trimmed) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    if (isMarkdownBlockSyntax(trimmed)) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    paragraph.push(trimmed);
  }

  if (paragraph.length === 0) {
    return null;
  }

  return cleanMarkdownInline(paragraph.join(" "));
}

function isMarkdownBlockSyntax(line: string): boolean {
  return (
    line.startsWith("#") ||
    line.startsWith(">") ||
    line.startsWith("|") ||
    /^[-*+]\s/.test(line) ||
    /^\d+\.\s/.test(line)
  );
}

function cleanMarkdownInline(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateDescription(value: string): string {
  if (value.length <= 180) {
    return value;
  }

  return `${value.slice(0, 177).trimEnd()}...`;
}

function titleizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
