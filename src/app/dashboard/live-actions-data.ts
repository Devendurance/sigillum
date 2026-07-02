import { isArcTransactionHash } from "@/lib/sigillum/arcscan";
import type { AgentDecision, Finding, InspectedUnits, Quote, SigillumReceipt } from "@/lib/sigillum/types";

export type PaymentSnapshot = {
  amount?: string;
  currency?: string;
  payment_reference?: string;
  transaction_hash?: string;
  settlement_status?: string;
  settlement_scope?: string;
  settlement_source?: string;
  transaction_confirmed_at?: string;
  batch_reference?: string;
  rail?: string;
  mode?: string;
  network?: string;
};

export type LifecycleEventRecord = {
  stage: string;
  timestamp?: string;
  quoteId?: string;
  amount?: string;
  paymentReference?: string;
  transactionHash?: string;
  settlementStatus?: string;
  settlementScope?: string;
  settlementSource?: string;
  transactionConfirmedAt?: string;
  batchReference?: string;
  receiptId?: string;
  decision?: string;
};

export type LiveActionRecord = {
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
  settlementStatus?: string;
  settlementScope?: string;
  settlementSource?: string;
  transactionConfirmedAt?: string;
  batchReference?: string;
  createdAt?: string;
  updatedAt?: string;
  quote?: Quote | null;
  receipt?: SigillumReceipt | null;
  receiptId?: string;
  inspectedUnits?: InspectedUnits | null;
  agentDecision?: AgentDecision | null;
  payment?: PaymentSnapshot | null;
  lifecycleEvents: LifecycleEventRecord[];
  raw: Record<string, unknown>;
};

export type LiveActionsPayload = {
  records: LiveActionRecord[];
  sourceAvailable: boolean;
  errorMessage?: string;
  lastUpdatedAt?: string;
};

export type DashboardInitialResponse = {
  ok: boolean;
  status?: number;
  body: unknown;
};

export async function readLiveActionsResponse(response: Response): Promise<LiveActionsPayload> {
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
}: DashboardInitialResponse): LiveActionsPayload {
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

export function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function truncateHash(value: string) {
  if (value.length <= 20) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function getStatusLabel(record: LiveActionRecord) {
  return (
    record.receipt?.recommendation ??
    record.status ??
    record.agentDecision?.agent_decision ??
    "recorded"
  )
    .replaceAll("_", " ")
    .toUpperCase();
}

export function getStatusTone(record: LiveActionRecord) {
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

export function summarizeInspectedUnits(units: InspectedUnits) {
  return `${units.changed_lines} lines, ${units.ast_nodes} AST nodes, ${units.strings} strings`;
}

export function describeLifecycleEvent(event: LifecycleEventRecord) {
  switch (event.stage) {
    case "action_submitted":
      return "Action was submitted into the persisted ledger.";
    case "quote_created":
      return `Quote ${event.quoteId ?? "pending"} created${event.amount ? ` for ${event.amount} USDC` : ""}.`;
    case "payment_required":
      return `HTTP 402 payment required${event.amount ? ` for ${event.amount} USDC` : ""}.`;
    case "payment_confirmed":
      return describeSettlementProof({
        paymentReference: event.paymentReference,
        transactionHash: event.transactionHash,
        settlementStatus: event.settlementStatus,
        settlementScope: event.settlementScope,
        batchReference: event.batchReference,
      });
    case "inspection_running":
      return "Sigillum inspection is running on the action payload.";
    case "receipt_generated":
      return event.receiptId ? `Receipt ${event.receiptId} was generated.` : "Receipt was generated.";
    case "agent_decision_created":
      return event.decision
        ? `Agent decision ${formatLabel(event.decision)} was recorded.`
        : "Agent decision was recorded.";
    default:
      return "Lifecycle event recorded.";
  }
}

export function describeSettlementProof({
  paymentReference,
  transactionHash,
  settlementStatus,
  settlementScope,
  batchReference,
}: {
  paymentReference?: string;
  transactionHash?: string;
  settlementStatus?: string;
  settlementScope?: string;
  batchReference?: string;
}) {
  if (transactionHash && settlementScope === "batch") {
    return batchReference
      ? `Gateway payment ${truncateHash(paymentReference ?? batchReference)} was settled on Arc in batch ${truncateHash(batchReference)}.`
      : `Gateway payment ${truncateHash(paymentReference ?? transactionHash)} was settled on Arc in a batch transaction.`;
  }

  if (transactionHash) {
    return paymentReference
      ? `Gateway payment ${truncateHash(paymentReference)} settled on Arc with hash ${truncateHash(transactionHash)}.`
      : `x402 payment settled on Arc with hash ${truncateHash(transactionHash)}.`;
  }

  if (settlementScope === "batch" && batchReference) {
    return `Gateway payment ${truncateHash(paymentReference ?? batchReference)} belongs to settlement batch ${truncateHash(batchReference)}; Arc hash not yet attributable.`;
  }

  if (settlementStatus === "gateway_received" || settlementStatus === "confirmed" || settlementStatus === "unresolved") {
    return "Gateway payment confirmed; Arc settlement hash not yet attributable.";
  }

  if (paymentReference) {
    return `x402 payment confirmed with reference ${truncateHash(paymentReference)}.`;
  }

  return "x402 payment confirmed.";
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
    typeof raw.agent_decision_detail === "object" && raw.agent_decision_detail !== null
      ? raw.agent_decision_detail
      : typeof raw.agent_decision === "object" && raw.agent_decision !== null
        ? raw.agent_decision
        : raw,
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
    settlementStatus: readString(raw.settlement_status) ?? undefined,
    settlementScope: readString(raw.settlement_scope) ?? undefined,
    settlementSource: readString(raw.settlement_source) ?? undefined,
    transactionConfirmedAt: readString(raw.transaction_confirmed_at) ?? undefined,
    batchReference: readString(raw.batch_reference) ?? undefined,
    createdAt: readString(raw.created_at) ?? readString(raw.createdAt) ?? receipt?.timestamp,
    updatedAt: readString(raw.updated_at) ?? readString(raw.updatedAt) ?? undefined,
    quote,
    receipt,
    receiptId: readString(raw.receipt_id) ?? receipt?.receipt_id ?? undefined,
    inspectedUnits: normalizeInspectedUnits(raw.inspected_units) ?? receipt?.inspected_units ?? quote?.inspected_units ?? null,
    agentDecision,
    payment,
    lifecycleEvents: normalizeLifecycleEvents(raw.lifecycle_events),
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
    settlement_status: readString(raw.settlement_status) ?? undefined,
    settlement_scope: readString(raw.settlement_scope) ?? undefined,
    settlement_source: readString(raw.settlement_source) ?? undefined,
    transaction_confirmed_at: readString(raw.transaction_confirmed_at) ?? undefined,
    batch_reference: readString(raw.batch_reference) ?? undefined,
    rail: readString(raw.rail) ?? undefined,
    mode: readString(raw.mode) ?? undefined,
    network: readString(raw.network) ?? undefined,
  };
}

function normalizeLifecycleEvents(value: unknown): LifecycleEventRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const raw = entry as Record<string, unknown>;
    const stage = readString(raw.stage);
    if (!stage) {
      return [];
    }

    return [
      {
        stage,
        timestamp: readString(raw.timestamp) ?? undefined,
        quoteId: readString(raw.quote_id) ?? undefined,
        amount: readString(raw.amount) ?? undefined,
        paymentReference: readString(raw.payment_reference) ?? undefined,
        transactionHash: normalizeTransactionHash(readString(raw.transaction_hash)),
        settlementStatus: readString(raw.settlement_status) ?? undefined,
        settlementScope: readString(raw.settlement_scope) ?? undefined,
        settlementSource: readString(raw.settlement_source) ?? undefined,
        transactionConfirmedAt: readString(raw.transaction_confirmed_at) ?? undefined,
        batchReference: readString(raw.batch_reference) ?? undefined,
        receiptId: readString(raw.receipt_id) ?? undefined,
        decision: readString(raw.decision) ?? undefined,
      },
    ];
  });
}

function normalizeTransactionHash(value: string | null) {
  return value && isArcTransactionHash(value) ? value : undefined;
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
