# Sigillum Automation

Sigillum's first autonomous paid loop is server-owned.

- Production scheduler: Vercel Cron
- Production entrypoint: `GET /api/agent-loop`
- Manual/operator entrypoint: `POST /api/agent-loop`
- Deferred fallback: Hermes, documented only for later

## Product loop

Each enabled agent follows the same persisted flow:

1. `action_submitted`
2. `quote_created`
3. `payment_required`
4. `payment_confirmed`
5. `inspection_running`
6. `receipt_generated`
7. `agent_decision_created`

The public dashboard reads only persisted rows and action events from the live ledger. It does not generate synthetic activity.

## Enabled agents

One Vercel cron tick evaluates all three agents in sequence:

- `CodeChangeAgent`
- `DependencyInstallAgent`
- `DeployActionAgent`

Each agent uses the real quote -> HTTP 402 -> x402 payment -> inspect -> receipt -> decision path through the existing Sigillum API. No automation path writes directly to the database.

For the first production bring-up, keep only `CodeChangeAgent` enabled until one automated paid run is proven on the live ledger and visible on `/dashboard`.

## Vercel Cron

`vercel.json` is the production scheduler source:

```json
{
  "crons": [
    {
      "path": "/api/agent-loop",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This phase assumes a five-minute production cadence.

## Route authentication

`/api/agent-loop` is server-only and requires an authorization header.

- Vercel Cron: `Authorization: Bearer ${CRON_SECRET}`
- Optional manual trigger: `Authorization: Bearer ${SIGILLUM_AUTOMATION_SHARED_SECRET}`

If `SIGILLUM_AUTOMATION_ENABLED` is not `true`, the route returns `503`.

## Required server env

Core live env:

- `SIGILLUM_PAYMENT_MODE=x402`
- `X402_NETWORK=arcTestnet`
- `X402_SELLER_ADDRESS`
- `X402_FACILITATOR_URL`
- `X402_RPC_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

Automation env:

- `CRON_SECRET`
- `SIGILLUM_AUTOMATION_ENABLED=true`
- `SIGILLUM_AUTOMATION_SHARED_SECRET`
- `SIGILLUM_AUTOMATION_DAILY_CAP_USDC`
- `SIGILLUM_AUTOMATION_DEFAULT_INTERVAL_MS`

Per-agent flags:

- `SIGILLUM_AUTOMATION_ENABLE_CODE_CHANGE_AGENT`
- `SIGILLUM_AUTOMATION_ENABLE_DEPENDENCY_INSTALL_AGENT`
- `SIGILLUM_AUTOMATION_ENABLE_DEPLOY_ACTION_AGENT`

Recommended first production values:

- `SIGILLUM_AUTOMATION_ENABLE_CODE_CHANGE_AGENT=true`
- `SIGILLUM_AUTOMATION_ENABLE_DEPENDENCY_INSTALL_AGENT=false`
- `SIGILLUM_AUTOMATION_ENABLE_DEPLOY_ACTION_AGENT=false`

Buyer/payment env for the paid path:

- `X402_BUYER_PRIVATE_KEY`
- `X402_API_BASE_URL`

Keep buyer keys, seller keys, and the Supabase service-role key server-side only.

## Spend safety

The server automation layer enforces:

- per-agent enable flags
- per-agent interval gating
- per-agent or global daily caps
- stable tick-scoped idempotency keys

This means a cron tick can skip an agent cleanly instead of forcing spend.

The built-in automation defaults are intentionally conservative for production bring-up:

- `CodeChangeAgent` defaults to enabled when automation is on
- `DependencyInstallAgent` defaults to disabled until explicitly enabled
- `DeployActionAgent` defaults to disabled until explicitly enabled

## Payment proof

Sigillum keeps payment proof fields separate:

- `payment_reference`: required payment proof
- `transaction_hash`: optional onchain Arc hash

The dashboard and receipt surfaces must always show `payment_reference`.
Arcscan links render only when `transaction_hash` is a real `0x...` hash.

If no onchain hash is exposed, show:

`Gateway payment reference confirmed; explorer transaction hash not exposed.`

## Local verification

Start the app with live env, then trigger the route manually:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3000/api/agent-loop `
  -Method GET `
  -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

Expected behavior:

- the route returns per-agent `completed` or `skipped` results
- the live ledger records lifecycle stages for any real run
- `/dashboard` updates from persisted truth only

## Production bring-up checklist

1. Deploy the current `vercel.json` production build.
2. Confirm Vercel production env includes:
   - `CRON_SECRET`
   - `SIGILLUM_AUTOMATION_ENABLED=true`
   - `SIGILLUM_AUTOMATION_ENABLE_CODE_CHANGE_AGENT=true`
   - `SIGILLUM_AUTOMATION_ENABLE_DEPENDENCY_INSTALL_AGENT=false`
   - `SIGILLUM_AUTOMATION_ENABLE_DEPLOY_ACTION_AGENT=false`
   - the existing x402 buyer, seller, RPC, Supabase, and Postgres envs
3. Manually hit `GET /api/agent-loop` with `Authorization: Bearer ${CRON_SECRET}` once to verify auth and logs before waiting for cron.
4. Confirm one paid `CodeChangeAgent` run persists:
   - `action_submitted`
   - `quote_created`
   - `payment_required`
   - `payment_confirmed`
   - `inspection_running`
   - `receipt_generated`
   - `agent_decision_created`
5. Refresh `/dashboard` and confirm the action appears from persisted rows only.
6. Expand the other two agents only after the first production loop is proven.

## Hermes

Hermes stays out of the runtime in this phase.

If Vercel Cron later proves insufficient, Hermes can be introduced as a scheduler fallback, but it should call the same authenticated `/api/agent-loop` contract rather than introducing a second automation implementation.
