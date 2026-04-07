# KULT Studio UI — DS Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the entire React UI (FB Post Generator + Shopee Article Generator) to use the KULT Studio Design System — Mulish font, DS color/shadow/spacing tokens in Tailwind, reusable DS component wrappers, and new Figma-designed screens implemented with pixel fidelity.

**Architecture:** Figma-first: design all screens in `KULT Studio Screens` (file key `ap6iMYiyiacy1iOfcoFDJU`), then implement from the Figma frames. Reusable DS wrapper components (`Button`, `TextField`, `Alert`, etc.) are created first and used throughout all pages.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3, Vite, Mulish (Google Fonts)

---

## DS Token Reference (extracted from Figma DS Tokens file)

### Colors — Global palette (key values)

| Token | Hex |
|---|---|
| neutral-0 | `#ffffff` |
| neutral-5 | `#f8f8f9` |
| neutral-10 | `#dedee0` |
| neutral-40 | `#ababad` |
| neutral-60 | `#78787a` |
| neutral-70 | `#606062` |
| neutral-90 | `#303031` |
| neutral-100 | `#010414` |
| red-5 | `#fde8e7` |
| red-70 | `#b9170d` |
| green-5 | `#eaf9e9` |
| green-70 | `#259c1a` |
| orange-5 | `#fff1e6` |
| orange-70 | `#cc5900` |
| blue-5 | `#e7f1fd` |
| blue-60 | `#1473e6` |
| blue-70 | `#105cb8` |
| brand-green | `#004c22` |

### Colors — Semantic mapping

| Semantic token | Maps to | Hex |
|---|---|---|
| surface-default | neutral-0 | `#ffffff` |
| surface-subtle-neutral | neutral-5 | `#f8f8f9` |
| surface-active | neutral-100 | `#010414` |
| surface-hover | neutral-90 | `#303031` |
| surface-disabled | neutral-10 | `#dedee0` |
| surface-inverse-neutral | neutral-100 | `#010414` |
| surface-error | red-5 | `#fde8e7` |
| surface-success | green-5 | `#eaf9e9` |
| surface-warning | orange-5 | `#fff1e6` |
| surface-info | blue-5 | `#e7f1fd` |
| foreground-default | neutral-100 | `#010414` |
| foreground-strong | neutral-70 | `#606062` |
| foreground-subtle | neutral-40 | `#ababad` |
| foreground-inactive | neutral-60 | `#78787a` |
| foreground-disabled | neutral-40 | `#ababad` |
| foreground-on-active | neutral-0 | `#ffffff` |
| foreground-on-error | red-70 | `#b9170d` |
| foreground-on-success | green-70 | `#259c1a` |
| foreground-on-warning | orange-70 | `#cc5900` |
| border-default | neutral-10 | `#dedee0` |
| border-active | neutral-100 | `#010414` |
| border-error | red-70 | `#b9170d` |

### Typography

| Token | Size | Weight | Line Height |
|---|---|---|---|
| display | 40px | 800 (ExtraBold) | 56px |
| heading1 | 32px | 800 | 40px |
| heading2 | 28px | 800 | 36px |
| body1 | 16px | 400 | 24px |
| body2 | 14px | 400 | 20px |
| body1-strong | 16px | 700 | 24px |
| body2-strong | 14px | 700 | 20px |
| label1 | 14px | 700 | 20px |
| label2 | 12px | 700 | 16px |
| caption | 12px | 400 | 16px |

Font family: `Mulish` (Latin), `Noto Sans` (non-Latin)

### Spacing scale

xs=4, sm=8, md=12, lg=16, xl=24, 2xl=32, 3xl=40, 4xl=48, 5xl=64

### Border radius

sm=4, md=8, lg=16, xl=24, rounded=9999

### Shadows (map in tailwind.config.js)

| Token | Value |
|---|---|
| shadow-sm | `0 1px 3px rgba(1,4,20,0.08), 0 1px 2px rgba(1,4,20,0.06)` |
| shadow-md | `0 4px 6px rgba(1,4,20,0.07), 0 2px 4px rgba(1,4,20,0.06)` |
| shadow-lg | `0 10px 15px rgba(1,4,20,0.07), 0 4px 6px rgba(1,4,20,0.05)` |

---

## File Map

### Modified files
- `ui/tailwind.config.js` — add Mulish font, DS color tokens, spacing, radius, shadow
- `ui/src/index.css` — replace Inter with Mulish import
- `ui/src/App.tsx` — use DS layout tokens, use new DS components
- `ui/src/components/Sidebar.tsx` — DS surface-inverse-neutral, DS typography
- `ui/src/components/InputForm.tsx` — use TextField, Button, SegmentedControl, Modal DS components
- `ui/src/components/PreviewPanel.tsx` — use DS components
- `ui/src/components/ResultPreview.tsx` — use DS components
- `ui/src/components/HistoryPanel.tsx` — use DS Pagination component
- `ui/src/components/ArticlePage.tsx` — use DS components throughout all states
- `ui/src/components/ProgressSteps.tsx` — DS-compliant loading states

### New files (DS component wrappers)
- `ui/src/components/ds/Button.tsx`
- `ui/src/components/ds/TextField.tsx`
- `ui/src/components/ds/Alert.tsx`
- `ui/src/components/ds/SegmentedControl.tsx`
- `ui/src/components/ds/Modal.tsx`
- `ui/src/components/ds/Spinner.tsx`
- `ui/src/components/ds/Pagination.tsx`
- `ui/src/components/ds/Tag.tsx`
- `ui/src/components/ds/index.ts` — barrel export

---

## Task 1: Tailwind + Font Setup

**Files:**
- Modify: `ui/tailwind.config.js`
- Modify: `ui/src/index.css`

- [ ] **Step 1: Update tailwind.config.js with DS tokens**

```js
// ui/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Mulish', 'Noto Sans', 'system-ui', 'sans-serif'],
        mulish: ['Mulish', 'sans-serif'],
      },
      colors: {
        // Semantic surface tokens
        surface: {
          default: '#ffffff',
          subtle: '#f8f8f9',
          active: '#010414',
          hover: '#303031',
          disabled: '#dedee0',
          'inverse-neutral': '#010414',
          error: '#fde8e7',
          success: '#eaf9e9',
          warning: '#fff1e6',
          info: '#e7f1fd',
        },
        // Semantic foreground tokens
        fg: {
          default: '#010414',
          strong: '#606062',
          subtle: '#ababad',
          inactive: '#78787a',
          disabled: '#ababad',
          'on-active': '#ffffff',
          'on-error': '#b9170d',
          'on-success': '#259c1a',
          'on-warning': '#cc5900',
          'on-inverse': '#ffffff',
        },
        // Semantic border tokens
        border: {
          default: '#dedee0',
          active: '#010414',
          error: '#b9170d',
          success: '#259c1a',
        },
        // Brand
        brand: {
          green: '#004c22',
        },
        // Neutral palette (for direct use when needed)
        neutral: {
          0: '#ffffff',
          5: '#f8f8f9',
          10: '#dedee0',
          40: '#ababad',
          60: '#78787a',
          70: '#606062',
          90: '#303031',
          100: '#010414',
        },
      },
      spacing: {
        'ds-xs': '4px',
        'ds-sm': '8px',
        'ds-md': '12px',
        'ds-lg': '16px',
        'ds-xl': '24px',
        'ds-2xl': '32px',
        'ds-3xl': '40px',
        'ds-4xl': '48px',
        'ds-5xl': '64px',
      },
      borderRadius: {
        'ds-sm': '4px',
        'ds-md': '8px',
        'ds-lg': '16px',
        'ds-xl': '24px',
        'ds-rounded': '9999px',
      },
      boxShadow: {
        'ds-sm': '0 1px 3px rgba(1,4,20,0.08), 0 1px 2px rgba(1,4,20,0.06)',
        'ds-md': '0 4px 6px rgba(1,4,20,0.07), 0 2px 4px rgba(1,4,20,0.06)',
        'ds-lg': '0 10px 15px rgba(1,4,20,0.07), 0 4px 6px rgba(1,4,20,0.05)',
      },
      fontSize: {
        'ds-caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'ds-label2': ['12px', { lineHeight: '16px', fontWeight: '700' }],
        'ds-label1': ['14px', { lineHeight: '20px', fontWeight: '700' }],
        'ds-body2': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'ds-body2-strong': ['14px', { lineHeight: '20px', fontWeight: '700' }],
        'ds-body1': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'ds-body1-strong': ['16px', { lineHeight: '24px', fontWeight: '700' }],
        'ds-heading2': ['28px', { lineHeight: '36px', fontWeight: '800' }],
        'ds-heading1': ['32px', { lineHeight: '40px', fontWeight: '800' }],
        'ds-display': ['40px', { lineHeight: '56px', fontWeight: '800' }],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Update index.css — replace Inter with Mulish**

```css
/* ui/src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;700;800;900&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: 'Mulish', 'Noto Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  background: #f8f8f9;
}

/* Keep all existing @keyframes and .animate-* classes unchanged */
```

- [ ] **Step 3: Verify font loads in browser**

Run: `cd ui && npm run dev`
Check: Open browser, heading text should render in Mulish (rounded, friendly letterforms vs Inter)

---

## Task 2: DS Component — Button

**Files:**
- Create: `ui/src/components/ds/Button.tsx`

- [ ] **Step 1: Create Button component**

```tsx
// ui/src/components/ds/Button.tsx
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'inverse-primary' | 'inverse-secondary' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-surface-active text-fg-on-active hover:bg-surface-hover disabled:bg-surface-disabled disabled:text-fg-disabled',
  secondary:
    'bg-transparent border border-border-active text-fg-default hover:bg-neutral-5 disabled:border-border-default disabled:text-fg-disabled',
  tertiary:
    'bg-transparent text-fg-default hover:bg-neutral-5 disabled:text-fg-disabled',
  'inverse-primary':
    'bg-fg-on-active text-surface-active hover:bg-neutral-5 disabled:bg-neutral-10 disabled:text-fg-disabled',
  'inverse-secondary':
    'bg-transparent border border-fg-on-active text-fg-on-active hover:bg-white/10 disabled:border-fg-disabled disabled:text-fg-disabled',
  destructive:
    'bg-surface-error border border-border-error text-fg-on-error hover:bg-red-50 disabled:opacity-50',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-ds-md py-ds-xs text-ds-label2 rounded-ds-md',
  md: 'px-ds-lg py-ds-sm text-ds-label1 rounded-ds-md',
  lg: 'px-ds-xl py-ds-md text-ds-body1-strong rounded-ds-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-mulish font-bold transition-colors active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  )
}
```

- [ ] **Step 2: Verify Tailwind picks up new component**

Run: `cd ui && npm run build`
Expected: No Tailwind purge warnings, build succeeds

---

## Task 3: DS Component — TextField

**Files:**
- Create: `ui/src/components/ds/TextField.tsx`

- [ ] **Step 1: Create TextField component**

```tsx
// ui/src/components/ds/TextField.tsx
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  success?: string
  trailingAction?: React.ReactNode
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

const baseInput =
  'w-full px-ds-lg py-ds-sm font-mulish text-ds-body1 text-fg-default bg-surface-default border border-border-default rounded-ds-md placeholder:text-fg-subtle focus:outline-none focus:border-border-active focus:ring-1 focus:ring-border-active disabled:bg-surface-disabled disabled:text-fg-disabled transition-colors'

export function TextField({ label, hint, error, success, trailingAction, className = '', ...props }: TextFieldProps) {
  return (
    <div className="space-y-ds-xs">
      {label && <label className="block text-ds-label1 text-fg-default font-mulish">{label}</label>}
      <div className="relative">
        <input
          className={[
            baseInput,
            error ? 'border-border-error focus:ring-border-error' : '',
            trailingAction ? 'pr-10' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {trailingAction && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailingAction}</div>
        )}
      </div>
      {error && <p className="text-ds-caption text-fg-on-error">{error}</p>}
      {success && !error && <p className="text-ds-caption text-fg-on-success">{success}</p>}
      {hint && !error && !success && <p className="text-ds-caption text-fg-subtle">{hint}</p>}
    </div>
  )
}

export function TextAreaField({ label, hint, error, className = '', ...props }: TextAreaFieldProps) {
  return (
    <div className="space-y-ds-xs">
      {label && <label className="block text-ds-label1 text-fg-default font-mulish">{label}</label>}
      <textarea
        className={[
          baseInput,
          'resize-none',
          error ? 'border-border-error focus:ring-border-error' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
      {error && <p className="text-ds-caption text-fg-on-error">{error}</p>}
      {hint && !error && <p className="text-ds-caption text-fg-subtle">{hint}</p>}
    </div>
  )
}
```

---

## Task 4: DS Components — Alert, Spinner, SegmentedControl, Modal, Pagination, Tag

**Files:**
- Create: `ui/src/components/ds/Alert.tsx`
- Create: `ui/src/components/ds/Spinner.tsx`
- Create: `ui/src/components/ds/SegmentedControl.tsx`
- Create: `ui/src/components/ds/Modal.tsx`
- Create: `ui/src/components/ds/Pagination.tsx`
- Create: `ui/src/components/ds/Tag.tsx`
- Create: `ui/src/components/ds/index.ts`

- [ ] **Step 1: Create Alert**

```tsx
// ui/src/components/ds/Alert.tsx
type AlertVariant = 'neutral' | 'warning' | 'negative' | 'positive' | 'info'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  message: string
  action?: React.ReactNode
}

const config: Record<AlertVariant, { surface: string; text: string; icon: string }> = {
  neutral: { surface: 'bg-surface-subtle border-border-default', text: 'text-fg-default', icon: 'text-fg-strong' },
  warning: { surface: 'bg-surface-warning border-orange-200', text: 'text-fg-on-warning', icon: 'text-fg-on-warning' },
  negative: { surface: 'bg-surface-error border-border-error', text: 'text-fg-on-error', icon: 'text-fg-on-error' },
  positive: { surface: 'bg-surface-success border-border-success', text: 'text-fg-on-success', icon: 'text-fg-on-success' },
  info: { surface: 'bg-surface-info border-blue-200', text: 'text-blue-700', icon: 'text-blue-600' },
}

export function Alert({ variant = 'neutral', title, message, action }: AlertProps) {
  const c = config[variant]
  return (
    <div className={`flex gap-ds-md p-ds-lg rounded-ds-lg border ${c.surface}`}>
      <div className="flex-1">
        {title && <p className={`text-ds-body2-strong font-mulish ${c.text} mb-1`}>{title}</p>}
        <p className={`text-ds-body2 font-mulish ${c.text}`}>{message}</p>
        {action && <div className="mt-ds-sm">{action}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create Spinner**

```tsx
// ui/src/components/ds/Spinner.tsx
interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; inverse?: boolean }
const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }

export function Spinner({ size = 'md', inverse = false }: SpinnerProps) {
  return (
    <div
      className={`${sizes[size]} rounded-full border-4 animate-spin ${
        inverse
          ? 'border-white/20 border-t-white'
          : 'border-neutral-10 border-t-surface-active'
      }`}
    />
  )
}
```

- [ ] **Step 3: Create SegmentedControl**

```tsx
// ui/src/components/ds/SegmentedControl.tsx
interface Option<T extends string> { value: T; label: string }
interface SegmentedControlProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

export function SegmentedControl<T extends string>({
  options, value, onChange, disabled
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex gap-1 bg-neutral-5 rounded-ds-md p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={[
            'px-ds-md py-ds-xs rounded-ds-sm text-ds-label2 font-mulish font-bold transition-colors',
            value === opt.value
              ? 'bg-surface-default text-fg-default shadow-ds-sm'
              : 'text-fg-strong hover:text-fg-default',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create Modal**

```tsx
// ui/src/components/ds/Modal.tsx
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'sm' }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-neutral-100/40 backdrop-blur-sm flex items-center justify-center z-50 p-ds-lg" onClick={onClose}>
      <div
        className={`bg-surface-default rounded-ds-xl shadow-ds-lg w-full ${size === 'lg' ? 'max-w-2xl' : 'max-w-sm'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-ds-xl pt-ds-xl pb-ds-lg border-b border-border-default">
          <h2 className="text-ds-body1-strong font-mulish text-fg-default">{title}</h2>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg-default transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-ds-xl py-ds-lg">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create Pagination**

```tsx
// ui/src/components/ds/Pagination.tsx
interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="text-ds-label2 font-mulish px-ds-md py-ds-xs border border-border-default rounded-ds-md text-fg-default hover:bg-neutral-5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      <span className="text-ds-caption text-fg-subtle font-mulish">
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        disabled={page === totalPages - 1}
        className="text-ds-label2 font-mulish px-ds-md py-ds-xs border border-border-default rounded-ds-md text-fg-default hover:bg-neutral-5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Create Tag**

```tsx
// ui/src/components/ds/Tag.tsx
type TagVariant = 'primary' | 'secondary' | 'status-positive' | 'status-negative' | 'status-warning' | 'status-neutral'

interface TagProps { variant?: TagVariant; children: React.ReactNode }

const tagClasses: Record<TagVariant, string> = {
  primary: 'bg-surface-active text-fg-on-active',
  secondary: 'bg-neutral-5 border border-border-default text-fg-strong',
  'status-positive': 'bg-surface-success text-fg-on-success',
  'status-negative': 'bg-surface-error text-fg-on-error',
  'status-warning': 'bg-surface-warning text-fg-on-warning',
  'status-neutral': 'bg-neutral-5 text-fg-strong',
}

export function Tag({ variant = 'secondary', children }: TagProps) {
  return (
    <span className={`inline-flex items-center px-ds-sm py-[2px] rounded-ds-sm text-ds-label2 font-mulish font-bold ${tagClasses[variant]}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 7: Create barrel export**

```ts
// ui/src/components/ds/index.ts
export { Button } from './Button'
export { TextField, TextAreaField } from './TextField'
export { Alert } from './Alert'
export { Spinner } from './Spinner'
export { SegmentedControl } from './SegmentedControl'
export { Modal } from './Modal'
export { Pagination } from './Pagination'
export { Tag } from './Tag'
```

- [ ] **Step 8: Build check**

Run: `cd ui && npm run build`
Expected: Clean build, no TS errors

---

## Task 5: Design Screens in Figma

**Target file:** `KULT Studio Screens` (key: `ap6iMYiyiacy1iOfcoFDJU`)

Design the following screens using DS components from the DS Components file (`jngGSyw8ADneVjU3mATZAU`). Use the DS Tokens file (`jvhYNmktE4OPkbUU85cFCt`) for all colors, spacing, and typography.

- [ ] **Screen 1: App Shell** — Sidebar (desktop + mobile states) + page layout wrapper
- [ ] **Screen 2: FB Post — Idle** — Input form (URL field, brand select, SegmentedControl for title/caption modes) + empty preview panel
- [ ] **Screen 3: FB Post — Loading** — Input form (disabled) + ProgressSteps in preview panel
- [ ] **Screen 4: FB Post — Result** — Input form + result preview (image, caption, action buttons)
- [ ] **Screen 5: FB Post — Error** — Input form + error alert in preview panel
- [ ] **Screen 6: FB Post — Approved** — Success state with animated checkmark
- [ ] **Screen 7: Shopee Article — Idle** — Brand input + Shopee links textarea + CTA
- [ ] **Screen 8: Shopee Article — Angle Selection** — Product summary accordion + angle cards + custom angle form
- [ ] **Screen 9: Shopee Article — Review Draft** — Article preview + Copy HTML / Approve / Suggest Changes actions
- [ ] **Screen 10: Shopee Article — Thumbnail** — Prompt editor + generate button
- [ ] **Screen 11: Shopee Article — Thumbnail Result** — Image preview + Download / Regenerate / Finish actions
- [ ] **Screen 12: Shopee Article — Done** — Success state with article title + action buttons

All loading/spinner states use the `Spinner` DS component pattern.

---

## Task 6: Implement Sidebar

**Files:**
- Modify: `ui/src/components/Sidebar.tsx`

- [ ] **Step 1: Revamp Sidebar with DS tokens**

Key changes:
- Background: `bg-surface-inverse-neutral` (`#010414`)
- Header text: `text-ds-body1-strong font-mulish text-fg-on-inverse`
- Nav items active: `bg-white/10 text-fg-on-active`
- Nav items inactive: `text-fg-on-inverse-inactive hover:bg-white/8 hover:text-fg-on-inverse`
- Dividers: `border-white/8`
- Footer text: `text-ds-caption text-fg-on-inverse-inactive`
- Hamburger button: DS-compliant `Button` variant

Implement from Figma Screen 1 (App Shell) after it is designed.

- [ ] **Step 2: Build check** — `npm run build`

---

## Task 7: Implement FB Post Generator

**Files:**
- Modify: `ui/src/components/InputForm.tsx`
- Modify: `ui/src/components/PreviewPanel.tsx`
- Modify: `ui/src/components/ResultPreview.tsx`
- Modify: `ui/src/components/HistoryPanel.tsx`
- Modify: `ui/src/components/ProgressSteps.tsx`
- Modify: `ui/src/App.tsx` (layout + approved state)

- [ ] **Step 1: Revamp InputForm**

Replace all bespoke elements:
- URL input → `<TextField>` with `trailingAction` for clear button
- Brand select → native `<select>` styled with DS tokens (border-border-default, rounded-ds-md, text-ds-body1)
- Image Title / Caption Title toggles → `<SegmentedControl>`
- Custom title input → `<TextField>`
- Submit button → `<Button variant="primary" size="lg" fullWidth>`
- Supported sites modal → `<Modal>`
- Brand detected indicator → `<Tag variant="status-positive">`
- Domain not supported → `<Alert variant="negative">`

Implement from Figma Screen 2 (FB Post — Idle).

- [ ] **Step 2: Revamp PreviewPanel + ProgressSteps**

- Idle state: DS icon + `text-ds-body2 text-fg-subtle`
- Loading state: `<Spinner size="lg">` + DS typography, implement from Figma Screen 3
- Error state: `<Alert variant="negative">` + `<Button variant="secondary">`, implement from Figma Screen 5
- Container: `bg-surface-default shadow-ds-md rounded-ds-xl`

- [ ] **Step 3: Revamp ResultPreview**

- Image container: `rounded-ds-lg border border-border-default`
- Image actions: `<Button variant="primary">` Download, `<Button variant="secondary">` Edit Image Title
- Inline edit panels: DS `bg-neutral-5 rounded-ds-lg border border-border-default` containers
- SegmentedControl for title/caption mode toggles
- Caption textarea: `<TextAreaField>`
- Copy/Readjust caption: `<Button variant="primary">`, `<Button variant="secondary">`
- Caption char count: `text-ds-caption text-fg-subtle`

Implement from Figma Screen 4 (FB Post — Result).

- [ ] **Step 4: Revamp HistoryPanel**

- Section header: `text-ds-label2 text-fg-subtle font-mulish uppercase tracking-wider`
- History cards: `bg-surface-subtle rounded-ds-lg border border-border-default`
- Download/Copy buttons: `<Button variant="secondary" size="sm">`
- Pagination: `<Pagination>`

- [ ] **Step 5: Revamp App.tsx approved state**

- Container: `bg-surface-default shadow-ds-md rounded-ds-xl`
- Success icon: `bg-surface-success` circle
- Text: DS typography tokens
- CTA: `<Button variant="primary" size="lg">`

- [ ] **Step 6: Build + visual check**

Run: `npm run build`
Open dev server and verify all 5 FB Post states visually match Figma screens.

---

## Task 8: Implement Shopee Article Generator

**Files:**
- Modify: `ui/src/components/ArticlePage.tsx`

- [ ] **Step 1: Revamp Idle state**

- Brand input → `<TextField label="Brand">`
- Shopee links → `<TextAreaField label="Shopee Links" hint="Paste one link per line">`
- CTA → `<Button variant="primary" size="lg" fullWidth loading={isLoading}>`
- Container: `bg-surface-default shadow-ds-md rounded-ds-xl p-ds-xl`

Implement from Figma Screen 7 (Shopee Article — Idle).

- [ ] **Step 2: Revamp loading states (processing_products, generating_article, revising_article, generating_thumbnail)**

Replace all spinner divs with:
```tsx
<div className="flex flex-col items-center gap-ds-lg py-ds-5xl">
  <Spinner size="lg" />
  <p className="text-ds-body2-strong text-fg-default font-mulish">{label}</p>
  {sublabel && <p className="text-ds-body2 text-fg-subtle font-mulish">{sublabel}</p>}
</div>
```

- [ ] **Step 3: Revamp Angle Selection state**

- Product summary: `bg-surface-subtle border border-border-default rounded-ds-lg p-ds-lg` accordion
- Product count: `text-ds-body1-strong text-fg-default font-mulish`
- Angle cards: DS selection card pattern — `border-2 border-border-default rounded-ds-lg p-ds-lg`, active: `border-border-active bg-surface-subtle`
- Angle category: `<Tag variant="secondary">`
- Custom angle toggle: DS-styled checkbox with label
- Custom angle inputs: `<TextField>`, `<TextAreaField>`
- Buttons: `<Button variant="primary">`, `<Button variant="tertiary">`

Implement from Figma Screen 8.

- [ ] **Step 4: Revamp Review Draft state**

- Article title: `text-ds-heading1 font-mulish text-fg-default`
- HTML preview: `prose` wrapper with DS typography overrides (Mulish, fg-default)
- Action row: `<Button variant="secondary">` Copy HTML, `<Button variant="primary">` Approve, `<Button variant="tertiary">` Suggest Changes
- Feedback textarea: `<TextAreaField label="What would you like to change?">`
- Feedback actions: `<Button variant="primary" loading={isLoading}>`, `<Button variant="tertiary">`

Implement from Figma Screen 9.

- [ ] **Step 5: Revamp Thumbnail Prompt state**

- `<TextAreaField label="Image Prompt" hint="Review and edit if needed">`
- `<Button variant="primary" loading={isLoading}>` Generate
- `<Button variant="tertiary">` Skip

Implement from Figma Screen 10.

- [ ] **Step 6: Revamp Thumbnail Result state**

- Image preview: `rounded-ds-lg overflow-hidden` with 16:9 aspect ratio
- `<Button variant="secondary">` Download (green tint for positive action), `<Button variant="primary">` Regenerate, `<Button variant="tertiary">` Finish
- Feedback: `<TextAreaField>` + `<Button variant="primary" loading>`, `<Button variant="tertiary">`

Implement from Figma Screen 11.

- [ ] **Step 7: Revamp Done state**

- Success icon: `bg-surface-success` circle with check
- `text-ds-heading2 font-mulish text-fg-default`
- `<Button variant="secondary">` Copy HTML, `<Button variant="primary">` Download Thumbnail
- `<Button variant="tertiary" fullWidth>` Start New Article

Implement from Figma Screen 12.

- [ ] **Step 8: Error state**

Replace bespoke error card with:
```tsx
<Alert variant="negative" title="Error" message={errorMessage} action={
  <Button variant="secondary" size="sm" onClick={reset}>Start over</Button>
} />
```

- [ ] **Step 9: Build + visual check**

Run: `npm run build`
Open dev server, walk through entire Shopee Article flow, verify each state matches Figma.

---

## Task 9: Final Polish + Audit

**Files:** All modified files

- [ ] **Step 1: Search for any remaining hardcoded colors**

Run: `grep -rn "#[0-9a-fA-F]\{3,6\}\|bg-neutral-950\|bg-gray-\|text-gray-\|border-gray-" ui/src --include="*.tsx" --include="*.ts" --include="*.css"`

Fix any found instances to use DS tokens.

- [ ] **Step 2: Search for Inter font references**

Run: `grep -rn "Inter\|font-inter" ui/src`
Expected: 0 results

- [ ] **Step 3: Verify responsive mobile behavior**

- Sidebar mobile hamburger works
- FB Post form + preview stack correctly on mobile
- Shopee Article single-column on mobile

- [ ] **Step 4: Final build**

Run: `cd ui && npm run build && npm run lint`
Expected: 0 errors, 0 warnings

---

## Execution Order

1. Task 1 (tokens) → Task 2–4 (DS components) → Task 5 (Figma designs) → Task 6–8 (implement) → Task 9 (audit)
2. **Do not start Task 6+ without Task 5 Figma screens complete** — implementation must reference the Figma frames.
3. Each DS component (Tasks 2–4) can be built in parallel.
4. Tasks 6, 7, 8 must be sequential (Sidebar first, then FB Post, then Shopee Article).
