# Sigillum Landing Page Direction

This document defines the landing page structure, section copy, visual direction, and product narrative for Sigillum.

## Landing Page Goal

The landing page should not feel like a normal SaaS site.

It should feel like:

- a cryptographic receipt
- a payment checkpoint
- an autonomous agent control panel
- a premium verification seal

The page should make judges understand the product in one flow:

```text
AI Diff -> HTTP 402 -> Sigillum Receipt -> Agent Blocks Merge
```

## Core Positioning

Headline concept:

```text
Proof before permission.
```

Expanded positioning:

```text
Sigillum is the x402 risk oracle for autonomous software changes. Coding agents pay tiny USDC fees to get signed risk receipts before they merge, deploy, install, or publish.
```

Core product language:

- `Sigillum Receipt`
- `Sigillum Seal`
- `Sigillum Score`
- `Verified by Sigillum`
- `Pay for proof, not subscriptions`

## Visual Direction

The receipt must be the hero object.

It should feel like a combination of:

- boarding pass
- invoice
- cryptographic certificate
- inspection seal
- agent-readable artifact

Avoid generic SaaS dashboard visuals.

Use product artifacts instead:

- pinned code diff
- `HTTP 402 Payment Required` checkpoint
- x402 payment confirmation
- receipt card
- agent decision timeline
- badge preview

## Section 1: Hero

Headline:

```text
Proof before permission.
```

Subheadline:

```text
Sigillum gives AI coding agents a neutral, paid risk receipt before they merge, deploy, install, or publish.
```

Alternative subheadline:

```text
Sigillum is the x402 risk oracle for autonomous software changes. Coding agents pay tiny USDC fees to get signed risk receipts before they merge, deploy, install, or publish.
```

Primary CTA:

```text
Inspect sample diff
```

Secondary CTA:

```text
View Sigillum Receipt
```

Hero visual:

```text
AI-generated diff -> x402 payment gate -> Sigillum Receipt -> Agent blocks merge
```

Hero layout:

- Left: pinned code diff artifact.
- Center: small x402 payment checkpoint with a Sigillum Seal.
- Right: premium receipt artifact.

Proof elements to show in hero:

- paid amount
- receipt ID
- risk score
- recommendation
- inspected units

Example hero receipt text:

```text
Sigillum Receipt
Recommendation: BLOCK
Score: 82
Paid: 0.000043 USDC
Finding: Possible API key added
Seal: Verified by Sigillum
```

## Section 2: The Trust Gap

Title:

```text
The agent that writes the code should not be the only one approving it.
```

Alternative title:

```text
Agents can write code faster than humans can review it.
```

Copy:

```text
AI coding tools can generate production changes in seconds. But self-review is weak. Sigillum gives agents an external checkpoint before risky actions.
```

Supporting copy:

```text
The danger is not only that agents write bad code. The danger is that the same system writing the code may also be trusted to approve it.
```

Visual:

```text
Agent wrote change -> Self-review is weak -> External receipt required
```

Panel labels:

- `Agent wrote change`
- `Self-review risk`
- `External receipt required`

## Section 3: How Sigillum Works

Title:

```text
Quote. Pay. Inspect. Act.
```

Flow:

1. Submit changed code
2. Receive priced quote
3. Pay through x402
4. Inspect changed surface
5. Receive Sigillum Receipt
6. Pass, warn, or block

Visual:

- horizontal pipeline with pinned step cards
- each card should show real product data, not abstract icons

Example step copy:

```text
Submit diff
Sigillum receives only the changed surface.

Receive quote
Price is calculated from inspected units.

Pay through x402
The inspection unlocks after payment.

Inspect changed surface
Sigillum checks secrets, dependencies, configs, APIs, prompt surfaces, syntax, and copy.

Receive receipt
The result is a signed, machine-readable risk receipt.

Act
The agent passes, warns, or blocks based on policy.
```

## Section 4: Receipt Preview

Title:

```text
The receipt is the product.
```

Alternative title:

```text
A paid proof object your agent can act on.
```

Visual:

- large premium receipt card
- two tabs: `Human Summary` and `JSON Receipt`
- no generic dashboard mockup

Human Summary should show:

- Sigillum Score
- Recommendation
- Paid amount
- Inspected units
- Findings
- Patch recommendation
- Receipt ID

Example Human Summary:

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

Example JSON Receipt:

```json
{
  "receipt_id": "sig_01J...",
  "seal": "Verified by Sigillum",
  "score": 82,
  "recommendation": "block",
  "paid_amount_usdc": "0.000043",
  "inspected_units": {
    "ast_nodes": 312,
    "changed_lines": 74,
    "dependency_changes": 2,
    "config_mutations": 1,
    "strings": 42
  },
  "findings": [
    {
      "severity": "critical",
      "category": "secret_exposure",
      "message": "Possible API key added in .env.example",
      "file": ".env.example",
      "line": 4
    }
  ],
  "patch_recommendation": "Remove the exposed key and rotate the credential before merge.",
  "timestamp": "2026-06-25T00:00:00Z"
}
```

Design note:

This section should feel expensive. The receipt should look signed, paid for, and machine-readable.

## Section 5: What Sigillum Checks

Title:

```text
Small checks before large mistakes.
```

Visual:

- pinned inspection board, not a generic card grid
- each check should have a different inspection state

Checks:

- Secrets
- Dependency risk
- Config mutation
- Dangerous APIs
- Prompt-injection surfaces
- Syntax and structure
- Typo and copy issues

States to show:

- `pass`
- `warn`
- `critical`
- `blocked`
- `needs patch`

Important copy rule:

Do not overclaim. Say “checks for risk signals,” not “guarantees secure code.”

Suggested copy:

```text
Sigillum checks the changed surface for risk signals before an autonomous action is allowed to continue.
```

## Section 6: x402 Pricing

Title:

```text
No subscription. Pay per inspected unit.
```

Supporting copy:

```text
Some checks are too small for monthly billing. Sigillum prices each verification by the changed surface area, so agents can buy proof only when they need it.
```

Visual:

- receipt-style pricing breakdown

Example:

```text
Changed lines         74    $0.000074
AST nodes            312    $0.000156
Dependency changes     2    $0.000040
Config mutations       1    $0.000010
Total paid                  0.000043 USDC
```

Note:

Numbers can be simplified, but the principle must be clear. This section should make x402 feel necessary, not decorative.

## Section 7: Demo Agent Flow

Title:

```text
The receipt does not just inform. It controls the next action.
```

Alternative title:

```text
The agent receives the receipt. Then it acts.
```

Visual:

- live agent decision panel

Example panel:

```text
Risk score: 82
Recommendation: BLOCK
Policy matched: block_on.secret_exposure
Agent action: stop merge
Next action: remove exposed key and regenerate patch
```

This is where the demo becomes obvious to judges.

## Section 8: Developer Integration

Title:

```text
One checkpoint before risky action.
```

Visual:

- code block showing `POST /quote`
- code block showing `POST /inspect`
- result panel showing `HTTP 402 Payment Required`

Example API copy:

```http
POST /quote
POST /inspect
```

Example response state:

```http
HTTP 402 Payment Required
Payment confirmed
Receipt generated
```

Example JSON result:

```json
{
  "recommendation": "block",
  "score": 82,
  "receipt_id": "sig_01J..."
}
```

Proof element:

Show that the product is callable by agents, not just humans.

## Section 9: Final CTA

Title:

```text
Seal the change before it ships.
```

Copy:

```text
Run a paid verification check before your agent merges, deploys, installs, or publishes.
```

Primary CTA:

```text
Inspect sample diff
```

Secondary CTA:

```text
View receipt demo
```

## What To Remove Or Avoid

Remove anything that makes Sigillum look like a generic dashboard.

Avoid:

- `Developer dashboard`
- `AI-powered insights`
- `Secure your codebase`
- `Enterprise-grade code intelligence`
- vague card grids
- generic cyber gradients
- fake testimonials
- huge feature claims

Keep:

- quote
- 402
- payment
- receipt
- decision

## Landing Page Build Priority

The landing page should prioritize:

1. Hero with receipt object
2. Trust gap explanation
3. Quote/pay/inspect/act flow
4. Receipt preview with JSON
5. x402 pricing proof
6. Agent decision panel
7. Developer API
8. Final CTA

The page should sell one clear idea:

> Sigillum is not another code assistant. It is the paid verification layer an autonomous coding agent calls before risky action.
