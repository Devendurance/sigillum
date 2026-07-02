import type { SigillumPublicReceipt } from "@/lib/sigillum/types";

type PdfPage = {
  lines: string[];
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 56;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 56;
const FONT_SIZE = 11;
const HEADING_SIZE = 18;
const SUBHEADING_SIZE = 12;
const LINE_HEIGHT = 16;
const SECTION_GAP = 10;
const MAX_CHARS_PER_LINE = 78;

export function createSigillumReceiptPdf(receipt: SigillumPublicReceipt) {
  const pages = paginateReceipt(receipt);
  return buildPdfDocument(pages);
}

function paginateReceipt(receipt: SigillumPublicReceipt) {
  const pages: PdfPage[] = [];
  let currentPage: PdfPage = { lines: [] };
  let currentY = PAGE_HEIGHT - MARGIN_TOP;

  const pushLine = (line: string, size = FONT_SIZE, extraGap = 0) => {
    const requiredHeight = (size === HEADING_SIZE ? 28 : size === SUBHEADING_SIZE ? 20 : LINE_HEIGHT) + extraGap;
    if (currentY - requiredHeight < MARGIN_BOTTOM) {
      pages.push(currentPage);
      currentPage = { lines: [] };
      currentY = PAGE_HEIGHT - MARGIN_TOP;
    }

    currentPage.lines.push(renderTextLine(line, currentY, size));
    currentY -= requiredHeight;
  };

  const pushWrapped = (label: string, value: string | null | undefined) => {
    const normalized = value && value.trim().length > 0 ? value.trim() : "Unavailable";
    for (const line of wrapText(`${label}: ${normalized}`, MAX_CHARS_PER_LINE)) {
      pushLine(line);
    }
  };

  pushLine("Verified by Sigillum", SUBHEADING_SIZE);
  pushLine(receipt.receipt_id, HEADING_SIZE, 6);

  for (const line of wrapText("Persisted Sigillum receipt for a real paid inspection and agent decision.", MAX_CHARS_PER_LINE)) {
    pushLine(line);
  }

  currentY -= SECTION_GAP;

  pushLine("Proof Summary", SUBHEADING_SIZE);
  pushWrapped("Sigillum Risk Score", String(receipt.risk_score));
  pushWrapped("Recommendation", receipt.recommendation.toUpperCase());
  pushWrapped("Paid Amount", `${receipt.paid_amount_usdc} USDC`);
  pushWrapped("Decision", receipt.agent_decision.agent_decision.replaceAll("_", " "));
  pushWrapped("Timestamp", formatTimestamp(receipt.timestamp));

  currentY -= SECTION_GAP;

  pushLine("Receipt Details", SUBHEADING_SIZE);
  pushWrapped("Action ID", receipt.action_id);
  pushWrapped("Agent", receipt.agent_name);
  pushWrapped("Action Type", receipt.action_type);
  pushWrapped("Rail", receipt.rail ?? "Unavailable");
  pushWrapped("Network", receipt.network ?? "Unavailable");
  pushWrapped("Payment Reference", receipt.payment_reference ?? "Unavailable");
  pushWrapped("Transaction Hash", receipt.transaction_hash ?? unresolvedHashCopy(receipt));
  pushWrapped("Receipt Hash", receipt.receipt_hash);
  pushWrapped("Settlement Status", receipt.settlement_status?.replaceAll("_", " ") ?? "Unavailable");
  pushWrapped("Settlement Scope", receipt.settlement_scope?.replaceAll("_", " ") ?? "Unavailable");
  pushWrapped("Settlement Source", receipt.settlement_source?.replaceAll("_", " ") ?? "Unavailable");
  pushWrapped("Batch Reference", receipt.batch_reference ?? "Unavailable");
  pushWrapped(
    "Transaction Confirmed",
    receipt.transaction_confirmed_at ? formatTimestamp(receipt.transaction_confirmed_at) : "Unavailable",
  );

  currentY -= SECTION_GAP;

  pushLine("Inspected Units", SUBHEADING_SIZE);
  pushWrapped("Changed Lines", String(receipt.inspected_units.changed_lines));
  pushWrapped("AST Nodes", String(receipt.inspected_units.ast_nodes));
  pushWrapped("Dependency Changes", String(receipt.inspected_units.dependency_changes));
  pushWrapped("Config Mutations", String(receipt.inspected_units.config_mutations));
  pushWrapped("Strings", String(receipt.inspected_units.strings));

  currentY -= SECTION_GAP;

  pushLine("Agent Decision", SUBHEADING_SIZE);
  pushWrapped("Decision", receipt.agent_decision.agent_decision);
  pushWrapped("Policy Matched", receipt.agent_decision.policy_matched);
  pushWrapped("Next Action", receipt.agent_decision.next_action);
  for (const line of wrapText(`Reason: ${receipt.agent_decision.reason}`, MAX_CHARS_PER_LINE)) {
    pushLine(line);
  }

  currentY -= SECTION_GAP;

  pushLine("Patch Recommendation", SUBHEADING_SIZE);
  for (const line of wrapText(receipt.patch_recommendation, MAX_CHARS_PER_LINE)) {
    pushLine(line);
  }

  currentY -= SECTION_GAP;

  pushLine("Findings", SUBHEADING_SIZE);
  if (receipt.findings.length === 0) {
    pushLine("No findings were recorded for this receipt.");
  } else {
    receipt.findings.forEach((finding, index) => {
      const prefix = `${index + 1}. [${finding.severity.toUpperCase()}] ${finding.category}`;
      pushLine(prefix);
      for (const line of wrapText(`   ${finding.message}`, MAX_CHARS_PER_LINE)) {
        pushLine(line);
      }
      if (finding.file) {
        pushWrapped("   Location", `${finding.file}${finding.line ? `:${finding.line}` : ""}`);
      }
      currentY -= 4;
    });
  }

  pages.push(currentPage);
  return pages;
}

function buildPdfDocument(pages: PdfPage[]) {
  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageKids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${pageKids}] /Count ${pages.length} >>`);

  pages.forEach((page, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const content = `BT\n/F1 ${FONT_SIZE} Tf\n1 0 0 1 0 0 Tm\n${page.lines.join("\n")}\nET`;
    const contentBytes = Buffer.byteLength(content, "utf8");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${contentBytes} >>\nstream\n${content}\nendstream`);
  });

  let output = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "utf8"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    output += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, "utf8");
}

function renderTextLine(text: string, y: number, size: number) {
  const font = size > FONT_SIZE ? "/F2" : "/F1";
  return `${font} ${size} Tf 1 0 0 1 ${MARGIN_X} ${Math.round(y)} Tm (${escapePdfText(text)}) Tj`;
}

function wrapText(text: string, maxChars: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 1 && words[0] === "") {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [text];
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function unresolvedHashCopy(receipt: SigillumPublicReceipt) {
  return receipt.settlement_scope === "batch"
    ? "Gateway payment is part of a settlement batch; Arc hash not yet attributable."
    : "Gateway payment confirmed; Arc settlement hash not yet attributable.";
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
