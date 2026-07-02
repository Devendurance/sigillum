"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { getArcscanTransactionUrl } from "@/lib/sigillum/arcscan";
import type { DashboardInitialResponse, LiveActionRecord, LifecycleEventRecord } from "./live-actions-data";
import {
  buildLiveActionsPayload,
  describeLifecycleEvent,
  describeSettlementProof,
  formatLabel,
  formatTimestamp,
  getStatusLabel,
  getStatusTone,
  readLiveActionsResponse,
  summarizeInspectedUnits,
  truncateHash,
} from "./live-actions-data";
import styles from "./dashboard-view.module.css";

type DashboardClientProps = {
  initialResponse: DashboardInitialResponse;
  mode?: "overview" | "timeline";
};

const POLL_INTERVAL_MS = 15000;
const MOBILE_OVERVIEW_MAX_ITEMS = 6;
const MOBILE_MEDIA_QUERY = "(max-width: 980px)";

export function DashboardClient({ initialResponse, mode = "overview" }: DashboardClientProps) {
  const [payload, setPayload] = useState(() => buildLiveActionsPayload(initialResponse));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  const timelineRecords = useMemo(
    () => payload.records.filter((record) => record.lifecycleEvents.length > 0).slice(0, 6),
    [payload.records],
  );
  const paymentRecords = useMemo(
    () => payload.records.filter((record) => Boolean(record.payment?.payment_reference || record.payment?.transaction_hash)),
    [payload.records],
  );
  const decisionRecords = useMemo(
    () => payload.records.filter((record) => Boolean(record.agentDecision)),
    [payload.records],
  );
  const visibleActivityRecords = useMemo(
    () => (isMobileViewport ? payload.records.slice(0, MOBILE_OVERVIEW_MAX_ITEMS) : payload.records),
    [isMobileViewport, payload.records],
  );
  const visiblePaymentRecords = useMemo(
    () => (isMobileViewport ? paymentRecords.slice(0, MOBILE_OVERVIEW_MAX_ITEMS) : paymentRecords),
    [isMobileViewport, paymentRecords],
  );
  const visibleDecisionRecords = useMemo(
    () => (isMobileViewport ? decisionRecords.slice(0, MOBILE_OVERVIEW_MAX_ITEMS) : decisionRecords),
    [decisionRecords, isMobileViewport],
  );
  const selectedRecord = useMemo(
    () => payload.records.find((record) => record.id === selectedId) ?? null,
    [payload.records, selectedId],
  );
  const hasRecords = payload.records.length > 0;

  useEffect(() => {
    if (!selectedRecord) {
      return;
    }

    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedRecord]);

  return (
    <main className={styles.page}>
      <section className={`proof-board-section ${styles.board}`}>
        <div className="board-tab">{mode === "overview" ? "AGENT DASHBOARD" : "LIVE ACTIVITY TIMELINE"}</div>

        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderCopy}>
            <p className={styles.eyebrow}>
              {mode === "overview" ? "Persisted proof surfaces" : "Recent 6 persisted timelines"}
            </p>
            <h1 className={styles.pageTitle}>
              {mode === "overview" ? "Agent Dashboard" : "Live Activity Timeline"}
            </h1>
            <p className={styles.pageLead}>
              {mode === "overview"
                ? "Compact proof panels show real persisted activity only. Open any action to inspect the full lifecycle, payment proof, receipt links, and agent decision."
                : "The timeline page standardizes the latest six persisted action histories so viewers can track live Sigillum movement without oversized cards or broken wrapping."}
            </p>
          </div>
          <div className={styles.headerMeta}>
            <span
              className={`${styles.statusChip} ${
                payload.sourceAvailable ? styles.statusPass : styles.statusWarn
              }`}
            >
              {payload.sourceAvailable ? "Feed available" : "Feed unavailable"}
            </span>
            <span className={styles.panelCount}>
              {isRefreshing
                ? "Refreshing"
                : payload.lastUpdatedAt
                  ? `Updated ${formatTimestamp(payload.lastUpdatedAt)}`
                  : "Waiting for data"}
            </span>
          </div>
        </header>

        {payload.errorMessage ? (
          <div className={styles.feedError} role="alert">
            {payload.errorMessage}
          </div>
        ) : null}

        {mode === "overview" ? (
          <OverviewBoard
            decisionRecords={visibleDecisionRecords}
            hasRecords={hasRecords}
            isMobileViewport={isMobileViewport}
            onOpenDetails={setSelectedId}
            paymentRecords={visiblePaymentRecords}
            records={visibleActivityRecords}
            totalDecisionCount={decisionRecords.length}
            totalPaymentCount={paymentRecords.length}
            totalRecordCount={payload.records.length}
          />
        ) : (
          <TimelineBoard hasRecords={timelineRecords.length > 0} onOpenDetails={setSelectedId} records={timelineRecords} />
        )}
      </section>

      {selectedRecord ? (
        <>
          <button
            aria-label="Close activity details"
            className={styles.drawerBackdrop}
            onClick={() => setSelectedId(null)}
            type="button"
          />
          <aside
            aria-labelledby="dashboard-drawer-title"
            aria-modal="true"
            className={styles.drawer}
            role="dialog"
          >
            <div className={styles.drawerShell}>
              <div className={styles.drawerHeader}>
                <div className={styles.drawerHeaderCopy}>
                  <p className={styles.drawerMeta}>Action detail</p>
                  <h2 className={styles.drawerTitle} id="dashboard-drawer-title">
                    {selectedRecord.receiptId ?? selectedRecord.quote?.quote_id ?? selectedRecord.id}
                  </h2>
                  <p className={styles.pageLead}>
                    {selectedRecord.safeSummary ?? "Persisted action proof for this Sigillum inspection."}
                  </p>
                </div>
                <button
                  aria-label="Close activity details"
                  className={styles.closeButton}
                  onClick={() => setSelectedId(null)}
                  ref={closeButtonRef}
                  type="button"
                >
                  ×
                </button>
              </div>

              <div className={styles.drawerScroll}>
                <DrawerContent record={selectedRecord} />
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}

function OverviewBoard({
  records,
  paymentRecords,
  decisionRecords,
  hasRecords,
  isMobileViewport,
  onOpenDetails,
  totalRecordCount,
  totalPaymentCount,
  totalDecisionCount,
}: {
  records: LiveActionRecord[];
  paymentRecords: LiveActionRecord[];
  decisionRecords: LiveActionRecord[];
  hasRecords: boolean;
  isMobileViewport: boolean;
  onOpenDetails: (id: string) => void;
  totalRecordCount: number;
  totalPaymentCount: number;
  totalDecisionCount: number;
}) {
  if (!hasRecords) {
    return (
      <div className={styles.emptyPanel}>
        <p className={styles.emptyEyebrow}>No live actions yet</p>
        <h2 className={styles.emptyTitle}>The dashboard is waiting for the next persisted inspection.</h2>
        <p className={styles.emptyText}>
          Sigillum will populate this board from real API-driven actions only. No synthetic rows appear here.
        </p>
        <Link className={`${styles.ghostButton} ${styles.emptyAction}`} href="/">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.contentGrid}>
      <ProofPanel
        countLabel={isMobileViewport ? "Recent 6" : `${totalRecordCount} records`}
        scrollClassName={styles.panelScroll}
        subtitle="Compact activity cards show only the key proof points. Open any row to inspect full lifecycle details."
        title="Live Agent Activity"
      >
        <div className={styles.cardList}>
          {records.map((record) => (
            <ActivityCard key={record.id} onOpenDetails={onOpenDetails} record={record} />
          ))}
        </div>
      </ProofPanel>

      <div className={styles.asideStack}>
        <ProofPanel
          countLabel={isMobileViewport ? "Recent 6" : `${totalPaymentCount} payments`}
          scrollClassName={`${styles.panelScroll} ${styles.compactScroll}`}
          subtitle="Gateway proof first, Arc explorer links only when a real onchain hash exists."
          title="Payment Timeline"
        >
          <div className={styles.timelineList}>
            {paymentRecords.length > 0 ? (
              paymentRecords.map((record) => (
                <MiniProofCard
                  key={`payment-${record.id}`}
                  detail={describeSettlementProof({
                    paymentReference: record.paymentReference,
                    transactionHash: record.transactionHash,
                    settlementStatus: record.settlementStatus,
                    settlementScope: record.settlementScope,
                    batchReference: record.batchReference,
                  })}
                  footer={
                    record.transactionHash ? (
                      <a
                        className={styles.proofLink}
                        href={getArcscanTransactionUrl(record.transactionHash)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open Arcscan
                      </a>
                    ) : (
                      <span className={styles.proofLine}>
                        {record.paymentReference
                          ? `Payment reference ${truncateHash(record.paymentReference)}`
                          : "Payment reference unavailable"}
                      </span>
                    )
                  }
                  meta={record.payment?.network ?? "Arc testnet"}
                  title={record.payment?.amount ? `${record.payment.amount} USDC` : "Payment proof"}
                />
              ))
            ) : (
              <EmptyPanelCopy text="No settled payments have been persisted yet." />
            )}
          </div>
        </ProofPanel>

        <ProofPanel
          countLabel={isMobileViewport ? "Recent 6" : `${totalDecisionCount} decisions`}
          scrollClassName={`${styles.panelScroll} ${styles.compactScroll}`}
          subtitle="Only recorded machine-readable decisions from real persisted actions appear here."
          title="Agent Decisions"
        >
          <div className={styles.timelineList}>
            {decisionRecords.length > 0 ? (
              decisionRecords.map((record) => (
                <MiniProofCard
                  key={`decision-${record.id}`}
                  detail={record.agentDecision?.reason ?? "No decision reason recorded."}
                  footer={
                    <button className={styles.ghostButton} onClick={() => onOpenDetails(record.id)} type="button">
                      View details
                    </button>
                  }
                  highlight={record.agentDecision ? formatLabel(record.agentDecision.agent_decision) : "Pending"}
                  meta={record.agentDecision?.next_action ?? "Next action unavailable"}
                  title={record.raw.agent_name ? String(record.raw.agent_name) : "Unknown agent"}
                />
              ))
            ) : (
              <EmptyPanelCopy text="No agent decisions have been recorded yet." />
            )}
          </div>
        </ProofPanel>
      </div>
    </div>
  );
}

function TimelineBoard({
  records,
  hasRecords,
  onOpenDetails,
}: {
  records: LiveActionRecord[];
  hasRecords: boolean;
  onOpenDetails: (id: string) => void;
}) {
  if (!hasRecords) {
    return (
      <div className={styles.timelineEmpty}>
        <p className={styles.emptyEyebrow}>Timeline waiting</p>
        <h2 className={styles.emptyTitle}>No persisted lifecycle timelines are available yet.</h2>
        <p className={styles.emptyText}>
          Once live inspections move through the canonical seven stages, the latest six will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.timelineGrid}>
      {records.map((record) => (
        <article className={styles.timelineCard} key={`timeline-${record.id}`}>
          <div className={styles.timelineCardTop}>
            <div className={styles.cardIdentity}>
              <p className={styles.microLabel}>Timeline record</p>
              <h2 className={styles.timelineCardTitle}>
                {record.raw.agent_name ? String(record.raw.agent_name) : "Unknown agent"}
              </h2>
            </div>
            <span className={`${styles.statusChip} ${toneClassName(record)}`}>{getStatusLabel(record)}</span>
          </div>

          <div className={styles.timelineChipRow}>
            <span className={styles.timelineChip}>{formatLabel(record.actionType ?? "code_change")}</span>
            <span className={styles.timelineChip}>{formatLabel(record.currentStage ?? "recorded")}</span>
            {record.receiptId ? <span className={styles.timelineChip}>{truncateHash(record.receiptId)}</span> : null}
          </div>

          <p className={`${styles.timelineDetail} ${styles.clampThree}`}>
            {record.safeSummary ?? "Persisted lifecycle proof for this action."}
          </p>

          <div className={styles.timelineTrack}>
            {record.lifecycleEvents.map((event, index) => {
              const isCurrent = event.stage === record.currentStage;
              const isFinal = event.stage === "agent_decision_created";
              return (
                <div
                  className={`${styles.timelineEvent} ${isCurrent ? styles.timelineCurrent : ""} ${isFinal ? styles.timelineFinal : ""}`}
                  key={`${record.id}-${event.stage}-${index}`}
                >
                  <div className={styles.timelineDot} aria-hidden="true" />
                  <div className={styles.timelineEventCopy}>
                    <strong className={styles.timelineEventTitle}>{formatLabel(event.stage)}</strong>
                    <span className={styles.timelineEventTime}>
                      {event.timestamp ? formatTimestamp(event.timestamp) : "Timestamp unavailable"}
                    </span>
                    <span className={`${styles.timelineEventBody} ${styles.clampTwo}`}>
                      {compactEventLine(event)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.cardFooter}>
            <span className={styles.proofLine}>
              {record.payment?.amount ? `${record.payment.amount} USDC` : "Payment pending"}
            </span>
            <button className={styles.ghostButton} onClick={() => onOpenDetails(record.id)} type="button">
              View details
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProofPanel({
  title,
  subtitle,
  countLabel,
  scrollClassName,
  children,
}: {
  title: string;
  subtitle: string;
  countLabel: string;
  scrollClassName: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`artifact-card ${styles.panel}`}>
      <span className="card-tape" />
      <div className={styles.panelHeader}>
        <div className={styles.panelHeaderCopy}>
          <h2 className={styles.panelTitle}>{title}</h2>
          <p className={styles.panelLead}>{subtitle}</p>
        </div>
        <span className={styles.panelCount}>{countLabel}</span>
      </div>
      <div className={scrollClassName}>{children}</div>
    </section>
  );
}

function ActivityCard({
  record,
  onOpenDetails,
}: {
  record: LiveActionRecord;
  onOpenDetails: (id: string) => void;
}) {
  return (
    <article className={styles.activityCard}>
      <div className={styles.cardTop}>
        <div className={styles.cardIdentity}>
          <p className={styles.microLabel}>Live activity</p>
          <h3 className={styles.cardTitle}>{record.raw.agent_name ? String(record.raw.agent_name) : "Unknown agent"}</h3>
          <p className={styles.cardSummary}>{formatLabel(record.actionType ?? "code_change")}</p>
        </div>
        <span className={`${styles.statusChip} ${toneClassName(record)}`}>{getStatusLabel(record)}</span>
      </div>

      <div className={styles.metricStrip}>
        <MetricCell label="Stage" value={formatLabel(record.currentStage ?? "recorded")} />
        <MetricCell label="Receipt" value={record.receiptId ? truncateHash(record.receiptId) : "Pending"} />
        <MetricCell
          label="Risk score"
          value={record.receipt?.score !== undefined ? String(record.receipt.score) : "Pending"}
        />
        <MetricCell
          label="Decision"
          value={record.agentDecision ? formatLabel(record.agentDecision.agent_decision) : "Pending"}
        />
      </div>

      <p className={`${styles.cardSummary} ${styles.clampTwo}`}>
        {record.safeSummary ?? "Persisted proof summary unavailable."}
      </p>

      <div className={styles.cardFooter}>
        <span className={styles.proofLine}>
          {record.payment?.amount
            ? `${record.payment.amount} USDC • ${record.createdAt ? formatTimestamp(record.createdAt) : "Timestamp unavailable"}`
            : record.createdAt
              ? formatTimestamp(record.createdAt)
              : "Timestamp unavailable"}
        </span>
        <button className={styles.ghostButton} onClick={() => onOpenDetails(record.id)} type="button">
          View details
        </button>
      </div>
    </article>
  );
}

function MiniProofCard({
  title,
  meta,
  detail,
  footer,
  highlight,
}: {
  title: string;
  meta: string;
  detail: string;
  footer: React.ReactNode;
  highlight?: string;
}) {
  return (
    <article className={styles.miniCard}>
      <div className={styles.cardIdentity}>
        <p className={styles.microLabel}>{meta}</p>
        <h3 className={styles.cardTitle}>{title}</h3>
      </div>
      {highlight ? <span className={styles.inlineStatus}>{highlight}</span> : null}
      <p className={`${styles.miniDetail} ${styles.clampThree}`}>{detail}</p>
      <div className={styles.cardFooter}>{footer}</div>
    </article>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metricCell}>
      <span className={styles.microLabel}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DrawerContent({ record }: { record: LiveActionRecord }) {
  return (
    <div className={styles.drawerSections}>
      <section className={styles.drawerPanel}>
        <div className={styles.drawerChipRow}>
          <span className={styles.drawerChip}>{formatLabel(record.actionType ?? "code_change")}</span>
          <span className={styles.drawerChip}>{formatLabel(record.currentStage ?? "recorded")}</span>
          {record.payment?.rail ? <span className={styles.drawerChip}>{record.payment.rail}</span> : null}
          {record.payment?.network ? <span className={styles.drawerChip}>{record.payment.network}</span> : null}
        </div>

        <div className={styles.drawerMetrics}>
          <DrawerMetric label="Sigillum Risk Score" value={record.receipt?.score !== undefined ? String(record.receipt.score) : "Pending"} />
          <DrawerMetric label="Recommendation" value={record.receipt?.recommendation ? record.receipt.recommendation.toUpperCase() : "Pending"} />
          <DrawerMetric label="Payment" value={record.payment?.amount ? `${record.payment.amount} USDC` : "Pending"} />
          <DrawerMetric label="Decision" value={record.agentDecision ? formatLabel(record.agentDecision.agent_decision) : "Pending"} />
        </div>
      </section>

      <section className={styles.drawerPanel}>
        <p className={styles.microLabel}>Proof links</p>
        <div className={styles.drawerLinkRow}>
          {record.receiptId ? (
            <>
              <a className={styles.drawerLink} href={`/receipts/${record.receiptId}`}>
                Open receipt page
              </a>
              <a className={styles.drawerLink} href={`/api/receipts/${record.receiptId}?download=1`}>
                Download JSON
              </a>
              <a className={styles.drawerLink} href={`/api/receipts/${record.receiptId}/pdf`}>
                Download PDF
              </a>
            </>
          ) : null}
          {record.transactionHash ? (
            <a
              className={styles.drawerLink}
              href={getArcscanTransactionUrl(record.transactionHash)}
              rel="noreferrer"
              target="_blank"
            >
              Open Arcscan
            </a>
          ) : null}
        </div>
      </section>

      <section className={styles.drawerPanel}>
        <p className={styles.microLabel}>Action proof</p>
        <div className={styles.drawerEvidence}>
          <ProofRow label="Agent" value={record.raw.agent_name ? String(record.raw.agent_name) : "Unknown"} />
          <ProofRow label="Quote ID" value={record.quote?.quote_id ?? "Unavailable"} />
          <ProofRow label="Payment reference" value={record.paymentReference ?? "Unavailable"} />
          <ProofRow
            label="Transaction hash"
            value={
              record.transactionHash ??
              (record.settlementScope === "batch"
                ? "Gateway payment is part of a batch settlement; Arc hash not yet attributable."
                : "Gateway payment confirmed; Arc settlement hash not yet attributable.")
            }
          />
          <ProofRow label="Source hash" value={record.sourceHash ?? "Unavailable"} />
          <ProofRow
            label="Inspected units"
            value={record.inspectedUnits ? summarizeInspectedUnits(record.inspectedUnits) : "Unavailable"}
          />
          <ProofRow
            label="Findings categories"
            value={record.findingsCategories.length > 0 ? record.findingsCategories.join(", ") : "No findings categories recorded."}
          />
        </div>
      </section>

      <section className={styles.drawerPanel}>
        <p className={styles.microLabel}>Settlement proof</p>
        <div className={styles.drawerEvidence}>
          <div className={styles.drawerEvidenceRow}>
            <strong className={styles.drawerEvidenceTitle}>Settlement summary</strong>
            <p className={styles.drawerBodyText}>
              {describeSettlementProof({
                paymentReference: record.paymentReference,
                transactionHash: record.transactionHash,
                settlementStatus: record.settlementStatus,
                settlementScope: record.settlementScope,
                batchReference: record.batchReference,
              })}
            </p>
          </div>
          <ProofRow label="Settlement status" value={record.settlementStatus ? formatLabel(record.settlementStatus) : "Unavailable"} />
          <ProofRow label="Settlement scope" value={record.settlementScope ? formatLabel(record.settlementScope) : "Unavailable"} />
          <ProofRow label="Batch reference" value={record.batchReference ?? "Unavailable"} />
          <ProofRow
            label="Transaction confirmed"
            value={record.transactionConfirmedAt ? formatTimestamp(record.transactionConfirmedAt) : "Unavailable"}
          />
        </div>
      </section>

      <section className={styles.drawerPanel}>
        <p className={styles.microLabel}>Lifecycle timeline</p>
        <div className={styles.timelineTrack}>
          {record.lifecycleEvents.map((event, index) => {
            const isCurrent = event.stage === record.currentStage;
            const isFinal = event.stage === "agent_decision_created";
            return (
              <div
                className={`${styles.timelineEvent} ${isCurrent ? styles.timelineCurrent : ""} ${isFinal ? styles.timelineFinal : ""}`}
                key={`${record.id}-${event.stage}-${index}`}
              >
                <div className={styles.timelineDot} aria-hidden="true" />
                <div className={styles.timelineEventCopy}>
                  <strong className={styles.timelineEventTitle}>{formatLabel(event.stage)}</strong>
                  <span className={styles.timelineEventTime}>
                    {event.timestamp ? formatTimestamp(event.timestamp) : "Timestamp unavailable"}
                  </span>
                  <span className={styles.timelineEventBody}>{describeLifecycleEvent(event)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {record.agentDecision ? (
        <section className={styles.drawerPanel}>
          <p className={styles.microLabel}>Agent decision</p>
          <div className={styles.drawerEvidence}>
            <ProofRow label="Decision" value={formatLabel(record.agentDecision.agent_decision)} />
            <ProofRow label="Policy matched" value={record.agentDecision.policy_matched} />
            <ProofRow label="Next action" value={record.agentDecision.next_action} />
            <div className={styles.drawerEvidenceRow}>
              <strong className={styles.drawerEvidenceTitle}>Reason</strong>
              <p className={styles.drawerBodyText}>{record.agentDecision.reason}</p>
            </div>
          </div>
        </section>
      ) : null}

      {record.receipt?.patch_recommendation ? (
        <section className={styles.drawerPanel}>
          <p className={styles.microLabel}>Patch recommendation</p>
          <p className={styles.drawerBodyText}>{record.receipt.patch_recommendation}</p>
        </section>
      ) : null}
    </div>
  );
}

function DrawerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.drawerMetric}>
      <span className={styles.microLabel}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.proofRow}>
      <span className={styles.microLabel}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyPanelCopy({ text }: { text: string }) {
  return <p className={styles.emptyText}>{text}</p>;
}

function toneClassName(record: LiveActionRecord) {
  const tone = getStatusTone(record);
  if (tone === "block") {
    return styles.statusBlock;
  }
  if (tone === "warn") {
    return styles.statusWarn;
  }
  return styles.statusPass;
}

function compactEventLine(event: LifecycleEventRecord) {
  switch (event.stage) {
    case "quote_created":
      return event.quoteId ? `Quote ${truncateHash(event.quoteId)}` : "Quote created";
    case "payment_required":
      return event.amount ? `${event.amount} USDC requested` : "Payment required";
    case "payment_confirmed":
      return event.paymentReference ? `Ref ${truncateHash(event.paymentReference)}` : "Payment confirmed";
    case "receipt_generated":
      return event.receiptId ? `Receipt ${truncateHash(event.receiptId)}` : "Receipt generated";
    case "agent_decision_created":
      return event.decision ? formatLabel(event.decision) : "Decision recorded";
    default:
      return formatLabel(event.stage);
  }
}
