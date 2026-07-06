export type ResourceType = "note" | "skill" | "demo";

export type ResourceStatus = "public" | "unlisted" | "draft";

export type ResourceSource = "vercel-site" | "skills" | "github-pages" | "external";

export type Resource = {
  title: string;
  description: string;
  type: ResourceType;
  href: string;
  source: ResourceSource;
  tags: string[];
  date?: string;
  status: ResourceStatus;
  featured?: boolean;
};

export const resources = [
  {
    title: "Skip List 跳表讲解",
    description: "交互式解释跳表的搜索、插入、层高和复杂度。",
    type: "demo",
    href: "https://derekwang2002.github.io/skills/skiplist-explained.html",
    source: "github-pages",
    tags: ["algorithm", "data-structure", "visualization"],
    status: "public",
    featured: true
  },
  {
    title: "Agent Eval Skill",
    description: "用于 reviewer/fixer 循环的 Codex skill。",
    type: "skill",
    href: "https://github.com/Derekwang2002/skills/tree/main/agent-eval",
    source: "skills",
    tags: ["codex", "skill", "automation"],
    status: "public"
  },
  {
    title: "MySQL 八股",
    description: "MySQL 执行流程、存储、索引和事务学习记录。",
    type: "note",
    href: "/blog/mysql-notes",
    source: "vercel-site",
    tags: ["mysql", "database"],
    date: "2026-05-01",
    status: "public"
  }
] satisfies Resource[];
