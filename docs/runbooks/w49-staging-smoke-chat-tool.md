# W49 Staging Smoke — Chat Tool Runbook

> **Purpose**: weekly automated check that the customer chat tool-calling
> pipeline (ADR-012) and the admin dashboard widget are alive in staging.
> Drives the W49 leadership KPI process — see
> [W49 brief](../briefs/2026-05-W49-leadership-sync.md).
>
> **Workflow**: [`.github/workflows/staging-smoke.yml`](../../.github/workflows/staging-smoke.yml)
> **Smoke script**: [`scripts/staging/smoke-chat-tool.ts`](../../scripts/staging/smoke-chat-tool.ts)

---

## Schedule

| Trigger                    | Cadence                                                    | Notes                                                                     |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- | ------ | ------- |
| `schedule: cron 0 1 * * 1` | Mondays 01:00 UTC = 09:00 Asia/Shanghai = 10:00 Asia/Tokyo | GitHub may drift up to ~30 min on busy hours; acceptable for canary check |
| `workflow_dispatch`        | Manual                                                     | Inputs: `brand` (`homtone                                                 | spoonlemon | davivy | tysun`) |

Concurrency is per-brand and **never cancels in-flight runs** (`cancel-in-progress: false`) — a manual trigger that overlaps with the cron will queue.

---

## One-time setup (do this before the first Monday cron)

### Required GitHub secrets

| Secret                | Purpose                                       | Source                                                       |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| `STAGING_API_BASE`    | Smoke target API base URL (no trailing slash) | e.g. `https://staging-api.yaemartos.com`                     |
| `STAGING_ADMIN_TOKEN` | Admin JWT with `metrics:read:*` Casbin policy | Mint from staging admin auth flow; rotate at least quarterly |

### Optional GitHub secrets

| Secret                     | Purpose                                      | Default behaviour without it                                                                                      |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `STAGING_CUSTOMER_TOKEN`   | Customer JWT (aud=`customer`, brand matches) | Smoke runs anonymous path; tools still bump invocation_count + error_count (`requireCustomer` returns `ok:false`) |
| `STAGING_DASHBOARD_URL`    | Admin dashboard URL to SSR-check             | Soft-warning only; no SSR assertion                                                                               |
| `STAGING_DASHBOARD_COOKIE` | NextAuth session cookie for dashboard SSR    | Same as above (must be paired with URL)                                                                           |
| `SLACK_WEBHOOK_URL`        | Incoming webhook for failure notifications   | Workflow still fails; just no Slack ping                                                                          |

### Create secrets

```bash
gh secret set STAGING_API_BASE      --body 'https://staging-api.yaemartos.com'
gh secret set STAGING_ADMIN_TOKEN   < ./.staging-admin-jwt
gh secret set STAGING_CUSTOMER_TOKEN < ./.staging-customer-jwt
gh secret set STAGING_DASHBOARD_URL --body 'https://staging.yaemartos.com/zh-CN/dashboard'
gh secret set STAGING_DASHBOARD_COOKIE < ./.staging-admin-cookie
gh secret set SLACK_WEBHOOK_URL     --body 'https://hooks.slack.com/services/...'
```

---

## What the smoke checks

| #   | Step                                                              | Hard / Soft            | Failure means                                                |
| --- | ----------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------ |
| 1   | Read 3 KPI metrics baseline (`/metrics?name=…`)                   | Hard                   | Admin token bad, or `metrics:read:*` policy not granted      |
| 2   | `POST /customer/chat/sessions`                                    | Hard                   | Tenant header / chat feature flag / portal_chat off          |
| 3   | Drain SSE `/customer/chat/sessions/:id/stream` until `done`       | Soft                   | Ingress / model unavailable; doesn't fail run by itself      |
| 4   | `POST /customer/chat/sessions/:id/messages` (tool-trigger prompt) | Hard                   | Throttle / chat handler crash                                |
| 5   | Sleep 3s, re-read 3 KPI metrics                                   | Hard (post-fetch)      | Same as #1                                                   |
| 6   | `chat.session.with_tools_count` Δ ≥ 1                             | **Hard**               | `AGENT_NATIVE_TOOL_CALLING.<brand>` flag is OFF              |
| 7   | `chat.tool.invocation_count` Δ ≥ 1                                | **Soft**               | LLM didn't choose to call a tool — adjust prompt or escalate |
| 8   | Dashboard SSR contains "客服 Chat Tool 活动"                      | Hard (when configured) | Dashboard widget broke / route 5xx                           |

---

## Failure triage

When the workflow fails, you get:

1. **Slack message** (if `SLACK_WEBHOOK_URL` is set) with brand, exit code, parsed hard failures, metric deltas, soft warnings, and a link to the run.
2. **GitHub Actions artifact** named `chat-tool-smoke-<brand>-<run_id>`, retained 90 days, containing:
   - `smoke-output.json` — full structured `SmokeReport`
   - `docs/reports/staging-smoke/*.json` — pretty-formatted copy

### Common root causes and fixes

| Symptom                                              | Likely cause                                   | Fix                                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `chat.session.with_tools_count` Δ = 0                | feature flag off                               | `UPDATE feature_flag SET value='true' WHERE key='AGENT_NATIVE_TOOL_CALLING.<brand>';` then re-run via `workflow_dispatch` |
| Exit code 2 — "Missing required env var"             | Required secret unset / rotated out            | Re-set via `gh secret set ...`                                                                                            |
| HTTP 401 on `/metrics`                               | Admin token expired                            | Mint a fresh admin JWT (longer TTL recommended for the smoke service account)                                             |
| HTTP 403 on `/metrics`                               | Casbin `metrics:read:*` not granted            | Update Casbin policy for the smoke service account role                                                                   |
| HTTP 400 "Missing or invalid x-yaemart-brand header" | Brand not in `VALID_TENANTS`                   | Check `STAGING_BRAND` is one of the 4 brand schemas                                                                       |
| Soft warning: invocation_count Δ = 0                 | LLM ignored the tool-trigger prompt            | Tweak `TOOL_TRIGGER_PROMPT` in `smoke-chat-tool.ts`, or accept noise (it's a soft signal)                                 |
| Dashboard SSR missing marker                         | Server component crash; Next.js page fell back | Check `apps/web/app/[locale]/(admin)/dashboard/page.tsx` & widget render                                                  |

---

## Disabling

To pause the cron without deleting the workflow:

1. Edit `.github/workflows/staging-smoke.yml` and comment out the `schedule:` block (commit + push), OR
2. Disable the workflow from **GitHub UI → Actions → Staging Smoke — Chat Tool → ⋯ → Disable workflow**

Either path leaves `workflow_dispatch` available for manual smoke runs.

---

## Local equivalent

Same env vars, same exit codes; useful for staging credential rotation:

```bash
STAGING_API_BASE=https://staging-api.yaemartos.com \
STAGING_BRAND=homtone \
STAGING_ADMIN_TOKEN=$(cat ./.staging-admin-jwt) \
STAGING_CUSTOMER_TOKEN=$(cat ./.staging-customer-jwt) \
STAGING_DASHBOARD_URL=https://staging.yaemartos.com/zh-CN/dashboard \
STAGING_DASHBOARD_COOKIE=$(cat ./.staging-admin-cookie) \
  pnpm smoke:chat-tool
```

---

_Owner: agent-native team · Created: 2026-W48 末 · Source of truth for cron behaviour: `.github/workflows/staging-smoke.yml`_
