# Cloudinary → ImageKit Migration — Status Board

> **Purpose:** one-glance status for a fresh session. This is the *entry point*.
> - **Deep archive / decisions / n8n workflow IDs:** auto-memory `project_imagekit_migration.md`
> - **Detailed roadmap + numbered inventory (#1–#16):** `~/.claude/plans/hi-we-have-some-delightful-dijkstra.md`
>   (note: that file's *header* is stale — Election is done, CMS is kept-not-dropped; the numbered
>   inventory is still the reference).
>
> **Goal = FULL cutover**, not a permanent dual-run: end state is ImageKit-only, then delete
> `utils/cloudinary.ts`, the `VITE_IMAGE_PROVIDER` flag, all `VITE_CLOUDINARY_*`, and the Cloudinary account.
>
> _Last updated: 2026-07-21 · branch `imageKitMigration` · HEAD `999bd35`_

---

## ✅ Done

A2S (4 types) · sign webhook · CMS `/cms/post` · Election (#7) · standalone pages (deleted) ·
Trending News (#1) · shared photo-edit path (also fixed A2S edit/crop/custom-image) · Did You Know (#11) ·
Weather Malaysia (#3) · Weather Gegar (#4) · On This Day (#5)

_Food Places (#6) DROPPED (2026-07-21): frontend feature removed from the codebase
(FoodPlacesPage, features/foodplaces/, foodPlacesCanvasConfig, VITE_FOOD_PLACES_WEBHOOK_URL in
.env files). It was already unrouted/orphaned. n8n workflow `Po4YPX1Feiv05FPy` left AS-IS (not migrated, not touched)._

_Weather note (2026-07-21): deleted the dead grouped/individual path (`WeatherCanvas.tsx`,
`weatherCanvasConfig.ts`, `groupPostsByWeather`, `WeatherImageCard`, ModeToggle). Live render =
`WeatherSinglePostCanvas` + `GegarRegionPosterCanvas`. Left flagged: n8n `Weather Post`
(`QQxRMwnyyoJwDvs0`) still has the now-unreachable `Build Images` Cloudinary branch (harmless dead node)._

---

## 🟩 Remaining generation surfaces

### B2 — Client Fabric (upload base + logo/bg)

| #  | Feature                               | Wf ID                              | Effort   |
|----|---------------------------------------|------------------------------------|----------|
| 8  | Engagement (EPL/UCL/Badminton/MotoGP) | `HvnKJqk5LCI2lr4P`, `26i1eevFw5M6FQgU` | Med-High |
| 9  | Gempak Entertainment                  | `iNnNB8lFkC1ofpBI`, `RME9FR4RrDno3AP9` | Med      |
| 10 | Prime Talk                            | env → `webhook-test/…`             | Med      |

### B4 — Server-side image ops (n8n uploads to Cloudinary)

| #  | Feature                    | Wf ID              |
|----|----------------------------|--------------------|
| 14 | Image Enhance / Editor     | `vpFmn2spUxNQNSnl` |
| 15 | Affiliate thumbnail        | `qTnBl4W2WSz0YahR` |
| 16 | Social Affiliate thumbnail | `QHLCsSUihK9Do2JC` |

---

## 🟨 Cross-cutting sweeps (D–G)

- **Canvas logo hardcodes → `brandLogoUrl`:** GempakEntertainmentCanvas,
  QuickFactSlideCanvas, IdeaCard (Weather/Gegar/OnThisDay done ✅; FoodPlaces dropped)
- **Constants/assets:** `BRAND_LOGO_URLS` (`<img>` thumbnails), `SHARED_TEMPLATE_IMAGES`
  (EPL/UCL/Gempak) → migrate + repoint (weather bg configs done ✅ — deleted)
- **Presets (E):** all `VITE_CLOUDINARY_*` upload presets → ImageKit folders
- **Search (F):** "Search Cloudinary Photos by Tags" (`wucwc4YFdQWj2322`) → ImageKit media-search +
  migrate searchable library

---

## 🟥 Final cutover (H)

Set Vercel env vars → flip `VITE_IMAGE_PROVIDER=imagekit` (preview → prod) → delete `cloudinary.ts`
+ flag + Cloudinary account.

---

## ⚠️ Open flags

- **Vercel env vars not set** — nothing works on a deployed ImageKit build until then.
- Manual Election canvas click-through never done.
- `999bd35` (Did You Know) **not pushed yet**.

---

## Suggested next

Weather → On This Day → Food Places Fabric batch (shared pattern), **or** knock out the cheap
canvas logo-hardcode sweep first.
