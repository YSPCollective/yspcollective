# YSP Collective — Deployment Issue Log

## April 2026 — Cloudflare Deployment Broken After GA4 Session

### What Happened
During a session adding GA4 tracking code, the site's Cloudflare deployment pipeline broke. The root cause was a mismatch between the `wrangler.toml` file in the repo and the Cloudflare Worker configuration in the dashboard.

The `yspcollective` Worker (which serves the frontend static site) and the `ysp-ai-proxy` Worker (which handles the backend API) were both configured via a single `wrangler.toml` file named `ysp-ai-proxy`. When Cloudflare attempted to auto-sync the Worker name, it created bot PRs on GitHub that conflicted with the repo, and subsequent deploys failed because the toml pointed to the wrong Worker.

Additionally, the `admin/config.yml` CMS config had the `Product Name` field accidentally deleted from the fragrances collection, causing the CMS to generate filenames from content fields instead.

### Symptoms
- New pushes to GitHub not deploying to the live site
- CMS admin showing stale config (old `admin/config.yml` being served)
- Product Name field missing from CMS fragrance form
- Deploy command errors: "Project not found", "Authentication error", "Entry-point file not found"
- Two open bot PRs on GitHub from `cloudflare-workers-and-pages[bot]`

### How It Was Fixed

#### 1. Merged the Cloudflare bot PR
Go to GitHub → Pull Requests → find the open PR from `cloudflare-workers-and-pages[bot]`. There will be a merge conflict in `wrangler.toml`. Resolve it by keeping `name = "ysp-ai-proxy"` and adding `main = "worker.js"`. Mark as resolved and commit merge.

#### 2. Split into two wrangler files
The single `wrangler.toml` was split into two separate files:

**`wrangler.toml`** — for the `yspcollective` frontend Worker:
```toml
name = "yspcollective"
compatibility_date = "2024-01-01"

[assets]
directory = "_site"
not_found_handling = "single-page-application"
```

**`wrangler-api.toml`** — for the `ysp-ai-proxy` backend Worker:
```toml
name = "ysp-ai-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"
[[kv_namespaces]]
binding = "YSP_USERS"
id = "940cf71cfdee47509f8e5e765b3cc158"
```

#### 3. Updated the Cloudflare API token
Go to `dash.cloudflare.com/profile/api-tokens` → find `yspcollective build token` → Edit → add **Cloudflare Pages — Edit** permission → Save.

#### 4. Updated the deploy command in Cloudflare
Go to Cloudflare → `yspcollective` Worker → Settings → Build → set:
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy --config wrangler.toml`

#### 5. Restored the CMS Product Name field
The `name` field was missing from the fragrances collection in `admin/config.yml`. Added it back as the first field:
```yaml
- { label: "Product Name", name: "name", widget: "string", hint: "e.g. Lattafa Yara 100ml" }
```

### Architecture Notes
- **`yspcollective` Worker** — serves the Eleventy static site from `_site/`. Configured via `wrangler.toml`. Build: `npm run build`. Deploy: `npx wrangler deploy --config wrangler.toml`.
- **`ysp-ai-proxy` Worker** — handles AI chat, Stripe payments, auth, email. Configured via `wrangler-api.toml`. Deployed separately from the Cloudflare dashboard.
- **Decap CMS** — reads `admin/config.yml` directly from GitHub via the GitHub API. Not served by the Worker. Changes take effect on next build/deploy.

### If This Happens Again
1. Check the `yspcollective` Worker → Deployments tab for the last successful deployment and its build log
2. Check for open PRs from `cloudflare-workers-and-pages[bot]` on GitHub and close/resolve them
3. Verify `wrangler.toml` in repo root has `name = "yspcollective"` and `[assets] directory = "_site"`
4. Check the deploy command in Cloudflare Worker build settings matches `npx wrangler deploy --config wrangler.toml`
5. Do NOT use `npx wrangler pages deploy` — this is for Pages projects, not Workers
6. Do NOT use `npx wrangler deploy` without `--config wrangler.toml` — it will deploy the wrong Worker
7. If the live site breaks, rollback via Cloudflare → `yspcollective` Worker → Deployments → three dots → Rollback on the last working deployment
