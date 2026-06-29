# Sigillum Payment Modes

Sigillum keeps one inspect flow and swaps the payment rail behind `SIGILLUM_PAYMENT_MODE`.

For the local buyer harness and CLI usage, see [docs/cli.md](./cli.md).
For server-owned automation, see [docs/sigillum-automation.md](./sigillum-automation.md).

## Demo mode

`SIGILLUM_PAYMENT_MODE=demo` is the default.

- `POST /api/inspect` returns HTTP `402`
- internal/local development can still confirm the payment path without live settlement
- keep demo fallback off the public product surface

## x402 mode

`SIGILLUM_PAYMENT_MODE=x402` turns `/api/inspect` into a real seller-side x402 endpoint.

- the first request returns HTTP `402 Payment Required`
- the response includes a standard `PAYMENT-REQUIRED` header
- a buyer signs the payment off-chain and retries with `PAYMENT-SIGNATURE`
- Sigillum verifies and settles through the Circle Gateway facilitator before inspection runs
- success responses include `PAYMENT-RESPONSE`, the receipt, the agent decision, and persisted action-ledger records
- live `quote` and `inspect` requests should send the `code_change` action envelope plus the persisted `action_id` / `quote_id` references

## Local buyer harness

Use the local harness to prove the real payment flow without moving keys into the browser:

```bash
npm run x402:buyer
```

Required buyer env vars:

- `X402_BUYER_PRIVATE_KEY`
- `X402_API_BASE_URL`

Optional buyer env vars:

- `X402_BUYER_ADDRESS`
- `X402_BUYER_AUTO_DEPOSIT_USDC`
- the local harness also accepts the older `SIGILLUM_BASE_URL`, `SIGILLUM_BUYER_PRIVATE_KEY`, `SIGILLUM_BUYER_CHAIN`, and `SIGILLUM_BUYER_RPC_URL` aliases

Seller-side env placeholders:

- `X402_NETWORK=arcTestnet`
- `X402_SELLER_ADDRESS`
- `X402_FACILITATOR_URL`
- `X402_RPC_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

Never expose buyer or seller private keys in frontend code.
Never expose the Supabase service-role key in frontend code.

## Payment provenance

Sigillum keeps payment proof and explorer provenance separate:

- `payment_reference` is the required proof that the x402 payment settled through the gateway path
- `transaction_hash` is optional and should only be populated when Sigillum has a real Arc `0x...` hash

Public surfaces should always show the `payment_reference`.
Arcscan links should render only when `transaction_hash` is a real onchain hash.

If no onchain hash is exposed yet, show:

`Gateway payment reference confirmed; explorer transaction hash not exposed.`
