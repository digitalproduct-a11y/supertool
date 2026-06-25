# History Log Download — Design Spec

**Date:** 2026-06-25
**Status:** Approved

## Context

Editors use KULT Digital Kit to generate and schedule Facebook posts, but there is currently
**no central record** of who did what. Usage is only sent to Google Analytics (aggregate) and a
few per-device `localStorage` counters — nothing durable, queryable, or downloadable.

Goal: when an editor generates or schedules a post, **we** know about it — who, what, which brand,
when — and an authorized person can download that history as an Excel file for a chosen date range.

## Access model

- **Viewing** is open and **brand-scoped** — anyone on a brand's page sees that brand's history.
  Admins additionally get a brand picker (they already have the `isAdmin` brand-override).
- **Downloading:**
  - **Admins** download with **no passcode** (already privileged via `isAdmin`).
  - **Brand-level users** must enter a **single dedicated passcode** (`history101123!`).
- **Passcode storage:** lives **server-side in n8n only** (inside the fetch workflow), validated by
  the fetch webhook. NEVER a `VITE_` var — anything `VITE_`-prefixed ships in the browser bundle.

## Storage

Google Sheet via n8n — **no DB**. ~thousands of rows/month is well within Sheets' limits; n8n
filters fine; ops can eyeball the raw log. Mirrors the existing dashboard Sheet→n8n pattern. Upgrade
path if write volume explodes: an n8n Data Table (native filtering) — deferred.

## Events captured

`generated`, `scheduled`, `error`, `downloaded`. Edits are recorded as **which fields changed**
(`edited_fields`: caption/title/image) on the `scheduled` row — not as separate rows (avoids noise).

## Row schema (one row per event)

```
event_id        client uuid
server_time     n8n $now on ingest — AUTHORITATIVE for date-range filtering
client_time     ISO from browser
event_type      generated | scheduled | error | downloaded
user_email      MSAL account.username
user_name       MSAL account.name
brand           effectiveBrand (original case; matched case-insensitively)
tool_post_type  photo | carousel | quickfact | quote | cms | history_export
source_page     article_to_social | cms | history_log
article_url     source article (where applicable)
source_domain   extractDomain(article_url)
title           photoTitle / article title / quote text
caption         final caption text
image_url       cloudinary/image url
scheduled_for   ISO (schedule events)
edited_fields   comma-joined, e.g. "caption,image"
status          success | error
error_message   (error events)
```

## Architecture

Browser fires a fire-and-forget `logHistoryEvent()` (`fetch` + `keepalive`) on each tracked event →
n8n **ingest** workflow appends one Sheet row. A new **History** page (Others nav) reads brand rows
back for the in-page table (open, no passcode) and, on Download, calls the n8n **fetch** workflow
which validates the passcode (or trusts `is_admin`) and returns date-ranged rows; the client builds
the `.xlsx` with the existing SheetJS pattern.

- **New:** `services/historyLog.ts`, `pages/HistoryLogPage.tsx`, `components/HistoryPasscodeModal.tsx`,
  2 n8n workflows, 1 Google Sheet.
- **Modified:** `auth/msalConfig.ts` (+`main.tsx`) to export the MSAL singleton; `ArticleToSocialPage.tsx`
  and `postGeneration.ts`/`CmsPostPage.tsx` for event wiring; `Sidebar.tsx` + `App.tsx` for nav/routing.
- **Env:** `VITE_HISTORY_LOG_WEBHOOK_URL`, `VITE_HISTORY_FETCH_WEBHOOK_URL`.

## Reused patterns

- Excel build + download: `hooks/useAffiliateLinks.ts` (SheetJS + Blob/anchor).
- Passcode modal styling + `AUTH_ERROR` convention: `components/AdminPasscodeModal.tsx`,
  `postToFacebook` in `ArticleToSocialPage.tsx`.
- Identity: `instance.getActiveAccount()` (as in `Sidebar.tsx:165`), via exported singleton.
- Admin/brand state: `useBrand()` (`isAdmin`, `selectedBrand`).

## Out of scope (YAGNI)

Real DB / Supabase; per-keystroke edit history; server-side logging inside existing generate/schedule
workflows; a new test harness (repo has none — verify via build/lint/runtime/n8n test).
