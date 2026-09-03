# DLM Fashion Daily Scheduler

Cloudflare Worker Cron checks whether today's Korean-date briefing exists on `https://dlm-fashion-daily.pages.dev`.

If the site still shows an older latest date, the Worker triggers the GitHub Actions workflow through `workflow_dispatch`.

Required Cloudflare secret:

```bash
npx wrangler secret put GITHUB_WORKFLOW_TOKEN --config cloudflare-scheduler/wrangler.toml
```

Use a `doklipmungpt` GitHub token with permission to run workflows on `doklipmungpt/dlm-fashion-daily`.

Deploy:

```bash
npx wrangler deploy --config cloudflare-scheduler/wrangler.toml
```
