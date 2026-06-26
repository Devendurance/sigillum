# Sigillum Product Flow And UX

This document turns the product flow guidance into a build-ready UX specification for Sigillum.

## Verdict On The Proposed Flow

The GPT-generated flow is directionally good, but it is still too much like a deck flow and not yet precise enough for a working product.

It is not lies. The core flow is correct:

```text
diff -> quote -> 402 -> payment -> inspection -> receipt -> agent action
```

But it has two weak spots:

- It assumes the payment moment is easy without specifying how the agent/human demo handles wallet/payment state.
- It says “agent acts” but does not define the actual action contract clearly enough.

For Sigillum to feel real, every UX screen must map to an actual API state and actual product object.

## Product Flow Principle

The product should have two parallel flows:

1. Human demo flow

A judge or developer can paste/use a sample diff and watch the full Sigillum flow.

2. Agent API flow

A coding agent can call endpoints and receive structured responses.

Both flows must produce the same final object: `Sigillum Receipt`.

## Working MVP Flow

## Step 1: Choose Diff

The user lands on the demo.

Options:

- `Use risky sample diff`
- `Paste your own diff`
- `Upload patch file`

For the hackathon, the default should be `Use risky sample diff`.

The sample diff should include:

- `package.json` dependency addition
- `.env.example` suspicious key
- config mutation
- JS/TS code change with dangerous API usage
- user-facing typo/copy string

This lets the product show all key checks without needing huge scope.

UX objective:

- Make the starting point obvious.
- Let judges run the product without needing their own repo.
- Ensure the sample diff demonstrates secrets, dependencies, config, dangerous APIs, and copy issues.

## Step 2: Preflight Quote

The user clicks `Request Quote`.

Actual API:

```http
POST /quote
```

Example response:

```json
{
  "quote_id": "quote_01J...",
  "currency": "USDC",
  "amount": "0.000043",
  "inspected_units": {
    "changed_lines": 74,
    "ast_nodes": 312,
    "dependency_changes": 2,
    "config_mutations": 1,
    "strings": 42
  },
  "expires_at": "2026-06-25T00:05:00Z"
}
```

UX should show:

- inspected units
- exact price
- why the price exists
- CTA: `Continue to x402 payment`

This is important because pricing must feel computed, not fake.

Recommended screen copy:

```text
Quote ready

Sigillum inspected the changed surface area and priced this verification before running the risk check.

Changed lines: 74
AST nodes: 312
Dependency changes: 2
Config mutations: 1
Strings: 42

Total verification price: 0.000043 USDC
```

Primary CTA:

```text
Continue to x402 payment
```

## Step 3: 402 Payment Gate

This screen is essential.

Do not hide it.

Show:

```http
HTTP 402 Payment Required
```

With:

- `Verification price: 0.000043 USDC`
- `Reason: 431 inspected units`
- `Network: Arc`
- `Payment: x402`
- `Expires in: 5:00`

CTA states:

- Human demo: `Simulate/Complete Payment`
- Agent demo: `Agent pays with wallet`

If real x402 is integrated, use real payment. If not fully available during local development, label simulation clearly for local demo mode. The final submitted build should have the real flow where possible.

Recommended screen copy:

```text
HTTP 402 Payment Required

Sigillum requires payment before inspection.

Verification price: 0.000043 USDC
Reason: 431 inspected units
Network: Arc
Payment rail: x402
Quote expires in: 5:00
```

Primary CTA for demo mode:

```text
Agent pays with wallet
```

Secondary state label for local testing only:

```text
Local demo payment simulation
```

## Step 4: Payment Confirmation

Show a short transaction state:

- `Payment requested`
- `Payment sent`
- `Payment confirmed`
- `Inspection unlocked`

This makes Arc/x402 visible.

The payment should unlock `/inspect`.

Actual API:

```http
POST /inspect
```

Recommended payment state copy:

```text
Payment requested
Payment sent
Payment confirmed
Inspection unlocked
```

UX objective:

- Make the payment feel like part of the product, not hidden plumbing.
- Show that x402 is required to unlock the inspection.
- Reinforce that the user is paying for proof, not a subscription.

## Step 5: Inspection Run

Do not make this look like an AI chatbot.

Make it look like an inspection pipeline:

- `Parsing diff`
- `Counting AST nodes`
- `Checking dependency changes`
- `Scanning config mutations`
- `Checking secrets`
- `Detecting dangerous APIs`
- `Checking prompt surfaces`
- `Generating receipt`

This avoids “AI wrapper” vibes.

Recommended inspection state copy:

```text
Parsing diff
Counting AST nodes
Checking dependency changes
Scanning config mutations
Checking secrets
Detecting dangerous APIs
Checking prompt surfaces
Generating Sigillum Receipt
```

UX objective:

- Emphasize deterministic inspection.
- Avoid generic “AI is thinking” language.
- Show exactly what the product checks.

## Step 6: Sigillum Receipt

This is the main product.

The receipt should have two modes:

- `Human Summary`
- `JSON Receipt`

Human Summary example:

```text
Sigillum Receipt
Recommendation: BLOCK
Sigillum Score: 82
Paid: 0.000043 USDC
Inspected Units: 431
Critical Finding: Possible API key added in .env.example
Patch Recommendation: Remove exposed key and rotate credential before merge.
Seal: Verified by Sigillum
Receipt ID: sig_01J...
```

JSON Receipt example:

```json
{
  "receipt_id": "sig_01J...",
  "recommendation": "block",
  "score": 82,
  "paid_amount_usdc": "0.000043",
  "findings": [],
  "patch_recommendation": ""
}
```

This must be copyable and downloadable.

Receipt UX requirements:

- Make the receipt the visual center of the product.
- Show `Verified by Sigillum` prominently.
- Show the paid amount.
- Show the inspected units.
- Show the recommendation.
- Show the receipt ID.
- Allow copy/download of the JSON receipt.

## Step 7: Agent Decision

This is where most generic flows fail.

The agent action must be explicit and machine-readable.

Example decision object:

```json
{
  "agent_decision": "stop_merge",
  "reason": "critical_secret_exposure",
  "next_action": "remove_secret_and_regenerate_patch"
}
```

UX display:

```text
Agent decision: Merge blocked
Next action: Remove exposed key and regenerate patch
```

This turns the product from “reporting” into “control layer.”

UX objective:

- Show that the receipt changes behavior.
- Make the agent decision auditable.
- Avoid ending the experience with a static report.

## The Key Missing Detail

The product should not simply say:

> Agent blocks or patches.

It should define a policy.

Example policy:

```json
{
  "policy": {
    "block_on": ["critical", "secret_exposure", "unsafe_dependency"],
    "warn_on": ["copy_issue", "minor_config_change"],
    "pass_below_score": 40
  }
}
```

For MVP, this can be hardcoded.

Showing this makes the product feel real.

## Demo Journey Summary

The entire demo should be built around this moment:

> An autonomous coding agent tries to merge, receives `HTTP 402`, pays `0.000043 USDC`, gets a signed risk receipt, and blocks itself from shipping a secret.

Recommended timeline display:

```text
Diff submitted -> Quote returned -> 402 payment required -> Payment sent -> Receipt issued -> Merge blocked
```

## Key Screens

## Screen 1: Landing

Purpose:

- Explain “proof before permission.”
- Show that Sigillum is not a dashboard-first product.
- Drive the user into the sample diff flow.

Primary CTA:

```text
Inspect sample diff
```

Secondary CTA:

```text
View Sigillum Receipt
```

## Screen 2: Quote Simulator

Purpose:

- User pastes or selects a diff.
- Sigillum calculates inspected units and exact price.

Must show:

- changed lines
- AST nodes
- dependency changes
- config mutations
- strings
- total price

## Screen 3: Payment Required Screen

Purpose:

- Make `HTTP 402` visible.
- Make Arc/x402 feel necessary, not decorative.

Must show:

- `HTTP 402 Payment Required`
- verification price
- x402 payment rail
- Arc network
- quote expiry

## Screen 4: Receipt Screen

Purpose:

- Present the main product artifact.

Must show:

- Sigillum Receipt
- Sigillum Score
- recommendation
- paid amount
- inspected units
- findings
- patch recommendation
- receipt ID
- JSON receipt tab

## Screen 5: Agent Decision Timeline

Purpose:

- Show that the receipt drives the next action.

Must show:

```text
Risk score: 82
Recommendation: BLOCK
Policy matched: block_on.secret_exposure
Agent action: stop merge
Next action: remove exposed key and regenerate patch
```

## Screen 6: Badge Preview

Purpose:

- Show the future integration artifact.
- Create a shareable visual.

Example badge:

```text
Verified by Sigillum
Score 82 / Block
Receipt ID: sig_01J...
```

## UX Principle

Do not build a dashboard-first product.

Build a receipt-first product.

The dashboard can come later. For the hackathon, the receipt is the product.
