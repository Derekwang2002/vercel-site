# LRU Hero Copy Box Design

## Goal

Place the introductory LRU Cache paragraph in a subtle information box so it reads as one intentional block and does not split the term "最近使用" across lines.

## Scope

- Update only `public/leetcode-cookbook/lru-cache-explained.html`.
- Preserve the paragraph text, position, and existing emphasis.
- Do not change other cards, sections, or interactive behavior.

## Visual Design

- Reuse the page's warm paper palette and `8px` radius.
- Add a thin warm-gray border, pale paper background, and restrained shadow.
- Use approximately `18px 20px` padding on desktop and slightly tighter padding on mobile.
- Keep the box responsive within the existing hero layout.
- Keep "最近使用" together with a narrowly scoped no-wrap span.

## Verification

- Confirm the page builds successfully.
- Inspect desktop and mobile screenshots for wrapping, overflow, and visual consistency.
- Confirm unrelated working-tree changes remain untouched.
