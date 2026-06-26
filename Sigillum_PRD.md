# Sigillum PRD

Product: `Sigillum`  
Positioning: `The first x402 risk oracle for autonomous software changes`  
Core language: `Sigillum Receipt`, `Sigillum Seal`, `Sigillum Score`, `Verified by Sigillum`, `Pay for proof, not subscriptions`

## 1. Executive Summary

Sigillum is an x402-protected verification service for AI-generated software changes.

As coding agents write more production code, the bottleneck shifts from generation to trust. The future problem is not “can an agent write code?” It is “should this autonomous change be allowed to merge, deploy, install dependencies, modify config, or touch production?”

Sigillum gives agents and developers a neutral external verifier. A coding agent submits a diff, receives an `HTTP 402 Payment Required` response with a price based on the changed surface area, pays a tiny USDC amount through Arc/Circle Gateway, and receives a signed `Sigillum Receipt`.

The receipt includes:

- risk score
- merge/deploy recommendation
- syntax and structural validation
- dependency/config risk
- secret and credential exposure checks
- dangerous API usage
- prompt-injection surface detection
- typo/copy issues
- patch recommendations
- inspected units
- paid amount
- receipt ID

Sigillum does not compete as “better Codex,” “better Claude Code,” or “better Snyk.” It is the paid trust layer between autonomous code generation and risky software actions.

Core thesis:

> Don’t trust the agent that wrote the code to be the only agent that approves the code.

## 2. Problem Statement

AI coding tools are rapidly increasing the volume and speed of code changes. Teams are moving from human-authored PRs to agent-authored diffs, autonomous refactors, generated configs, package installs, and automated deployments.

This creates a new trust gap.

Current tools solve adjacent problems:

| Tool Type | What It Does | Gap |
|---|---|---|
| Codex / Claude Code / Cursor | Generate and edit code | Not neutral; same system may write and review |
| Snyk / Dependabot | Dependency/security scanning | Subscription/project-oriented, not agent-native |
| Semgrep / ESLint | Static rules | Not payment-native, not receipt-oriented |
| GitHub Checks | CI status | Human/account-centric, not autonomous economic flow |
| Human review | Judgment and accountability | Slow, scarce, expensive |

The emerging pain:

- Agent-generated code can ship faster than humans can review.
- Developers need cheap second opinions on small changes.
- Agent workflows need machine-readable approvals, not essays.
- Existing security products are not priced for thousands of tiny autonomous checks.
- Subscriptions are poorly matched to per-action agent economies.
- A coding agent reviewing its own work is a weak trust model.

Sigillum solves the specific moment before a risky action:

> “This AI-generated change is about to merge/deploy/install/publish. Should it be trusted?”

## 3. Target Market

**Primary Persona: AI-Native Indie Builder**
- Uses Codex, Claude Code, Cursor, Replit, or similar agents.
- Ships fast.
- Wants lightweight protection without enterprise setup.
- Will pay sub-cent or cent-level fees for confidence before deploy.

Job to be done:

> When my coding agent creates a change, I want an external verifier to inspect it before I merge, so I can ship fast without blindly trusting generated code.

**Secondary Persona: Autonomous Coding Agent**
- Has wallet/budget.
- Can discover x402 services.
- Makes cost-benefit decisions.
- Pays for verification before risky actions.

Job to be done:

> When I am about to take a risky software action, I need to buy a cheap trust signal so I can decide whether to continue, patch, or escalate.

**Tertiary Persona: Open-Source Maintainer**
- Receives AI-generated PRs.
- Needs quick trust signals.
- Wants badge-style validation.

Job to be done:

> When contributors submit AI-generated PRs, I want a neutral receipt showing what was inspected and whether it passed.

**Market Sizing**
TAM: developer security, code review, DevSecOps, and AI coding infrastructure. Multi-billion-dollar category.

SAM: AI-assisted developer workflows, CI checks, agent services, and lightweight code verification.

SOM wedge: hackathon builders, indie AI builders, open-source projects, and autonomous coding workflows using x402/Arc.

The initial market does not need enterprise adoption. It needs repeated small usage from agentic software workflows.

## 4. Solution

Sigillum provides a paid, independent, machine-readable verification receipt for software changes.

**Core Value Proposition**
> Sigillum lets agents and developers pay tiny amounts for neutral proof before trusting AI-written code.

**Why Now**
- AI code generation is exploding.
- Agents are becoming autonomous actors.
- x402 enables payment-per-call APIs.
- Arc/Circle Gateway makes sub-cent USDC settlement practical.
- Code trust is becoming more valuable than code generation.

**1-Year Vision**
Become the default x402 verification endpoint for AI-generated diffs.

**3-Year Vision**
Become the trust receipt layer for autonomous software actions across code, configs, agents, plugins, package installs, and deployments.

## 5. MVP Feature Spec

**Must Have**

1. `POST /quote`
- Accepts code diff or changed file payload.
- Calculates inspected units.
- Returns price, inspected categories, and x402 payment requirement.

2. `POST /inspect`
- Protected by x402.
- Requires payment before result.
- Runs deterministic analysis.
- Returns `Sigillum Receipt`.

3. Diff parser
- Counts changed lines, AST nodes, config mutations, dependency modifications, strings, and risk-bearing patterns.

4. Risk engine
- Produces `Sigillum Score`.
- Gives recommendation: `pass`, `warn`, or `block`.

5. Receipt object
- Machine-readable JSON.
- Human-readable summary.
- Includes paid amount and inspected unit count.

6. Demo agent flow
- Agent attempts risky merge.
- Gets `402`.
- Pays.
- Receives receipt.
- Blocks or patches change.

**Should Have**

- GitHub PR badge: `Verified by Sigillum`
- CLI demo: `sigillum inspect diff.patch`
- Rules for JavaScript/TypeScript first
- Dependency risk checks for `package.json`
- Secret pattern detection
- Prompt injection checks in markdown/config/prompt files

**Could Have**

- Optional LLM-enhanced explanation tier
- Public receipt page
- Agent budget policy
- Multi-file repo scan

**Won’t Have in MVP**

- Full enterprise dashboard
- Full SAST replacement
- Deep runtime security analysis
- Long-term receipt registry
- Paid VPS infrastructure

## 6. Key User Stories

1. As a coding agent, I want to request a quote before inspection so I can decide if verification is worth the cost.

2. As a coding agent, I want to pay through x402 so I can access the verifier without human billing setup.

3. As an indie builder, I want a receipt before merge so I can trust AI-generated code faster.

4. As a maintainer, I want a badge on a PR so I can quickly see whether the change was independently checked.

5. As a developer, I want dangerous dependency changes flagged so I do not ship supply-chain risk.

6. As a developer, I want secrets detected before push so I do not leak credentials.

7. As an agent, I want a machine-readable `block/warn/pass` recommendation so I can continue automatically.

8. As a judge/demo viewer, I want to see the exact nanopayment and inspected units so the Arc/x402 value is obvious.

## 7. Technical Architecture

No VPS. No extra paid infrastructure required for MVP.

Recommended architecture:

- Frontend/demo: static app or serverless web app
- API: serverless/edge functions
- Payments: x402 + Circle Gateway/Arc
- Analysis: deterministic TypeScript modules
- Storage: optional minimal KV/database, or stateless receipts at first
- Parsing: AST parser for JS/TS, JSON parser for config, regex/rules for secrets
- Optional LLM: only for premium explanation, not core detection

Flow:

1. Agent submits diff.
2. Sigillum calculates units and price.
3. API responds with `402 Payment Required`.
4. Agent pays USDC via x402.
5. Sigillum verifies payment.
6. Analyzer runs bounded checks.
7. Receipt is generated and returned.
8. Agent decides whether to merge, patch, or stop.

Scalability principles:

- Analyze diffs, not full repos.
- Keep deterministic checks first.
- Price before compute-heavy work.
- Bound payload size.
- Charge by inspected unit.
- Avoid persistent infrastructure dependency.
- Make LLM optional, not required.

## 8. Receipt Schema

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

## 9. Business Model

**Primary Revenue**
- Pay-per-inspection through x402.
- Price based on inspected units.

Example pricing:

| Unit | Price |
|---|---:|
| Changed line | `$0.000001` |
| AST node | `$0.0000005` |
| Dependency change | `$0.00002` |
| Config mutation | `$0.00001` |
| Secret/security finding tier | premium multiplier |
| LLM explanation | optional higher fee |

**Why This Works**
Traditional billing cannot economically support ultra-small verification events. x402 makes the natural unit of value sellable.

**Future Revenue**
- Team policies
- Receipt registry
- GitHub app
- Agent marketplace integrations
- Enterprise verification logs
- Premium rule packs
- Higher-assurance signed receipts

## 10. Competitive Advantage

Sigillum wins by being structurally different, not by claiming better static analysis.

Advantages:

- Agent-native payment flow
- Neutral external verifier
- Pay-per-diff pricing
- Machine-readable receipts
- Economic proof of verification
- No subscription barrier
- Built for autonomous software actions
- Visible Arc/x402 use case
- Diff-bounded scalability

The moat grows through:

- receipt reputation
- integration into agent workflows
- rule quality
- trusted brand/seal
- historical risk data
- marketplace distribution
- agent policy compatibility

## 11. Go-To-Market

**Hackathon Launch**
Primary demo:

> A coding agent writes a risky change, hits Sigillum’s `402`, pays a nanopayment, receives a receipt, and blocks the merge.

Demo must visibly show:

- `HTTP 402`
- USDC amount
- inspected units
- risk score
- `Sigillum Receipt`
- `Verified by Sigillum`
- agent decision

**Initial Channels**
- Lepton/Circle/Arc community
- AI coding agent communities
- GitHub/X demo video
- Open-source maintainers
- Hackathon builders
- “AI wrote this PR, Sigillum checked it” badges

**Growth Loops**
- Public receipts are shareable.
- PR badges advertise the product.
- Agents recommend verification when risk is high.
- Open-source maintainers require receipts for AI-generated PRs.

## 12. Success Metrics

**North Star Metric**
Paid verified software changes per week.

**Hackathon Metrics**
- Number of x402 payments completed
- Average payment size
- Number of receipts generated
- Number of risky changes blocked
- Time from quote to receipt
- Demo clarity

**Product Metrics**
- Repeat inspections per user/agent
- Percentage of receipts consumed by machines
- Block/warn/pass distribution
- Cost per inspection
- Median latency
- Conversion from quote to paid inspection

## 13. Risks And Mitigations

**Risk: Looks like generic linting**
Mitigation: Make the receipt, payment, and agent decision the center of the product.

**Risk: Shallow checks**
Mitigation: Include meaningful MVP categories: secrets, dependencies, configs, dangerous APIs, prompt surfaces, AST syntax.

**Risk: x402 feels decorative**
Mitigation: Price must be computed from diff complexity before access. The product should not work fully without payment.

**Risk: Competes with Snyk/Semgrep**
Mitigation: Position as agent-native verification receipts, not enterprise SAST.

**Risk: Human-only demo is unimpressive**
Mitigation: Demo must show an autonomous coding agent paying and acting on the result.

**Risk: Scaling costs explode**
Mitigation: Deterministic checks first, diff-only scope, payload limits, optional LLM tier.

**Risk: Trust claims are too strong**
Mitigation: Use “risk receipt” and “verification signal,” not “guaranteed secure.”

## 14. Timeline

**Phase 1: Hackathon MVP**
- x402-protected inspect endpoint
- quote endpoint
- JS/TS diff parser
- basic risk engine
- receipt JSON
- demo agent flow
- landing page with receipt visualization

**Phase 2: Productized Beta**
- GitHub PR badge
- CLI
- public receipt links
- expanded rules
- agent budget policies

**Phase 3: Scalable Trust Layer**
- receipt registry
- integrations with coding agents
- marketplace listing
- premium verification tiers
- team/org policies

## 15. Final YC Framing

Sigillum is a bet on a future where agents do not just write code, they make software decisions.

In that world, trust becomes programmable.

The winning primitive is not another chat interface. It is a neutral, paid, machine-readable proof layer that agents can call before taking risky actions.

Final pitch:

> Sigillum is the x402 risk oracle for autonomous software changes. Coding agents pay sub-cent USDC fees to receive signed risk receipts before they merge, deploy, install, or publish. Pay for proof, not subscriptions.
