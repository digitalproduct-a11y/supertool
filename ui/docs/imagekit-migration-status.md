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
> _Last updated: 2026-07-22 · branch `imageKitMigration` · HEAD `5603d8e` (pushed)_

---

## ✅ Done

A2S (4 types) · sign webhook · CMS `/cms/post` · Election (#7) · standalone pages (deleted) ·
Trending News (#1) · shared photo-edit path (also fixed A2S edit/crop/custom-image) · Did You Know (#11) ·
Weather Malaysia (#3) · Weather Gegar (#4) · On This Day (#5) · **Engagement (#8 — CLOSED)** · Gempak Entertainment (#9)

_Engagement (#8) CLOSED 2026-07-22: photo bank (~225) on ImageKit (mirror + tag search + tagged upload);
all four sports (EPL/UCL/Badminton/MotoGP) render through one config-driven `EngagementPostCanvas`
(per-topic configs) with provider-aware `fo-auto` fill-crop; `BadmintonPostCanvas` + `canvasRenderingUtils`
retired. EPL + MotoGP visually verified. **Follow-ups (NOT migration — separate):** (a) Badminton
`fetch-ideas` returns empty because it keyword-filters general Astro sports RSS and finds no badminton
articles — needs dedicated badminton news sources + an empty-safe Respond (content/n8n work); (b) UCL
has no webhook env vars (dead until its n8n trending/generate workflows are wired); (c) PrimeTalk (#10)
still shares `IdeaCard` on the Cloudinary `buildPreviewUrl` path. **Cutover TODO:** add
`VITE_IMAGEKIT_SEARCH_WEBHOOK_URL` to Vercel + confirm `VITE_EPL_IDEA_GENERATION_WEBHOOK_URL` →
`generate-posts-staging`._

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
| 10 | Prime Talk                            | env → `webhook-test/…`             | Med      |

_Gempak Entertainment (#9) DONE 2026-07-22: kept its richer `GempakEntertainmentCanvas`; repointed
photo → `imageProvider.fitPhotoUrl` (provider-aware fo-face/g_face) + logo → `brandLogoUrl`; extracted
shared `fitPhotoUrl` (also used by `EngagementPostCanvas`). Entertainment photos celebrity-tagged →
default search finds them on ImageKit. "Malay Entertainment" display kept; internal id stays `gempak-entertainment`._

### B4 — Server-side image ops (n8n uploads to Cloudinary)

| #  | Feature                    | Wf ID              |
|----|----------------------------|--------------------|
| 14 | Image Enhance / Editor     | `vpFmn2spUxNQNSnl` |
| 15 | Affiliate thumbnail        | `qTnBl4W2WSz0YahR` |
| 16 | Social Affiliate thumbnail | `QHLCsSUihK9Do2JC` |

---

## 🟨 Cross-cutting sweeps (D–G)

- **Canvas logo hardcodes → `brandLogoUrl`:** QuickFactSlideCanvas, IdeaCard
  (Weather/Gegar/OnThisDay/Gempak done ✅; FoodPlaces dropped)
- **Constants/assets:** `BRAND_LOGO_URLS` (`<img>` thumbnails), `SHARED_TEMPLATE_IMAGES`
  (EPL/UCL/Gempak) → migrate + repoint (weather bg configs done ✅ — deleted)
- **Presets (E):** all `VITE_CLOUDINARY_*` upload presets → ImageKit folders
- **Search (F) — CUTOVER BLOCKER for Engagement:** the engagement photo picker is backed by a
  Cloudinary tag-searchable **photo bank** (~225 assets under `Engagement Photos/<Sport>`, each tagged
  `[player, club]`; EPL 111 · Badminton 33 · Entertainment 26 · UCL 16 · MotoGP 14). Path:
  search = n8n `wucwc4YFdQWj2322` (`/webhook/search-photos`, `VITE_CLOUDINARY_SEARCH_WEBHOOK_URL`) →
  returns `{public_id, secure_url}`; upload = `signedUpload` w/ per-sport presets → folder + tags.
  Kill Cloudinary without migrating this → picker empties + past photos 404.
  **Replication:** mirror assets → ImageKit `/engagement-photos/<sport>/` with tags preserved
  (upload-from-URL ✓, `tags IN [...]` search ✓), then re-point search + upload n8n to ImageKit.
  - **A1 DONE (2026-07-21): all 225 assets mirrored** to ImageKit `/engagement-photos/<sport>/`, tags
    preserved, tag-search validated (Arsenal→25, Badminton→33). Per-sport: epl 111 · badminton 33 ·
    entertainment 26 · ucl 16 · motogp 14 · misc 25. Cloudinary originals untouched (dual-run).
    Minor cleanups: (a) 2 pilot assets also live under capital `/engagement-photos/EPL/` (dupes of
    lowercase); (b) `misc` holds 25 non-sport assets that were under the Cloudinary `Engagement Photos`
    parent (Stock Exchange/Fuel Prices/Did You Know/Gold Rate/Prime Talk + a video) — untagged, harmless.
  - **A2 DONE:** cloned search → `[ImageKit] Search Photos by Tags` (`UR2t08nciB5MYDhD`,
    `/webhook/imagekit-search-photos`, active; `tags IN [...]` query, same response shape). Original
    Cloudinary search untouched. `bulkSearchPhotos` now flag-aware; `VITE_IMAGEKIT_SEARCH_WEBHOOK_URL`
    added to `.env.production`. Tested: Salah→20, Badminton→32.
  - **A3 DONE:** `PhotoPickerModal` uploads via `imageProvider.signedUpload({folder,tags})` (ImageKit
    when flag on).
  - **A4 DONE (verified):** the n8n AI-imagen write path (`HvnKJqk5LCI2lr4P`) is NOT invoked by the live
    UI (photos come only from picker search + user upload) → no re-point needed for cutover.
  - **Phase A (photo bank → ImageKit) COMPLETE.** When `VITE_IMAGE_PROVIDER=imagekit`, the picker
    searches + uploads to ImageKit.
  - **Phase B (EPL/UCL render → Fabric) COMPLETE (code; pending in-app visual QA).** New
    `EngagementPostCanvas` + `engagementCanvasConfig`; `IdeaCard` renders EPL/UCL via the canvas
    (gated by `useEngagementCanvas`, set for epl/ucl in `EngagementPhotosPage`), uploads the composed
    PNG via `imageProvider`. Cloudinary `buildPreviewUrl` retained ONLY for PrimeTalk (#10, shares
    `IdeaCard`). Badminton/MotoGP unchanged (dead; still on `BadmintonPostCanvas`). tsc + build clean.
  - **Phase B VISUAL QA PASSED (2026-07-22):** EPL renders end-to-end on ImageKit — preview + download
    match (player framed via `fo-auto` crop, gradient, headline/subtitle, brand logo). Fixes:
    `fittedPhotoUrl` (provider-aware fill-crop to 1080x1350) + forced preview `<canvas>` to 100%.
  - **Badminton/MotoGP:** now folded onto the shared `EngagementPostCanvas` (SPORT_CANVAS config);
    `BadmintonPostCanvas` + `canvasRenderingUtils` retired. Badminton webhooks wired (`/webhook/badminton-news/*`);
    Both Badminton + MotoGP webhooks wired. **Photos now ImageKit:** dropped the per-topic Cloudinary
    search override — badminton/motogp search the bank by fixed tag (`Badminton`/`MotoGP`) via the
    flag-aware ImageKit search (verified: MotoGP→photos under `/engagement-photos/motogp/`). The unused
    `photosWebhookEnvVar` config field remains but is no longer read.
  - **Local-env fixes made while testing (Vercel is source of truth):** `VITE_ENGAGEMENT_TRENDING_TOPICS_WEBHOOK_URL`
    = `/webhook/epl-engagement/fetch-ideas`; `VITE_EPL_IDEA_GENERATION_WEBHOOK_URL` corrected to
    `/webhook/epl-engagement/generate-posts-staging` (old `/webhook/engagement/generate` is dead).
  - **CUTOVER TODO:** add `VITE_IMAGEKIT_SEARCH_WEBHOOK_URL` to Vercel; confirm the EPL generate URL in
    Vercel points at `generate-posts-staging`.

---

## 🟥 Final cutover (H)

Set Vercel env vars → flip `VITE_IMAGE_PROVIDER=imagekit` (preview → prod) → delete `cloudinary.ts`
+ flag + Cloudinary account.

---

## ⚠️ Open flags

- **Vercel cutover env** — add `VITE_IMAGEKIT_SEARCH_WEBHOOK_URL`; confirm EPL generate URL →
  `generate-posts-staging`. Nothing on a deployed ImageKit build searches ImageKit until then.
- Manual Election canvas click-through never done.
- Branch pushed through `5603d8e`; **not deployed**.

---

## Suggested next

**#10 Prime Talk** (quick — route its `IdeaCard` usage to `EngagementPostCanvas`, removes the last
`buildPreviewUrl`/Cloudinary code from `IdeaCard`) → then **#9 Gempak**, **B4** thumbnails (#14/#15/#16),
the cross-cutting sweeps (`BRAND_LOGO_URLS`, presets, `/engagement-photos/misc` cleanup), and finally
the cutover (flip `VITE_IMAGE_PROVIDER` → delete `cloudinary.ts`).
