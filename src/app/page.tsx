"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ScrollChoreography } from "@/components/motion/ScrollChoreography";
import { SmoothScroll } from "@/components/motion/SmoothScroll";

const proofSteps = [
  {
    label: "Submit diff",
    detail: "Changed surface only",
    state: "quoted",
  },
  {
    label: "HTTP 402",
    detail: "0.000043 USDC",
    state: "required",
  },
  {
    label: "Inspect",
    detail: "431 units checked",
    state: "running",
  },
  {
    label: "Receipt",
    detail: "sig_01J7K9...",
    state: "signed",
  },
  {
    label: "Decision",
    detail: "Merge blocked",
    state: "blocked",
  },
];

const inspectionChecks = [
  ["Secrets", "critical", "Possible API key added"],
  ["Dependency risk", "warn", "2 package changes"],
  ["Config mutation", "warn", "1 deployment setting"],
  ["Dangerous APIs", "blocked", "eval-like path found"],
  ["Prompt surfaces", "pass", "No prompt override"],
  ["Syntax structure", "pass", "Parsed successfully"],
  ["Copy issues", "needs patch", "User-facing typo"],
];

const receiptJson = `{
  "receipt_id": "sig_01J7K9X4M6A2",
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
  "patch_recommendation": "Remove the exposed key and rotate the credential before merge."
}`;

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="site-shell" data-motion-root>
      <SmoothScroll />
      <ScrollChoreography />
      <header className="site-nav" data-motion="nav">
        <Link className="brand-mark" href="/" aria-label="Sigillum home">
          <Image
            src="/images/Untitled design (15).webp"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            className="brand-mark-icon"
            priority
          />
          Sigillum
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#flow">Flow</a>
          <a href="#receipt">Receipt</a>
          <a href="#developers">Docs</a>
        </nav>
        <Link className="nav-cta" href="/dashboard">
          Open live dashboard
        </Link>
        <button
          className="menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {menuOpen ? (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile">
          <a href="#product" onClick={() => setMenuOpen(false)}>
            Product
          </a>
          <a href="#flow" onClick={() => setMenuOpen(false)}>
            Flow
          </a>
          <a href="#receipt" onClick={() => setMenuOpen(false)}>
            Receipt
          </a>
          <a href="#developers" onClick={() => setMenuOpen(false)}>
            Docs
          </a>
          <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
            Open live dashboard
          </Link>
        </nav>
      ) : null}

      <section className="hero-section" id="product" data-motion="hero">
        <div className="hero-copy">
          <p className="eyebrow" data-motion="hero-copy">X402 RISK ORACLE FOR AUTONOMOUS CODE</p>
          <h1 data-motion="hero-copy">Proof before permission.</h1>
          <p className="hero-lede" data-motion="hero-copy">
            Sigillum gives AI coding agents a neutral, paid risk receipt before
            they merge, deploy, install, or publish.
          </p>
          <div className="hero-actions" data-motion="hero-copy">
            <Link className="button-primary" href="/dashboard">
              Open live dashboard
            </Link>
            <a className="text-link" href="#receipt">
              View Sigillum Receipt
            </a>
          </div>
          <div className="proof-strip" aria-label="Sigillum proof sequence" data-motion="hero-copy">
            {["402 quoted", "USDC paid", "units inspected", "score returned", "receipt signed"].map(
              (item) => (
                <span key={item} data-motion="proof-pill">{item}</span>
              ),
            )}
          </div>
        </div>

        <div className="hero-visual" aria-label="AI diff to Sigillum receipt flow" data-motion="hero-visual">
          <ProofMesh />
          <article
            className="artifact-card diff-card"
            data-motion="hero-artifact"
            data-hover-card
            data-base-rotate="-5"
          >
            <span className="card-tape" />
            <p className="card-label">AI-GENERATED DIFF</p>
            <pre>{`+ API_KEY="sk_live_..."
+ eval(plugin.payload)
+ "Deploy succesful"`}</pre>
          </article>
          <article
            className="payment-gate"
            data-motion="hero-artifact"
            data-hover-card
            data-base-rotate="2"
          >
            <p>HTTP 402</p>
            <strong>Payment Required</strong>
            <span>0.000043 USDC via x402</span>
          </article>
          <article
            className="receipt-card hero-receipt"
            data-motion="hero-artifact"
            data-hover-card
            data-base-rotate="3"
          >
            <div className="receipt-topline">
              <span>Sigillum Receipt</span>
              <strong>BLOCK</strong>
            </div>
            <div className="score-lockup">
              <span>82</span>
              <p>Sigillum Score</p>
            </div>
            <dl>
              <div>
                <dt>PAID</dt>
                <dd>0.000043 USDC</dd>
              </div>
              <div>
                <dt>INSPECTED UNITS</dt>
                <dd>431</dd>
              </div>
              <div>
                <dt>SEAL</dt>
                <dd>Verified by Sigillum</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <ProofBoard
        id="trust"
        tab="TRUST GAP"
        eyebrow="NEUTRAL REVIEW"
        title="The agent that writes the code should not be the only one approving it."
        body="AI coding tools can generate production changes in seconds. Sigillum creates an external checkpoint at the risky moment before merge, deploy, install, or publish."
      >
        <div className="trust-grid">
          <article
            className="artifact-card critical-card"
            data-hover-card
            data-base-rotate="-3"
          >
            <span className="card-tape" />
            <p className="card-label">SELF-REVIEW RISK</p>
            <h3>Same system wrote and approved the change.</h3>
            <p>External receipt required before action continues.</p>
          </article>
          <div className="explanation-panel">
            {["Agent wrote change", "Self-review is weak", "External receipt required"].map(
              (item, index) => (
                <div className="decision-row" key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item}</strong>
                </div>
              ),
            )}
          </div>
        </div>
      </ProofBoard>

      <ProofBoard
        id="flow"
        tab="PROOF LOOP"
        eyebrow="QUOTE. PAY. INSPECT. ACT."
        title="A paid proof loop for risky software actions."
        body="The landing page shows the product contract without running the live flow here. The full interactive quote, 402 payment gate, receipt, and decision journey belongs on the dashboard."
      >
        <div className="flow-track">
          {proofSteps.map((step, index) => (
            <article
              className={`flow-card state-${step.state}`}
              key={step.label}
              data-motion="flow-card"
              data-hover-card
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.label}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </ProofBoard>

      <section className="receipt-section" id="receipt" data-motion="receipt-pin">
        <div className="section-heading" data-motion="section-copy">
          <p className="eyebrow">SIGNED PROOF OBJECT</p>
          <h2>The receipt is the product.</h2>
          <p>
            A paid proof object your agent can act on, with score, findings,
            payment, inspected units, and recommendation in one machine-readable
            artifact.
          </p>
        </div>
        <div className="receipt-stage" data-motion="receipt-stage">
          <div className="receipt-tabs" aria-label="Receipt preview">
            <input
              className="tab-radio"
              type="radio"
              name="receipt-preview"
              id="summary-tab"
              defaultChecked
            />
            <input
              className="tab-radio"
              type="radio"
              name="receipt-preview"
              id="json-tab"
            />
            <div className="tab-list">
              <label htmlFor="summary-tab">Human Summary</label>
              <label htmlFor="json-tab">JSON Receipt</label>
            </div>
            <article
              className="premium-receipt summary-panel"
              id="summary-panel"
              aria-labelledby="summary-tab"
              data-motion="receipt-panel"
              data-hover-card
              data-base-rotate="-1"
            >
              <div className="receipt-header">
                <div>
                  <p className="card-label">SIGILLUM RECEIPT</p>
                  <h3>Verified by Sigillum</h3>
                </div>
                <span className="status-chip critical">BLOCK</span>
              </div>
              <div className="receipt-metrics">
                <div>
                  <span>82</span>
                  <p>Sigillum Score</p>
                </div>
                <div>
                  <span>431</span>
                  <p>Inspected Units</p>
                </div>
                <div>
                  <span>0.000043</span>
                  <p>USDC Paid</p>
                </div>
              </div>
              <div className="finding-panel">
                <span>CRITICAL FINDING</span>
                <strong>Possible API key added in .env.example</strong>
                <p>
                  Patch recommendation: remove the exposed key and rotate the
                  credential before merge.
                </p>
              </div>
              <p className="receipt-id">RECEIPT ID sig_01J7K9X4M6A2</p>
            </article>
            <pre
              className="json-panel"
              id="json-panel"
              aria-labelledby="json-tab"
              tabIndex={0}
              data-motion="receipt-panel"
              data-hover-card
            >
              {receiptJson}
            </pre>
          </div>
        </div>
      </section>

      <ProofBoard
        id="checks"
        tab="INSPECTION BOARD"
        eyebrow="RISK SIGNALS"
        title="Small checks before large mistakes."
        body="Sigillum checks the changed surface for risk signals. It does not claim guaranteed security; it returns bounded evidence and a recommendation."
      >
        <div className="check-board">
          {inspectionChecks.map(([name, state, detail]) => (
            <article
              className={`check-card ${state.replace(" ", "-")}`}
              key={name}
              data-motion="check-card"
              data-hover-card
            >
              <span>{state}</span>
              <h3>{name}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </ProofBoard>

      <section className="pricing-decision-grid" data-motion="split-section">
        <article className="pricing-card" data-motion="split-left" data-hover-card>
          <p className="eyebrow">X402 PRICING</p>
          <h2>No subscription. Pay per inspected unit.</h2>
          <p>
            Some checks are too small for monthly billing. Sigillum prices each
            verification by changed surface area, so agents buy proof only when
            they need it.
          </p>
          <div className="price-table" aria-label="Pricing breakdown">
            {[
              ["Changed lines", "74", "$0.000074"],
              ["AST nodes", "312", "$0.000156"],
              ["Dependency changes", "2", "$0.000040"],
              ["Config mutations", "1", "$0.000010"],
            ].map(([label, count, price]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
                <em>{price}</em>
              </div>
            ))}
            <div className="price-total">
              <span>Total paid</span>
              <strong>0.000043 USDC</strong>
            </div>
          </div>
        </article>

        <article className="agent-panel" data-motion="split-right" data-hover-card>
          <p className="eyebrow">AGENT DECISION</p>
          <h2>The receipt controls the next action.</h2>
          <div className="agent-terminal">
            <div>
              <span>Risk score</span>
              <strong>82</strong>
            </div>
            <div>
              <span>Recommendation</span>
              <strong>BLOCK</strong>
            </div>
            <div>
              <span>Policy matched</span>
              <strong>block_on.secret_exposure</strong>
            </div>
            <div>
              <span>Agent action</span>
              <strong>stop merge</strong>
            </div>
            <div>
              <span>Next action</span>
              <strong>remove secret and regenerate patch</strong>
            </div>
          </div>
        </article>
      </section>

      <ProofBoard
        id="developers"
        tab="DEVELOPER CHECKPOINT"
        eyebrow="AGENT-CALLABLE API"
        title="One checkpoint before risky action."
        body="Sigillum is designed for agents to call before they act. The dashboard hosts the live receipt flow, while the landing page keeps the contract visible."
      >
        <div className="developer-grid">
          <pre className="code-card" data-hover-card>{`POST /quote
-> quote_01J...
-> 0.000043 USDC

POST /inspect
-> HTTP 402 Payment Required
-> Payment confirmed
-> Receipt generated`}</pre>
          <article className="result-card" data-hover-card>
            <p className="card-label">RESULT SUMMARY</p>
            <h3>Machine-readable recommendation</h3>
            <pre>{`{
  "recommendation": "block",
  "score": 82,
  "receipt_id": "sig_01J..."
}`}</pre>
          </article>
        </div>
      </ProofBoard>

      <section className="final-cta" data-motion="final-section">
        <article className="artifact-card final-receipt" data-motion="final-card" data-hover-card>
          <span className="card-tape" />
          <p className="card-label">SIGILLUM SEAL</p>
          <h2>Seal the change before it ships.</h2>
          <p>
            Run a paid verification check before your agent merges, deploys,
            installs, or publishes.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" href="/dashboard">
              Open live dashboard
            </Link>
            <a className="text-link" href="#receipt">
              View receipt example
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}

function ProofBoard({
  id,
  tab,
  eyebrow,
  title,
  body,
  children,
}: {
  id: string;
  tab: string;
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section className="proof-board-section" id={id} data-motion="board-section">
      <div className="board-tab">{tab}</div>
      <div className="board-copy" data-motion="section-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div data-motion="section-content">{children}</div>
    </section>
  );
}

function ProofMesh() {
  return (
    <svg className="proof-mesh" viewBox="0 0 420 320" aria-hidden="true" data-motion="mesh">
      <path d="M48 210L128 96L220 140L310 68L382 182L270 250L164 218Z" />
      <path d="M128 96L164 218L310 68M220 140L270 250" />
      {[48, 128, 220, 310, 382, 270, 164].map((x, index) => {
        const y = [210, 96, 140, 68, 182, 250, 218][index];
        return <circle cx={x} cy={y} r={index === 3 ? 7 : 5} key={x} />;
      })}
    </svg>
  );
}
