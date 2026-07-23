import type {
  MarkdownCollectionSource,
  MarkdownSource
} from "../lib/markdown-sources";

export type ResourceType = "skill" | "demo";

export type ResourceStatus = "public" | "unlisted" | "draft";

export type Resource = {
  title: string;
  description: string;
  type: ResourceType;
  href: string;
  docSource?: MarkdownSource;
  tags: string[];
  date?: string;
  status: ResourceStatus;
  featured?: boolean;
};

export type ResourceCollectionOverride = Partial<
  Pick<Resource, "title" | "description" | "tags" | "date" | "status" | "featured">
>;

export type ResourceCollection = {
  type: ResourceType;
  hrefPrefix: string;
  source: MarkdownCollectionSource;
  tags: string[];
  status: ResourceStatus;
  date?: string;
  featured?: boolean;
  overrides?: Record<string, ResourceCollectionOverride>;
};

export const resources = [
  // Snapshot source:
  // https://gist.githubusercontent.com/Derekwang2002/8ea85042f886b464aa3562eb493c3c16/raw/8d2e2bcbcb237586bc1fea065aa277c574685d47/session.html
  {
    title: "dev -> test -> uat -> prod",
    description: "以共享会话形式讲解 Dev、Test、UAT 与 Prod 环境及其发布流程。",
    type: "demo",
    href: "/dev-test-uat-prod/index.html",
    tags: ["devops", "environment", "deployment"],
    date: "2026-07-23",
    status: "public"
  },
  {
    title: "Docker 运行原理动态讲解",
    description: "从 Dockerfile、Image 到 Container，配合构建、隔离、网络、Volume 与 Compose 动画，从头理解 Docker。",
    type: "demo",
    href: "/docker-runtime/index.html",
    tags: ["docker", "container", "devops", "visualization"],
    date: "2026-07-09",
    status: "public",
    featured: true
  },
  {
    title: "Skip List 跳表讲解",
    description: "交互式解释跳表的搜索、插入、层高和复杂度。",
    type: "demo",
    href: "/leetcode-cookbook/skiplist-explained.html",
    tags: ["algorithm", "data-structure", "visualization"],
    status: "public",
    featured: true
  },
  {
    title: "LRU Cache 缓存讲解",
    description: "交互式讲解 HashMap 与双向链表如何实现 O(1) 读写，并比较淘汰策略和并发方案。",
    type: "demo",
    href: "/leetcode-cookbook/lru-cache-explained.html",
    tags: ["algorithm", "data-structure", "cache", "visualization"],
    status: "public",
    featured: true
  }
] satisfies Resource[];

export const resourceCollections = [
  {
    type: "skill",
    hrefPrefix: "/hub/skills",
    source: {
      type: "githubFolder",
      repository: "Derekwang2002/skills",
      branch: "main",
      path: "docs"
    },
    tags: ["codex", "skill"],
    date: "2026-07-08",
    status: "public",
    overrides: {
      "agent-eval": {
        title: "Agent Eval Skill",
        description: "用于 reviewer/fixer 循环的 Codex skill。",
        tags: ["codex", "skill", "automation"]
      }
    }
  }
] satisfies ResourceCollection[];
