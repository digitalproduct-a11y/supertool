# Page Width Consistency & Inner Sidebar Design

**Date:** 2026-05-14  
**Scope:** `super-tool/ui/src/pages/` and `super-tool/ui/src/components/LatestNewsTab.tsx`

---

## Problem

1. **Double-sidebar layout feels wrong.** In Latest News and Trending News, the page-level brand filter sidebar (white background, left-aligned) sits immediately to the right of the global dark navigation sidebar. Both blend together visually — the filter strip looks like an extension of the nav rather than a content filter panel.

2. **Sidebar is not visually sticky.** The filter sidebar has no visual distinction from the article content behind it, so as users scroll through news, the filter panel loses its identity as a persistent control.

3. **Article list centering fights the sidebar.** Both pages use `max-w-3xl mx-auto` inside the article column. The `mx-auto` centers content within the remaining space, creating an off-center float rather than a clean left-anchored list.

4. **`HomePage` uses `max-w-5xl`** while all other standard content pages use `max-w-6xl`.

---

## Design

### 1. Inner Sidebar — Visual Treatment

**Files:** `LatestNewsTab.tsx`, `TrendingSpikePage.tsx`

- Background: change `bg-white` → `bg-neutral-50`
- Right border: strengthen from `border-neutral-100` → `border-neutral-200`
- Width: unify both to `w-48` (192px). TrendingSpikePage was `w-44`, LatestNewsTab was `w-40`.
- No other style changes — keep existing font sizes, active states (`bg-neutral-950 text-white`), and section headers as-is.

The `bg-neutral-50` tray differentiates the filter panel from the white article cards, so it reads as a persistent navigation element rather than blending into content.

### 2. Inner Sidebar — Sticky Behaviour

**Files:** `LatestNewsTab.tsx`, `TrendingSpikePage.tsx`

The sidebars already use `overflow-y-auto` within a `flex overflow-hidden` parent, which gives them independent scroll contexts. Verify both pages have `min-h-0` on the flex wrapper so the parent doesn't expand past the viewport — this is what locks the sidebar in place while articles scroll.

- Parent flex wrapper must have: `flex-1 flex min-h-0 overflow-hidden`
- Sidebar: `w-48 shrink-0 border-r border-neutral-200 overflow-y-auto flex flex-col bg-neutral-50`
- No `position: sticky` or `fixed` needed — the flex layout handles it.

### 3. Article List Width Fix

**Files:** `LatestNewsTab.tsx`, `TrendingSpikePage.tsx`

- Remove `mx-auto` from the article list inner wrapper.
- Keep `max-w-3xl` as a reading-width cap (good for text-heavy content).
- Keep `px-4 md:px-6` padding.
- Result: articles flow from the left edge of the content column naturally, no asymmetric centering.

**Before:** `max-w-3xl mx-auto px-4 md:px-6 py-4 space-y-3`  
**After:** `max-w-3xl px-4 md:px-6 py-4 space-y-3`

### 4. Page Width — `HomePage`

**File:** `HomePage.tsx`

- Change `max-w-5xl` → `max-w-6xl` on the main content wrapper.
- This is the only standard content page that diverges from the `max-w-6xl` norm.

### 5. Pages Left Unchanged

The following pages intentionally use `max-w-7xl` for data tables and image grids — they are consistent with each other and should not be changed:

- `DashboardPage` — wide data table
- `EngagementPhotosPage` — large image grid
- `PrimeTalkPage` — large image grid
- `KLCIIndexPage` — data table
- `LatestCurrencyRatePage` — data table
- `LatestFuelPricePage` — data table
- `OnThisDayPage` — mixed data + image grid

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/HomePage.tsx` | `max-w-5xl` → `max-w-6xl` |
| `src/pages/TrendingSpikePage.tsx` | sidebar `w-44` → `w-48`, `bg-white` → `bg-neutral-50`, border strengthened, article list `mx-auto` removed, flex parent verified |
| `src/components/LatestNewsTab.tsx` | sidebar `w-40` → `w-48`, `bg-white` → `bg-neutral-50`, border strengthened, article list `mx-auto` removed, flex parent verified |

---

## Out of Scope

- No changes to global `Sidebar.tsx`
- No changes to any `max-w-7xl` pages
- No changes to article card designs, typography, or spacing
- No responsive breakpoint changes
