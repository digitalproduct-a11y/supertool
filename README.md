# supertool

A web app for generating and managing content across multiple platforms (Facebook, Shopee) using n8n workflows.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- The repository cloned locally

### Setup

1. **Install dependencies** (from `ui/` directory):
   ```bash
   cd ui
   npm install
   ```

2. **Set up environment files** — create `.env.production` and `.env.staging` with your webhook URLs.

## Local Development

### Production Environment
Runs against production n8n webhooks:
```bash
cd ui
npm run dev
```
Loads: `ui/.env.production`

### Staging Environment
Runs against staging n8n webhooks:
```bash
cd ui
npm run dev:staging
```
Loads: `ui/.env.staging`

## Building

### Production Build
```bash
cd ui
npm run build
```
Creates optimized bundle in `ui/dist/` using production env vars from `ui/.env.production`.

### Other Commands
- `npm run lint` — run ESLint checks
- `npm run preview` — preview production build locally

## Deployment

### To Staging
Push to the `staging` branch:
```bash
git checkout staging
git push origin staging
```
Vercel auto-deploys to: https://supertool-git-staging-digitalproduct-a11y.vercel.app

### To Production
Push to the `main` branch:
```bash
git checkout main
git push origin main
```
Vercel auto-deploys to your production domain.

## Environment Variables

Environment variables are defined in `.env.production` and `.env.staging`. **Never commit these files** — they contain webhook URLs and should be ignored by git.

### Key Variables
All variables are prefixed with `VITE_` and include:
- Webhook URLs for n8n workflows (article generator, trending spike, post publisher, etc.)
- Cloudinary credentials for image uploads
- Analytics and feedback webhook URLs

### Managing Env Vars in Vercel
For deployed environments (main and staging branches), env vars are set in the **Vercel dashboard** under Project Settings → Environment Variables, scoped per branch. Local `.env.*` files are for development only.

## Project Structure

- `ui/` — React frontend (Vite, TypeScript, Tailwind CSS)
  - `src/components/` — UI components
  - `src/hooks/` — Custom hooks for n8n workflow integration
  - `src/pages/` — Page components
- `ui/vercel.json` — SPA rewrite config for client-side routing