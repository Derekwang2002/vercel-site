export type ResourceType = "skill" | "demo";

export type ResourceStatus = "public" | "unlisted" | "draft";

export type Resource = {
  title: string;
  description: string;
  type: ResourceType;
  href: string;
  tags: string[];
  date?: string;
  status: ResourceStatus;
  featured?: boolean;
};

export const resources = [
  {
    title: "数据结构可视化讲解",
    description: "Skip List 与 LRU Cache 的交互式讲解入口，包含动态演示、实现代码和工程取舍。",
    type: "demo",
    href: "/leetcode-cookbook/",
    tags: ["algorithm", "data-structure", "visualization", "leetcode"],
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
    title: "Agent Eval Skill",
    description: "用于 reviewer/fixer 循环的 Codex skill。",
    type: "skill",
    href: "https://github.com/Derekwang2002/skills/tree/main/agent-eval",
    tags: ["codex", "skill", "automation"],
    status: "public"
  }
] satisfies Resource[];
