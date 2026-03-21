# Performance Baseline (T14)

Date: 2026-03-21

## Scope

- Home page: `/`
- Blog page: `/blog`

## Method

Lighthouse CLI (performance category only):

```bash
npx -y lighthouse http://localhost:3000 --only-categories=performance --quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu" --output=json --output-path="./lighthouse-home.json"
npx -y lighthouse http://localhost:3000/blog --only-categories=performance --quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu" --output=json --output-path="./lighthouse-blog.json"
```

Note: in this environment Lighthouse exits with a Windows temp cleanup `EPERM` warning after finishing, but JSON reports were still produced and parsed successfully.

## Observed Baseline

- Home (`/`)
  - Performance: `80`
  - FCP: `0.9 s`
  - LCP: `1.8 s`
  - TBT: `820 ms`
  - CLS: `0`
  - Speed Index: `0.9 s`

- Blog (`/blog`)
  - Performance: `80`
  - FCP: `0.9 s`
  - LCP: `1.8 s`
  - TBT: `830 ms`
  - CLS: `0`
  - Speed Index: `1.1 s`

## Quick Manual Recheck

1. Start app: `npm run dev`
2. Run the two Lighthouse commands above.
3. Parse key metrics quickly:

```bash
node -e "const fs=require('fs'); for (const f of ['lighthouse-home.json','lighthouse-blog.json']) { const j=JSON.parse(fs.readFileSync(f,'utf8')); const a=j.audits; console.log({file:f,score:Math.round((j.categories.performance.score||0)*100),FCP:a['first-contentful-paint']?.displayValue,LCP:a['largest-contentful-paint']?.displayValue,TBT:a['total-blocking-time']?.displayValue,CLS:a['cumulative-layout-shift']?.displayValue,SI:a['speed-index']?.displayValue}); }"
```
