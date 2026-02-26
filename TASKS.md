# Next.js (App Router) + Vercel Blog Plan

**Architecture: Minimal Timeline + Tag-driven Knowledge Base**

---

## Global Rules

* Framework: **Next.js (App Router)**
* Deployment: **Vercel only**
* Content: Markdown files under `/content/posts`
* No database
* No authentication
* No comments (MVP)
* TypeScript required
* Do NOT add new dependencies without approval
* Every task must pass:

  * `lint`
  * `typecheck`
  * `build`
* `draft=true` posts must be excluded from:

  * Blog
  * Tags
  * RSS
  * Sitemap

---

# Milestone 1 — Project Skeleton

---

## T1 — Initialize Next.js (App Router)

### Goal

Create minimal working Next.js project with routes:

* `/`
* `/blog`
* `/tags`
* `/404`

### Allowed Changes

* Root project initialization
* `/app`
* `/app/page.tsx`
* `/app/blog/page.tsx`
* `/app/tags/page.tsx`
* `/app/not-found.tsx`

### Acceptance Criteria

* All routes accessible
* No runtime errors
* `build` succeeds
* `lint` passes
* `typecheck` passes

### Forbidden

* No Markdown logic yet
* No UI framework additions
* No extra dependencies

---

# Milestone 2 — Global Layout & Home

---

## T2 — Global Layout

### Goal

Create minimal layout:

* Header (Home / Blog / Tags)
* Footer
* Centered reading container
* Responsive design

### Allowed Changes

* `/app/layout.tsx`
* `/components/*`
* `/styles/*`

### Acceptance Criteria

* Navigation works on mobile
* Content width limited for readability
* Clean, minimal styling

### Forbidden

* No animation libraries
* No heavy design systems

---

## T3 — Home Page

### Goal

Minimal homepage with:

* Avatar
* Name
* Tagline
* Social links

### Allowed Changes

* `/app/page.tsx`
* `/public/*`

### Acceptance Criteria

* Layout centered
* Works on mobile
* Social links functional

---

# Milestone 3 — Markdown Data Layer

---

## T4 — Markdown Loader

### Goal

Implement logic to:

* Read `/content/posts`
* Parse frontmatter
* Return structured Post objects

### Required Fields

* `title`
* `date`
* `summary`
* `tags`
* `draft`
* `selected`

### Allowed Changes

* `/lib/posts.ts`
* `/content/posts/*`

### Acceptance Criteria

* `draft=true` excluded
* Missing required fields throw clear error
* Posts load successfully

### Forbidden

* No database
* No API calls

---

## T5 — Sorting & Filtering

### Goal

Implement:

* Sort by `date` descending
* Functions:

  * `getAllPosts()`
  * `getSelectedPosts()`
  * `getPostsByTag(tag)`

### Allowed Changes

* `/lib/posts.ts`

### Acceptance Criteria

* Sorting accurate
* Tag filtering accurate
* Draft excluded

---

# Milestone 4 — Blog Pages

---

## T6 — Blog Timeline Page

### Goal

Create `/blog` page with:

* All Posts
* Selected tab (based on `selected=true`)

### UI Requirements

* Show title + date only
* Minimal style

### Allowed Changes

* `/app/blog/page.tsx`
* `/components/BlogList.tsx`

### Acceptance Criteria

* Tab switching works
* Correct ordering
* Draft excluded

---

## T7 — Post Detail Page

### Goal

Create dynamic route:

`/blog/[slug]`

Render:

* Title
* Date
* Tags
* Markdown content

### Slug Rule

Derived from filename without date prefix.

Example:
`2025-04-06-cloning-github.md`
Slug = `cloning-github`

### Allowed Changes

* `/app/blog/[slug]/page.tsx`
* `/components/PostContent.tsx`

### Acceptance Criteria

* Markdown renders correctly
* Tags clickable
* Nonexistent slug returns 404

---

# Milestone 5 — Tags (Knowledge Navigation)

---

## T8 — Tag Index Page

### Goal

Create `/tags` page:

* List all tags
* Show post count

### Allowed Changes

* `/app/tags/page.tsx`

### Acceptance Criteria

* Tag count correct
* Links route to `/tags/[tag]`

---

## T9 — Tag Timeline Page

### Goal

Create `/tags/[tag]` page:

* Timeline filtered by tag
* Sorted by date descending

### Allowed Changes

* `/app/tags/[tag]/page.tsx`

### Acceptance Criteria

* Filtering accurate
* Draft excluded
* Unknown tag returns 404

---

# Milestone 6 — SEO & Feeds

---

## T10 — Metadata

### Goal

Add per-page metadata:

* Title
* Description
* Open Graph

### Acceptance Criteria

* Meta tags visible in page source
* OG preview works

---

## T11 — RSS Feed

### Goal

Generate `/rss.xml`

* Include title
* Include link
* Include date
* Include summary
* Exclude draft

### Acceptance Criteria

* RSS accessible
* Valid XML

---

## T12 — Sitemap

### Goal

Generate `/sitemap.xml`

Include:

* `/`
* `/blog`
* `/tags`
* All posts
* All tag pages

Exclude drafts.

### Acceptance Criteria

* Sitemap accessible
* URLs correct

---

# Milestone 7 — Quality & Deployment

---

## T13 — 404 & Empty States

### Goal

Handle:

* No posts
* Tag with no posts

### Acceptance Criteria

* Friendly UI
* No crash

---

## T14 — Performance Baseline

### Goal

* Record Lighthouse score
* Optimize images

---

## T15 — CI + Vercel

### Goal

* PR triggers Preview Deployment
* `build/lint/typecheck` run in CI
* Production auto-deploy on main

---

# Standard CLI Agent Instruction Template

Use this every time:

```
Read PRD.md, ARCHITECTURE.md, and TASKS_NEXTJS.md.
Implement task {TASK_ID}.
Only modify allowed files.
Do not add new dependencies.
Provide an implementation plan first.
After implementation, run lint, typecheck, and build.
Return acceptance checklist verification.
```
