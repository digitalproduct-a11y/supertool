# Launch Staging Instructions

  ┌────────────┬─────────────┬───────────────────────────┐
  │            │ npm run dev │    npm run dev:staging    │
  ├────────────┼─────────────┼───────────────────────────┤
  │ Env loaded │ .env.local  │ .env.staging → .env.local │
  ├────────────┼─────────────┼───────────────────────────┤
  │ Webhooks   │ Production  │ Staging                   │
  └────────────┴─────────────┴───────────────────────────┘


## Local dev with staging webhooks
Create a .env.staging file (you already have it), then run:

cd super-tool/ui
cp .env.staging .env.local.staging
Vite doesn't auto-load .env.staging, so the easiest way is to temporarily swap your .env.local:
s
### Back up production env
cp .env.local .env.local.production

### Switch to staging
cp .env.staging .env.local

### Run dev
npm run dev

### When done, restore production
cp .env.local.production .env.local


## Use Vercel Preview URL
Since you already set up Vercel Preview env vars, just push any change to the staging branch and Vercel auto-deploys it with staging webhooks:

cd super-tool
git checkout staging

### make a trivial change if needed
git push origin staging
Vercel will give you a URL like:
https://supertool-git-staging-digitalproduct-a11y.vercel.app

Find it in Vercel dashboard → Deployments → filter by staging branch.

