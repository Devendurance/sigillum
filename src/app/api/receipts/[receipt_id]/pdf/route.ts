import { logSigillumError, logSigillumInfo } from "@/lib/server/sigillum-log";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ receipt_id: string }> },
) {
  const { receipt_id: receiptId } = await context.params;

  try {
    const [{ findPublicReceiptByReceiptId }, { createSigillumReceiptPdf }] = await Promise.all([
      import("@/lib/server/sigillum-store"),
      import("@/lib/server/sigillum-receipt-pdf"),
    ]);
    const receipt = await findPublicReceiptByReceiptId(receiptId);

    if (!receipt) {
      return Response.json(
        {
          error: "receipt_not_found",
          message: "Sigillum could not find a persisted receipt for this ID.",
        },
        { status: 404 },
      );
    }

    const pdf = createSigillumReceiptPdf(receipt);

    logSigillumInfo("receipts.api.pdf_read", {
      receipt_id: receipt.receipt_id,
      action_id: receipt.action_id,
    });

    return new Response(pdf, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receipt.receipt_id}.pdf"`,
      },
    });
  } catch (error) {
    logSigillumError("receipts.api.pdf_failed", error, {
      receipt_id: receiptId,
    });

    return Response.json(
      {
        error: "receipt_pdf_unavailable",
        message: "Sigillum could not generate this persisted receipt PDF.",
      },
      { status: 503 },
    );
  }
}
