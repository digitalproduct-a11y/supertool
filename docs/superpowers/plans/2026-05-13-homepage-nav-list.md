# Homepage Navigation List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chip-button layout in the HomePage left column with a navigation list — each item is a full-width tappable row with a 56×56 image placeholder, title, and arrow.

**Architecture:** All changes are confined to `HomePage.tsx`. The `ENGAGEMENT_GROUPS` constant gains an optional `image` field per link. The JSX rendering swaps the chip grid for a list of nav rows, grouped under sub-headers with dividers between groups.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite

---

### Task 1: Add `image` field to ENGAGEMENT_GROUPS

**Files:**
- Modify: `super-tool/ui/src/pages/HomePage.tsx:83-109`

- [ ] **Step 1: Update the ENGAGEMENT_GROUPS constant**

Replace the existing `ENGAGEMENT_GROUPS` definition (lines 83–109) with this:

```ts
const ENGAGEMENT_GROUPS = [
  {
    label: 'Fun Fact',
    links: [
      { label: 'Did You Know?', path: '/engagement-posts/didyouknow', image: '' },
    ],
  },
  {
    label: 'Sports',
    links: [
      { label: 'EPL', path: '/engagement-posts/epl', image: '' },
      { label: 'Champions League', path: '/engagement-posts/ucl', image: '' },
      { label: 'Badminton', path: '/engagement-posts/badminton', image: '' },
      { label: 'MotoGP', path: '/engagement-posts/motogp', image: '' },
    ],
  },
  {
    label: 'Information',
    links: [
      { label: 'KLCI Index', path: '/engagement-posts/klci-index', image: '' },
      { label: 'Currency Rate', path: '/engagement-posts/latest-currency-rate', image: '' },
      { label: 'Fuel Price', path: '/engagement-posts/latest-fuel-price', image: '' },
      { label: 'On This Day', path: '/engagement-posts/on-this-day-malaysia', image: '' },
      { label: 'Weather Malaysia', path: '/engagement-posts/weather-malaysia', image: '' },
    ],
  },
]
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui"
git add src/pages/HomePage.tsx
git commit -m "feat: add image field to ENGAGEMENT_GROUPS links"
```

---

### Task 2: Build the NavRow component (inline)

**Files:**
- Modify: `super-tool/ui/src/pages/HomePage.tsx` — add inline `NavRow` component above the `ENGAGEMENT_GROUPS` constant

- [ ] **Step 1: Add the NavRow component**

Insert this above the `// ── Engagement quick-link groups` comment (before line 81):

```tsx
// ── Nav row component ─────────────────────────────────────────────────────────

function NavRow({ label, image, onClick }: { label: string; image?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 active:bg-neutral-100 transition-colors text-left"
    >
      {image ? (
        <img src={image} alt={label} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-neutral-100 flex-shrink-0" />
      )}
      <span className="flex-1 text-sm font-semibold text-neutral-900">{label}</span>
      <svg className="w-4 h-4 text-neutral-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: add inline NavRow component for homepage list"
```

---

### Task 3: Replace chip layout with navigation list JSX

**Files:**
- Modify: `super-tool/ui/src/pages/HomePage.tsx` — replace the combined card JSX (lines ~318–355)

- [ ] **Step 1: Replace the combined card JSX**

Find and replace the entire `{/* Combined card: Article to Social + Engagement Posts */}` block with:

```tsx
{/* Combined card: Article to Social + Engagement Posts */}
<div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden">

  {/* Article to Social row */}
  <NavRow
    label="Article to Social Post"
    image=""
    onClick={() => navigate('/article-to-social')}
  />

  {/* Divider */}
  <div className="border-t border-neutral-100" />

  {/* Engagement Posts section */}
  <div className="py-2">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 px-5 pt-3 pb-2">
      Engagement Posts
    </p>
    {ENGAGEMENT_GROUPS.map((group, idx) => (
      <div key={group.label}>
        <p className="text-[11px] font-semibold text-neutral-400 px-5 pt-2 pb-1">{group.label}</p>
        {group.links.map(link => (
          <NavRow
            key={link.path}
            label={link.label}
            image={link.image}
            onClick={() => navigate(link.path)}
          />
        ))}
        {idx < ENGAGEMENT_GROUPS.length - 1 && (
          <div className="border-t border-neutral-100 mx-5 my-1" />
        )}
      </div>
    ))}
  </div>

</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Start dev server and visually verify**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npm run dev
```

Check in browser:
- Left column shows one row for "Article to Social Post" with grey image placeholder and arrow
- Below a divider: "ENGAGEMENT POSTS" label
- Sub-group headers (Fun Fact, Sports, Information) each followed by their rows
- Each row has grey 56×56 placeholder, title, arrow
- Rows are tappable (hover shows `bg-neutral-50`)
- Dividers appear between sub-groups, not after the last group

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: replace engagement chips with navigation list rows"
```
