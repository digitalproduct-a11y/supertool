# Page Width Consistency & Inner Sidebar Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the double-sidebar visual problem in Latest News and Trending News, make the filter sidebar sticky and visually distinct, and unify `HomePage` to the standard `max-w-6xl` page width.

**Architecture:** Pure Tailwind className changes across 3 files. No logic changes, no new components, no API changes. Each task is independent and can be verified visually in the browser via `npm run dev`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite

**Spec:** `docs/superpowers/specs/2026-05-14-page-width-sidebar-design.md`

---

### Task 1: Fix `HomePage` page width

**Files:**
- Modify: `src/pages/HomePage.tsx:293`

- [ ] **Step 1: Open `src/pages/HomePage.tsx` and find line 293**

The current line reads:
```tsx
<div className="max-w-5xl mx-auto space-y-8">
```

- [ ] **Step 2: Change `max-w-5xl` to `max-w-6xl`**

```tsx
<div className="max-w-6xl mx-auto space-y-8">
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev` if not already running. Navigate to the Home page. Confirm the content area is slightly wider and consistent with pages like Article to Social, Article Generator, etc.

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "fix: align HomePage content width to max-w-6xl standard"
```

---

### Task 2: Fix `TrendingSpikePage` inner sidebar and article list

**Files:**
- Modify: `src/pages/TrendingSpikePage.tsx:265,268,318,335`

The parent flex wrapper at line 265 already has `min-h-0` so the sticky behaviour is already correct. Changes needed: sidebar width, background, border, and remove `mx-auto` from article list in two places.

- [ ] **Step 1: Update sidebar div at line 268**

Current:
```tsx
<div className="w-44 shrink-0 border-r border-neutral-100 overflow-y-auto flex flex-col bg-white">
```

Change to:
```tsx
<div className="w-48 shrink-0 border-r border-neutral-200 overflow-y-auto flex flex-col bg-neutral-50">
```

Changes made:
- `w-44` → `w-48` (176px → 192px, unified with LatestNewsTab)
- `border-neutral-100` → `border-neutral-200` (stronger separator)
- `bg-white` → `bg-neutral-50` (tray background, visually distinct from article cards)

- [ ] **Step 2: Remove `mx-auto` from article list wrapper — loading skeleton (line 318)**

Current:
```tsx
<div className="max-w-3xl mx-auto px-4 md:px-6 py-4 space-y-3">
```

Change to:
```tsx
<div className="max-w-3xl px-4 md:px-6 py-4 space-y-3">
```

- [ ] **Step 3: Remove `mx-auto` from article list wrapper — loaded state (line 335)**

Current:
```tsx
<div className="max-w-3xl mx-auto px-4 md:px-6 py-4 space-y-3">
```

Change to:
```tsx
<div className="max-w-3xl px-4 md:px-6 py-4 space-y-3">
```

- [ ] **Step 4: Verify in browser**

Navigate to Trending News. Confirm:
1. The left filter sidebar has a subtle gray background (`bg-neutral-50`) that visually separates it from the article list
2. The sidebar border is slightly more visible
3. The article list is left-anchored (starts from the left edge of the content column, not floating-centered)
4. As you scroll through articles, the sidebar stays locked in place — brand filter buttons remain visible throughout

- [ ] **Step 5: Commit**

```bash
git add src/pages/TrendingSpikePage.tsx
git commit -m "fix: trending news sidebar bg, width, border and left-anchor article list"
```

---

### Task 3: Fix `LatestNewsTab` inner sidebar and article list

**Files:**
- Modify: `src/components/LatestNewsTab.tsx:500,503,612`

The parent flex wrapper at line 500 is missing `min-h-0` — this is what causes the sidebar to not stay sticky when scrolling through a long article list. Also: sidebar width, background, border, and remove `mx-auto` from article list.

- [ ] **Step 1: Add `min-h-0` to the parent flex wrapper at line 500**

Current:
```tsx
<div className="flex-1 flex overflow-hidden">
```

Change to:
```tsx
<div className="flex-1 flex min-h-0 overflow-hidden">
```

This is the critical sticky fix. Without `min-h-0`, the flex parent can grow taller than the viewport, causing both the sidebar and article list to scroll together with the page rather than independently.

- [ ] **Step 2: Update sidebar div at line 503**

Current:
```tsx
<div className="w-40 shrink-0 border-r border-neutral-100 overflow-y-auto flex flex-col bg-white">
```

Change to:
```tsx
<div className="w-48 shrink-0 border-r border-neutral-200 overflow-y-auto flex flex-col bg-neutral-50">
```

Changes made:
- `w-40` → `w-48` (160px → 192px, unified with TrendingSpikePage)
- `border-neutral-100` → `border-neutral-200` (stronger separator)
- `bg-white` → `bg-neutral-50` (tray background, visually distinct from article cards)

- [ ] **Step 3: Remove `mx-auto` from article list wrapper at line 612**

Current:
```tsx
<div className="max-w-3xl mx-auto px-4 md:px-6 py-4 space-y-3">
```

Change to:
```tsx
<div className="max-w-3xl px-4 md:px-6 py-4 space-y-3">
```

- [ ] **Step 4: Verify in browser**

Navigate to Latest News. Confirm:
1. The left filter sidebar has a subtle gray background (`bg-neutral-50`)
2. The sidebar border is slightly more visible
3. The article list is left-anchored (starts from the left edge of the content column)
4. Scroll through a long list of articles — the sidebar with brand/competitor filters stays locked in place throughout. You can switch brand mid-scroll without scrolling back to the top.
5. The sidebar width matches the Trending News page sidebar width visually

- [ ] **Step 5: Commit**

```bash
git add src/components/LatestNewsTab.tsx
git commit -m "fix: latest news sidebar sticky, bg, width, border and left-anchor article list"
```

---

## Final Check

After all 3 tasks are done:

- [ ] Open each of the following pages and confirm they all have the same content width: Home, Article to Social, Trending News, Latest News, Affiliate Links, Quote, Did You Know
- [ ] On Latest News and Trending News: scroll to the bottom of a long article list and confirm the brand filter sidebar is still fully visible and clickable
- [ ] Confirm no other pages were affected
