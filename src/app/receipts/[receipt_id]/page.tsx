import { notFound } from "next/navigation";
import { getArcscanTransactionUrl, isArcTransactionHash } from "@/lib/sigillum/arcscan";
import styles from "./page.module.css";

export default async function ReceiptPage(
  props: { params: Promise<{ receipt_id: string }> },
) {
  const { receipt_id: receiptId } = await props.params;
  const { findPublicReceiptByReceiptId } = await import("@/lib/server/sigillum-store");
  const receipt = await findPublicReceiptByReceiptId(receiptId);

  if (!receipt) {
    notFound();
  }

  const jsonPayload = `${JSON.stringify(receipt, null, 2)}\n`;

  return (
    <main className={styles.receiptPageShell}>
      <section className={styles.receiptProofBoard}>
        <div className="board-tab">PUBLIC RECEIPT</div>
        <div className={styles.receiptHero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>VERIFIED BY SIGILLUM</p>
            <h1>{receipt.receipt_id}</h1>
            <p>
              This persisted receipt records the paid inspection result for one real Sigillum action,
              including the payment settlement reference, deterministic findings, and the returned
              agent decision.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href={`/api/receipts/${receipt.receipt_id}?download=1`}>
                Download JSON
              </a>
              <a className={styles.secondaryAction} href={`/api/receipts/${receipt.receipt_id}`}>
                View API JSON
              </a>
            </div>
          </div>

          <article className={`${styles.artifactCard} ${styles.recommendationCard} ${styles[`tone${capitalize(receipt.recommendation)}`]}`} data-hover-card>
            <span className={styles.cardTape} />
            <p className={styles.cardLabel}>RECOMMENDATION</p>
            <strong>{receipt.recommendation.toUpperCase()}</strong>
            <p>Sigillum Risk Score {receipt.risk_score}</p>
          </article>
        </div>

        <div className={styles.metricGrid}>
          <MetricCard label="Paid" value={`${receipt.paid_amount_usdc} USDC`} />
          <MetricCard label="Changed Lines" value={String(receipt.inspected_units.changed_lines)} />
          <MetricCard label="Findings" value={String(receipt.findings.length)} />
          <MetricCard label="Decision" value={receipt.agent_decision.agent_decision.replaceAll("_", " ")} />
        </div>

        <div className={styles.artifactGrid}>
          <section className={`${styles.artifactCard} ${styles.hashCard}`} data-hover-card>
            <span className={styles.cardTape} />
            <p className={styles.cardLabel}>PAYMENT REFERENCE</p>
            {receipt.payment_reference ? (
              <code>{receipt.payment_reference}</code>
            ) : (
              <code>Unavailable</code>
            )}
          </section>
          <section className={`${styles.artifactCard} ${styles.hashCard}`} data-hover-card>
            <span className={styles.cardTape} />
            <p className={styles.cardLabel}>TRANSACTION HASH</p>
            {receipt.transaction_hash && isArcTransactionHash(receipt.transaction_hash) ? (
              <a
                className={styles.hashLink}
                href={getArcscanTransactionUrl(receipt.transaction_hash)}
                target="_blank"
                rel="noreferrer"
              >
                <code>{receipt.transaction_hash}</code>
              </a>
            ) : (
              <code>
                {receipt.settlement_scope === "batch"
                  ? "Gateway payment is part of a settlement batch; Arc hash not yet attributable."
                  : "Gateway payment confirmed; Arc settlement hash not yet attributable."}
              </code>
            )}
          </section>
          <section className={`${styles.artifactCard} ${styles.hashCard}`} data-hover-card>
            <span className={styles.cardTape} />
            <p className={styles.cardLabel}>RECEIPT HASH</p>
            <code>{receipt.receipt_hash}</code>
          </section>
        </div>

        <div className={styles.receiptDetailGrid}>
          <section className={styles.detailPanel}>
            <p className={styles.cardLabel}>RECEIPT DETAILS</p>
            <div className={styles.detailList}>
              <DetailRow label="Action ID" value={receipt.action_id} />
              <DetailRow label="Agent" value={receipt.agent_name} />
              <DetailRow label="Action Type" value={receipt.action_type} />
              <DetailRow label="Rail" value={receipt.rail ?? "Unavailable"} />
              <DetailRow label="Network" value={receipt.network ?? "Unavailable"} />
              <DetailRow
                label="Settlement Status"
                value={receipt.settlement_status ? receipt.settlement_status.replaceAll("_", " ") : "Unavailable"}
              />
              <DetailRow
                label="Settlement Scope"
                value={receipt.settlement_scope ? receipt.settlement_scope.replaceAll("_", " ") : "Unavailable"}
              />
              <DetailRow
                label="Settlement Source"
                value={receipt.settlement_source ? receipt.settlement_source.replaceAll("_", " ") : "Unavailable"}
              />
              <DetailRow label="Batch Reference" value={receipt.batch_reference ?? "Unavailable"} />
              <DetailRow
                label="Transaction Confirmed"
                value={receipt.transaction_confirmed_at ? formatTimestamp(receipt.transaction_confirmed_at) : "Unavailable"}
              />
              <DetailRow label="Timestamp" value={formatTimestamp(receipt.timestamp)} />
              <DetailRow label="Seal" value={receipt.seal} />
            </div>
          </section>

          <section className={styles.detailPanel}>
            <p className={styles.cardLabel}>AGENT DECISION</p>
            <div className={styles.detailList}>
              <DetailRow label="Decision" value={receipt.agent_decision.agent_decision} />
              <DetailRow label="Policy Matched" value={receipt.agent_decision.policy_matched} />
              <DetailRow label="Next Action" value={receipt.agent_decision.next_action} />
              <DetailRow label="Reason" value={receipt.agent_decision.reason} />
            </div>
          </section>
        </div>

        <section className={styles.findingPanel}>
          <p className={styles.cardLabel}>FINDINGS</p>
          {receipt.findings.length > 0 ? (
            <div className={styles.findingList}>
              {receipt.findings.map((finding, index) => (
                <article className={styles.findingRow} key={`${finding.category}-${finding.file ?? "nofile"}-${index}`}>
                  <strong>{finding.category}</strong>
                  <p>{finding.message}</p>
                  <span>
                    {finding.severity.toUpperCase()}
                    {finding.file ? ` | ${finding.file}${finding.line ? `:${finding.line}` : ""}` : ""}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyCopy}>No findings were recorded for this receipt.</p>
          )}
        </section>

        <section className={`${styles.artifactCard} ${styles.patchCard}`} data-hover-card>
          <span className={styles.cardTape} />
          <p className={styles.cardLabel}>PATCH RECOMMENDATION</p>
          <p>{receipt.patch_recommendation}</p>
        </section>

        <section className={styles.jsonShell}>
          <div className={styles.jsonToolbar}>
            <span className={styles.cardLabel}>CANONICAL RECEIPT JSON</span>
            <span className={styles.toolbarStamp}>SERVER PAYLOAD</span>
          </div>
          <pre className={styles.jsonPanel}>{jsonPayload}</pre>
        </section>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.metricCard}>
      <span className={styles.metricLabel}>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
