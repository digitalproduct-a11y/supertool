# Brand Passcode Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate each brand behind a per-brand passcode validated server-side by an n8n webhook; direct URL access without auth redirects to the brand selection page.

**Architecture:** Clicking a brand on `BrandSelectionPage` fires an initial webhook check (POST with empty passcode). If the brand has no passcode the user is auto-navigated; if it does, a `BrandPasscodeModal` appears and validates the entered passcode. `BrandLayout` guards every brand route via a sessionStorage key, redirecting to `/` if missing.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind CSS, n8n cloud workflows (MCP), n8n data table `WrA94W8RTzSvEhyS`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `ui/src/components/BrandPasscodeModal.tsx` | Passcode input modal — renders brand logo/name, submits to webhook, stores sessionStorage on success |
| Modify | `ui/src/pages/BrandSelectionPage.tsx` | Add async `handleSelectBrand`: check passcode requirement, show modal if needed |
| Modify | `ui/src/components/BrandLayout.tsx` | Add sessionStorage auth guard after existing admin guard |
| Modify | `ui/.env.local` | Add `VITE_BRAND_PASSCODE_WEBHOOK_URL` |
| Create (n8n) | Brand Passcode Validator workflow | Webhook that reads data table and validates brand + passcode |

---

## Task 1: Create n8n Brand Passcode Validator workflow

**Files:** n8n cloud (via MCP)

- [ ] **Step 1: Check current workflows to avoid duplication**

Use MCP: `n8n_list_workflows` — confirm no existing "Brand Passcode" workflow exists.

- [ ] **Step 2: Create the workflow via MCP**

Use `n8n_create_workflow` with this JSON:

```json
{
  "name": "Brand Passcode Validator",
  "active": true,
  "nodes": [
    {
      "id": "webhook-trigger",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300],
      "parameters": {
        "httpMethod": "POST",
        "path": "brand-passcode-validate",
        "responseMode": "responseNode",
        "options": {}
      }
    },
    {
      "id": "read-table",
      "name": "Read Brand Table",
      "type": "n8n-nodes-base.n8n",
      "typeVersion": 1,
      "position": [460, 300],
      "parameters": {
        "resource": "dataTable",
        "operation": "getRows",
        "tableId": "WrA94W8RTzSvEhyS"
      }
    },
    {
      "id": "validate-code",
      "name": "Validate Passcode",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [680, 300],
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const body = $('Webhook').first().json.body;\nconst brandInput = (body.brand ?? '').toLowerCase().trim();\nconst passcodeInput = (body.passcode ?? '').trim();\nconst rows = $('Read Brand Table').all();\n\nconst row = rows.find(r => (r.json.brand ?? '').toLowerCase().trim() === brandInput);\n\nif (!row) {\n  return [{ json: { success: false, message: 'Brand not found' } }];\n}\n\nconst storedPasscode = (row.json.passcode ?? '').trim();\n\nif (!storedPasscode) {\n  return [{ json: { success: true, requires_passcode: false } }];\n}\n\nif (passcodeInput === storedPasscode) {\n  return [{ json: { success: true, requires_passcode: true } }];\n}\n\nreturn [{ json: { success: false, requires_passcode: true, message: 'Incorrect passcode' } }];"
      }
    },
    {
      "id": "respond",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [900, 300],
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}",
        "options": {
          "responseHeaders": {
            "values": [
              { "name": "Content-Type", "value": "application/json" }
            ]
          }
        }
      }
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "Read Brand Table", "type": "main", "index": 0 }]]
    },
    "Read Brand Table": {
      "main": [[{ "node": "Validate Passcode", "type": "main", "index": 0 }]]
    },
    "Validate Passcode": {
      "main": [[{ "node": "Respond to Webhook", "type": "main", "index": 0 }]]
    }
  }
}
```

> **Note:** If the `n8n-nodes-base.n8n` node's `getRows` operation name is rejected by validation, use `n8n_autofix_workflow` on the created workflow ID, or check the exact operation name with `get_node("n8n-nodes-base.n8n")` and update accordingly before saving.

- [ ] **Step 3: Test the workflow with a curl command**

```bash
# Test: open brand (no passcode in data table) — should return requires_passcode: false
# Note: replace the URL with the actual webhook URL from the created workflow
curl -s -X POST https://astroproduct.app.n8n.cloud/webhook/brand-passcode-validate \
  -H "Content-Type: application/json" \
  -d '{"brand": "era", "passcode": ""}' | python3 -m json.tool
```

Expected (if Era has a passcode set):
```json
{ "success": false, "requires_passcode": true, "message": "Incorrect passcode" }
```

```bash
# Test: correct passcode (use Era's actual passcode from the data table)
curl -s -X POST https://astroproduct.app.n8n.cloud/webhook/brand-passcode-validate \
  -H "Content-Type: application/json" \
  -d '{"brand": "era", "passcode": "@12304"}' | python3 -m json.tool
```

Expected:
```json
{ "success": true, "requires_passcode": true }
```

```bash
# Test: wrong passcode
curl -s -X POST https://astroproduct.app.n8n.cloud/webhook/brand-passcode-validate \
  -H "Content-Type: application/json" \
  -d '{"brand": "era", "passcode": "wrong"}' | python3 -m json.tool
```

Expected:
```json
{ "success": false, "requires_passcode": true, "message": "Incorrect passcode" }
```

- [ ] **Step 4: Note the webhook URL**

Save the full webhook URL (e.g. `https://astroproduct.app.n8n.cloud/webhook/brand-passcode-validate`) — needed for Task 2.

---

## Task 2: Add env var to `.env.local`

**Files:** Modify `ui/.env.local`

- [ ] **Step 1: Read current `.env.local`**

Read `ui/.env.local` to see existing vars.

- [ ] **Step 2: Append the new env var**

Add this line (do not overwrite existing vars):

```
VITE_BRAND_PASSCODE_WEBHOOK_URL=https://astroproduct.app.n8n.cloud/webhook/brand-passcode-validate
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npx tsc --noEmit
```

Expected: no errors (`.env.local` changes don't affect TS compilation).

---

## Task 3: Create `BrandPasscodeModal` component

**Files:** Create `ui/src/components/BrandPasscodeModal.tsx`

- [ ] **Step 1: Create the component**

Create `ui/src/components/BrandPasscodeModal.tsx` with this content:

```tsx
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getBrandLogoUrl, getBrandHex, needsDarkBg } from '../constants/brands'
import type { BrandName } from '../constants/brands'
import { brandToSlug } from '../utils/brandSlug'

interface BrandPasscodeModalProps {
  brand: BrandName
  onSuccess: () => void
  onClose: () => void
}

export function BrandPasscodeModal({ brand, onSuccess, onClose }: BrandPasscodeModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const webhookUrl = (import.meta.env.VITE_BRAND_PASSCODE_WEBHOOK_URL as string | undefined)?.trim()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(webhookUrl ?? '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, passcode: input.trim() }),
      })
      const data = await res.json() as { success?: boolean; message?: string }
      if (data.success) {
        sessionStorage.setItem(`kult_brand_auth_${brandToSlug(brand)}`, '1')
        onSuccess()
      } else {
        setError(data.message ?? 'Incorrect passcode.')
        setInput('')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleSubmit()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-slide-up"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="brand-passcode-title"
        aria-modal="true"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: needsDarkBg(brand) ? getBrandHex(brand) : '#F9FAFB' }}
            >
              <img src={getBrandLogoUrl(brand)} alt={brand} className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h2 id="brand-passcode-title" className="text-base font-semibold text-neutral-950">
                {brand}
              </h2>
              <p className="text-sm text-neutral-500 mt-0.5">Enter passcode to continue</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none ml-4 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={input}
            onChange={e => {
              setInput(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Passcode"
            disabled={loading}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950/20 focus:border-neutral-400 transition disabled:opacity-50"
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!input || loading}
            className="w-full px-4 py-2 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                Verifying…
              </>
            ) : 'Continue →'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npx tsc --noEmit
```

Expected: no errors.

---

## Task 4: Update `BrandSelectionPage` — async brand click with passcode check

**Files:** Modify `ui/src/pages/BrandSelectionPage.tsx`

- [ ] **Step 1: Read the current file**

Read `ui/src/pages/BrandSelectionPage.tsx` to confirm current state before editing.

- [ ] **Step 2: Add imports and state**

At the top of the file, add the `BrandPasscodeModal` import alongside the existing `AdminPasscodeModal` import:

```tsx
import { AdminPasscodeModal } from '../components/AdminPasscodeModal'
import { BrandPasscodeModal } from '../components/BrandPasscodeModal'
```

Inside `BrandSelectionPage`, replace:
```tsx
const [showAdminModal, setShowAdminModal] = useState(false)
```
with:
```tsx
const [showAdminModal, setShowAdminModal] = useState(false)
const [pendingBrand, setPendingBrand] = useState<BrandName | null>(null)
const [loadingBrand, setLoadingBrand] = useState<BrandName | null>(null)
```

- [ ] **Step 3: Replace `handleSelectBrand` with async version**

Replace the current `handleSelectBrand`:
```tsx
const handleSelectBrand = (brand: BrandName) => {
  setSelectedBrand(brand)
  navigate(`/${brandToSlug(brand)}/home`)
}
```

with:
```tsx
const webhookUrl = (import.meta.env.VITE_BRAND_PASSCODE_WEBHOOK_URL as string | undefined)?.trim()

const handleSelectBrand = async (brand: BrandName) => {
  setLoadingBrand(brand)
  try {
    if (!webhookUrl) {
      setPendingBrand(brand)
      return
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, passcode: '' }),
    })
    const data = await res.json() as { success?: boolean; requires_passcode?: boolean }
    if (data.success && !data.requires_passcode) {
      sessionStorage.setItem(`kult_brand_auth_${brandToSlug(brand)}`, '1')
      setSelectedBrand(brand)
      navigate(`/${brandToSlug(brand)}/home`)
    } else {
      setPendingBrand(brand)
    }
  } catch {
    setPendingBrand(brand)
  } finally {
    setLoadingBrand(null)
  }
}
```

- [ ] **Step 4: Update every brand button's `onClick` and add loading state**

Every brand `<button>` currently has:
```tsx
onClick={() => handleSelectBrand(brand as BrandName)}
```

Change to (the `void` silences the floating promise lint warning):
```tsx
onClick={() => void handleSelectBrand(brand as BrandName)}
disabled={loadingBrand !== null}
```

Also add a loading spinner inside the button, replacing the arrow SVG with:
```tsx
{loadingBrand === brand ? (
  <span className="text-neutral-300 shrink-0 pr-3">
    <span className="w-4 h-4 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin inline-block" />
  </span>
) : (
  <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0 pr-3">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  </span>
)}
```

Apply this change to all three brand column `<button>` elements (AASB+MBNS combined, ARSB, NISB).

- [ ] **Step 5: Add `BrandPasscodeModal` to the JSX**

In the return JSX, alongside the existing `AdminPasscodeModal`, add:
```tsx
{pendingBrand && (
  <BrandPasscodeModal
    brand={pendingBrand}
    onSuccess={() => {
      setSelectedBrand(pendingBrand)
      navigate(`/${brandToSlug(pendingBrand)}/home`)
      setPendingBrand(null)
    }}
    onClose={() => setPendingBrand(null)}
  />
)}
```

- [ ] **Step 6: Type-check**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: Update `BrandLayout` — add sessionStorage auth guard

**Files:** Modify `ui/src/components/BrandLayout.tsx`

- [ ] **Step 1: Read the current file**

Read `ui/src/components/BrandLayout.tsx` to confirm current state.

- [ ] **Step 2: Add brand auth guard after the existing admin guard**

Locate this block in `BrandLayout`:
```tsx
// Admin route requires passcode to have been entered this session
if (resolvedBrand === 'Admin' && sessionStorage.getItem('kult_admin_auth') !== '1') {
  return <Navigate to="/" replace />
}
```

Immediately after it, add:
```tsx
// Brand passcode guard — redirect to picker if not authenticated this session
if (resolvedBrand !== 'Admin' && sessionStorage.getItem(`kult_brand_auth_${brandSlug}`) !== '1') {
  return <Navigate to="/" replace />
}
```

- [ ] **Step 3: Type-check**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npx tsc --noEmit
```

Expected: no errors.

---

## Task 6: Run dev server and test end-to-end

- [ ] **Step 1: Start dev server**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npm run dev
```

- [ ] **Step 2: Test — open brand (no passcode)**

If any brand in the data table has an empty/null `passcode` column:
1. Click that brand on the selection page
2. Expected: brief loading spinner on the card, then immediately navigates to `/:brandSlug/home` — no modal

- [ ] **Step 3: Test — passcode-protected brand, correct passcode**

1. Click Era (passcode: `@12304` based on data table)
2. Expected: loading spinner on card → passcode modal appears with Era logo
3. Enter `@12304` → click Continue
4. Expected: modal closes, navigates to `/era/home`
5. Open DevTools → Application → Session Storage → confirm `kult_brand_auth_era = "1"` is set

- [ ] **Step 4: Test — passcode-protected brand, wrong passcode**

1. Click Era
2. Enter `wrongpasscode` → click Continue
3. Expected: "Incorrect passcode." error appears, input is cleared, focus returns to input
4. Enter correct passcode → navigates successfully

- [ ] **Step 5: Test — direct URL access (redirect guard)**

1. Clear session storage (DevTools → Application → Session Storage → Clear all)
2. Navigate directly to `/era/home` in the browser address bar
3. Expected: immediately redirected to `/` (brand selection page)

- [ ] **Step 6: Test — session survives page refresh**

1. Log in to Era via the picker (correct passcode)
2. Hard-refresh the page while on `/era/home`
3. Expected: still on `/era/home` (sessionStorage persists across page refreshes within the same tab)

- [ ] **Step 7: Test — modal close without navigating**

1. Click Era → modal appears
2. Click the × button
3. Expected: modal closes, stays on brand selection page

- [ ] **Step 8: Build check**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && npm run build
```

Expected: build completes with no errors.

---

## Task 7: Commit

- [ ] **Step 1: Stage files**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && git add src/components/BrandPasscodeModal.tsx src/pages/BrandSelectionPage.tsx src/components/BrandLayout.tsx
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui" && git commit -m "$(cat <<'EOF'
feat: add per-brand passcode gate

Each brand now requires a passcode before accessing its profile.
Validated server-side via n8n webhook; session lasts until tab closes.
Direct URL access without auth redirects to brand selection page.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

- [x] **n8n workflow** — Task 1 covers creation, code logic, and curl tests
- [x] **Env var** — Task 2 covers `.env.local` addition
- [x] **`BrandPasscodeModal`** — Task 3 covers full component with webhook call, sessionStorage write, error state
- [x] **`BrandSelectionPage`** — Task 4 covers async check, loading state on button, modal trigger, `onSuccess` nav
- [x] **`BrandLayout` guard** — Task 5 covers redirect for direct URL access
- [x] **All brands (AASB+MBNS, ARSB, NISB)** — Task 4 Step 4 applies to all three column button groups
- [x] **Session key format** — `kult_brand_auth_${brandSlug}` consistent between Task 3, Task 4, and Task 5
- [x] **Admin not affected** — Task 5 guard skips `resolvedBrand === 'Admin'`
- [x] **No passcode brands** — n8n returns `{success: true, requires_passcode: false}` → auto-navigates without modal
- [x] **`brandToSlug` import** — already imported in `BrandSelectionPage`; added explicitly in `BrandPasscodeModal`
