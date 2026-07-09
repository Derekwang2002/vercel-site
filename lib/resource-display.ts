import type { ResourceType } from "../content/resources";

const TYPE_LABELS: Record<ResourceType, string> = {
  skill: "Skill",
  demo: "Demo"
};

export function getResourceTypeLabel(type: ResourceType): string {
  return TYPE_LABELS[type];
}

export function isExternalResourceHref(href: string): boolean {
  return /^https?:\/\//.test(href) || href.startsWith("mailto:");
}
