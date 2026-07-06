import {
  resources,
  type Resource,
  type ResourceSource,
  type ResourceType
} from "../content/resources";

export type ResourceSection = "notes" | "skills" | "demos";

export type ResourceSectionDefinition = {
  slug: ResourceSection;
  label: string;
  type: ResourceType;
  description: string;
};

export const RESOURCE_SECTIONS: ResourceSectionDefinition[] = [
  {
    slug: "notes",
    label: "Notes",
    type: "note",
    description: "Long-term notes that live in the personal site repository."
  },
  {
    slug: "skills",
    label: "Skills",
    type: "skill",
    description: "Reusable skills and workflows maintained in external repositories."
  },
  {
    slug: "demos",
    label: "Demos",
    type: "demo",
    description: "Temporary HTML demos, explainers, and visual pages."
  }
];

const SOURCE_LABELS: Record<ResourceSource, string> = {
  "vercel-site": "Vercel site",
  skills: "Skills repo",
  "github-pages": "GitHub Pages",
  external: "External"
};

const TYPE_LABELS: Record<ResourceType, string> = {
  note: "Note",
  skill: "Skill",
  demo: "Demo"
};

const allResources: readonly Resource[] = resources;

export function getPublicResources(): Resource[] {
  return sortResources(allResources.filter((resource) => resource.status !== "draft"));
}

export function getFeaturedResources(): Resource[] {
  return getPublicResources().filter(
    (resource) => resource.status === "public" && resource.featured === true
  );
}

export function getResourcesBySection(section: ResourceSection): Resource[] {
  const definition = getResourceSection(section);

  if (!definition) {
    return [];
  }

  return getPublicResources().filter((resource) => resource.type === definition.type);
}

export function getResourceSection(slug: string): ResourceSectionDefinition | undefined {
  return RESOURCE_SECTIONS.find((section) => section.slug === slug);
}

export function getResourceTypeLabel(type: ResourceType): string {
  return TYPE_LABELS[type];
}

export function getResourceSourceLabel(source: ResourceSource): string {
  return SOURCE_LABELS[source];
}

export function isExternalResourceHref(href: string): boolean {
  return /^https?:\/\//.test(href) || href.startsWith("mailto:");
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
