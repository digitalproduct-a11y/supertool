# Quick Fact Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Quick Fact Generator page to the super-tool that turns an article URL into a branded "key facts" photo post for Facebook.

**Architecture:** Standalone page component (`QuickFactPage.tsx`) with its own internal webhook logic — the same pattern as `FbPostPage` in App.tsx. Wired into the existing sidebar under "Content Ideas" and registered as a route at `/quick-fact`. Reuses `ScheduleModal`, `ScheduleModal`, and `VITE_POST_DRAFT_WEBHOOK_URL` for FB scheduling.

**Tech Stack:** React + TypeScript (Vite), Tailwind CSS, Cloudinary URL manipulation, existing ScheduleModal + fbCredentials utilities.

---

## File Structure

| File | Action | What changes |
|------|--------|-------------|
| `ui/src/types.ts` | Modify | Add `QuickFactResult` interface |
| `ui/src/utils/cloudinary.ts` | Modify | Add `updateFactInImageUrl` function |
| `ui/src/components/Sidebar.tsx` | Modify | Add `'quick-fact'` to ToolId union; add nav item to "Content Ideas"; add TOOL_NAMES entry |
| `ui/src/App.tsx` | Modify | Add `'quick-fact'` to ToolId union; add pathToTool/toolToPath entries; import + register route |
| `ui/src/components/QuickFactPage.tsx` | Create | Full page component: input form, skeleton loader, result panel with editable title/facts/caption, download, schedule |
| `ui/.env.staging` | Modify | Add `VITE_QUICK_FACT_WEBHOOK_URL` placeholder |

---

## Task 1: Add QuickFactResult type

**Files:**
- Modify: `ui/src/types.ts` (append after line 382)

- [ ] **Step 1: Add the interface**

Open `ui/src/types.ts` and append this at the end of the file:

```typescript
// Quick Fact Generator tool types
export interface QuickFactResult {
  success: true
  imageUrl: string
  title: string
  facts: string[]
  caption: string
  brand: string
}

export interface QuickFactError {
  success: false
  message: string
}

export type QuickFactResponse = QuickFactResult | QuickFactError
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `ui/`:
```bash
npx tsc --noEmit
```
Expected: no errors related to types.ts.

- [ ] **Step 3: Commit**

```bash
git add ui/src/types.ts
git commit -m "feat: add QuickFactResult type"
```

---

## Task 2: Add updateFactInImageUrl utility

**Files:**
- Modify: `ui/src/utils/cloudinary.ts` (append after line 157)

Background: `updateTitleInImageUrl` (lines 31–56) replaces encoded title text in a Cloudinary URL. `updateFactInImageUrl` uses the same encoding strategy but for individual bullet-point text layers. Each fact appears once in the URL (unlike title which can appear twice for shadow layers), so we use `replace` not `replaceAll`. The `factIndex` parameter is kept for future use when the n8n URL structure is fully known.

- [ ] **Step 1: Add the function**

Open `ui/src/utils/cloudinary.ts` and append this after line 157 (end of file):

```typescript
/**
 * Replaces the encoded text for a single bullet-point fact layer in a Cloudinary URL.
 * Uses the same encoding strategies as updateTitleInImageUrl, but replaces only the
 * first match (facts appear once; title layers can appear twice for shadow brands).
 *
 * factIndex is reserved for future use when the n8n URL structure is finalised.
 */
export function updateFactInImageUrl(
  imageUrl: string,
  _factIndex: number,
  oldText: string,
  newText: string
): string {
  if (!oldText || !newText) return imageUrl

  const normalizedOld = normalizeTitle(oldText)

  const strategies: Array<[(s: string) => string, (s: string) => string]> = [
    [cloudinaryTextEncode, s => s],
    [cloudinaryTextEncode, s => s.toUpperCase()],
    [singleEncode, s => s],
    [singleEncode, s => s.toUpperCase()],
    [encodeURIComponent, s => s],
  ]

  for (const [encode, caseTransform] of strategies) {
    const encodedOld = encode(caseTransform(normalizedOld))
    if (encodedOld && imageUrl.includes(encodedOld)) {
      return imageUrl.replace(encodedOld, encode(caseTransform(newText)))
    }
  }

  return imageUrl
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/utils/cloudinary.ts
git commit -m "feat: add updateFactInImageUrl utility"
```

---

## Task 3: Wire up ToolId, sidebar, and routes

**Files:**
- Modify: `ui/src/components/Sidebar.tsx` (lines 19, 49–55, 89–103)
- Modify: `ui/src/App.tsx` (lines 40, 42–80)

Note: The "Content Ideas" section already exists in `Sidebar.tsx` at lines 49–55. We add the Quick Fact item to it.

- [ ] **Step 1: Update ToolId in Sidebar.tsx (line 19)**

Find this line in `ui/src/components/Sidebar.tsx`:
```typescript
type ToolId = 'home' | 'fb-post' | 'trending-news' | 'spike-news' | 'affiliate-links' | 'article-generator' | 'engagement-posts' | 'engagement-photos' | 'scheduled-posts' | 'shopee-top-products' | 'post-queue' | 'photo-carousel' | 'social-affiliate-posting'
```

Replace with:
```typescript
type ToolId = 'home' | 'fb-post' | 'trending-news' | 'spike-news' | 'affiliate-links' | 'article-generator' | 'engagement-posts' | 'engagement-photos' | 'scheduled-posts' | 'shopee-top-products' | 'post-queue' | 'photo-carousel' | 'social-affiliate-posting' | 'quick-fact'
```

- [ ] **Step 2: Add IconBulb to imports in Sidebar.tsx (line 2)**

Find the existing icon imports:
```typescript
import {
  IconHome,
  IconPhoto,
  IconCarouselHorizontal,
  IconTrendingUp,
  IconLink,
  IconFileText,
  IconLayoutSidebar,
  IconHeart,
  IconCalendarClock,
  IconBrandThreads,
  IconBolt,
  IconBrandShopee,
} from "@tabler/icons-react";
```

Replace with:
```typescript
import {
  IconHome,
  IconPhoto,
  IconCarouselHorizontal,
  IconTrendingUp,
  IconLink,
  IconFileText,
  IconLayoutSidebar,
  IconHeart,
  IconCalendarClock,
  IconBrandThreads,
  IconBolt,
  IconBrandShopee,
  IconBulb,
} from "@tabler/icons-react";
```

- [ ] **Step 3: Add Quick Fact to navSections "Content Ideas" in Sidebar.tsx (lines 49–55)**

Find the "Content Ideas" section:
```typescript
  {
    section: "Content Ideas",
    items: [
      { id: 'spike-news', label: 'Spike news', icon: IconBolt },
      { id: 'scheduled-posts', label: 'Trending news', icon: IconTrendingUp },
      { id: 'engagement-posts', label: 'Engagement posts', icon: IconHeart },
    ],
  },
```

Replace with:
```typescript
  {
    section: "Content Ideas",
    items: [
      { id: 'spike-news', label: 'Spike news', icon: IconBolt },
      { id: 'scheduled-posts', label: 'Trending news', icon: IconTrendingUp },
      { id: 'engagement-posts', label: 'Engagement posts', icon: IconHeart },
      { id: 'quick-fact', label: 'Quick fact post', icon: IconBulb },
    ],
  },
```

- [ ] **Step 4: Add 'quick-fact' to TOOL_NAMES in Sidebar.tsx (lines 89–103)**

Find:
```typescript
const TOOL_NAMES: Record<ToolId, string> = {
  home: 'KULT Digital Kit',
  'fb-post': 'Photo post',
  'photo-carousel': 'Photo carousel post',
  'trending-news': 'Trending News',
  'spike-news': 'Spike News',
  'affiliate-links': 'Shopee Affiliate Links',
  'article-generator': 'Affiliate Article Editor',
  'engagement-posts': 'Engagement posts',
  'engagement-photos': 'English Premier League',
  'shopee-top-products': 'Shopee Top Products',
  'scheduled-posts': 'Trending news',
  'post-queue': 'Scheduled queue',
  'social-affiliate-posting': 'Social Affiliate Posting',
}
```

Replace with:
```typescript
const TOOL_NAMES: Record<ToolId, string> = {
  home: 'KULT Digital Kit',
  'fb-post': 'Photo post',
  'photo-carousel': 'Photo carousel post',
  'trending-news': 'Trending News',
  'spike-news': 'Spike News',
  'affiliate-links': 'Shopee Affiliate Links',
  'article-generator': 'Affiliate Article Editor',
  'engagement-posts': 'Engagement posts',
  'engagement-photos': 'English Premier League',
  'shopee-top-products': 'Shopee Top Products',
  'scheduled-posts': 'Trending news',
  'post-queue': 'Scheduled queue',
  'social-affiliate-posting': 'Social Affiliate Posting',
  'quick-fact': 'Quick Fact Generator',
}
```

- [ ] **Step 5: Update ToolId in App.tsx (line 40)**

Find:
```typescript
type ToolId = 'home' | 'fb-post' | 'trending-news' | 'spike-news' | 'affiliate-links' | 'article-generator' | 'engagement-posts' | 'engagement-photos' | 'scheduled-posts' | 'shopee-top-products' | 'post-queue' | 'photo-carousel' | 'social-affiliate-posting'
```

Replace with:
```typescript
type ToolId = 'home' | 'fb-post' | 'trending-news' | 'spike-news' | 'affiliate-links' | 'article-generator' | 'engagement-posts' | 'engagement-photos' | 'scheduled-posts' | 'shopee-top-products' | 'post-queue' | 'photo-carousel' | 'social-affiliate-posting' | 'quick-fact'
```

- [ ] **Step 6: Add pathToTool entry in App.tsx (lines 42–56)**

Find:
```typescript
const pathToTool: Record<string, ToolId> = {
  '/home': 'home',
  '/article-to-fb': 'fb-post',
  '/article-to-carousel': 'photo-carousel',
  '/trending-news-to-fb': 'trending-news',
  '/spike-news': 'spike-news',
  '/affiliate-links': 'affiliate-links',
  '/affiliate-article-editor': 'article-generator',
  '/engagement-photos': 'engagement-posts',
  '/engagement-photos/epl': 'engagement-photos',
  '/trending-news': 'scheduled-posts',
  '/shopee-top-products': 'shopee-top-products',
  '/post-queue': 'post-queue',
  '/social-affiliate-posting': 'social-affiliate-posting',
}
```

Replace with:
```typescript
const pathToTool: Record<string, ToolId> = {
  '/home': 'home',
  '/article-to-fb': 'fb-post',
  '/article-to-carousel': 'photo-carousel',
  '/trending-news-to-fb': 'trending-news',
  '/spike-news': 'spike-news',
  '/affiliate-links': 'affiliate-links',
  '/affiliate-article-editor': 'article-generator',
  '/engagement-photos': 'engagement-posts',
  '/engagement-photos/epl': 'engagement-photos',
  '/trending-news': 'scheduled-posts',
  '/shopee-top-products': 'shopee-top-products',
  '/post-queue': 'post-queue',
  '/social-affiliate-posting': 'social-affiliate-posting',
  '/quick-fact': 'quick-fact',
}
```

- [ ] **Step 7: Add toolToPath entry in App.tsx (lines 66–80)**

Find:
```typescript
const toolToPath: Record<ToolId, string> = {
  'home': '/home',
  'fb-post': '/article-to-fb',
  'photo-carousel': '/article-to-carousel',
  'trending-news': '/trending-news-to-fb',
  'spike-news': '/spike-news',
  'affiliate-links': '/affiliate-links',
  'article-generator': '/affiliate-article-editor',
  'engagement-posts': '/engagement-photos',
  'engagement-photos': '/engagement-photos/epl',
  'scheduled-posts': '/trending-news',
  'shopee-top-products': '/shopee-top-products',
  'post-queue': '/post-queue',
  'social-affiliate-posting': '/social-affiliate-posting',
}
```

Replace with:
```typescript
const toolToPath: Record<ToolId, string> = {
  'home': '/home',
  'fb-post': '/article-to-fb',
  'photo-carousel': '/article-to-carousel',
  'trending-news': '/trending-news-to-fb',
  'spike-news': '/spike-news',
  'affiliate-links': '/affiliate-links',
  'article-generator': '/affiliate-article-editor',
  'engagement-posts': '/engagement-photos',
  'engagement-photos': '/engagement-photos/epl',
  'scheduled-posts': '/trending-news',
  'shopee-top-products': '/shopee-top-products',
  'post-queue': '/post-queue',
  'social-affiliate-posting': '/social-affiliate-posting',
  'quick-fact': '/quick-fact',
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add ui/src/components/Sidebar.tsx ui/src/App.tsx
git commit -m "feat: register quick-fact route and sidebar nav entry"
```

---

## Task 4: Create QuickFactPage component

**Files:**
- Create: `ui/src/components/QuickFactPage.tsx`

This is the main page. It has four visual states: `idle` (input form), `loading` (skeleton shimmer), `result` (full editing panel), `error` (error card + retry). It defines its own `callQuickFactWebhook` and `callZernioWebhook` internally — same pattern as `FbPostPage`.

State:
- `pageState: 'idle' | 'loading' | 'result' | 'error'`
- `url / brand` — form inputs
- `result: QuickFactResult | null` — raw webhook response (never mutated)
- `title / committedTitle` — title: live edits; committedTitle: committed on blur → drives `updateTitleInImageUrl`
- `facts / committedFacts` — facts: live edits; committedFacts: committed via "Update Image" button → drives `updateFactInImageUrl`
- `caption` — live editable, 600 char cap
- `scheduleState / showScheduleModal` — FB scheduling flow

`previewImageUrl` is derived inline each render: start from `result.imageUrl`, apply committed title update, then apply each committed fact update in sequence.

- [ ] **Step 1: Create the file**

Create `ui/src/components/QuickFactPage.tsx` with this content:

```tsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BRANDS, type BrandName } from '../constants/brands'
import type { QuickFactResult } from '../types'
import { toast } from '../hooks/useToast'
import { updateTitleInImageUrl, updateFactInImageUrl } from '../utils/cloudinary'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'

type PageState = 'idle' | 'loading' | 'result' | 'error'

async function callQuickFactWebhook(
  url: string,
  brand: string,
): Promise<QuickFactResult | { success: false; message: string }> {
  const webhookUrl = (import.meta.env.VITE_QUICK_FACT_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('VITE_QUICK_FACT_WEBHOOK_URL is not configured')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, brand }),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!text.trim()) throw new Error('Empty response from server')
    return JSON.parse(text) as QuickFactResult | { success: false; message: string }
  } finally {
    clearTimeout(timeout)
  }
}

async function callZernioWebhook(
  imageUrl: string,
  caption: string,
  brand: string,
  scheduledFor: string | undefined,
  passcode: string,
): Promise<{ success: boolean; message: string; status?: string }> {
  const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) return { success: false, message: 'Webhook not configured.' }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fb_ai_image_url: imageUrl,
        fb_ai_caption: caption,
        brand: brand.toLowerCase(),
        ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        passcode,
      }),
    })
    const data = await res.json() as { success?: boolean; status?: string; message?: string }
    if (data.status === 'AUTH_ERROR') {
      clearCredentials(brand.toLowerCase())
      return { success: false, message: data.message ?? 'Invalid passcode.', status: 'AUTH_ERROR' }
    }
    if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
      saveCredentials(brand.toLowerCase(), passcode)
      return { success: true, message: data.message ?? 'Scheduled!' }
    }
    return { success: false, message: data.message ?? 'Something went wrong.' }
  } catch {
    return { success: false, message: 'Network error. Please try again.' }
  }
}

export function QuickFactPage() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [url, setUrl] = useState('')
  const [brand, setBrand] = useState<BrandName | ''>('')
  const [result, setResult] = useState<QuickFactResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Editable content fields
  const [title, setTitle] = useState('')
  const [committedTitle, setCommittedTitle] = useState('')
  const [facts, setFacts] = useState<string[]>([])
  const [committedFacts, setCommittedFacts] = useState<string[]>([])
  const [caption, setCaption] = useState('')

  // UI state
  const [copied, setCopied] = useState(false)
  const [scheduleState, setScheduleState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Derive preview URL from committed values (recomputed each render)
  let previewImageUrl = result?.imageUrl ?? ''
  if (result) {
    previewImageUrl = updateTitleInImageUrl(previewImageUrl, result.title, committedTitle)
    for (let i = 0; i < committedFacts.length; i++) {
      previewImageUrl = updateFactInImageUrl(previewImageUrl, i, result.facts[i] ?? '', committedFacts[i] ?? '')
    }
  }

  async function handleGenerate() {
    if (!url.trim() || !brand) return
    setPageState('loading')
    setErrorMessage('')
    try {
      const data = await callQuickFactWebhook(url.trim(), brand)
      if (!data.success) {
        setErrorMessage((data as { success: false; message: string }).message || 'Failed to generate. Please try again.')
        setPageState('error')
        return
      }
      const res = data as QuickFactResult
      setResult(res)
      setTitle(res.title)
      setCommittedTitle(res.title)
      setFacts([...res.facts])
      setCommittedFacts([...res.facts])
      setCaption(res.caption)
      setPageState('result')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPageState('error')
    }
  }

  async function handleSchedule(scheduledFor: string | undefined, passcode: string) {
    if (!result) return
    setScheduleState('posting')
    const response = await callZernioWebhook(previewImageUrl, caption, result.brand, scheduledFor, passcode)
    if (response.status === 'AUTH_ERROR') {
      setShowScheduleModal(true)
      setScheduleState('idle')
      toast.error('Invalid passcode. Please try again.')
    } else if (response.success) {
      setScheduleState('done')
      setShowScheduleModal(false)
      toast.success('Scheduled on Facebook!')
    } else {
      setScheduleState('error')
      toast.error(response.message || "Couldn't schedule. Please try again.")
    }
  }

  async function handleDownload() {
    try {
      const res = await fetch(previewImageUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `quick-fact-${result?.brand ?? 'post'}-${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(previewImageUrl, '_blank')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleReset() {
    setPageState('idle')
    setResult(null)
    setUrl('')
    setBrand('')
    setScheduleState('idle')
    setErrorMessage('')
  }

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Quick Fact Generator</h1>
          <p className="text-neutral-500 mt-1 text-sm">Turn any article into a key-facts photo post for Facebook</p>
          <div className="mt-3 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* Input form — shown in idle and error states */}
        {(pageState === 'idle' || pageState === 'error') && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Article URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.astroawani.com/..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Brand</label>
              <select
                value={brand}
                onChange={e => setBrand(e.target.value as BrandName)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition bg-white"
              >
                <option value="">Select a brand</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {pageState === 'error' && errorMessage && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={!url.trim() || !brand}
              className="w-full py-3 px-4 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition"
            >
              Generate
            </button>
          </div>
        )}

        {/* Skeleton loader */}
        {pageState === 'loading' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 animate-pulse space-y-4">
            <div className="aspect-[4/5] rounded-xl bg-gray-200" />
            <div className="h-5 bg-gray-200 rounded-lg w-3/4" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
              <div className="h-4 bg-gray-200 rounded w-4/6" />
            </div>
            <div className="h-10 bg-gray-200 rounded-xl w-full" />
          </div>
        )}

        {/* Result panel */}
        {pageState === 'result' && result && (
          <>
            {showScheduleModal && createPortal(
              <ScheduleModal
                brand={result.brand}
                hasCredentials={!!getCredentials(result.brand.toLowerCase())}
                isPosting={scheduleState === 'posting'}
                onConfirm={(sf, passcode) => void handleSchedule(sf, passcode)}
                onClose={() => setShowScheduleModal(false)}
              />,
              document.body
            )}

            <div className="space-y-4">
              {/* Image preview */}
              <div className="bg-neutral-50 rounded-xl overflow-hidden border border-gray-200 aspect-[4/5] w-full">
                <img
                  src={previewImageUrl}
                  alt="Quick fact post preview"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = '' }}
                />
              </div>

              {/* Download */}
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>

              {/* Editable title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Title</label>
                  <span className="text-xs text-gray-400">{title.length}</span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => setCommittedTitle(title)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                />
              </div>

              {/* Editable facts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Key Facts</label>
                </div>
                <div className="space-y-2">
                  {facts.map((fact, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                      <input
                        type="text"
                        value={fact}
                        onChange={e => {
                          const updated = [...facts]
                          updated[i] = e.target.value
                          setFacts(updated)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setCommittedFacts([...facts])}
                  className="mt-2 w-full py-2 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition"
                >
                  Update Image
                </button>
              </div>

              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Caption</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{caption.length}/600</span>
                    <button onClick={handleCopy} title="Copy caption" className="text-neutral-400 hover:text-neutral-700 transition">
                      {copied
                        ? <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      }
                    </button>
                  </div>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value.slice(0, 600))}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent font-sans leading-relaxed transition"
                />
              </div>

              {/* Schedule on FB */}
              <div className="pt-2">
                <button
                  onClick={() => setShowScheduleModal(true)}
                  disabled={scheduleState === 'posting'}
                  className="w-full py-3 px-4 font-medium rounded-xl transition text-sm bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white"
                >
                  {scheduleState === 'posting' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Scheduling…
                    </span>
                  ) : 'Schedule on FB'}
                </button>
                {scheduleState === 'done' && (
                  <div className="text-center space-y-1 mt-1">
                    <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
                    <p className="text-xs text-neutral-400">
                      To view or delete your scheduled post, check{' '}
                      <Link to="/post-queue" className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
                        here
                      </Link>.
                    </p>
                  </div>
                )}
                {scheduleState === 'error' && (
                  <p className="text-xs text-red-500 text-center mt-1">✗ Failed to schedule. Try again.</p>
                )}
              </div>

              {/* Generate another */}
              <button
                onClick={handleReset}
                className="w-full py-2 px-4 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                ← Generate another
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/QuickFactPage.tsx
git commit -m "feat: add QuickFactPage component"
```

---

## Task 5: Wire route in App.tsx

**Files:**
- Modify: `ui/src/App.tsx`

- [ ] **Step 1: Import QuickFactPage**

Find the existing imports block at the top of App.tsx (near lines 1–38). Add the import after the last page component import. Find the line:

```typescript
import { SocialAffiliatePostingPage } from './components/SocialAffiliatePostingPage'
```

Add after it:
```typescript
import { QuickFactPage } from './components/QuickFactPage'
```

- [ ] **Step 2: Add the route**

Find the last route before the closing `</Routes>` (lines 939–944):

```tsx
      <Route path="/social-affiliate-posting" element={
        <Layout {...layoutProps}>
          <SocialAffiliatePostingPage />
        </Layout>
      } />
    </Routes>
```

Replace with:
```tsx
      <Route path="/social-affiliate-posting" element={
        <Layout {...layoutProps}>
          <SocialAffiliatePostingPage />
        </Layout>
      } />
      <Route path="/quick-fact" element={
        <Layout {...layoutProps}>
          <QuickFactPage />
        </Layout>
      } />
    </Routes>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```
Expected: dev server starts on localhost:5173 (or similar) with no errors in the terminal.

- [ ] **Step 5: Verify routing works**

Navigate to `http://localhost:5173/quick-fact` — the page should render with the header "Quick Fact Generator" and the input form. The sidebar "Content Ideas" section should show "Quick fact post" with a bulb icon, and clicking it should navigate to `/quick-fact`.

- [ ] **Step 6: Commit**

```bash
git add ui/src/App.tsx
git commit -m "feat: add /quick-fact route to App"
```

---

## Task 6: Add env var

**Files:**
- Modify: `ui/.env.staging`

- [ ] **Step 1: Add placeholder to .env.staging**

Open `ui/.env.staging` and append:

```
# Quick Fact Generator (new workflow — URL TBD when n8n workflow is built)
VITE_QUICK_FACT_WEBHOOK_URL=
```

- [ ] **Step 2: Note for .env.local**

`ui/.env.local` is gitignored and holds the real webhook URLs for local dev. Once the n8n workflow is built and deployed, add the same variable to `.env.local`:

```
VITE_QUICK_FACT_WEBHOOK_URL=https://astroproduct.app.n8n.cloud/webhook/quick-fact-generator
```

This step cannot be committed — it's a local file. Just note it.

- [ ] **Step 3: Commit .env.staging**

```bash
git add ui/.env.staging
git commit -m "feat: add VITE_QUICK_FACT_WEBHOOK_URL env var placeholder"
```

---

## Task 7: Push to staging

- [ ] **Step 1: Verify the feature end-to-end locally (with a real webhook URL in .env.local)**

If the n8n workflow is not yet built, verify the UI flows:
- `/quick-fact` renders the input form
- "Generate" button is disabled until URL + brand are filled
- (Skip webhook call until n8n is ready)

- [ ] **Step 2: Push to staging branch**

```bash
git push origin feature/quick-fact-generator
```

Then open a PR: `feature/quick-fact-generator` → `staging`.

Once merged, Vercel will build the staging preview automatically.

---

## Self-Review

**Spec coverage check:**
- ✅ `/quick-fact` route and sidebar nav item — Task 3 + 5
- ✅ Input form (URL + brand + Generate button) — Task 4
- ✅ Skeleton loader (shimmer, 4:5 proportions) — Task 4
- ✅ Image preview (4:5 aspect ratio) — Task 4
- ✅ Editable title → committed on blur → `updateTitleInImageUrl` — Task 4
- ✅ Editable facts → committed via "Update Image" button → `updateFactInImageUrl` — Task 2 + 4
- ✅ Editable caption (600 char cap, copy button) — Task 4
- ✅ Download button — Task 4
- ✅ Schedule on FB via `ScheduleModal` + `callZernioWebhook` — Task 4
- ✅ AUTH_ERROR handling (clear credentials, reopen modal) — Task 4
- ✅ Error state (red card + retry = form shows again with error) — Task 4
- ✅ `QuickFactResult` type — Task 1
- ✅ `updateFactInImageUrl` utility — Task 2
- ✅ Env var placeholder — Task 6
- ✅ "Generate another" button resets to idle — Task 4

**Type consistency check:**
- `QuickFactResult.facts: string[]` — used as `result.facts[i]` in `updateFactInImageUrl` calls ✅
- `QuickFactResult.title` — used as `result.title` in `updateTitleInImageUrl` call ✅
- `callZernioWebhook` returns `{ success: boolean; message: string; status?: string }` — consumed correctly in `handleSchedule` ✅
- `updateFactInImageUrl(imageUrl, i, oldText, newText)` — called with the right argument order in QuickFactPage ✅

**Placeholder scan:** None found — all steps have complete code.
