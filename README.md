# Derek Hub

This repository contains Derek Hub, a Next.js App Router site for writing, resource curation, skill documentation, and interactive demos.

## Current Capabilities

- Home page with profile links and pinned resources.
- Blog index, post detail pages, tag index, and tag detail pages.
- Hub sections for all resources, skills, and demos.
- Skill articles rendered as internal hub pages instead of direct repository links.
- Static HTML demos served from `public/leetcode-cookbook/`.
- RSS feed at `/rss.xml`.
- Static sitemap at `/sitemap.xml` with blog posts and internal hub resources.
- Markdown rendering with headings, table of contents, code highlighting, links, lists, tables, and blockquotes.
- Shared Markdown source layer for local files, GitHub files, and GitHub folders.
- Duplicate slug/source validation so one article is resolved from exactly one source.
- Private Share Board for uploading Markdown/HTML and issuing revocable, single-document links.

## Content Model

### Blog

Blog posts can come from three source types:

- Local Markdown files in `content/posts/`.
- Explicit remote Markdown files configured in `content/blog.ts`.
- Remote Markdown folders configured in `content/blog.ts`.

Local blog filenames must use:

```text
YYYY-MM-DD-slug.md
```

Each blog post requires frontmatter:

```md
---
title: "Post title"
date: "2026-05-01"
summary: "Short summary."
tags:
  - tag
draft: false
selected: true
---
```

Remote blog folders are expanded into individual Markdown file sources. The generated slug comes from the filename, or from the `YYYY-MM-DD-slug.md` filename pattern when present.

### Hub

Hub resources are configured in `content/resources.ts`.

- `resources` stores direct resources, such as static demos.
- `resourceCollections` stores folder-backed Markdown article collections.

The current skills hub is backed by:

```ts
{
  type: "githubFolder",
  repository: "Derekwang2002/skills",
  branch: "main",
  path: "docs"
}
```

Each Markdown file in that folder becomes one internal article page:

```text
docs/agent-eval.md -> /hub/skills/agent-eval
```

`README.md` files are ignored when expanding GitHub folders. Article pages can still include repository links inside the Markdown body.

Collection overrides can customize generated metadata:

- `title`
- `description`
- `tags`
- `date`
- `status`
- `featured`

## Markdown Sources

The shared source layer lives in `lib/markdown-sources.ts`.

Supported source types:

- `local` - read a Markdown file from this repository.
- `github` - fetch one Markdown file from GitHub raw content.
- `githubFolder` - list a GitHub folder through the GitHub Contents API and expand direct `.md` files into file sources.

The article loader validates duplicates by both public slug/href and source id. This keeps local, single-file remote, and folder remote sources available at the same time without overlapping ownership of the same article.

## Routes

- `/` - Home page.
- `/blog` - Blog index.
- `/blog/[slug]` - Blog post page.
- `/tags` - Tag index.
- `/tags/[tag]` - Tag detail page.
- `/hub` - Hub redirect/entry.
- `/hub/all` - All public hub resources.
- `/hub/skills` - Skill articles.
- `/hub/demos` - Static demos.
- `/hub/skills/[slug]` - Skill article page.
- `/board/login` - Owner-only Share Board login.
- `/board` - Owner-only document manager.
- `/board/[documentId]` - Private preview and share management.
- `/private` - Password-protected catalogue of every Board document.
- `/private/[documentId]` - Password-protected, near-fullscreen document reader.
- `/private/[documentId]/download` - Authenticated download for a Private Repo document.
- `/share/[token]` - Distraction-free, near-fullscreen access to exactly one shared document.
- `/share/[token]/download` - Download that same document after revalidating the Share Token.
- `/rss.xml` - RSS feed.
- `/sitemap.xml` - Sitemap.
- `/404` and `not-found` - Error pages.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Shiki for code highlighting
- Neon Postgres for private Share Board documents and share grants
- ESLint and TypeScript checks

## Share Board Setup

The public blog remains statically generated. Share Board and Private Repo routes are dynamic and require four server-only environment variables:

```text
DATABASE_URL=postgresql://...
BOARD_ADMIN_PASSWORD=use-a-long-unique-password
BOARD_SESSION_SECRET=use-at-least-32-random-bytes
PRIVATE_REPO_PASSWORD=use-a-different-long-password
```

Run [`db/migrations/001_share_board.sql`](db/migrations/001_share_board.sql) once against the Neon database before opening `/board`. Documents are limited to non-empty `.md` and `.html` files of 1 MB or less. HTML is rendered in a near-fullscreen iframe sandbox without same-origin privileges. Private Repo and Share pages omit the public site navigation and footer. The Private Repo lists every Board document for authenticated readers, while each Share exposes only its token-bound file.

## Requirements

- Node.js `>=20 <24`
- npm 10+

## Run Locally

```bash
npm install
npm run dev:host
```

Open `http://localhost:3000`.

For production preview:

```bash
npm run build
npm run start -- -p 3000
```

## Available Scripts

- `npm run dev` - start local dev server with the repository's custom dev command.
- `npm run dev:host` - start a standard Next.js dev server.
- `npm run lint` - run ESLint checks.
- `npm run test:board` - test Share Board authentication, permissions, uploads, sandboxing, and navigation.
- `npm run test:series` - test localized post-series loading and navigation boundaries.
- `npm run typecheck` - run TypeScript checks with `tsc --noEmit`.
- `npm run build` - create a production build.
- `npm run start` - run the production server after a build.

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`.

Checks:

- `npm ci`
- `npm run lint`
- `npm run test:board`
- `npm run test:series`
- `npm run typecheck`
- `npm run build`

CI uses Node.js 22.

## Deployment

The project is designed for Vercel with the standard Next.js setup.

Recommended Vercel settings:

- Install command: `npm ci`
- Build command: `npm run build`
- Node.js runtime: `22.x`

Environment variable:

- `NEXT_PUBLIC_SITE_URL` - canonical site URL used by metadata and sitemap.
- `DATABASE_URL` - Neon Postgres connection string for the Share Board.
- `BOARD_ADMIN_PASSWORD` - password for the single Board Owner.
- `BOARD_SESSION_SECRET` - random secret used to sign the Owner session cookie.
- `PRIVATE_REPO_PASSWORD` - separate read-only password for the Private Repo; never reuse the Board administrator password.

If `NEXT_PUBLIC_SITE_URL` is unset, sitemap generation falls back to `http://localhost:3000`.

## Directory Structure

```text
.
|- archive/
|  |- logs/
|  `- notes/
|- content/
|  |- blog.ts
|  |- posts/
|  `- resources.ts
|- data/
|  `- nextjs/
|- docs/
|  |- ARCHITECTURE.md
|  |- PERFORMANCE_BASELINE.md
|  |- PRD.md
|  `- TASKS.md
|- lib/
|  |- markdown-sources.ts
|  |- posts.ts
|  |- resource-display.ts
|  |- resources.ts
|  `- skill-docs.ts
|- public/
|  |- leetcode-cookbook/
|  |- avatar.png
|  `- og-default.svg
|- src/
|  |- app/
|  `- components/
|- .github/
|- next.config.ts
|- package-lock.json
|- package.json
`- tsconfig.json
```

## Notes

- Historical logs and one-off notes live under `archive/`.
- GitHub/Next.js data snapshots live under `data/nextjs/`.
- Planning docs live under `docs/`.
