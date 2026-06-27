"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { getArcscanTransactionUrl, isArcTransactionHash } from "@/lib/sigillum/arcscan";
import type { AgentDecision, Finding, InspectedUnits, Quote, SigillumReceipt } from "@/lib/sigillum/types";

type PaymentSnapshot = {
  amount?: string;
  currency?: string;
  payment_reference?: string;
  transaction_hash?: string;
  rail?: string;
  mode?: string;
  network?: string;
};

type LiveActionRecord = {
  id: string;
  status?: string;
  actionType?: string;
  currentStage?: string;
  safeSummary?: string;
  sourceHash?: string;
  findingsCategories: string[];
  fileTypes: string[];
  transactionHash?: string;
  paymentReference?: string;
  createdAt?: string;
  updatedAt?: string;
  quote?: Quote | null;
  receipt?: SigillumReceipt | null;
  receiptId?: string;
  inspectedUnits?: InspectedUnits | null;
  agentDecision?: AgentDecision | null;
  payment?: PaymentSnapshot | null;
  raw: Record<string, unknown>;
};

type LiveActionsPayload = {
  records: LiveActionRecord[];
  sourceAvailable: boolean;
  errorMessage?: string;
  lastUpdatedAt?: string;
};

type DashboardClientProps = {
  initialResponse: {
    ok: boolean;
    status?: number;
    body: unknown;
  };
};

const POLL_INTERVAL_MS = 15000;

export function DashboardClient({ initialResponse }: DashboardClientProps) {
  const [payload, setPayload] = useState(() => buildLiveActionsPayload(initialResponse));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"board" | "json">("board");

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      setIsRefreshing(true);

      try {
        const response = await fetch("/api/actions/live", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });
        const nextPayload = await readLiveActionsResponse(response);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPayload(nextPayload);
        });
      } catch {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPayload((current) => ({
            ...current,
            errorMessage: current.sourceAvailable ? "Live actions refresh failed." : "Live actions feed is unavailable.",
          }));
        });
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const jsonView = useMemo(() => JSON.stringify(payload.records.map((record) => record.raw), null, 2), [payload.records]);
  const hasRecords = payload.records.length > 0;
  const activeInspections = payload.records.filter((record) =>
    record.currentStage === "payment_confirmed" || record.currentStage === "inspection_running",
  );
  const receiptRecords = payload.records.filter((record) => Boolean(record.receiptId));
  const decisionRecords = payload.records.filter((record) => Boolean(record.agentDecision));
  const paymentTimeline = payload.records.filter((record) => Boolean(record.payment?.payment_reference || record.payment?.transaction_hash));

  return (
    <main className="dashboard-shell">
      <section className="proof-board-section dashboard-stage">
        <div className="board-tab">LIVE ACTIONS</div>
        <div className="board-copy">
          <p className="eyebrow">PERSISTED RECEIPTS</p>
          <h1>Real Sigillum actions, polled from the live feed.</h1>
          <p>
            The dashboard reads persisted actions from <code>/api/actions/live</code>, refreshes on an interval, and keeps the
            receipt, payment, and decision fields aligned to the stored response.
          </p>
        </div>

        <div className="dashboard-toolbar" aria-live="polite">
          <div className="tab-list">
            <button
              className={activeTab === "board" ? "tab-button active" : "tab-button"}
              type="button"
              onClick={() => setActiveTab("board")}
            >
              Live Board
            </button>
            <button
              className={activeTab === "json" ? "tab-button active" : "tab-button"}
              type="button"
              onClick={() => setActiveTab("json")}
            >
              Raw JSON
            </button>
          </div>
          <div className="toolbar-meta">
            <span className={`status-chip ${payload.sourceAvailable ? "pass" : "warn"}`}>
              {payload.sourceAvailable ? "Feed available" : "Feed unavailable"}
            </span>
            <span className="toolbar-stamp">
              {isRefreshing
                ? "Refreshing"
                : payload.lastUpdatedAt
                  ? `Updated ${formatTimestamp(payload.lastUpdatedAt)}`
                  : "Waiting for first payload"}
            </span>
          </div>
        </div>

        {payload.errorMessage ? (
          <div className="notice notice-error" role="alert">
            {payload.errorMessage}
          </div>
        ) : null}

        {activeTab === "board" ? (
          hasRecords ? (
            <div className="board-sections">
              <SectionHeader
                label="Live Agent Activity"
                meta={`${payload.records.length} real action${payload.records.length === 1 ? "" : "s"}`}
              />
              <div className="action-grid">
                {payload.records.map((record) => (
                  <article className="action-card" data-hover-card key={record.id}>
                    <div className="action-card-header">
                      <div>
                        <p className="card-label">ACTION RECORD</p>
                        <h2>{record.receiptId ?? record.quote?.quote_id ?? record.id}</h2>
                      </div>
                      <span className={`status-chip ${getStatusTone(record)}`}>{getStatusLabel(record)}</span>
                    </div>

                    <div className="metric-row">
                      <Metric label="Agent" value={record.raw.agent_name ? String(record.raw.agent_name) : "Unknown"} />
                      <Metric label="Action" value={formatLabel(record.actionType ?? "code_change")} />
                      <Metric label="Status" value={formatLabel(record.currentStage ?? record.status ?? "recorded")} />
                      {record.receipt?.score !== undefined ? <Metric label="Risk Score" value={String(record.receipt.score)} /> : null}
                      {record.agentDecision ? <Metric label="Decision" value={formatLabel(record.agentDecision.agent_decision)} /> : null}
                      {record.payment?.amount ? <Metric label="Payment" value={`${record.payment.amount} USDC`} /> : null}
                    </div>

                    <div className="detail-grid">
                      <DetailBlock label="Receipt" value={record.receiptId ?? "Pending"} />
                      <DetailBlock label="Rail" value={record.payment?.rail ?? "Unavailable"} />
                      <DetailBlock label="Network" value={record.payment?.network ?? "Unavailable"} />
                      <DetailBlock label="Source Hash" value={record.sourceHash ? truncateHash(record.sourceHash) : "Unavailable"} />
                    </div>

                    <div className="meta-strip">
                      {record.quote?.quote_id ? <Chip>{record.quote.quote_id}</Chip> : null}
                      {record.receiptId ? <Chip>{record.receiptId}</Chip> : null}
                      {record.fileTypes.length > 0 ? <Chip>{record.fileTypes.join(", ")}</Chip> : null}
                      {record.findingsCategories.length > 0 ? <Chip>{record.findingsCategories.join(", ")}</Chip> : null}
                      {record.createdAt ? <Chip>{formatTimestamp(record.createdAt)}</Chip> : null}
                    </div>

                    {record.safeSummary ? <p className="safe-summary">{record.safeSummary}</p> : null}

                    <div className="link-row">
                      {record.transactionHash ? (
                        <a
                          className="tx-link"
                          href={getArcscanTransactionUrl(record.transactionHash)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Transaction Hash: {truncateHash(record.transactionHash)}
                        </a>
                      ) : record.paymentReference ? (
                        <span className="proof-label">Payment Reference: {truncateHash(record.paymentReference)}</span>
                      ) : null}
                      {record.receiptId ? (
                        <a className="tx-link" href={`/receipts/${record.receiptId}`}>
                          Receipt Page
                        </a>
                      ) : null}
                      {record.receiptId ? (
                        <a className="tx-link" href={`/api/receipts/${record.receiptId}?download=1`}>
                          Download Receipt
                        </a>
                      ) : null}
                    </div>

                    {record.receipt?.recommendation || record.receipt?.patch_recommendation ? (
                      <div className="artifact-row">
                        {record.receipt?.recommendation ? (
                          <section className={`artifact-card recommendation-card tone-${record.receipt.recommendation}`} data-hover-card>
                            <span className="card-tape" />
                            <p className="card-label">RECOMMENDATION</p>
                            <strong>{record.receipt.recommendation.toUpperCase()}</strong>
                          </section>
                        ) : null}
                        {record.receipt?.patch_recommendation ? (
                          <section className="artifact-card patch-card" data-hover-card>
                            <span className="card-tape" />
                            <p className="card-label">PATCH RECOMMENDATION</p>
                            <p>{record.receipt.patch_recommendation}</p>
                          </section>
                        ) : null}
                      </div>
                    ) : null}

                    {record.agentDecision ? (
                      <div className="decision-strip">
                        <DecisionCell label="Agent decision" value={record.agentDecision.agent_decision} />
                        <DecisionCell label="Next action" value={record.agentDecision.next_action} />
                        <DecisionCell label="Policy matched" value={record.agentDecision.policy_matched} />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="dashboard-section-grid">
                <InfoSection
                  title="Active Inspections"
                  subtitle="Actions currently in payment-confirmed or inspection-running states."
                  emptyState="No active inspections right now."
                  items={activeInspections.map((record) => ({
                    title: record.raw.agent_name ? `${record.raw.agent_name}` : record.id,
                    value: formatLabel(record.currentStage ?? "pending"),
                    meta: record.safeSummary ?? "Inspection summary unavailable.",
                    detail: record.inspectedUnits ? summarizeInspectedUnits(record.inspectedUnits) : "Inspected units unavailable.",
                    href: record.receiptId ? `/receipts/${record.receiptId}` : undefined,
                  }))}
                />
                <InfoSection
                  title="Payment Timeline"
                  subtitle="Settled x402 payments show a truthful payment reference, plus an Arc link only when a real onchain hash exists."
                  emptyState="No settled payments yet."
                  items={paymentTimeline.map((record) => ({
                    title: record.payment?.amount ? `${record.payment.amount} USDC` : "Payment",
                    value: record.payment?.network ?? "Arc testnet",
                    meta: record.paymentReference
                      ? `Payment reference ${truncateHash(record.paymentReference)}`
                      : "Payment reference unavailable.",
                    detail: record.transactionHash
                      ? `Onchain hash ${truncateHash(record.transactionHash)}`
                      : "No Arc transaction hash recorded yet.",
                    href: record.transactionHash ? getArcscanTransactionUrl(record.transactionHash) : undefined,
                    external: Boolean(record.transactionHash),
                  }))}
                />
                <InfoSection
                  title="Receipt Feed"
                  subtitle="Public-safe receipt IDs, finding categories, and safe summaries only."
                  emptyState="No receipts have been issued yet."
                  items={receiptRecords.map((record) => ({
                    title: record.receiptId ?? record.id,
                    value: record.receipt?.recommendation ? record.receipt.recommendation.toUpperCase() : "RECEIPT",
                    meta: record.findingsCategories.length > 0 ? record.findingsCategories.join(", ") : "No finding categories recorded.",
                    detail: record.safeSummary ?? "Safe summary unavailable.",
                    href: record.receiptId ? `/receipts/${record.receiptId}` : undefined,
                  }))}
                />
                <InfoSection
                  title="Agent Decisions"
                  subtitle="Machine-readable decisions returned from persisted Sigillum receipts."
                  emptyState="No agent decisions yet."
                  items={decisionRecords.map((record) => ({
                    title: record.raw.agent_name ? `${record.raw.agent_name}` : record.id,
                    value: record.agentDecision ? formatLabel(record.agentDecision.agent_decision) : "Pending",
                    meta: record.agentDecision?.reason ?? "No decision reason recorded.",
                    detail: record.agentDecision?.next_action ?? "Next action unavailable.",
                    href: record.receiptId ? `/receipts/${record.receiptId}` : undefined,
                  }))}
                />
                <InfoSection
                  title="Downloadable Receipts"
                  subtitle="Canonical JSON receipts only, sourced from persisted database records."
                  emptyState="No downloadable receipts yet."
                  items={receiptRecords.map((record) => ({
                    title: record.receiptId ?? record.id,
                    value: "DOWNLOAD JSON",
                    meta: record.paymentReference
                      ? `Payment reference ${truncateHash(record.paymentReference)}`
                      : "No settled payment reference recorded.",
                    detail: record.transactionHash
                      ? `Transaction hash ${truncateHash(record.transactionHash)}`
                      : "No settled transaction hash recorded.",
                    href: record.receiptId ? `/api/receipts/${record.receiptId}?download=1` : undefined,
                  }))}
                />
              </div>
            </div>
          ) : (
            <section className="empty-state" aria-live="polite">
              <p className="card-label">NO PERSISTED ACTIONS</p>
              <h2>The live board is ready for the first stored receipt.</h2>
              <p>When Sigillum persists an action, its receipt, payment, and agent decision will appear here.</p>
            </section>
          )
        ) : (
          <div className="json-shell">
            <div className="json-toolbar">
              <span className="card-label">LIVE ACTION PAYLOAD</span>
              <span className="toolbar-stamp">{hasRecords ? `${payload.records.length} record${payload.records.length === 1 ? "" : "s"}` : "0 records"}</span>
            </div>
            <pre className="json-panel dashboard-json" tabIndex={0}>
              {jsonView || "[]"}
            </pre>
          </div>
        )}
      </section>

      <style jsx>{`
        .dashboard-shell {
          min-height: 100vh;
          padding: 24px 24px 40px;
        }

        .dashboard-stage {
          display: grid;
          gap: 24px;
        }

        .board-copy h1 {
          margin: 10px 0 18px;
          font-size: clamp(34px, 5vw, 64px);
          font-weight: 610;
          letter-spacing: -0.04em;
          line-height: 1;
          font-family: var(--font-display);
        }

        .board-copy p:last-child {
          max-width: 760px;
          color: var(--ink-2);
          font-size: clamp(16px, 1.7vw, 19px);
          line-height: 1.62;
          margin-bottom: 0;
        }

        .board-copy code {
          font-family: var(--font-mono);
          font-size: 0.92em;
        }

        .dashboard-toolbar,
        .toolbar-meta,
        .json-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          border: 1px solid transparent;
          border-radius: 5px;
          padding: 0 14px;
          background: transparent;
          color: var(--ink-2);
          font-weight: 800;
          cursor: pointer;
          transition: transform 160ms ease, opacity 160ms ease, background-color 160ms ease, color 160ms ease;
        }

        .tab-button:hover {
          opacity: 0.92;
          transform: translateY(-1px);
        }

        .tab-button.active {
          background: var(--ink);
          color: var(--background);
        }

        .toolbar-stamp {
          color: var(--ink-2);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .status-chip.pass {
          background: var(--mint);
          color: var(--success);
        }

        .status-chip.warn {
          background: var(--butter);
          color: var(--warning);
        }

        .status-chip.block {
          background: var(--pink);
          color: var(--critical);
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

        .action-grid {
          display: grid;
          gap: 20px;
        }

        .board-sections,
        .dashboard-section-grid {
          display: grid;
          gap: 20px;
        }

        .dashboard-section-grid {
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        }

        .section-header,
        .link-row,
        .detail-grid {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .section-title {
          margin: 0;
          font-size: clamp(22px, 2.5vw, 30px);
          line-height: 1.05;
        }

        .action-card {
          display: grid;
          gap: 18px;
          border: 1px solid rgba(17, 19, 24, 0.08);
          border-radius: 28px;
          padding: clamp(22px, 3vw, 32px);
          background: var(--paper);
          box-shadow: 0 18px 48px rgba(17, 19, 24, 0.1);
        }

        .action-card-header {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .action-card-header h2,
        .empty-state h2 {
          margin: 8px 0 0;
          font-size: clamp(24px, 3vw, 42px);
          line-height: 1.02;
        }

        .metric-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }

        .metric-box,
        .decision-strip div,
        .detail-block {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          background: var(--board-alt);
        }

        .metric-box span,
        .decision-strip span,
        .detail-block span {
          display: block;
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .metric-box strong {
          display: block;
          margin-top: 10px;
          font-family: var(--font-display);
          font-size: clamp(28px, 4vw, 46px);
          line-height: 0.94;
        }

        .metric-box strong,
        .detail-block strong {
          word-break: break-word;
        }

        .meta-strip,
        .artifact-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .chip {
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

        .artifact-row {
          display: grid;
          grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr);
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .safe-summary {
          margin: 0;
          color: var(--ink-2);
          line-height: 1.55;
        }

        .link-row {
          justify-content: flex-start;
        }

        .tx-link {
          color: var(--ink);
          text-decoration: underline;
          text-decoration-style: dotted;
          text-underline-offset: 4px;
          font-weight: 700;
        }

        .tx-link:hover {
          opacity: 0.82;
        }

        .recommendation-card,
        .patch-card {
          min-height: 100%;
        }

        .recommendation-card strong {
          display: block;
          margin-top: 18px;
          font-size: clamp(28px, 4vw, 44px);
          line-height: 0.98;
        }

        .tone-pass {
          background: var(--mint);
        }

        .tone-warn {
          background: var(--butter);
        }

        .tone-block {
          background: var(--pink);
        }

        .patch-card {
          background: var(--lavender);
        }

        .patch-card p {
          margin: 18px 0 0;
          color: var(--ink);
          line-height: 1.55;
        }

        .decision-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .decision-strip strong {
          display: block;
          margin-top: 8px;
          font-size: 15px;
          line-height: 1.4;
        }

        .finding-panel {
          border-radius: 18px;
          padding: 20px;
          background: var(--raised);
        }

        .finding-panel > span {
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
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

        .finding-row p,
        .empty-state p {
          margin-bottom: 0;
          color: var(--ink-2);
          line-height: 1.55;
        }

        .proof-label {
          display: inline-flex;
          align-items: center;
          min-height: 38px;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 0 14px;
          background: var(--board-alt);
          color: var(--ink-2);
          font-size: 13px;
          font-weight: 700;
        }

        .empty-state {
          border: 1px dashed rgba(17, 19, 24, 0.18);
          border-radius: 28px;
          padding: clamp(28px, 5vw, 48px);
          background: var(--board-alt);
        }

        .json-shell {
          display: grid;
          gap: 12px;
        }

        .dashboard-json {
          min-height: 420px;
          margin: 0;
          width: 100%;
          border-radius: 28px;
          padding: clamp(24px, 5vw, 42px);
          background: var(--paper);
          border: 1px solid rgba(17, 19, 24, 0.08);
          box-shadow: 0 18px 48px rgba(17, 19, 24, 0.1);
          overflow-x: auto;
        }

        @media (max-width: 760px) {
          .dashboard-shell {
            padding: 16px 16px 32px;
          }

          .dashboard-stage {
            padding: 58px 22px 28px;
          }

          .tab-list,
          .tab-button {
            width: 100%;
          }

          .artifact-row,
          .decision-strip,
          .dashboard-section-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-block">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DecisionCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="chip">{children}</span>;
}

function SectionHeader({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{label}</h2>
      </div>
      <span className="toolbar-stamp">{meta}</span>
    </div>
  );
}

function InfoSection({
  title,
  subtitle,
  emptyState,
  items,
}: {
  title: string;
  subtitle: string;
  emptyState: string;
  items: Array<{
    title: string;
    value: string;
    meta: string;
    detail?: string;
    href?: string;
    external?: boolean;
  }>;
}) {
  return (
    <section className="artifact-card dashboard-section-panel" data-hover-card>
      <span className="card-tape" />
      <div className="dashboard-section-panel-header">
        <div>
          <h3 className="dashboard-panel-title">{title}</h3>
          <p className="dashboard-section-subtitle">{subtitle}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="dashboard-section-panel-items">
          {items.map((item, index) => (
            <article className="dashboard-section-item" key={`${title}-${item.title}-${index}`}>
              <div className="dashboard-section-item-header">
                <strong>{item.title}</strong>
                <span className="card-label">{item.value}</span>
              </div>
              <p>{item.meta}</p>
              {item.detail ? <p className="dashboard-section-detail">{item.detail}</p> : null}
              {item.href ? (
                <a
                  className="dashboard-section-link"
                  href={item.href}
                  rel={item.external ? "noreferrer" : undefined}
                  target={item.external ? "_blank" : undefined}
                >
                  {item.external ? "Open transaction" : "Open receipt"}
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="dashboard-section-empty">{emptyState}</p>
      )}
    </section>
  );
}

function getStatusLabel(record: LiveActionRecord) {
  return (
    record.receipt?.recommendation ??
    record.status ??
    record.agentDecision?.agent_decision ??
    "recorded"
  )
    .replaceAll("_", " ")
    .toUpperCase();
}

function getStatusTone(record: LiveActionRecord) {
  if (record.receipt?.recommendation) {
    return record.receipt.recommendation;
  }

  const normalized = (record.status ?? record.agentDecision?.agent_decision ?? "").toLowerCase();
  if (normalized.includes("block") || normalized.includes("stop")) {
    return "block";
  }
  if (normalized.includes("warn") || normalized.includes("patch") || normalized.includes("review")) {
    return "warn";
  }
  return "pass";
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function truncateHash(value: string) {
  if (value.length <= 20) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

async function readLiveActionsResponse(response: Response): Promise<LiveActionsPayload> {
  return buildLiveActionsPayload({
    ok: response.ok,
    status: response.status,
    body: (await response.json().catch(() => null)) as unknown,
  });
}

export function buildLiveActionsPayload({
  ok,
  status,
  body,
}: {
  ok: boolean;
  status?: number;
  body: unknown;
}): LiveActionsPayload {
  const lastUpdatedAt = new Date().toISOString();

  if (!ok) {
    const bodyRecord =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const message =
      (typeof bodyRecord?.message === "string" && bodyRecord.message) ||
      (typeof bodyRecord?.error === "string" && bodyRecord.error) ||
      undefined;

    return {
      records: [],
      sourceAvailable: false,
      errorMessage:
        message ??
        (status === 404 ? "Live actions feed is unavailable." : "Live actions request failed."),
      lastUpdatedAt,
    };
  }

  return {
    records: normalizeLiveActionsPayload(body),
    sourceAvailable: true,
    lastUpdatedAt,
  };
}

function normalizeLiveActionsPayload(payload: unknown): LiveActionRecord[] {
  const records = extractRecordList(payload);

  return records
    .map((entry, index) => normalizeRecord(entry, index))
    .filter((record): record is LiveActionRecord => record !== null);
}

function extractRecordList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const container = payload as Record<string, unknown>;

  if (Array.isArray(container.actions)) {
    return container.actions;
  }
  if (Array.isArray(container.data)) {
    return container.data;
  }
  if (Array.isArray(container.items)) {
    return container.items;
  }
  if (Array.isArray(container.records)) {
    return container.records;
  }

  return [];
}

function normalizeRecord(entry: unknown, index: number): LiveActionRecord | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const raw = entry as Record<string, unknown>;
  const quote = normalizeQuote(raw.quote ?? raw);
  const receipt = normalizeReceipt(raw.receipt ?? raw);
  const agentDecision = normalizeAgentDecision(
    typeof raw.agent_decision === "object" && raw.agent_decision !== null ? raw.agent_decision : raw,
  );
  const payment = normalizePayment(raw.payment ?? raw);

  return {
    id:
      readString(raw.id) ??
      readString(raw.action_id) ??
      receipt?.receipt_id ??
      quote?.quote_id ??
      `live-action-${index}`,
    status: readString(raw.status) ?? readString(raw.current_stage) ?? receipt?.recommendation ?? agentDecision?.agent_decision,
    actionType: readString(raw.action_type) ?? undefined,
    currentStage: readString(raw.current_stage) ?? undefined,
    safeSummary: readString(raw.safe_summary) ?? undefined,
    sourceHash: readString(raw.source_hash) ?? undefined,
    findingsCategories: normalizeStringList(raw.findings_categories),
    fileTypes: normalizeStringList(raw.file_types),
    transactionHash: readString(raw.transaction_hash) ?? undefined,
    paymentReference: readString(raw.payment_reference) ?? undefined,
    createdAt: readString(raw.created_at) ?? readString(raw.createdAt) ?? receipt?.timestamp,
    updatedAt: readString(raw.updated_at) ?? readString(raw.updatedAt) ?? undefined,
    quote,
    receipt,
    receiptId: readString(raw.receipt_id) ?? receipt?.receipt_id ?? undefined,
    inspectedUnits: normalizeInspectedUnits(raw.inspected_units) ?? receipt?.inspected_units ?? quote?.inspected_units ?? null,
    agentDecision,
    payment,
    raw,
  };
}

function normalizeQuote(value: unknown): Quote | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const quoteId = readString(raw.quote_id);
  const amount = readString(raw.amount);
  const expiresAt = readString(raw.expires_at);
  const inspectedUnits = normalizeInspectedUnits(raw.inspected_units);

  if (!quoteId || !amount || !expiresAt || !inspectedUnits) {
    return null;
  }

  return {
    quote_id: quoteId,
    currency: readString(raw.currency) === "USDC" ? "USDC" : "USDC",
    amount,
    inspected_units: inspectedUnits,
    expires_at: expiresAt,
  };
}

function normalizeReceipt(value: unknown): SigillumReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const receiptId = readString(raw.receipt_id);
  const seal = readString(raw.seal);
  const recommendation = readString(raw.recommendation);
  const paidAmount = readString(raw.paid_amount_usdc);
  const patchRecommendation = readString(raw.patch_recommendation);
  const timestamp = readString(raw.timestamp);
  const inspectedUnits = normalizeInspectedUnits(raw.inspected_units);

  if (
    !receiptId ||
    !seal ||
    !paidAmount ||
    !patchRecommendation ||
    !timestamp ||
    !inspectedUnits ||
    !isRecommendation(recommendation)
  ) {
    return null;
  }

  return {
    receipt_id: receiptId,
    seal: seal === "Verified by Sigillum" ? "Verified by Sigillum" : "Verified by Sigillum",
    score: readNumber(raw.score) ?? 0,
    recommendation,
    paid_amount_usdc: paidAmount,
    inspected_units: inspectedUnits,
    findings: normalizeFindings(raw.findings),
    patch_recommendation: patchRecommendation,
    timestamp,
  };
}

function normalizeAgentDecision(value: unknown): AgentDecision | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const agentDecision = readString(raw.agent_decision);
  const reason = readString(raw.reason);
  const nextAction = readString(raw.next_action);
  const policyMatched = readString(raw.policy_matched);

  if (!agentDecision || !reason || !nextAction || !policyMatched) {
    return null;
  }

  if (agentDecision !== "continue_merge" && agentDecision !== "request_patch" && agentDecision !== "stop_merge") {
    return null;
  }

  return {
    agent_decision: agentDecision,
    reason,
    next_action: nextAction,
    policy_matched: policyMatched,
  };
}

function normalizePayment(value: unknown): PaymentSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  return {
    amount: readString(raw.amount) ?? undefined,
    currency: readString(raw.currency) ?? undefined,
    transaction_hash: normalizeTransactionHash(readString(raw.transaction_hash)),
    payment_reference: readString(raw.payment_reference) ?? undefined,
    rail: readString(raw.rail) ?? undefined,
    mode: readString(raw.mode) ?? undefined,
    network: readString(raw.network) ?? undefined,
  };
}

function normalizeTransactionHash(value: string | null) {
  return value && isArcTransactionHash(value) ? value : undefined;
}

function summarizeInspectedUnits(units: InspectedUnits) {
  return `${units.changed_lines} lines, ${units.ast_nodes} AST nodes, ${units.strings} strings`;
}

function normalizeInspectedUnits(value: unknown): InspectedUnits | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const changedLines = readNumber(raw.changed_lines);
  const astNodes = readNumber(raw.ast_nodes);
  const dependencyChanges = readNumber(raw.dependency_changes);
  const configMutations = readNumber(raw.config_mutations);
  const strings = readNumber(raw.strings);

  if (
    changedLines === null ||
    astNodes === null ||
    dependencyChanges === null ||
    configMutations === null ||
    strings === null
  ) {
    return null;
  }

  return {
    changed_lines: changedLines,
    ast_nodes: astNodes,
    dependency_changes: dependencyChanges,
    config_mutations: configMutations,
    strings,
  };
}

function normalizeFindings(value: unknown): Finding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const raw = entry as Record<string, unknown>;
    const severity = readString(raw.severity);
    const category = readString(raw.category);
    const message = readString(raw.message);

    if (!severity || !category || !message) {
      return [];
    }

    return [
      {
        severity: isSeverity(severity) ? severity : "info",
        category,
        message,
        file: readString(raw.file) ?? undefined,
        line: readNumber(raw.line) ?? undefined,
      },
    ];
  });
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecommendation(value: string | null): value is SigillumReceipt["recommendation"] {
  return value === "pass" || value === "warn" || value === "block";
}

function isSeverity(value: string): value is Finding["severity"] {
  return value === "info" || value === "low" || value === "medium" || value === "high" || value === "critical";
}
