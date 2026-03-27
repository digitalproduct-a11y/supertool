# Product: KULT Digital Kit

## One-Line Description
An internal AI-powered toolkit that helps Astro's digital content editors turn articles, trending news, and Shopee products into publish-ready Facebook posts and affiliate content — in seconds.

## Problem
Astro's digital editors spend too much time on repetitive content creation tasks: writing FB captions, designing social images, and building affiliate articles from product links. KULT Digital Kit automates all of this so editors can focus on editorial judgment, not grunt work.

## Target Audience
Astro's internal digital content editors and social media managers — people managing content across ~30 brands (Astro Awani, Era, Hitz, Gempak, Nona, Rasa, Stadium Astro, Melody, Remaja, Rojak Daily, etc.). They're under deadline pressure and need tools that are fast, reliable, and require zero technical knowledge.

## Core Features
- **Article to FB Photos** — Paste an article URL, pick a brand, get a branded Facebook image + caption. Supports custom titles, partial regen (image only or caption only), and draft posting.
- **Trending News to FB Photos** — Monitors a spike inbox (Chartbeat spike alerts) and lets editors bulk-generate branded FB posts for trending articles.
- **Shopee Affiliate Links** — Upload an Excel file of Shopee URLs, get back an affiliate-tagged file with product data auto-filled.
- **Affiliate Article Editor** — Multi-step flow: input Shopee links → AI suggests editorial angles → generates a full brand-voiced article with affiliate links woven in → generates a thumbnail.
- **Coming soon**: Engagement Photos, Photo Carousels, Brand Health Check, Idea Agent.

## Tech Stack / Platform
- React 19 + TypeScript, built with Vite
- Tailwind CSS for styling
- Fully client-side SPA — no backend server
- All AI processing runs through n8n cloud workflows (Astro's instance at `astroproduct.app.n8n.cloud`)
- Browser calls n8n webhooks directly via POST requests
- Brand auto-detection from article URLs (e.g. `astroawani.com` → Astro Awani)

## Differentiation
Built specifically for Astro's brand ecosystem — it knows all 30+ Astro brands, their voice profiles, and their domains. It's not a generic AI tool; every output is brand-aware and publish-ready without manual formatting. The spike inbox integration means editors can react to trending content the moment Chartbeat flags it.

## Tone & Brand
Casual, friendly, and direct — like talking to a teammate. Keep it practical and skip the fluff.

## Additional Context
- Internal tool only — not public-facing
- Feedback goes to `digitalproduct@astro.com.my`
- Usage stats tracked per-brand in localStorage (daily streak, posts generated today)
- The spike inbox is fed by Chartbeat spike alert emails received at `product.astro.my@gmail.com`
- Each tool maps to one or more n8n workflows triggered via webhook env vars (`VITE_WEBHOOK_URL`, `VITE_AFFILIATE_WEBHOOK_URL`, etc.)
