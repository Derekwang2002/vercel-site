import type { NextConfig } from "next";

const deploymentId = [
  process.env.NEXT_DEPLOYMENT_ID,
  process.env.VERCEL_DEPLOYMENT_ID,
  process.env.VERCEL_GIT_COMMIT_SHA,
  process.env.GITHUB_SHA
].find((value) => value?.trim());

const nextConfig: NextConfig = {
  ...(deploymentId ? { deploymentId: deploymentId.trim() } : {}),
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async redirects() {
    return [
      {
        source: "/blog/prod-dive-in-agentic-architecture",
        destination: "/blog/agentic-system-overview",
        permanent: true
      },
      {
        source: "/zh/blog/prod-dive-in-agentic-architecture",
        destination: "/zh/blog/agentic-system-overview",
        permanent: true
      },
      {
        source: "/blog/call-e-agentic-tech-doc",
        destination: "/blog/agentic-system-overview",
        permanent: true
      },
      {
        source: "/zh/blog/call-e-agentic-tech-doc",
        destination: "/zh/blog/agentic-system-overview",
        permanent: true
      }
    ];
  },
  experimental: {
    devtoolSegmentExplorer: false
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.optimization = {
        ...config.optimization,
        chunkIds: "named"
      };
    }

    return config;
  }
};

export default nextConfig;
