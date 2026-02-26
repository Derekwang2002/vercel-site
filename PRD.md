# Personal Website PRD (MVP)

## 1. Goal
Build a minimalist personal website that:
- Presents basic identity and links (home).
- Publishes all writing as a chronological timeline (blog).
- Uses tags to support lightweight knowledge navigation (tag-driven).
- Is easy to maintain (Markdown-first), fast, and SEO-friendly.

## 2. Target Users
- Recruiters / collaborators: quickly understand who I am and what I do.
- Readers: browse my writing timeline and find content via tags.
- Myself: a long-term archive for writing and notes.

## 3. Core Principles
- Minimal design, high readability.
- Timeline-first browsing; tags for secondary navigation.
- Markdown as the single source of truth.
- No backend required.

## 4. Site Map
- `/` Home
- `/blog` Blog (Timeline)
- `/blog/[slug]` Post detail
- `/tags` Tag index
- `/tags/[tag]` Tag timeline
- `/rss.xml` RSS feed
- `/sitemap.xml` Sitemap
- `/404` Not found

## 5. MVP Features
### 5.1 Home
- Avatar/photo
- Name
- One-line tagline (e.g., "professor / entrepreneur / artisan")
- Social links (GitHub, LinkedIn, etc.)

Acceptance:
- Looks good on mobile & desktop.
- All external links open correctly.

### 5.2 Blog Timeline
- List posts sorted by date desc (newest first).
- Each item shows: title + date (optionally summary later).
- Tabs: "All Posts" and "Selected" (optional selection flag).
- Draft posts hidden.

Acceptance:
- Correct ordering by date.
- Clicking a title opens the post detail page.
- Draft posts do not appear anywhere.

### 5.3 Post Detail
- Render Markdown with:
  - headings
  - lists
  - code blocks
  - images
- Show title + date + tags.
- Provide "Back to Blog".

Acceptance:
- Markdown renders correctly.
- Code blocks are readable.
- Tags are clickable and lead to tag page.

### 5.4 Tags (Knowledge Navigation)
- Tag index page lists all tags with counts.
- Tag page shows timeline list filtered by tag.
- Tag pages are also chronological.

Acceptance:
- Tag counts correct.
- Tag filter correct.
- Tag page URLs stable and shareable.

### 5.5 SEO & Feeds
- Per-page meta: title, description, OG tags.
- Generate RSS feed.
- Generate sitemap.

Acceptance:
- RSS reachable and valid.
- sitemap reachable.
- OG previews work.

## 6. Content Model (Markdown Frontmatter)
Each post must include:
- title: string
- date: YYYY-MM-DD
- summary: string (short)
- tags: string[]
- selected: boolean (optional)
- draft: boolean (optional, default false)
- cover: string (optional path/url)

## 7. Non-Goals (Out of Scope for MVP)
- Comments system
- Login/auth
- Database/CMS backend
- Full-text search (can be future)
- Multi-language (future)
- Analytics dashboard (future)

## 8. Quality Bar (Definition of Done)
- Mobile responsive
- Fast load (Lighthouse performance baseline)
- Lint/typecheck/build pass
- No new dependencies without explicit approval