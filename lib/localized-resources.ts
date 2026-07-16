import type { ContentLocale } from "./locale";
import { getResourcesBySection, type ResourceSection } from "./resources";
import type { Resource } from "../content/resources";

const ENGLISH_COPY: Record<string, Pick<Resource, "title" | "description">> = {
  "/docker-runtime/index.html": {
    title: "Docker Runtime Visual Explainer",
    description: "Follow Dockerfile, Image, and Container through animated build, isolation, networking, Volume, and Compose flows."
  },
  "/leetcode-cookbook/skiplist-explained.html": {
    title: "Skip List Visual Explainer",
    description: "An interactive explanation of Skip List search, insertion, level height, and complexity."
  },
  "/leetcode-cookbook/lru-cache-explained.html": {
    title: "LRU Cache Visual Explainer",
    description: "See how a HashMap and doubly linked list provide O(1) reads and writes, with eviction and concurrency comparisons."
  },
  "/hub/skills/agent-eval": {
    title: "Agent Eval Skill",
    description: "A Codex skill for reviewing changes and running bounded reviewer/fixer loops."
  }
};

export async function getLocalizedResourcesBySection(section: ResourceSection, locale: ContentLocale): Promise<Resource[]> {
  const resources = await getResourcesBySection(section);
  if (locale === "zh") return resources;
  return resources.map((resource) => ({ ...resource, ...(ENGLISH_COPY[resource.href] ?? {}) }));
}

export function localizeResource(resource: Resource, locale: ContentLocale): Resource {
  return locale === "en" ? { ...resource, ...(ENGLISH_COPY[resource.href] ?? {}) } : resource;
}
