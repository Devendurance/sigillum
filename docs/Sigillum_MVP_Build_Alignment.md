# Sigillum MVP Build Alignment Checklist

This document keeps the build aligned with the PRD, user stories, product flow, and hackathon judging needs.

## Honest Product Assessment

The product must not become a generic AI code-review dashboard.

The magic is not a beautiful dashboard.

The magic is this exact moment:

> An autonomous coding agent tries to merge, receives `HTTP 402`, pays `0.000043 USDC`, gets a signed risk receipt, and blocks itself from shipping a secret.

If the build centers this moment, Sigillum will feel specific, real, and non-generic.

## Product Identity

Sigillum is:

- an x402 risk oracle for autonomous software changes
- a neutral external verifier
- a receipt-first product
- a paid proof layer
- an agent-callable checkpoint before risky action

Sigillum is not:

- a better Snyk
- a better Semgrep
- a better Codex
- a generic AI code reviewer
- a dashboard-first DevSecOps product

## Must Be Real In The MVP

To satisfy the PRD and key user stories, the MVP should actually include:

- `POST /quote`
- `POST /inspect`
- visible `402 Payment Required` state
- real or clearly integrated x402 payment flow
- diff parser
- inspected unit calculator
- deterministic risk checks
- receipt JSON
- human receipt card
- agent decision output
- sample risky diff
- badge preview

## Should-Haves If Time Allows

- CLI-style demo
- GitHub badge preview
- JSON copy/download
- public receipt page

## Could-Haves That Should Not Block MVP

- full GitHub integration
- LLM explanation tier
- receipt registry
- custom agent policies

## Required API States

The UX should map to actual API/product states.

Required state sequence:

```text
Diff selected
Quote requested
Quote returned
HTTP 402 Payment Required
Payment requested
Payment sent
Payment confirmed
Inspection unlocked
Inspection running
Receipt generated
Agent decision produced
```

## Required Endpoints

## `POST /quote`

Purpose:

- Accept a diff or changed file payload.
- Calculate inspected units.
- Return quote, quote expiry, and payment amount.

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

## `POST /inspect`

Purpose:

- Require payment before inspection.
- Run deterministic analysis.
- Return a `Sigillum Receipt`.

Expected locked state:

```http
HTTP 402 Payment Required
```

Expected unlocked result:

```json
{
  "receipt_id": "sig_01J...",
  "recommendation": "block",
  "score": 82,
  "paid_amount_usdc": "0.000043",
  "findings": [
    {
      "severity": "critical",
      "category": "secret_exposure",
      "message": "Possible API key added in .env.example",
      "file": ".env.example",
      "line": 4
    }
  ],
  "patch_recommendation": "Remove the exposed key and rotate the credential before merge."
}
```

## Required Sample Risky Diff

The demo should include a prebuilt risky sample diff.

The sample diff should contain:

- `package.json` dependency addition
- `.env.example` suspicious key
- config mutation
- JS/TS code change with dangerous API usage
- user-facing typo/copy string

The sample exists so judges can experience the product without preparing code.

## Required Deterministic Checks

The MVP should include meaningful checks that are not just syntax linting.

Required check categories:

- secrets
- dependency risk
- config mutation
- dangerous APIs
- prompt-injection surfaces
- syntax and structure
- typo and copy issues

Copy rule:

Use `risk signals`, not `guaranteed secure`.

## Required Receipt Artifact

The receipt is the product.

Receipt must include:

- `receipt_id`
- `seal`
- `score`
- `recommendation`
- `paid_amount_usdc`
- `inspected_units`
- `findings`
- `patch_recommendation`
- `timestamp`

Example:

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

## Required Agent Decision Contract

Do not stop at generating a report.

The product must show that the receipt changes what the agent does.

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

## Required Policy Object

For MVP, the policy can be hardcoded.

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

This makes the product feel real and explains why the agent blocks, warns, or passes.

## Key User Story Alignment

## User Story 1

As a coding agent, I want to request a quote before inspection so I can decide if verification is worth the cost.

Build requirement:

- Implement `POST /quote`.
- Show inspected units and exact price.

## User Story 2

As a coding agent, I want to pay through x402 so I can access the verifier without human billing setup.

Build requirement:

- Show visible `HTTP 402 Payment Required` state.
- Unlock inspection only after payment confirmation or clearly labeled local simulation.

## User Story 3

As an indie builder, I want a receipt before merge so I can trust AI-generated code faster.

Build requirement:

- Generate human-readable `Sigillum Receipt`.
- Generate copyable JSON receipt.

## User Story 4

As a maintainer, I want a badge on a PR so I can quickly see whether the change was independently checked.

Build requirement:

- Include badge preview: `Verified by Sigillum`.

## User Story 5

As a developer, I want dangerous dependency changes flagged so I do not ship supply-chain risk.

Build requirement:

- Detect and display dependency changes from package files.

## User Story 6

As a developer, I want secrets detected before push so I do not leak credentials.

Build requirement:

- Include secret pattern detection.
- Sample diff must trigger this.

## User Story 7

As an agent, I want a machine-readable `block/warn/pass` recommendation so I can continue automatically.

Build requirement:

- Receipt must include recommendation.
- Agent decision object must be generated.

## User Story 8

As a judge/demo viewer, I want to see the exact nanopayment and inspected units so the Arc/x402 value is obvious.

Build requirement:

- Show price and inspected units in quote, payment, and receipt screens.

## UX Anti-Patterns To Avoid

Avoid:

- dashboard-first design
- generic AI chatbot interface
- vague security claims
- hidden payment flow
- fake enterprise language
- pretending the product guarantees security
- ending the flow at a static report

Use instead:

- receipt-first design
- visible `402`
- visible payment amount
- deterministic inspection pipeline
- machine-readable output
- explicit agent decision

## Hackathon Demo Script

Use this as the north-star demo:

```text
An autonomous coding agent creates a risky PR.
The agent sends the diff to Sigillum.
Sigillum returns a quote for 0.000043 USDC.
The agent hits HTTP 402 Payment Required.
The agent pays through x402 on Arc.
Sigillum inspects the changed surface.
Sigillum issues a signed risk receipt.
The receipt finds a possible exposed API key.
The policy says critical secret exposure should block.
The agent blocks the merge and requests a patch.
```

## Final Build Rule

If a feature does not support one of these five product moments, deprioritize it:

- quote
- 402
- payment
- receipt
- decision
