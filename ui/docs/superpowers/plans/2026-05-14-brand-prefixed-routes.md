# Brand-Prefixed Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all app routes under a `/:brandSlug` prefix so the selected brand is always encoded in the URL.

**Architecture:** A new `BrandLayout` wrapper component reads the brand slug from the URL, validates it, syncs it to BrandContext, and renders the shared Layout + Outlet. A `useBrandNavigate` hook auto-prepends the current brand slug to all navigation calls. Individual routes no longer need `<RequireBrand>` or `<Layout>` wrappers.

**Tech Stack:** React Router v6 (nested routes, `useParams`, `useOutletContext`, `Outlet`), existing BrandContext, existing `brandToSlug`/`slugToBrand` utilities.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/utils/brandSlug.ts` | Move `brandToSlug` and `slugToBrand` to a shared utility (currently in NewsBankLanding) |
| Create | `src/hooks/useBrandNavigate.ts` | Hook that wraps `useNavigate` to auto-prepend brand slug |
| Create | `src/components/BrandLayout.tsx` | Layout route: validates slug, syncs brand, renders Layout + Outlet |
| Modify | `src/App.tsx` | Replace flat routes with nested `/:brandSlug` parent route; remove `RequireBrand` wrappers; add catch-all redirect |
| Modify | `src/pages/BrandSelectionPage.tsx:14,35,191` | Navigate to `/${brandToSlug(brand)}/home` instead of `/home` |
| Modify | `src/pages/GetStartedPage.tsx:51` | Navigate to `/` instead of `/home` (no brand selected yet) |
| Modify | `src/pages/HomePage.tsx:334,505,526` | Use `useBrandNavigate` for dashboard, tool card, and news links |
| Modify | `src/pages/EngagementPostsLanding.tsx:138` | Use `useBrandNavigate` for card links |
| Modify | `src/pages/ArticleToSocialPage.tsx:668` | Use `useBrandNavigate` for reset navigation |
| Modify | `src/pages/WeatherMalaysiaPage.tsx:382` | Use `useBrandNavigate` for fallback home |
| Modify | `src/pages/OnThisDayPage.tsx:263` | Use `useBrandNavigate` for fallback home |
| Modify | `src/pages/QuotePage.tsx:409` | Use `useBrandNavigate` for fallback home |
| Modify | `src/pages/ScheduledPostsPage.tsx:287` | Use `useBrandNavigate` for fallback home |
| Modify | `src/pages/ScheduledPostsLanding.tsx:140` | Use `useBrandNavigate` for trending-news brand link |
| Modify | `src/pages/FoodPlacesPage.tsx:313` | Use `useBrandNavigate` for engagement-posts link |
| Modify | `src/components/ds/BackButton.tsx:11` | Use `useBrandNavigate` for fallback home |
| Modify | `src/components/Sidebar.tsx:286` | Keep `navigate('/')` for brand switch (correct — exits brand scope) |
| Modify | `src/components/NewsBankPage.tsx:19` | Use `useBrandNavigate` for back to news-feed |
| Modify | `src/components/PostCard.tsx:338` | Use `useBrandPath` for Link to post-queue |
| Modify | `src/components/ResultPreview.tsx:374` | Use `useBrandPath` for Link to post-queue |
| Modify | `src/components/GeneratePostView.tsx:525` | Use `useBrandPath` for Link to post-queue |
| Modify | `src/components/IdeaCard.tsx:418` | Use `useBrandPath` for Link to post-queue |
| Modify | `src/features/carousel/CarouselResultPreview.tsx:691` | Use `useBrandPath` for Link to post-queue |
| Delete | `src/components/NewsBankLanding.tsx` | No longer needed — brand is always known from URL |

---

## Task 1: Extract `brandToSlug` / `slugToBrand` to shared utility

**Files:**
- Create: `src/utils/brandSlug.ts`
- Modify: `src/components/NewsBankLanding.tsx` (remove functions, import from utility)

- [ ] **Step 1: Create `src/utils/brandSlug.ts`**

```typescript
import { BRANDS } from '../constants/brands'
import type { BrandName } from '../constants/brands'

export function brandToSlug(brand: string): string {
  return brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function slugToBrand(slug: string): BrandName | 'Admin' | null {
  if (slug === 'admin') return 'Admin'
  const found = BRANDS.find(b => brandToSlug(b) === slug)
  return found ?? null
}
```

Note: `slugToBrand` now returns `null` for invalid slugs instead of falling through — BrandLayout needs this to detect bad URLs.

- [ ] **Step 2: Update `NewsBankLanding.tsx` imports**

In `src/components/NewsBankLanding.tsx`, remove the `brandToSlug` and `slugToBrand` function definitions (lines 30-36). Replace with:

```typescript
import { brandToSlug, slugToBrand } from '../utils/brandSlug'
```

Also remove the `export` keyword from the old `slugToBrand` since it was exported. Search for any other imports of `slugToBrand` from `NewsBankLanding` and update them.

Check `src/components/NewsBankPage.tsx` line 6 — it imports `slugToBrand` from `./NewsBankLanding`. Update to:

```typescript
import { slugToBrand } from '../utils/brandSlug'
```

- [ ] **Step 3: Verify the app still compiles**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/utils/brandSlug.ts src/components/NewsBankLanding.tsx src/components/NewsBankPage.tsx
git commit -m "refactor: extract brandToSlug/slugToBrand to shared utility"
```

---

## Task 2: Create `useBrandNavigate` hook

**Files:**
- Create: `src/hooks/useBrandNavigate.ts`

- [ ] **Step 1: Create `src/hooks/useBrandNavigate.ts`**

```typescript
import { useNavigate, useParams } from 'react-router-dom'
import type { NavigateOptions } from 'react-router-dom'

/**
 * Wraps useNavigate to auto-prepend the current /:brandSlug prefix.
 * Pass paths starting with '/' — they become /:brandSlug/path.
 *
 * For absolute navigation outside the brand scope (e.g. brand picker),
 * use useNavigate() directly.
 */
export function useBrandNavigate() {
  const navigate = useNavigate()
  const { brandSlug } = useParams<{ brandSlug: string }>()

  return (path: string | number, options?: NavigateOptions) => {
    if (typeof path === 'number') {
      navigate(path)
      return
    }
    navigate(`/${brandSlug}${path}`, options)
  }
}

/**
 * Returns a brand-prefixed path string for use in <Link to={...}> or hrefs.
 */
export function useBrandPath(path: string): string {
  const { brandSlug } = useParams<{ brandSlug: string }>()
  return `/${brandSlug}${path}`
}
```

- [ ] **Step 2: Verify the app still compiles**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBrandNavigate.ts
git commit -m "feat: add useBrandNavigate and useBrandPath hooks"
```

---

## Task 3: Create `BrandLayout` component

**Files:**
- Create: `src/components/BrandLayout.tsx`

- [ ] **Step 1: Create `src/components/BrandLayout.tsx`**

This component replaces both `<RequireBrand>` and `<Layout>` for all brand-scoped routes.

```tsx
import { useEffect } from 'react'
import { useParams, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { slugToBrand } from '../utils/brandSlug'
import { useBrand } from '../context/BrandContext'
import { Sidebar } from './Sidebar'

// pathToTool and toolToPath must be accessible here — they'll be moved/exported from App.tsx in Task 4

interface BrandLayoutProps {
  isSidebarCollapsed: boolean
  onCollapsedChange: (v: boolean) => void
  pathToTool: Record<string, string>
  toolToPath: Record<string, string>
  getActiveTool: (pathname: string) => string
}

export function BrandLayout({
  isSidebarCollapsed,
  onCollapsedChange,
  pathToTool,
  toolToPath,
  getActiveTool,
}: BrandLayoutProps) {
  const { brandSlug } = useParams<{ brandSlug: string }>()
  const { setSelectedBrand } = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  const resolvedBrand = brandSlug ? slugToBrand(brandSlug) : null

  // Sync URL brand → context
  useEffect(() => {
    if (resolvedBrand) {
      setSelectedBrand(resolvedBrand)
    }
  }, [resolvedBrand, setSelectedBrand])

  // Invalid slug → brand picker
  if (!resolvedBrand) {
    return <Navigate to="/" replace />
  }

  // Strip the /:brandSlug prefix to get the page path for active tool detection
  const pagePath = location.pathname.replace(`/${brandSlug}`, '') || '/home'
  const activeTool = getActiveTool(pagePath)

  return (
    <div className={`min-h-screen bg-[#f7f7f6] transition-[padding] duration-300 ${isSidebarCollapsed ? 'md:pl-0' : 'md:pl-60'}`}>
      <Sidebar
        activeTool={activeTool}
        onToolChange={(id) => navigate(`/${brandSlug}${toolToPath[id]}`)}
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={onCollapsedChange}
      />
      <Outlet />
    </div>
  )
}
```

Note: `BrandLayout` receives the path mapping config as props from App.tsx. This avoids circular imports and keeps the route config in one place.

- [ ] **Step 2: Verify the app still compiles**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit`
Expected: No errors (BrandLayout isn't used yet, just defined)

- [ ] **Step 3: Commit**

```bash
git add src/components/BrandLayout.tsx
git commit -m "feat: add BrandLayout wrapper component"
```

---

## Task 4: Rewrite App.tsx routes to use nested `/:brandSlug` structure

This is the core change. Replace all flat `<RequireBrand><Layout>` routes with a single nested `<Route path="/:brandSlug" element={<BrandLayout />}>`.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update path mapping constants**

The `pathToTool`, `toolToPath`, `getActiveTool`, and `topicToPath` maps currently use absolute paths like `/home`. They need to stay as-is (relative to brand root) because `BrandLayout` strips the brand slug prefix before lookup. But they need to be exported or passed as props.

In `src/App.tsx`, keep the existing constants (`pathToTool`, `toolToPath`, `getActiveTool`, `topicToPath`) unchanged. They already use paths like `/home`, `/engagement-posts/epl` which is exactly what we need after stripping the brand prefix.

Remove the `RequireBrand` function (lines 173-177) — no longer needed.

Remove the `Layout` function (lines 184-203) — BrandLayout handles this now.

- [ ] **Step 2: Replace the Routes block**

Replace the entire `<Routes>` block (lines 677-927) with the new nested structure. The key changes:

1. `/` and `/start` remain top-level (no brand prefix)
2. All brand-scoped routes become children of `<Route path="/:brandSlug" element={<BrandLayout ... />}>`
3. Child routes use relative paths (no leading `/`)
4. Remove all `<RequireBrand>` and `<Layout>` wrappers from individual routes
5. Remove redirect routes (`/latest-news`, `/news-bank`, `/trending-news-to-fb`)
6. Remove `/news-feed/:brandSlug` and `/trending-news/:brandSlug` routes (brand is in prefix now)
7. Add a catch-all `<Route path="*" element={<Navigate to="/" replace />} />` at the bottom

New Routes structure:

```tsx
<Routes>
  <Route path="/" element={<BrandSelectionPage />} />
  <Route path="/start" element={<GetStartedPage />} />

  <Route path="/:brandSlug" element={
    <BrandLayout
      isSidebarCollapsed={isSidebarCollapsed}
      onCollapsedChange={setIsSidebarCollapsed}
      pathToTool={pathToTool}
      toolToPath={toolToPath}
      getActiveTool={getActiveTool}
    />
  }>
    <Route path="home" element={<HomePage onToolSelect={(id) => navigate(`/${/* brandSlug from URL */}${toolToPath[id as ToolId] ?? '/home'}`)} />} />
    <Route path="article-to-social" element={<ArticleToSocialPage />} />
    <Route path="article-to-fb" element={<FbPostPage />} />
    <Route path="article-to-carousel" element={<CarouselPage />} />
    <Route path="news-feed" element={<LatestNewsPage />} />
    <Route path="trending-news" element={<TrendingSpikePage />} />
    <Route path="spike-news" element={<SpikeNewsPage onMarkRead={markSpikeRead} />} />
    <Route path="affiliate-links" element={<AffiliateLinksPage />} />
    <Route path="affiliate-article-editor" element={<ArticleGeneratorPage isSidebarCollapsed={isSidebarCollapsed} />} />
    <Route path="engagement-posts" element={<EngagementPostsLanding onSelectTopic={(id) => { /* handled via useBrandNavigate in the component */ }} />} />
    <Route path="engagement-posts/epl" element={<EngagementPhotosPage topic="epl" />} />
    <Route path="engagement-posts/ucl" element={<EngagementPhotosPage topic="ucl" />} />
    <Route path="engagement-posts/gempak-entertainment" element={<EngagementPhotosPage topic="gempak-entertainment" />} />
    <Route path="engagement-posts/badminton" element={<EngagementPhotosPage topic="badminton" />} />
    <Route path="engagement-posts/motogp" element={<EngagementPhotosPage topic="motogp" />} />
    <Route path="engagement-posts/worldcup" element={<EngagementPhotosPage topic="worldcup" />} />
    <Route path="engagement-posts/latest-currency-rate" element={<LatestCurrencyRatePage />} />
    <Route path="engagement-posts/latest-fuel-price" element={<LatestFuelPricePage />} />
    <Route path="engagement-posts/klci-index" element={<KLCIIndexPage />} />
    <Route path="engagement-posts/on-this-day-malaysia" element={
      <Suspense fallback={<div className="flex-1 pt-20 md:pt-10 flex items-center justify-center"><Spinner size="lg" /></div>}>
        <OnThisDayPage />
      </Suspense>
    } />
    <Route path="engagement-posts/weather-malaysia" element={
      <Suspense fallback={<div className="flex-1 pt-20 md:pt-10 flex items-center justify-center"><Spinner size="lg" /></div>}>
        <WeatherMalaysiaPage />
      </Suspense>
    } />
    <Route path="engagement-posts/quote" element={
      <Suspense fallback={<div className="flex-1 pt-20 md:pt-10 flex items-center justify-center"><Spinner size="lg" /></div>}>
        <QuotePage />
      </Suspense>
    } />
    <Route path="engagement-posts/didyouknow" element={<DidYouKnowPage />} />
    <Route path="engagement-photos/prime-talk" element={<PrimeTalkPage />} />
    <Route path="shopee-top-products" element={<ShopeeTopProductsPage />} />
    <Route path="post-queue" element={<ZernioScheduledPostsPage />} />
    <Route path="social-affiliate-posting" element={<SocialAffiliatePostingPage />} />
    <Route path="quick-fact" element={<QuickFactPage />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="youtube-dashboard" element={<YouTubeDashboardPage />} />
  </Route>

  {/* Catch-all: old bookmarks or invalid paths → brand picker */}
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

For `HomePage`'s `onToolSelect` prop: since App.tsx no longer has direct access to the brand slug inside the Routes render, the simplest approach is to have HomePage use `useBrandNavigate` internally (done in Task 5) and make the `onToolSelect` prop a no-op or remove it. The `_onToolSelect` is already unused in HomePage (line 143 shows it's destructured as `_onToolSelect`).

Similarly, `EngagementPostsLanding`'s `onSelectTopic` prop is no longer needed — it already uses `useNavigate` internally. The prop can be kept as a no-op for now or removed.

- [ ] **Step 3: Remove unused imports and functions**

Remove from App.tsx:
- The `RequireBrand` function
- The `Layout` function
- The `ScheduledPostsBrandPage` function (no longer needed — brand is in URL prefix)
- The `NewsBankLanding` import
- The `NewsBankBrandPage` variable/import if it was a separate component

Keep:
- `pathToTool`, `toolToPath`, `getActiveTool`, `topicToPath` — still used
- All page component imports

- [ ] **Step 4: Verify the app compiles**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: restructure routes under /:brandSlug with BrandLayout"
```

---

## Task 5: Update `BrandSelectionPage` to navigate with brand slug

**Files:**
- Modify: `src/pages/BrandSelectionPage.tsx:14,35,191`

- [ ] **Step 1: Update all navigation targets**

Import `brandToSlug`:

```typescript
import { brandToSlug } from '../utils/brandSlug'
```

Change line 14 (the useEffect auto-redirect when brand is already set):

```typescript
// Old:
navigate('/home', { replace: true })

// New:
import { brandToSlug } from '../utils/brandSlug'
// ...
navigate(`/${selectedBrand === 'Admin' ? 'admin' : brandToSlug(selectedBrand)}` + '/home', { replace: true })
```

Change line 35 (`handleSelectBrand`):

```typescript
// Old:
navigate('/home')

// New:
navigate(`/${brandToSlug(brand)}/home`)
```

Change line 191 (Admin success callback):

```typescript
// Old:
navigate('/home')

// New:
navigate('/admin/home')
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/pages/BrandSelectionPage.tsx
git commit -m "feat: brand selection navigates to /:brandSlug/home"
```

---

## Task 6: Update `GetStartedPage`

**Files:**
- Modify: `src/pages/GetStartedPage.tsx:51`

- [ ] **Step 1: Change navigation target**

The "Let's Go" button currently navigates to `/home`. Since no brand is selected at this point, navigate to `/` (brand picker) instead:

```typescript
// Old:
navigate("/home")

// New:
navigate("/")
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/GetStartedPage.tsx
git commit -m "fix: GetStartedPage navigates to brand picker"
```

---

## Task 7: Update `BackButton` component

**Files:**
- Modify: `src/components/ds/BackButton.tsx`

- [ ] **Step 1: Use `useBrandNavigate` for fallback**

```typescript
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '@tabler/icons-react'
import { useBrandNavigate } from '../../hooks/useBrandNavigate'

export function BackButton() {
  const navigate = useNavigate()
  const brandNavigate = useBrandNavigate()

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      brandNavigate('/home')
    }
  }

  return (
    <button
      onClick={handleBack}
      className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
    >
      <IconChevronLeft className="w-5 h-5" />
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ds/BackButton.tsx
git commit -m "fix: BackButton uses brand-prefixed fallback path"
```

---

## Task 8: Update `HomePage` navigation

**Files:**
- Modify: `src/pages/HomePage.tsx:334,505,526`

- [ ] **Step 1: Import `useBrandNavigate`**

```typescript
import { useBrandNavigate } from '../hooks/useBrandNavigate'
```

- [ ] **Step 2: Replace `useNavigate` usage**

At the top of the `HomePage` component, add:

```typescript
const brandNavigate = useBrandNavigate()
```

Then replace these navigate calls:

Line 334 — "View details" link to dashboard:
```typescript
// Old:
onClick={() => navigate('/dashboard')}
// New:
onClick={() => brandNavigate('/dashboard')}
```

Line 505 — Tool card links:
```typescript
// Old:
onClick={() => navigate(link.path, 'state' in link ? { state: link.state } : undefined)}
// New:
onClick={() => brandNavigate(link.path, 'state' in link ? { state: link.state } : undefined)}
```

Line 526 — "See all" news link:
```typescript
// Old:
onClick={() => navigate('/news-feed')}
// New:
onClick={() => brandNavigate('/news-feed')}
```

Keep the existing `useNavigate` import — it may be used elsewhere in the component. Just add `brandNavigate` alongside it.

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "fix: HomePage uses brand-prefixed navigation"
```

---

## Task 9: Update `EngagementPostsLanding` navigation

**Files:**
- Modify: `src/pages/EngagementPostsLanding.tsx`

- [ ] **Step 1: Replace `useNavigate` with `useBrandNavigate`**

```typescript
// Old:
import { useNavigate } from "react-router-dom";
// ...
const navigate = useNavigate();
// ...
onClick={() => navigate(link.path)}

// New:
import { useBrandNavigate } from "../hooks/useBrandNavigate";
// ...
const brandNavigate = useBrandNavigate();
// ...
onClick={() => brandNavigate(link.path)}
```

The `onSelectTopic` prop is no longer used internally. Keep the interface for backwards compatibility but the component navigates directly.

- [ ] **Step 2: Commit**

```bash
git add src/pages/EngagementPostsLanding.tsx
git commit -m "fix: EngagementPostsLanding uses brand-prefixed navigation"
```

---

## Task 10: Update remaining page components with hardcoded `navigate()` calls

**Files:**
- Modify: `src/pages/ArticleToSocialPage.tsx:668`
- Modify: `src/pages/WeatherMalaysiaPage.tsx:382`
- Modify: `src/pages/OnThisDayPage.tsx:263`
- Modify: `src/pages/QuotePage.tsx:409`
- Modify: `src/pages/ScheduledPostsPage.tsx:287`
- Modify: `src/pages/ScheduledPostsLanding.tsx:140`
- Modify: `src/pages/FoodPlacesPage.tsx:313`
- Modify: `src/components/NewsBankPage.tsx:19`

For each file, the pattern is the same:

1. Import `useBrandNavigate`:
   ```typescript
   import { useBrandNavigate } from '../hooks/useBrandNavigate'
   ```
2. Add inside the component:
   ```typescript
   const brandNavigate = useBrandNavigate()
   ```
3. Replace hardcoded `navigate('/some-path')` with `brandNavigate('/some-path')`.

- [ ] **Step 1: Update `ArticleToSocialPage.tsx`**

Line 668:
```typescript
// Old:
navigate('/article-to-social', { replace: true })
// New:
brandNavigate('/article-to-social', { replace: true })
```

- [ ] **Step 2: Update `WeatherMalaysiaPage.tsx`**

Line 382:
```typescript
// Old:
navigate("/home")
// New:
brandNavigate("/home")
```

- [ ] **Step 3: Update `OnThisDayPage.tsx`**

Line 263:
```typescript
// Old:
navigate('/home')
// New:
brandNavigate('/home')
```

- [ ] **Step 4: Update `QuotePage.tsx`**

Line 409:
```typescript
// Old:
navigate("/home")
// New:
brandNavigate("/home")
```

- [ ] **Step 5: Update `ScheduledPostsPage.tsx`**

Line 287:
```typescript
// Old:
navigate('/home')
// New:
brandNavigate('/home')
```

- [ ] **Step 6: Update `ScheduledPostsLanding.tsx`**

Line 140:
```typescript
// Old:
navigate(`/trending-news/${brand.toLowerCase().replace(/\s+/g, '-')}`)
// New — trending-news no longer has a sub-brand slug; brand is in the prefix:
brandNavigate('/trending-news')
```

- [ ] **Step 7: Update `FoodPlacesPage.tsx`**

Line 313:
```typescript
// Old:
navigate("/engagement-posts")
// New:
brandNavigate("/engagement-posts")
```

- [ ] **Step 8: Update `NewsBankPage.tsx`**

Line 19:
```typescript
// Old:
navigate('/news-feed')
// New:
brandNavigate('/news-feed')
```

- [ ] **Step 9: Verify the app compiles**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit`

- [ ] **Step 10: Commit**

```bash
git add src/pages/ArticleToSocialPage.tsx src/pages/WeatherMalaysiaPage.tsx src/pages/OnThisDayPage.tsx src/pages/QuotePage.tsx src/pages/ScheduledPostsPage.tsx src/pages/ScheduledPostsLanding.tsx src/pages/FoodPlacesPage.tsx src/components/NewsBankPage.tsx
git commit -m "fix: update all page navigate() calls to use brand prefix"
```

---

## Task 11: Update `<Link>` components to use brand-prefixed paths

**Files:**
- Modify: `src/components/PostCard.tsx:338`
- Modify: `src/components/ResultPreview.tsx:374`
- Modify: `src/components/GeneratePostView.tsx:525`
- Modify: `src/components/IdeaCard.tsx:418`
- Modify: `src/features/carousel/CarouselResultPreview.tsx:691`

Each of these has a `<Link to="/post-queue">`. Replace with a dynamic path using `useBrandPath`.

- [ ] **Step 1: Update each file**

For each file:

1. Import `useBrandPath`:
   ```typescript
   import { useBrandPath } from '../hooks/useBrandNavigate'
   ```
   (For `CarouselResultPreview.tsx`, the import path is `../../hooks/useBrandNavigate`)

2. Inside the component, add:
   ```typescript
   const postQueuePath = useBrandPath('/post-queue')
   ```

3. Replace:
   ```tsx
   <Link to="/post-queue" ...>
   ```
   with:
   ```tsx
   <Link to={postQueuePath} ...>
   ```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/PostCard.tsx src/components/ResultPreview.tsx src/components/GeneratePostView.tsx src/components/IdeaCard.tsx src/features/carousel/CarouselResultPreview.tsx
git commit -m "fix: update Link components to use brand-prefixed paths"
```

---

## Task 12: Clean up — remove `NewsBankLanding` and dead code

**Files:**
- Delete: `src/components/NewsBankLanding.tsx`
- Modify: `src/App.tsx` (remove import)

- [ ] **Step 1: Remove `NewsBankLanding.tsx`**

Delete the file. It was the brand-picker grid for news feed — no longer needed since the brand is always known from the URL.

- [ ] **Step 2: Remove the import from App.tsx**

Remove:
```typescript
import { NewsBankLanding } from './components/NewsBankLanding'
```

Also remove the `RequireBrand` function if it still exists, and any remaining references to `NewsBankLanding`.

- [ ] **Step 3: Remove dead redirect routes from App.tsx**

Ensure these are gone (should already be removed in Task 4, but verify):
- `/latest-news` redirect
- `/news-bank` redirect
- `/trending-news-to-fb` redirect

- [ ] **Step 4: Verify the app compiles**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git rm src/components/NewsBankLanding.tsx
git add src/App.tsx
git commit -m "chore: remove NewsBankLanding and dead redirect routes"
```

---

## Task 13: Smoke test in browser

- [ ] **Step 1: Start dev server**

Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npm run dev`

- [ ] **Step 2: Test brand selection flow**

1. Visit `http://localhost:5173/` — should see brand picker
2. Click "Astro Awani" — should navigate to `/astro-awani/home`
3. URL bar should show `/astro-awani/home`
4. Page content should show Astro Awani data

- [ ] **Step 3: Test sidebar navigation**

1. From `/astro-awani/home`, click "Engagement posts" in sidebar
2. Should navigate to `/astro-awani/engagement-posts`
3. Click "EPL" card → should go to `/astro-awani/engagement-posts/epl`
4. Click back button → should go back

- [ ] **Step 4: Test admin flow**

1. Visit `/` → click Admin → enter passcode
2. Should navigate to `/admin/home`
3. Sidebar navigation should work with `/admin/` prefix

- [ ] **Step 5: Test old URL redirect**

1. Visit `/home` directly → should redirect to `/` (brand picker)
2. Visit `/engagement-posts/epl` → should redirect to `/`

- [ ] **Step 6: Test brand switching**

1. From `/astro-awani/home`, click "Switch brand" in sidebar footer
2. Should go to `/` → pick "Hitz"
3. Should navigate to `/hitz/home`

- [ ] **Step 7: Test News Feed**

1. Navigate to `/astro-awani/news-feed`
2. Should show news feed for Astro Awani (no brand picker grid)

- [ ] **Step 8: Fix any issues found during testing**

Address any navigation bugs, broken links, or visual issues.

- [ ] **Step 9: Commit any fixes**

```bash
git add -A
git commit -m "fix: address smoke test issues"
```
