# Sigillum CLI

Sigillum now exposes a real CLI surface for quoting and inspecting diffs through the existing API and payment flow.

## Commands

Inspect a diff file:

```bash
npm run sigillum -- inspect ./path/to/diff.patch
```

Inspect the current git diff:

```bash
npm run sigillum -- inspect --git-diff
```

Quote a diff file:

```bash
npm run sigillum -- quote ./path/to/diff.patch
```

Quote the current git diff:

```bash
npm run sigillum -- quote --git-diff
```

## Env setup

The CLI loads `.env.local` first, then `.env`.

Demo mode:

```env
SIGILLUM_PAYMENT_MODE=demo
SIGILLUM_BASE_URL=http://localhost:3000
```

x402 mode:

```env
SIGILLUM_PAYMENT_MODE=x402
X402_NETWORK=arcTestnet
X402_SELLER_ADDRESS=0x...
X402_API_BASE_URL=http://localhost:3000
X402_BUYER_PRIVATE_KEY=0x...
```

Optional x402 env vars:

- `X402_RPC_URL`
- `X402_FACILITATOR_URL`
- `X402_BUYER_AUTO_DEPOSIT_USDC`
- `SIGILLUM_BUYER_PRIVATE_KEY`
- `SIGILLUM_BUYER_CHAIN`
- `SIGILLUM_BUYER_RPC_URL`

## Demo mode example

```powershell
$env:SIGILLUM_PAYMENT_MODE="demo"
npm.cmd run sigillum -- inspect .\sample.patch
```

In demo mode, the CLI automatically follows the local demo payment confirmation path for `inspect`.

## x402 mode example

```powershell
$env:SIGILLUM_PAYMENT_MODE="x402"
$env:X402_SELLER_ADDRESS="0xYOUR_SELLER_ADDRESS"
$env:X402_NETWORK="arcTestnet"
$env:X402_API_BASE_URL="http://localhost:3000"
$env:X402_BUYER_PRIVATE_KEY="0xYOUR_BUYER_PRIVATE_KEY"
npm.cmd run sigillum -- inspect .\sample.patch
```

## Inspect a file

```bash
npm run sigillum -- inspect ./artifacts/sample.patch
```

## Inspect current git diff

```bash
npm run sigillum -- inspect --git-diff
```

If the current git diff is empty, the CLI exits with a clear error.

## Save a receipt

```bash
npm run sigillum -- inspect ./artifacts/sample.patch --save-receipt ./sigillum-receipt.json
```

## JSON output

```bash
npm run sigillum -- inspect ./artifacts/sample.patch --json
```

The JSON output includes:

- `quote`
- `payment`
- `receipt`
- `agent_decision`

## Quote examples

```bash
npm run sigillum -- quote ./artifacts/sample.patch
```

```bash
npm run sigillum -- quote --git-diff --json
```

## Exit codes

- `0`: `pass`, or `warn` when `--fail-on-warn` is not set
- `1`: `warn` when `--fail-on-warn` is set
- `2`: `block`
- `3`: infrastructure, config, input, or payment-flow error
