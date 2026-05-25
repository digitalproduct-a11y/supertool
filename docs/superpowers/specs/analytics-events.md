# GA4 Analytics Events

**Property ID:** `G-G4HMHMBB5K`

---

## Events Overview

| Event | Trigger | Key Parameters |
|---|---|---|
| `page_view` | Editor navigates to any tool page | `brand_slug`, `page_path` |
| `tool_used` | Editor clicks Generate | `tool_name`, `brand_slug` |
| `post_scheduled` | Post successfully sent/scheduled to Facebook | `tool_name`, `brand_slug` |
| `button_click` | Editor clicks a specific action button | `action`, `tool_name`, `brand_slug` |
| `home_tool_click` | Editor clicks a tool link on the homepage | `tool_label`, `tool_path`, `brand_slug` |

---

## Event Details

### `page_view`
Fires on every route change via the `RouteTracker` component.

| Parameter | Type | Example |
|---|---|---|
| `page_path` | string | `/astro-awani/article-to-fb` |
| `brand_slug` | string | `astro-awani` |

**Coverage:** All 28 tool pages automatically.

---

### `tool_used`
Fires when the editor clicks Generate — before the n8n workflow completes.

| Parameter | Type | Example |
|---|---|---|
| `tool_name` | string | `article-to-fb` |
| `brand_slug` | string | `astro-awani` |

**Coverage:**
- Article to FB
- Article to Carousel
- Article to Social
- Quick Fact
- Quote
- Weather Malaysia
- Latest Fuel Price
- Latest Currency Rate
- KLCI Index
- Engagement Photos (EPL, UCL, Badminton, MotoGP, etc.)
- Prime Talk
- Trending News (via GeneratePostView)
- Spike News (via GeneratePostView)
- Affiliate Article Editor (via ArticleGenerateView)

---

### `post_scheduled`
Fires only on a **successful** Facebook post or schedule.

| Parameter | Type | Example |
|---|---|---|
| `tool_name` | string | `article-to-fb` |
| `brand_slug` | string | `era` |

**Coverage:**
- Article to FB, Carousel, Article to Social — via `App.tsx` Zernio webhook
- Scheduled Posts tool — via `useScheduledPosts.schedulePost()`
- Fuel Price, Currency Rate, KLCI Index, Quick Fact — via each page's `handleSchedule()`

---

### `button_click`
Fires when editor clicks one of the tracked action buttons.

| Parameter | Type | Values |
|---|---|---|
| `action` | string | `adjust_image` \| `download_image` \| `upload_custom_image` \| `caption_copied` |
| `tool_name` | string | e.g. `article-to-fb` |
| `brand_slug` | string | e.g. `hitz` |

**`adjust_image`** — Fires when editor opens the crop/adjust image tool.
Coverage: ResultPreview, GeneratePostView, ArticleGenerateView, PostCard, QuickFactPage

**`download_image`** — Fires when editor downloads the generated image.
Coverage: ResultPreview, GeneratePostView, ArticleGenerateView, PostCard, QuickFactPage

**`upload_custom_image`** — Fires when editor uploads a custom image to replace the generated one.
Coverage: ResultPreview, GeneratePostView, ArticleGenerateView, PostCard, QuickFactPage

**`caption_copied`** — Fires when editor copies the post caption.
Coverage: ResultPreview, ArticleGenerateView, GeneratePostView, ArticleToSocialPage, WeatherMalaysiaPage, QuotePage, QuickFactPage

---

### `home_tool_click`
Fires when editor clicks a tool link from the homepage tool cards.

| Parameter | Type | Example |
|---|---|---|
| `tool_label` | string | `Article to FB Photo` |
| `tool_path` | string | `/article-to-fb` |
| `brand_slug` | string | `gempak` |

**Coverage:** All tool card links on the homepage.

---

## GA4 Setup Checklist

### Custom Dimensions to Register
Go to **GA4 → Admin → Custom definitions → Create custom dimension** for each:

| Dimension Name | Scope | Event Parameter |
|---|---|---|
| Brand Slug | Event | `brand_slug` |
| Tool Name | Event | `tool_name` |
| Action | Event | `action` |
| Tool Label | Event | `tool_label` |
| Tool Path | Event | `tool_path` |

### Custom Events to Mark as Conversions (optional)
- `post_scheduled` — marks when an editor successfully posts to Facebook

---

## Sample GA4 Questions You Can Answer

| Question | How |
|---|---|
| Which tools are most visited? | `page_view` → filter by `tool_name` |
| Which tools are actually used? | `tool_used` → filter by `tool_name` |
| Which brand is most active? | Any event → filter by `brand_slug` |
| Which tools do editors generate from but never post? | Compare `tool_used` vs `post_scheduled` by `tool_name` |
| Which tool links do editors click from the homepage? | `home_tool_click` → filter by `tool_label` |
| How often do editors adjust/download images? | `button_click` → filter by `action` |
| Do editors copy captions after generating? | `button_click` where `action = caption_copied` |

---

## Implementation Files

| File | Events Tracked |
|---|---|
| `src/utils/analytics.ts` | All event functions |
| `src/components/RouteTracker.tsx` | `page_view` |
| `src/hooks/useWorkflow.ts` | `tool_used` (Article to FB, Carousel) |
| `src/pages/ArticleToSocialPage.tsx` | `tool_used`, `button_click` (caption_copied) |
| `src/pages/QuickFactPage.tsx` | `tool_used`, `post_scheduled`, `button_click` (all) |
| `src/pages/QuotePage.tsx` | `tool_used`, `button_click` (caption_copied) |
| `src/pages/WeatherMalaysiaPage.tsx` | `tool_used`, `button_click` (caption_copied) |
| `src/pages/PrimeTalkPage.tsx` | `tool_used` |
| `src/pages/EngagementPhotosPage.tsx` | `tool_used` |
| `src/pages/LatestFuelPricePage.tsx` | `tool_used`, `post_scheduled` |
| `src/pages/KLCIIndexPage.tsx` | `tool_used`, `post_scheduled` |
| `src/pages/LatestCurrencyRatePage.tsx` | `tool_used`, `post_scheduled` |
| `src/hooks/useScheduledPosts.ts` | `post_scheduled` |
| `src/App.tsx` | `post_scheduled` (Article to FB / Carousel) |
| `src/components/ResultPreview.tsx` | `button_click` (all 4 actions) |
| `src/components/GeneratePostView.tsx` | `tool_used`, `button_click` (all 4 actions) |
| `src/components/ArticleGenerateView.tsx` | `tool_used`, `button_click` (all 4 actions) |
| `src/components/PostCard.tsx` | `button_click` (adjust, download, upload) |
| `src/pages/HomePage.tsx` | `home_tool_click` |
