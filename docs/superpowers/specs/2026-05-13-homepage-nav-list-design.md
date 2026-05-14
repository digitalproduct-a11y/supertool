# Homepage Navigation List — Design Spec

**Date:** 2026-05-13  
**Scope:** `HomePage.tsx` — left column quick-links card  
**Status:** Approved

---

## Problem

The current two-section card (Article to Social Post + Engagement Posts) has three UX issues:
- Sections don't feel visually distinct from each other
- "Article to Social Post" row is too plain — no clear tap affordance
- Engagement Post chip buttons are hard to scan and feel low-weight

---

## Solution

Replace the chip-based layout with a **navigation list** style: each item is a full-width tappable row with an image, title, and arrow. This is a familiar mobile pattern that clearly communicates "tap to go somewhere."

---

## Layout

One white card (`bg-white rounded-2xl shadow`), two sections separated by a divider.

### Section 1 — Article to Social Post

Single row:

```
[ 56×56 image ] Article to Social Post          →
```

### Section 2 — Engagement Posts

Section label header (`ENGAGEMENT POSTS`), then sub-group headers with rows beneath each:

```
ENGAGEMENT POSTS

Fun Fact
[ 56×56 image ] Did You Know?                   →

─────────────────────────────────────────────────

Sports
[ 56×56 image ] EPL                             →
[ 56×56 image ] Champions League                →
[ 56×56 image ] Badminton                       →
[ 56×56 image ] MotoGP                          →

─────────────────────────────────────────────────

Information
[ 56×56 image ] KLCI Index                      →
[ 56×56 image ] Currency Rate                   →
[ 56×56 image ] Fuel Price                      →
[ 56×56 image ] On This Day                     →
[ 56×56 image ] Weather Malaysia                →
```

---

## Row Anatomy

| Element | Spec |
|---|---|
| Image | 56×56px, `rounded-lg`, `object-cover`, `bg-neutral-100` fallback |
| Title | 14px semibold, `text-neutral-900` |
| Arrow | Chevron right icon, `text-neutral-300`, right-aligned |
| Row height | `py-3` padding, full width |
| Hover state | `hover:bg-neutral-50` |
| Active state | `active:bg-neutral-100` |

---

## Image Handling

Each entry in `ENGAGEMENT_GROUPS` gets an optional `image` field:

```ts
{ label: 'EPL', path: '/engagement-posts/epl', image: '/images/epl.png' }
```

Until images are provided, the placeholder renders as a `56×56 bg-neutral-100 rounded-lg` grey box. When `image` is set, it renders as `<img src={image} />`.

The Article to Social entry also gets an `image` prop passed directly in JSX.

---

## File Changes

- `src/pages/HomePage.tsx` — replace chip layout with nav-list rows
- `ENGAGEMENT_GROUPS` constant — add optional `image` field to each link entry

---

## Out of Scope

- Actual image assets (user will provide)
- Changes to any page other than `HomePage.tsx`
- Changes to routing or page components behind the links
