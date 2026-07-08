import {
  resources,
  type Resource,
  type ResourceType
} from "../content/resources";
export {
  getResourceSourceLabel,
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
    description: "Reusable skills and workflows maintained in external repositories."
  },
  {
    slug: "demos",
    label: "Demos",
    type: "demo",
    description: "Temporary HTML demos, explainers, and visual pages."
  }
];

const allResources: readonly Resource[] = resources;

export function getPublicResources(): Resource[] {
  return sortResources(allResources.filter((resource) => resource.status === "public"));
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

  if (definition.slug === "all") {
    return getPublicResources();
  }

  if (!definition.type) {
    return [];
  }

  return getPublicResources().filter((resource) => resource.type === definition.type);
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
