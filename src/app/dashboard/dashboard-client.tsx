"use client";

import { useMemo, useState } from "react";
import type { AgentDecision, Quote, SigillumReceipt } from "@/lib/sigillum/types";
import { sampleRiskyDiff } from "@/lib/sigillum/sample-diff";
import type { PaymentRequirement } from "@/lib/sigillum/payment/types";

type DemoPhase =
  | "idle"
  | "quoting"
  | "quoted"
  | "payment_required"
  | "payment_confirming"
  | "inspecting"
  | "receipt_ready";

type PaymentDisplayInfo = PaymentRequirement & {
  payment_reference?: string;
};

const pipelineSteps = [
  "diff",
  "quote",
  "402",
  "payment",
  "inspect",
  "receipt",
  "decision",
] as const;

export function DashboardClient() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [receipt, setReceipt] = useState<SigillumReceipt | null>(null);
  const [agentDecision, setAgentDecision] = useState<AgentDecision | null>(null);
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [activeTab, setActiveTab] = useState<"summary" | "json">("summary");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentDisplayInfo | null>(null);

  const receiptJson = useMemo(() => {
    if (!receipt) {
      return "";
    }

    return JSON.stringify(receipt, null, 2);
  }, [receipt]);

  const pipelineState = useMemo(() => {
    const completed = new Set<string>();
    const active = new Set<string>();

    switch (phase) {
      case "quoting":
        active.add("quote");
        break;
      case "quoted":
        completed.add("diff");
        completed.add("quote");
        active.add("402");
        break;
      case "payment_required":
        completed.add("diff");
        completed.add("quote");
        active.add("402");
        break;
      case "payment_confirming":
        completed.add("diff");
        completed.add("quote");
        completed.add("402");
        active.add("payment");
        break;
      case "inspecting":
        completed.add("diff");
        completed.add("quote");
        completed.add("402");
        completed.add("payment");
        active.add("inspect");
        break;
      case "receipt_ready":
        pipelineSteps.forEach((step) => completed.add(step));
        break;
      default:
        break;
    }

    return { completed, active };
  }, [phase]);

  async function handleRequestQuote() {
    setErrorMessage(null);
    setPhase("quoting");
    setReceipt(null);
    setAgentDecision(null);
    setPaymentInfo(null);

    const response = await fetch("/api/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ diff: sampleRiskyDiff }),
    });

    if (!response.ok) {
      setErrorMessage("Quote request failed.");
      setPhase("idle");
      return;
    }

    const nextQuote = (await response.json()) as Quote;
    setQuote(nextQuote);
    setPhase("quoted");
    setActiveTab("summary");
  }

  function handleContinueToPayment() {
    if (!quote) {
      return;
    }

    setErrorMessage(null);
    setPhase("payment_required");
  }

  async function handlePayWithWallet() {
    if (!quote) {
      return;
    }

    setErrorMessage(null);
    setPhase("payment_confirming");

    await pause(220);
    setPhase("inspecting");
    await pause(260);

    const response = await fetch("/api/inspect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        diff: sampleRiskyDiff,
        quote_id: quote.quote_id,
        payment_confirmed: true,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | {
            message?: string;
            payment?: PaymentRequirement;
            reason?: string;
            error?: string;
          }
        | null;

      if (body?.payment) {
        setPaymentInfo(body.payment);
      }

      setErrorMessage(
        body?.message ??
          body?.reason ??
          "x402 mode is selected, but payment verification is not configured yet.",
      );
      setPhase("payment_required");
      return;
    }

    const result = (await response.json()) as {
      receipt: SigillumReceipt;
      agent_decision: AgentDecision;
      payment: {
        mode: "demo" | "x402";
        rail: "local-demo" | "x402";
        payment_reference: string;
      };
    };

    setReceipt(result.receipt);
    setAgentDecision(result.agent_decision);
    setPaymentInfo({
      status: "payment_required",
      status_code: 402,
      message: "HTTP 402 Payment Required",
      network: "Arc",
      rail: result.payment.rail,
      currency: "USDC",
      amount: quote.amount,
      quote_id: quote.quote_id,
      expires_at: quote.expires_at,
      mode: result.payment.mode,
    });
    setPhase("receipt_ready");
    setActiveTab("summary");
  }

  async function handleCopyJson() {
    if (!receiptJson) {
      return;
    }

    await navigator.clipboard.writeText(receiptJson);
    setCopyStatus("copied");
    window.setTimeout(() => setCopyStatus("idle"), 1200);
  }

  const paymentGateVisible =
    phase === "payment_required" ||
    phase === "payment_confirming" ||
    phase === "inspecting" ||
    phase === "receipt_ready";
  const paymentGateLabel =
    paymentInfo?.mode === "x402"
      ? "x402 payment adapter"
      : "Local demo payment simulation";

  return (
    <main className="dashboard-shell">
      <section className="proof-board-section dashboard-stage">
        <div className="board-tab">SIGILLUM MVP ENGINE</div>
        <div className="dashboard-grid">
          <div className="dashboard-main">
            <article className="artifact-card diff-panel" data-hover-card>
              <span className="card-tape" />
              <p className="card-label">SAMPLE RISKY DIFF</p>
              <pre className="diff-pre">{sampleRiskyDiff}</pre>
            </article>

            <div className="action-row">
              <button className="button-primary" type="button" onClick={handleRequestQuote}>
                Request Quote
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={handleContinueToPayment}
                disabled={!quote}
              >
                Continue to x402 payment
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={handlePayWithWallet}
                disabled={!quote || phase === "payment_confirming" || phase === "inspecting"}
              >
                Agent pays with wallet
              </button>
            </div>

            {errorMessage ? (
              <div className="notice notice-error" role="alert">
                {errorMessage}
              </div>
            ) : null}

            {paymentGateVisible ? (
              <article className="payment-gate demo-gate">
                <p>HTTP 402</p>
                <strong>Payment Required</strong>
                <span>{paymentGateLabel}</span>
                <div className="gate-meta">
                  <span>{paymentInfo?.network ?? "Arc"}</span>
                  <span>{paymentInfo?.rail ?? "local-demo"}</span>
                  <span>{paymentInfo?.mode ?? "demo"}</span>
                  <span>{paymentInfo?.currency ?? "USDC"}</span>
                  <span>{paymentInfo?.amount ?? quote?.amount ?? "0.000043"}</span>
                </div>
                {paymentInfo?.quote_id ? <span className="quote-chip">quote {paymentInfo.quote_id}</span> : null}
              </article>
            ) : null}

            <div className="pipeline-row" aria-label="Inspection pipeline states">
              {pipelineSteps.map((step) => {
                const state = pipelineState.active.has(step)
                  ? "active"
                  : pipelineState.completed.has(step)
                    ? "done"
                    : "idle";

                return (
                  <div className={`pipeline-pill ${state}`} key={step}>
                    {step}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="dashboard-side">
            <article className="result-card metric-card" data-hover-card>
              <p className="card-label">QUOTE</p>
              <div className="metric-row">
                <div>
                  <span>{quote ? quote.amount : "0.000043"}</span>
                  <p>USDC</p>
                </div>
                <div>
                  <span>{quote ? quote.inspected_units.changed_lines : 0}</span>
                  <p>Changed lines</p>
                </div>
              </div>
              <div className="mini-metrics">
                <div>
                  <span>AST</span>
                  <strong>{quote ? quote.inspected_units.ast_nodes : 0}</strong>
                </div>
                <div>
                  <span>Deps</span>
                  <strong>{quote ? quote.inspected_units.dependency_changes : 0}</strong>
                </div>
                <div>
                  <span>Config</span>
                  <strong>{quote ? quote.inspected_units.config_mutations : 0}</strong>
                </div>
                <div>
                  <span>Strings</span>
                  <strong>{quote ? quote.inspected_units.strings : 0}</strong>
                </div>
              </div>
            </article>

            <article className="result-card seal-card" data-hover-card>
              <p className="card-label">SEAL PREVIEW</p>
              <h3>Verified by Sigillum</h3>
              <p className="seal-copy">
                {paymentInfo?.mode === "x402"
                  ? "x402 mode selected, but payment verification is not configured yet."
                  : "Local demo receipt and agent decision are generated after payment confirmation."}
              </p>
              <span className="seal-badge">Verified by Sigillum</span>
            </article>
          </aside>
        </div>
      </section>

      <section className="receipt-section dashboard-receipt">
        <div className="board-copy">
          <p className="eyebrow">RECEIPT + DECISION</p>
          <h2>Human summary and machine receipt stay in sync.</h2>
          <p>
            Quote, payment gate, inspection, receipt, and agent decision are all
            local-first here. Real x402 wiring can replace the demo gate later.
          </p>
        </div>

        <div className="receipt-tabs">
          <div className="tab-list">
            <button
              className={activeTab === "summary" ? "tab-button active" : "tab-button"}
              type="button"
              onClick={() => setActiveTab("summary")}
            >
              Human Summary
            </button>
            <button
              className={activeTab === "json" ? "tab-button active" : "tab-button"}
              type="button"
              onClick={() => setActiveTab("json")}
            >
              JSON Receipt
            </button>
          </div>

          {activeTab === "summary" ? (
            <article className={`premium-receipt receipt-summary ${receipt?.recommendation === "block" ? "is-block" : ""}`} data-hover-card>
              <div className="receipt-header">
                <div>
                  <p className="card-label">SIGILLUM RECEIPT</p>
                  <h3>{receipt ? receipt.seal : "Verified by Sigillum"}</h3>
                </div>
                <span className={`status-chip ${receipt?.recommendation ?? "warn"}`}>
                  {receipt ? receipt.recommendation.toUpperCase() : "WAITING"}
                </span>
              </div>

              <div className="receipt-metrics">
                <div>
                  <span>{receipt ? receipt.score : "--"}</span>
                  <p>Sigillum Score</p>
                </div>
                <div>
                  <span>{quote ? quote.inspected_units.changed_lines : "--"}</span>
                  <p>Changed lines</p>
                </div>
                <div>
                  <span>{quote ? quote.amount : "--"}</span>
                  <p>USDC paid</p>
                </div>
              </div>
              <div className="payment-meta-row">
                <span>{paymentInfo?.mode ?? "demo"}</span>
                <span>{paymentInfo?.rail ?? "local-demo"}</span>
                <span>{paymentInfo?.payment_reference ?? "payment pending"}</span>
              </div>

              <div className="finding-panel">
                <span>FINDINGS</span>
                <div className="finding-list">
                  {receipt?.findings?.length ? (
                    receipt.findings.map((finding) => (
                      <div className="finding-row" key={`${finding.category}-${finding.message}`}>
                        <strong>{finding.category}</strong>
                        <p>
                          {finding.message}
                          {finding.file ? ` · ${finding.file}${finding.line ? `:${finding.line}` : ""}` : ""}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="finding-row">
                      <strong>waiting</strong>
                      <p>Run the payment-confirmed inspect step to generate findings.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="decision-strip">
                <div>
                  <span>Agent decision</span>
                  <strong>{agentDecision ? agentDecision.agent_decision : "waiting"}</strong>
                </div>
                <div>
                  <span>Next action</span>
                  <strong>{agentDecision ? agentDecision.next_action : "agent pays with wallet"}</strong>
                </div>
                <div>
                  <span>Policy matched</span>
                  <strong>{agentDecision ? agentDecision.policy_matched : "local_demo_payment_simulation"}</strong>
                </div>
              </div>

              <p className="receipt-id">
                {receipt ? `RECEIPT ID ${receipt.receipt_id}` : "RECEIPT PENDING"}
              </p>
            </article>
          ) : null}

          {activeTab === "json" ? (
            <div className="json-shell">
              <div className="json-toolbar">
                <span className="card-label">JSON RECEIPT</span>
                <button className="button-secondary compact" type="button" onClick={handleCopyJson} disabled={!receiptJson}>
                  {copyStatus === "copied" ? "Copied" : "Copy JSON"}
                </button>
              </div>
              <pre className="json-panel dashboard-json" tabIndex={0}>
                {receiptJson || "{\n  \"receipt\": \"pending\"\n}"}
              </pre>
            </div>
          ) : null}
        </div>
      </section>

      <style jsx>{`
        .dashboard-shell {
          min-height: 100vh;
          padding: 24px 24px 40px;
        }

        .dashboard-stage {
          margin-bottom: 28px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
          gap: 24px;
        }

        .dashboard-main,
        .dashboard-side {
          display: grid;
          gap: 16px;
        }

        .diff-panel {
          background: var(--cyan);
        }

        .diff-pre {
          margin: 18px 0 0;
          white-space: pre-wrap;
          font-family: var(--font-mono);
          font-size: 13px;
          line-height: 1.55;
        }

        .action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
        }

        .button-secondary,
        .tab-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          border: 1px solid var(--ink);
          border-radius: 2px;
          padding: 0 16px;
          background: transparent;
          color: var(--ink);
          font-weight: 700;
          cursor: pointer;
          transition: transform 160ms ease, opacity 160ms ease, background-color 160ms ease, color 160ms ease;
        }

        .button-secondary:hover,
        .tab-button:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .button-secondary:disabled {
          border-color: var(--border);
          color: var(--ink-3);
          cursor: not-allowed;
          transform: none;
          opacity: 1;
        }

        .button-secondary.compact {
          min-height: 36px;
          padding: 0 12px;
        }

        .notice {
          border-radius: 16px;
          padding: 14px 16px;
          border: 1px solid var(--border);
          background: var(--paper);
          font-size: 14px;
          font-weight: 650;
        }

        .notice-error {
          border-color: rgba(162, 56, 48, 0.22);
          background: var(--pink);
          color: var(--critical);
        }

        .demo-gate {
          width: 100%;
        }

        .gate-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .quote-chip,
        .payment-meta-row span {
          display: inline-flex;
          min-height: 30px;
          align-items: center;
          border-radius: 999px;
          padding: 0 10px;
          border: 1px solid var(--border);
          background: var(--paper);
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .gate-meta span,
        .pipeline-pill,
        .seal-badge {
          display: inline-flex;
          min-height: 30px;
          align-items: center;
          border-radius: 999px;
          padding: 0 10px;
          border: 1px solid var(--border);
          background: var(--paper);
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .pipeline-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .pipeline-pill.done {
          background: var(--mint);
          color: var(--success);
        }

        .pipeline-pill.active {
          background: var(--butter);
          color: var(--warning);
        }

        .pipeline-pill.idle {
          background: var(--paper);
        }

        .metric-card {
          background: var(--paper);
        }

        .metric-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 18px 0 0;
        }

        .metric-row span {
          display: block;
          font-family: var(--font-display);
          font-size: clamp(34px, 4vw, 54px);
          line-height: 0.92;
          font-weight: 700;
        }

        .metric-row p {
          margin: 8px 0 0;
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .mini-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
        }

        .mini-metrics div {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px;
          background: var(--board-alt);
        }

        .mini-metrics span {
          display: block;
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .mini-metrics strong {
          display: block;
          margin-top: 8px;
          font-family: var(--font-display);
          font-size: 22px;
          line-height: 1;
        }

        .seal-card {
          background: var(--lavender);
        }

        .seal-card h3 {
          margin: 12px 0 10px;
          font-size: 28px;
          line-height: 1.05;
        }

        .seal-copy {
          margin-bottom: 16px;
          color: var(--ink-2);
        }

        .seal-badge {
          background: var(--paper);
          color: var(--ink);
        }

        .receipt-tabs {
          display: grid;
          gap: 18px;
        }

        .tab-list {
          display: inline-flex;
          gap: 8px;
          width: fit-content;
          padding: 4px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--paper);
        }

        .tab-button {
          border-color: transparent;
          min-height: 40px;
          background: transparent;
        }

        .tab-button.active {
          background: var(--ink);
          color: var(--background);
        }

        .receipt-summary {
          max-width: 920px;
        }

        .receipt-summary.is-block {
          background: var(--pink);
        }

        .finding-list {
          display: grid;
          gap: 12px;
          margin-top: 14px;
        }

        .finding-row {
          display: grid;
          gap: 4px;
          border-bottom: 1px dotted var(--border-strong);
          padding-bottom: 12px;
        }

        .finding-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .finding-row strong {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .finding-row p {
          margin-bottom: 0;
        }

        .decision-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 20px;
        }

        .payment-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .decision-strip div {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px;
          background: var(--paper);
        }

        .decision-strip span {
          display: block;
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .decision-strip strong {
          display: block;
          margin-top: 8px;
          font-size: 15px;
          line-height: 1.4;
        }

        .json-shell {
          display: grid;
          gap: 12px;
          max-width: 920px;
        }

        .json-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .dashboard-json {
          min-height: 420px;
          margin: 0;
        }

        @media (max-width: 1080px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .dashboard-shell {
            padding: 16px 16px 32px;
          }

          .dashboard-stage,
          .dashboard-receipt {
            padding: 58px 22px 28px;
          }

          .decision-strip,
          .metric-row,
          .mini-metrics {
            grid-template-columns: 1fr;
          }

          .action-row,
          .json-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .button-secondary,
          .tab-list,
          .tab-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function pause(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
