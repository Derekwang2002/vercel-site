# Architecture & Constraints

## 1. Project Type
- Hybrid Next.js site: SSG preferred for public content, dynamic server rendering for the private Share Board.
- Markdown-first content system.
- A narrow backend exists only for Owner authentication, private uploaded documents, and Share resolution.

## 2. Source of Truth
All blog content lives in the repo under `/content/posts`.
The site builds from these Markdown files.

## 3. Content Structure
Directory:
- /content/posts
- /public (images, icons, avatar)
- /src (app/pages/components/styles)

Post file naming:
- YYYY-MM-DD-slug.md
Example:
- 2025-04-06-cloning-github.md

Frontmatter schema (required):
- title: string
- date: YYYY-MM-DD
- summary: string
- tags: string[]
Optional:
- selected: boolean
- draft: boolean (default false)
- cover: string

Rules:
- draft=true must exclude the post from all lists, tags, RSS, sitemap.
- selected=true appears under the "Selected" tab.

## 4. Routing & URL Rules
- Blog list: /blog
- Post detail: /blog/[slug]
  - slug derived from filename after date prefix
- Tags index: /tags
- Tag page: /tags/[tag]
  - tag URL must be URL-safe (lowercase + hyphenate)
  - display name can preserve original case if desired

## 5. Design System (Minimal)
Typography:
- Large H1 on hero pages (Home/Blog).
- High line-height for reading.
- Mostly monochrome.

Layout:
- Centered content column with generous whitespace.
- Blog list: title link + date (no card UI).

No:
- Heavy animations
- Complex theme frameworks
- Excessive visual components

## 6. Dependency Policy
- Do not introduce new dependencies unless:
  1) it is necessary for Markdown rendering/SSG/SEO
  2) it is justified in a short note
  3) it is approved before installation
- The Share Board uses `@neondatabase/serverless` as its only database client so Vercel server functions can issue parameterized Postgres queries over Neon's serverless transport without an ORM.

## 7. Build & Quality Gates
Every change must pass:
- lint
- typecheck
- build

If tests exist:
- run relevant unit/e2e tests for changed areas.

## 8. Accessibility & SEO Baseline
- Semantic headings
- Alt text for images
- Keyboard navigation for links
- Meta title/description for every page
- OG tags for share previews

## 9. Deployment (Vercel)
- Deployment platform: Vercel only.
- Main branch deploys to Production automatically.
- Every Pull Request must generate a Preview Deployment.
- No manual server setup; site must remain statically generatable.
- Custom domain (optional): configure via Vercel dashboard; DNS managed externally if needed.
- Share Board persistence uses Neon Postgres and requires `DATABASE_URL`.
- Owner access requires `BOARD_ADMIN_PASSWORD` and `BOARD_SESSION_SECRET`.

## 10. Framework (Next.js)
- Framework: Next.js (App Router).
- Rendering: Static generation first (SSG) for posts/tags; dynamic rendering for `/board` and `/share`.
- Content: Markdown files under /content/posts.
- Public publishing has no database or auth. The Share Board has one Owner session and a Neon-backed document/share store.
- Deployment: Vercel only.

## 11. Project Conventions
- TypeScript required.
- ESLint enabled.
- Prefer minimal dependencies; new deps require justification + approval.
