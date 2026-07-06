import type { ResourceSource, ResourceType } from "../content/resources";

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

export function getResourceTypeLabel(type: ResourceType): string {
  return TYPE_LABELS[type];
}

export function getResourceSourceLabel(source: ResourceSource): string {
  return SOURCE_LABELS[source];
}

export function isExternalResourceHref(href: string): boolean {
  return /^https?:\/\//.test(href) || href.startsWith("mailto:");
}
