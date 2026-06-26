# Sigillum Payment Adapter

Sigillum uses a small payment adapter so the app can run in two modes without changing the inspect flow.

`SIGILLUM_PAYMENT_MODE=demo` is the default. In demo mode, `/api/inspect` returns HTTP 402 until the client confirms payment, then the route generates the receipt and agent decision locally.

`SIGILLUM_PAYMENT_MODE=x402` switches the adapter seam to the future Arc / x402 path. If the expected env vars are missing, `/api/inspect` returns a clear not-configured 402 response instead of pretending payment was verified.

Placeholder env vars for the future integration:

- `X402_SELLER_WALLET_ADDRESS`
- `X402_NETWORK=arc`
- `CIRCLE_GATEWAY_API_KEY`

The real verification call should be added inside `src/lib/sigillum/payment/index.ts` once the repo has the required SDKs and docs to support it safely.

