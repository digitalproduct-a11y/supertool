# Upload Revenue Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the upload revenue button from the global header into the Revenue Chart card with passcode protection and auto-selected brand.

**Architecture:** Create a PasscodeModal component that gates access to the upload flow. RevenueChart manages both modals (passcode + upload) with local state, passing a fixed brand to RevenueUploadModal. DashboardPage removes the global upload button and delegates to RevenueChart.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Tabler Icons

---

### Task 1: Create PasscodeModal Component

**Files:**
- Create: `ui/src/components/PasscodeModal.tsx`

- [ ] **Step 1: Write PasscodeModal component with passcode input**

```tsx
import { useState } from 'react'
import { createPortal } from 'react-dom'

interface PasscodeModalProps {
  onSuccess: () => void
  onClose: () => void
}

export function PasscodeModal({ onSuccess, onClose }: PasscodeModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const correctPasscode = import.meta.env.VITE_UPLOAD_PASSCODE as string | undefined

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!correctPasscode) {
      setError('Passcode not configured')
      return
    }
    setLoading(true)
    setError(null)

    if (input === correctPasscode) {
      sessionStorage.setItem('uploadAuth', 'true')
      onSuccess()
    } else {
      setError('Incorrect passcode')
      setInput('')
    }
    setLoading(false)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-950">Enter passcode</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Passcode"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
            disabled={loading}
            autoFocus
          />
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-900">
              {error}
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !input}
            className="px-4 py-1.5 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: Commit PasscodeModal**

```bash
git add ui/src/components/PasscodeModal.tsx
git commit -m "feat: add PasscodeModal component for upload authentication"
```

---

### Task 2: Update RevenueUploadModal to Support Fixed Brand Mode

**Files:**
- Modify: `ui/src/components/RevenueUploadModal.tsx`

- [ ] **Step 1: Add `fixedBrand` prop to interface**

Replace lines 5-10 in RevenueUploadModal.tsx:

```tsx
interface RevenueUploadModalProps {
  brands: { brand: string; bu: string }[]
  defaultBrand: string
  fixedBrand?: string
  onClose: () => void
  onSuccess: () => void
}
```

- [ ] **Step 2: Update component signature and modal title**

Update line 47 to destructure `fixedBrand`:

```tsx
export function RevenueUploadModal({ brands, defaultBrand, fixedBrand, onClose, onSuccess }: RevenueUploadModalProps) {
```

Update line 164 (modal title):

```tsx
<h2 className="text-lg font-semibold text-neutral-950">
  {fixedBrand ? `Upload revenue for ${fixedBrand}` : 'Revenue upload'}
</h2>
```

- [ ] **Step 3: Hide brand dropdown in upload tab when fixedBrand is set**

Replace lines 191-199 (brand selector in upload tab):

```tsx
{!fixedBrand && (
  <div>
    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Brand</label>
    <select
      value={brand}
      onChange={e => setBrand(e.target.value)}
      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white"
    >
      {brands.map(b => <option key={b.brand} value={b.brand}>{b.brand}</option>)}
    </select>
  </div>
)}
{fixedBrand && (
  <div>
    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Brand</label>
    <div className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-neutral-50 text-neutral-700">
      {fixedBrand}
    </div>
  </div>
)}
```

- [ ] **Step 4: Hide brand dropdown in clear tab when fixedBrand is set**

Replace lines 321-329 (brand selector in clear tab):

```tsx
{!fixedBrand && (
  <div>
    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Brand</label>
    <select
      value={clearBrand}
      onChange={e => setClearBrand(e.target.value)}
      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white"
    >
      {brands.map(b => <option key={b.brand} value={b.brand}>{b.brand}</option>)}
    </select>
  </div>
)}
{fixedBrand && (
  <div>
    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Brand</label>
    <div className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-neutral-50 text-neutral-700">
      {fixedBrand}
    </div>
  </div>
)}
```

- [ ] **Step 5: Update brand references in handleSubmit and handleClear**

In handleSubmit (around line 94), update to use fixedBrand:

```tsx
const uploadBrand = fixedBrand || brand
if (!parseResult || !uploadBrand || submitting) return
...
body: JSON.stringify({ brand: uploadBrand, rows: parseResult.rows }),
```

In handleClear (around line 131), update to use fixedBrand:

```tsx
const clearingBrand = fixedBrand || clearBrand
if (!clearingBrand || !clearStart || !clearEnd || clearing) return
...
body: JSON.stringify({ brand: clearingBrand, startDate: clearStart, endDate: clearEnd }),
```

- [ ] **Step 6: Commit RevenueUploadModal changes**

```bash
git add ui/src/components/RevenueUploadModal.tsx
git commit -m "feat: add fixedBrand prop to support pre-selected brand mode"
```

---

### Task 3: Update RevenueChart to Add Upload Button and Modal State

**Files:**
- Modify: `ui/src/components/RevenueChart.tsx`

- [ ] **Step 1: Add imports for PasscodeModal and icons**

Add to imports at the top:

```tsx
import { IconUpload } from '@tabler/icons-react'
import { PasscodeModal } from './PasscodeModal'
import { RevenueUploadModal } from './RevenueUploadModal'
```

- [ ] **Step 2: Update RevenueChartProps interface**

Replace the interface definition (lines 18-27):

```tsx
interface RevenueChartProps {
  data: DashboardRow[]
  prevData?: DashboardRow[]
  showComparison?: boolean
  targetData?: { dailyRevenue: number; revenueTarget: number; targetLabel: string; interactions: null } | null
  showTargets?: boolean
  viewMode?: 'daily' | 'weekly' | 'monthly'
  startDate?: Date
  endDate?: Date
  brand: string
  onRefetch: () => void
}
```

- [ ] **Step 3: Update function signature and add modal state**

Replace line 42:

```tsx
export function RevenueChart({ data, prevData = [], showComparison = false, targetData, showTargets = true, brand, onRefetch }: RevenueChartProps) {
  const [active, setActive] = useState<Set<string>>(new Set(SERIES.map(s => s.key)))
  const [open, setOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [showPasscodeModal, setShowPasscodeModal] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const metricsRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 4: Add upload button handler**

Add after the `toggle` function (around line 65):

```tsx
const handleUploadClick = () => {
  const isAuthenticated = sessionStorage.getItem('uploadAuth') === 'true'
  if (isAuthenticated) {
    setUploadModalOpen(true)
  } else {
    setShowPasscodeModal(true)
  }
}
```

- [ ] **Step 5: Add upload button to the Revenue Chart header**

Update the header section. Find the div with flex items-center justify-between that contains the title and settings button, and add the upload button to the right side:

```tsx
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    <h2 className="text-lg font-semibold text-neutral-950">REVENUE (USD)</h2>
    <div ref={ref} className="relative">
      {/* existing settings button code */}
    </div>
  </div>
  <button
    onClick={handleUploadClick}
    className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition"
  >
    <IconUpload className="w-3.5 h-3.5" />
    Upload revenue
  </button>
</div>
```

- [ ] **Step 6: Add modals to render at the bottom of the component**

Add before the closing `</div>` of the component (around line 336):

```tsx
{showPasscodeModal && (
  <PasscodeModal
    onSuccess={() => {
      setShowPasscodeModal(false)
      setUploadModalOpen(true)
    }}
    onClose={() => setShowPasscodeModal(false)}
  />
)}

{uploadModalOpen && (
  <RevenueUploadModal
    brands={[]}
    defaultBrand={brand}
    fixedBrand={brand}
    onClose={() => setUploadModalOpen(false)}
    onSuccess={() => {
      onRefetch()
      setUploadModalOpen(false)
    }}
  />
)}
```

- [ ] **Step 7: Commit RevenueChart changes**

```bash
git add ui/src/components/RevenueChart.tsx
git commit -m "feat: add upload button and modal management to RevenueChart"
```

---

### Task 4: Update DashboardPage to Remove Global Upload Button

**Files:**
- Modify: `ui/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Remove RevenueUploadModal import**

Delete the import line for RevenueUploadModal.

- [ ] **Step 2: Remove uploadModalOpen state**

Delete the line: `const [uploadModalOpen, setUploadModalOpen] = useState(false)`

- [ ] **Step 3: Remove global upload button from header**

Replace the button group (with Upload and Refresh buttons) with just the Refresh button:

```tsx
<div className="flex items-center gap-2 pt-1 shrink-0">
  <button
    onClick={refetch}
    disabled={loading}
    className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
  >
    <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
    Refresh
  </button>
</div>
```

- [ ] **Step 4: Add brand and onRefetch props to RevenueChart**

Update the RevenueChart render to include new props:

```tsx
<RevenueChart 
  data={filteredData} 
  prevData={prevFilteredData} 
  showComparison={showComparison} 
  targetData={targetData} 
  showTargets={showTargets} 
  viewMode={viewMode} 
  startDate={startDate} 
  endDate={endDate} 
  brand={selectedBrand || ''} 
  onRefetch={refetch} 
/>
```

- [ ] **Step 5: Remove RevenueUploadModal render**

Delete the entire RevenueUploadModal render block at the bottom of the component.

- [ ] **Step 6: Commit DashboardPage changes**

```bash
git add ui/src/pages/DashboardPage.tsx
git commit -m "feat: remove global upload button, move to RevenueChart"
```

---

### Task 5: Test the Feature in Browser

**Files:**
- Test: Browser manual testing

- [ ] **Step 1: Start dev server**

```bash
cd ui && npm run dev
```

- [ ] **Step 2: Navigate to dashboard and select a brand**

Open browser to the dashboard and select a brand from the dropdown.

- [ ] **Step 3: Click "Upload revenue" button on Revenue card**

Look for button in top-right of Revenue card and click it.

- [ ] **Step 4: Enter incorrect passcode**

Type wrong text and submit, verify error message appears.

- [ ] **Step 5: Enter correct passcode**

Enter the correct passcode from VITE_UPLOAD_PASSCODE and submit.

- [ ] **Step 6: Verify modal shows correct brand**

Check that "Upload revenue for [Brand Name]" title is shown and brand field is read-only.

- [ ] **Step 7: Verify Clear tab shows fixed brand**

Click Clear range tab and verify brand is read-only text.

- [ ] **Step 8: Click upload button again without closing**

Close modal and click upload button again, verify passcode modal does NOT appear.

- [ ] **Step 9: Close browser tab and reopen**

Close tab/open incognito, navigate back, verify passcode modal appears again.

- [ ] **Step 10: Switch brands and verify works for each**

Select different brand and verify upload flow works with correct brand.
