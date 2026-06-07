# Deploying fedshield-docs

Two paths. Either lands the site at a free `*.pages.dev` URL with automatic builds on every `git push`.

## Option A — Cloudflare Pages dashboard (recommended, one-time)

This is the standard path. After the one-time setup, every `git push` to `main` triggers a build and deploy automatically.

1. Go to <https://dash.cloudflare.com/?to=/:account/pages>
2. Click **Create application** → **Pages** → **Connect to Git**
3. Authorise Cloudflare to read your GitHub account, then select **JamilEssifiDEV/fedshield-docs**
4. On the build configuration screen:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** _leave blank_
   - **Environment variables:** _none needed_
5. Click **Save and Deploy**

First build takes ~2 minutes. After it succeeds, the site is live at `https://fedshield-docs.pages.dev`.

## Option B — Wrangler CLI (one-shot deploy, no GitHub integration)

Useful if you want to deploy without granting Cloudflare access to your GitHub. You'll have to re-run the deploy manually for every update though.

```sh
# One-time authentication. Opens a browser tab for OAuth.
npx wrangler login

# Build, then deploy the dist/ directory.
npm run build
npx wrangler pages deploy dist --project-name=fedshield-docs
```

The first run creates a new Pages project. Subsequent runs deploy a new version to the same URL.

## Custom domain (later, optional)

Once the `*.pages.dev` URL is live and you want `docs.fedshield.dev` (or similar):

1. Buy the domain (Cloudflare Registrar, Porkbun, or wherever).
2. In the Cloudflare Pages project → **Custom domains** → **Set up a custom domain**.
3. Add `docs.fedshield.dev`.
4. Cloudflare handles the DNS and TLS automatically if the domain is on Cloudflare DNS.

## Auto-sync the OpenAPI spec from federation-core

The `public/openapi.yaml` is a manual copy from the federation-core repo today. A future improvement is a GitHub Action in fedshield-docs that fetches the latest spec on every build, so updates to the API land here without a manual `cp`. See README.md for the current sync command.
