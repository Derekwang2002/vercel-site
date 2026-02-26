# Tasks (MVP)

## Milestone 0 — Repo & Docs
- [ ] T0. Add PRD.md, ARCHITECTURE.md, TASKS.md
  - Acceptance: docs exist and match intended scope.

## Milestone 1 — Skeleton & Layout
- [ ] T1. Initialize site skeleton (routes): /, /blog, /tags, /404
  - Acceptance: all routes load without errors.

- [ ] T2. Global layout: header nav + footer
  - Acceptance: nav links work; responsive on mobile.

- [ ] T3. Home page UI (avatar + name + tagline + social icons)
  - Acceptance: matches minimalist layout; no overflow on mobile.

## Milestone 2 — Markdown Content Pipeline
- [ ] T4. Define Markdown frontmatter parser & schema validation (soft validation ok)
  - Acceptance: missing required fields fails build or logs warnings clearly.

- [ ] T5. Blog data loader:
  - read /content/posts
  - parse frontmatter + markdown body
  - sort by date desc
  - exclude draft
  - Acceptance: correct ordering & filtering.

- [ ] T6. Blog list page (Timeline):
  - All Posts tab
  - Selected tab (selected=true)
  - show: title link + date
  - Acceptance: tabs filter correctly.

- [ ] T7. Post detail page:
  - render markdown
  - show title/date/tags
  - back link
  - Acceptance: markdown renders; tags clickable.

## Milestone 3 — Tags (Knowledge Navigation)
- [ ] T8. Tag index page:
  - list all tags + counts
  - sort tags (alpha or by count)
  - Acceptance: counts correct, links work.

- [ ] T9. Tag page:
  - timeline filtered by tag
  - Acceptance: correct filter; draft excluded.

## Milestone 4 — SEO & Feeds
- [ ] T10. SEO meta:
  - per page title/description
  - OG tags
  - Acceptance: OG preview fields present.

- [ ] T11. RSS feed generation:
  - exclude drafts
  - include title/link/date/summary
  - Acceptance: rss.xml exists and validates.

- [ ] T12. Sitemap generation:
  - include /, /blog, /tags, posts, tag pages
  - exclude drafts
  - Acceptance: sitemap.xml exists.

## Milestone 5 — Polish & Release
- [ ] T13. 404 & empty states:
  - no posts
  - tag with no posts
  - Acceptance: user-friendly messaging.

- [ ] T14. Performance basics:
  - image optimization guidance
  - avoid blocking assets
  - Acceptance: Lighthouse baseline recorded.

- [ ] T15. Deployment pipeline:
  - CI build/lint/typecheck on PR
  - deploy to chosen platform
  - Acceptance: each push deploys successfully.

## Post-MVP (Optional)
- [ ] P1. Full-text search
- [ ] P2. Dark mode
- [ ] P3. Projects page
- [ ] P4. Multi-language