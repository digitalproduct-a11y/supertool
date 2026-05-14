# Brand-Prefixed Routes

**Date:** 2026-05-14
**Status:** Approved

## Summary

Add a brand slug prefix to all app routes so the selected brand is encoded in the URL. Example: `/astro-awani/home`, `/admin/engagement-posts`, `/hitz/news-feed`.

## Goals

- Brand selection is reflected in the URL (shareable, bookmarkable)
- Clean URL structure: `/:brandSlug/<page>`
- Admin uses `/admin/` prefix
- Old URLs without a brand prefix redirect to the brand picker at `/`

## Route Structure

### Unscoped routes (no brand prefix)

| Path | Component | Notes |
|------|-----------|-------|
| `/` | BrandSelectionPage | Brand picker grid |
| `/start` | GetStartedPage | Onboarding |

### Brand-scoped routes (`/:brandSlug/*`)

All existing routes move under a `/:brandSlug` parent. Examples:

| Old Path | New Path |
|----------|----------|
| `/home` | `/:brandSlug/home` |
| `/article-to-social` | `/:brandSlug/article-to-social` |
| `/article-to-fb` | `/:brandSlug/article-to-fb` |
| `/article-to-carousel` | `/:brandSlug/article-to-carousel` |
| `/news-feed` | `/:brandSlug/news-feed` |
| `/trending-news` | `/:brandSlug/trending-news` |
| `/spike-news` | `/:brandSlug/spike-news` |
| `/affiliate-links` | `/:brandSlug/affiliate-links` |
| `/affiliate-article-editor` | `/:brandSlug/affiliate-article-editor` |
| `/engagement-posts` | `/:brandSlug/engagement-posts` |
| `/engagement-posts/epl` | `/:brandSlug/engagement-posts/epl` |
| `/engagement-posts/ucl` | `/:brandSlug/engagement-posts/ucl` |
| `/engagement-posts/badminton` | `/:brandSlug/engagement-posts/badminton` |
| `/engagement-posts/motogp` | `/:brandSlug/engagement-posts/motogp` |
| `/engagement-posts/worldcup` | `/:brandSlug/engagement-posts/worldcup` |
| `/engagement-posts/gempak-entertainment` | `/:brandSlug/engagement-posts/gempak-entertainment` |
| `/engagement-posts/latest-currency-rate` | `/:brandSlug/engagement-posts/latest-currency-rate` |
| `/engagement-posts/latest-fuel-price` | `/:brandSlug/engagement-posts/latest-fuel-price` |
| `/engagement-posts/klci-index` | `/:brandSlug/engagement-posts/klci-index` |
| `/engagement-posts/on-this-day-malaysia` | `/:brandSlug/engagement-posts/on-this-day-malaysia` |
| `/engagement-posts/weather-malaysia` | `/:brandSlug/engagement-posts/weather-malaysia` |
| `/engagement-posts/quote` | `/:brandSlug/engagement-posts/quote` |
| `/engagement-posts/didyouknow` | `/:brandSlug/engagement-posts/didyouknow` |
| `/engagement-photos/prime-talk` | `/:brandSlug/engagement-photos/prime-talk` |
| `/shopee-top-products` | `/:brandSlug/shopee-top-products` |
| `/post-queue` | `/:brandSlug/post-queue` |
| `/social-affiliate-posting` | `/:brandSlug/social-affiliate-posting` |
| `/quick-fact` | `/:brandSlug/quick-fact` |
| `/dashboard` | `/:brandSlug/dashboard` |
| `/youtube-dashboard` | `/:brandSlug/youtube-dashboard` |

Admin routes use the literal slug `admin`: `/admin/home`, `/admin/dashboard`, etc.

### Removed routes

| Old Path | Reason |
|----------|--------|
| `/news-feed/:brandSlug` | Brand is now in the prefix; `/:brandSlug/news-feed` is sufficient |
| `/news-bank` | Was a redirect to `/news-feed`; no longer needed |
| `/news-bank/:brandSlug` | Replaced by `/:brandSlug/news-feed` |
| `/latest-news` | Was a redirect to `/news-feed`; no longer needed |
| `/trending-news/:brandSlug` | Brand is now in the prefix; `/:brandSlug/trending-news` is sufficient |

### Catch-all redirect

```
<Route path="*" element={<Navigate to="/" replace />} />
```

Any unmatched path (including old bookmarks like `/home`) redirects to the brand picker.

## New Component: BrandLayout

**File:** `src/components/BrandLayout.tsx`

A layout route component that sits as the parent for all `/:brandSlug/*` routes.

**Responsibilities:**

1. Read `:brandSlug` from `useParams()`
2. Convert slug to brand name using `slugToBrand()` (or validate `"admin"`)
3. If the slug doesn't match any known brand or `"admin"`, redirect to `/`
4. Sync the resolved brand into BrandContext via `setSelectedBrand()`
5. Render `<Layout {...layoutProps}><Outlet /></Layout>`

**What it replaces:**

- `<RequireBrand>` wrapper on every route (BrandLayout handles this centrally)
- `<Layout>` wrapper on every route (BrandLayout renders Layout once)

**Route definition in App.tsx:**

```tsx
<Route path="/:brandSlug" element={<BrandLayout />}>
  <Route path="home" element={<HomePage />} />
  <Route path="engagement-posts" element={<EngagementPostsLanding />} />
  <Route path="engagement-posts/epl" element={<EngagementPhotosPage topic="epl" />} />
  ...
</Route>
```

## Navigation Helper: useBrandNavigate

**File:** `src/hooks/useBrandNavigate.ts`

A hook that wraps `useNavigate` and auto-prepends the current brand slug.

```typescript
function useBrandNavigate() {
  const navigate = useNavigate()
  const { brandSlug } = useParams()

  return (path: string, options?: NavigateOptions) => {
    navigate(`/${brandSlug}${path}`, options)
  }
}
```

Usage: `const nav = useBrandNavigate(); nav('/engagement-posts/epl')`

Also export a `useBrandPath(path: string)` utility for building hrefs:

```typescript
function useBrandPath(path: string): string {
  const { brandSlug } = useParams()
  return `/${brandSlug}${path}`
}
```

## Changes to Existing Components

### BrandSelectionPage

- After picking a brand, navigate to `/${brandToSlug(brand)}/home`
- After picking Admin, navigate to `/admin/home`

### Sidebar

- `toolToPath` map becomes a function that prepends the brand slug
- All `navigate()` calls use `useBrandNavigate()` or prepend the slug
- "Switch brand" button still navigates to `/` and clears brand

### BackButton

- If it uses `navigate(-1)`, no change needed
- If it uses hardcoded paths, update to use `useBrandNavigate()`

### All page components with internal navigation

Every `navigate('/some-path')` call must be updated to use `useBrandNavigate()` or prepend the slug. Key files:

- `HomePage.tsx` — tool card links, "View details" link, "See all" news link
- `EngagementPostsLanding.tsx` — card link navigation
- `NewsBankPage.tsx` — back button navigation
- `NewsBankLanding.tsx` — can be removed (brand picker grid no longer needed for news)
- Any component using `useNavigate()` with hardcoded paths

### BrandContext

- `RequireBrand` component is no longer needed (BrandLayout handles it)
- `setSelectedBrand` still used by BrandLayout to sync URL → context
- `clearBrand` still used by "Switch brand" button

### pathToTool / toolToPath / getActiveTool (App.tsx)

- `pathToTool`: Keys lose the leading slash prefix since routes are now relative within `/:brandSlug`. Or update to strip the brand slug before lookup.
- `toolToPath`: Values become relative paths (no brand prefix); Sidebar prepends slug at navigation time.
- `getActiveTool`: Strip the `/:brandSlug` prefix from pathname before matching.

## Brand Slug Mapping

Uses the existing `brandToSlug()` function: lowercase, spaces to hyphens, strip special chars.

| Brand | Slug |
|-------|------|
| Astro Awani | `astro-awani` |
| Astro Arena | `astro-arena` |
| Astro Ulagam | `astro-ulagam` |
| Era | `era` |
| Gempak | `gempak` |
| Hitz | `hitz` |
| Hotspot | `hotspot` |
| Melody | `melody` |
| Rojak Daily | `rojak-daily` |
| XUAN | `xuan` |
| Pa&Ma | `pama` |
| Admin | `admin` |
| ...etc | ...etc |

## Edge Cases

- **Invalid brand slug**: BrandLayout redirects to `/`
- **Admin accessing brand route**: `/admin/home` works; `/astro-awani/home` also works if admin wants brand-specific view
- **Brand switch**: Navigate to `/`, clear brand, pick new brand, land on `/<newBrand>/home`
- **Deep linking**: `/<brand>/engagement-posts/epl` works directly — BrandLayout resolves brand from URL
