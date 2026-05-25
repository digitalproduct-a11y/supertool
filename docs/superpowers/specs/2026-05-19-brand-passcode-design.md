# Brand Passcode Gate — Design Spec

**Date:** 2026-05-19  
**Status:** Approved

## Problem

Any user who knows a brand's URL (e.g. `/era/home`) can access it directly without going through the brand selection page. We need each brand to be protected by a per-brand passcode so only authorised editors can access their brand profile.

## Requirements

- Each brand has its own unique passcode stored in the n8n Brand Tone & Voice data table (`WrA94W8RTzSvEhyS`), `passcode` column
- Passcode validation happens server-side via a new n8n webhook (passcode never exposed in the JS bundle)
- Session lasts until the browser tab/session closes (sessionStorage)
- Visiting a brand URL directly without auth redirects to the brand selection page (`/`)
- Brands with no passcode configured in the data table are open (no modal shown)

---

## Data Layer (n8n)

**Data table:** `WrA94W8RTzSvEhyS` (Brand Tone & Voice)  
**Existing column used:** `brand` (lowercase display name, e.g. `astro awani`, `era`)  
**Column already added:** `passcode` (text, nullable)

---

## n8n Workflow — Brand Passcode Validator

**Workflow name:** Brand Passcode Validator  
**Webhook path:** `POST /webhook/brand-passcode-validate`

**Request payload:**
```json
{ "brand": "Astro Awani", "passcode": "user-entered-value" }
```

**Logic:**
1. Read all rows from data table `WrA94W8RTzSvEhyS`
2. Filter row where `brand` column matches `body.brand.toLowerCase()`
3. Branch:
   - No row found → `{ success: false, message: "Brand not found" }`
   - Row found, `passcode` is empty/null → `{ success: true, requires_passcode: false }`
   - Row found, `passcode` matches input → `{ success: true, requires_passcode: true }`
   - Row found, `passcode` does not match → `{ success: false, message: "Incorrect passcode" }`
4. Respond to Webhook with above JSON

---

## Frontend Changes

### New component: `BrandPasscodeModal`

File: `ui/src/components/BrandPasscodeModal.tsx`

Props:
```ts
interface BrandPasscodeModalProps {
  brand: BrandName
  onSuccess: () => void
  onClose: () => void
}
```

Behaviour:
- On mount: POST `{ brand, passcode: "" }` immediately to check if passcode is required
  - If `requires_passcode: false` → call `onSuccess()` immediately (no modal shown to user)
  - If `requires_passcode: true` → render the passcode input UI
- User enters passcode + submits → POST `{ brand, passcode }` to webhook
  - On `success: true` → `sessionStorage.setItem('kult_brand_auth_<brandSlug>', '1')` → call `onSuccess()`
  - On `success: false` → show error message, clear input, re-focus
- Loading state while webhook is in-flight (spinner, input disabled)
- Close button calls `onClose()` without navigating

Webhook URL: `import.meta.env.VITE_BRAND_PASSCODE_WEBHOOK_URL`

### `BrandSelectionPage` changes

File: `ui/src/pages/BrandSelectionPage.tsx`

- Add state: `pendingBrand: BrandName | null`
- `handleSelectBrand(brand)` → sets `pendingBrand` (shows modal) instead of navigating immediately
- Modal renders when `pendingBrand !== null`
- `onSuccess` → `setSelectedBrand(brand)` + `navigate(/${brandToSlug(brand)}/home)` + clear `pendingBrand`
- `onClose` → clear `pendingBrand`

### `BrandLayout` changes

File: `ui/src/components/BrandLayout.tsx`

After the existing admin guard, add brand auth check:

```ts
// Brand passcode guard (skip for Admin — it has its own check above)
if (resolvedBrand !== 'Admin' && sessionStorage.getItem(`kult_brand_auth_${brandSlug}`) !== '1') {
  return <Navigate to="/" replace />
}
```

This catches:
- Direct URL access without going through the brand picker
- Old bookmarks after session expires
- Any route under `/:brandSlug/*`

### `.env.local` addition

```
VITE_BRAND_PASSCODE_WEBHOOK_URL=https://astroproduct.app.n8n.cloud/webhook/brand-passcode-validate
```

---

## Auth Flow Summary

```
User clicks brand on BrandSelectionPage
  → BrandPasscodeModal mounts
  → Immediately checks: does this brand require a passcode?
    → No passcode required: onSuccess() fires silently → navigate to /:brandSlug/home
    → Passcode required: show input UI
      → User enters passcode → validate via webhook
        → Correct: sessionStorage.setItem('kult_brand_auth_<slug>', '1') → navigate
        → Wrong: error message, retry

User visits /:brandSlug/any-page directly (bookmark / direct link)
  → BrandLayout checks sessionStorage
  → Not found → <Navigate to="/" replace />
  → User lands on brand selection page, must go through picker
```

---

## Session Storage Keys

| Key | Value | Description |
|-----|-------|-------------|
| `kult_brand_auth_<slug>` | `"1"` | Per-brand auth token. Cleared when session ends. |
| `kult_admin_auth` | `"1"` | Existing admin auth (unchanged) |

---

## Out of Scope

- Server-side session validation (this is an internal tool; sessionStorage is sufficient)
- Rate limiting brute-force attempts (n8n webhook handles this if needed later)
- Remember-me / persistent login across sessions
