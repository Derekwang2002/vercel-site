# LRU Hero Copy Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the LRU hero introduction into a subtle responsive information box and keep the term "最近使用" on one line.

**Architecture:** Reuse the existing `.hero-copy` wrapper as the box so no new component or JavaScript is needed. Add one narrowly scoped utility span for the Chinese term, then verify the static structure and render the standalone HTML in desktop and mobile Chrome viewports.

**Tech Stack:** Standalone HTML, CSS, Chrome headless screenshots, Next.js project checks

## Global Constraints

- Update only `public/leetcode-cookbook/lru-cache-explained.html`.
- Preserve the paragraph text, position, and existing emphasis.
- Reuse the warm paper palette and `8px` radius.
- Do not change other cards, sections, or interactive behavior.

---

### Task 1: Style the LRU Introduction Box

**Files:**
- Modify: `public/leetcode-cookbook/lru-cache-explained.html:71`
- Modify: `public/leetcode-cookbook/lru-cache-explained.html:106`
- Modify: `public/leetcode-cookbook/lru-cache-explained.html:1334`
- Modify: `public/leetcode-cookbook/lru-cache-explained.html:1555`

**Interfaces:**
- Consumes: existing `.hero-copy`, `--paper-2`, `--line`, `--ink`, and `--radius` styles
- Produces: a responsive `.hero-copy` information box and `.keep-together` inline wrapping rule

- [ ] **Step 1: Run a static assertion to verify the box styles are absent**

Run:

```bash
rg -n "\.hero-copy-box|\.keep-together" public/leetcode-cookbook/lru-cache-explained.html
```

Expected: exit code `1`, confirming the new wrapping rule is not implemented yet. The implementation will style the existing `.hero-copy` selector rather than add `.hero-copy-box` markup.

- [ ] **Step 2: Add the minimal responsive box styles**

Update the existing rules to include:

```css
.hero-copy {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: start;
  width: min(100%, 1180px);
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: rgba(255, 253, 247, .9);
  box-shadow: 4px 4px 0 rgba(27, 26, 23, .08);
}

.hero p {
  font-size: 16px;
  color: var(--muted);
  max-width: none;
  margin: 0;
}

.keep-together { white-space: nowrap; }
```

Inside `@media (max-width: 760px)`, add:

```css
.hero-copy {
  padding: 15px 16px;
}
```

- [ ] **Step 3: Keep the quoted term together**

Replace only the quoted phrase in the existing paragraph:

```html
把<span class="keep-together">“最近使用”</span>变成一条可维护的时间轴。
```

- [ ] **Step 4: Verify static structure and project checks**

Run:

```bash
rg -n "width: min\(100%, 1180px\)|class=\"keep-together\"|white-space: nowrap" public/leetcode-cookbook/lru-cache-explained.html
npm run typecheck
git diff --check
```

Expected: all three new style/markup signals are found, TypeScript exits `0`, and `git diff --check` exits `0`.

- [ ] **Step 5: Render desktop and mobile screenshots**

Start the static server:

```bash
npx serve public -l 4173
```

Capture with installed Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --hide-scrollbars --window-size=1440,1000 --screenshot=/tmp/lru-desktop.png http://localhost:4173/leetcode-cookbook/lru-cache-explained.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --hide-scrollbars --window-size=390,844 --screenshot=/tmp/lru-mobile.png http://localhost:4173/leetcode-cookbook/lru-cache-explained.html
```

Expected: both screenshots show the introduction in a pale bordered box with no overflow, overlap, or split inside "最近使用".

- [ ] **Step 6: Commit the implementation**

```bash
git add public/leetcode-cookbook/lru-cache-explained.html
git commit -m "style: frame LRU introduction copy"
```
