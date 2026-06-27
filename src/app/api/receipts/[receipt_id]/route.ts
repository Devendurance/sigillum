import { NextResponse } from "next/server";
import { logSigillumError, logSigillumInfo } from "@/lib/server/sigillum-log";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ receipt_id: string }> },
) {
  const { receipt_id: receiptId } = await context.params;

  try {
    const { findPublicReceiptByReceiptId } = await import("@/lib/server/sigillum-store");
    const receipt = await findPublicReceiptByReceiptId(receiptId);

    if (!receipt) {
      return NextResponse.json(
        {
          error: "receipt_not_found",
          message: "Sigillum could not find a persisted receipt for this ID.",
        },
        { status: 404 },
      );
    }

    logSigillumInfo("receipts.api.read", {
      receipt_id: receipt.receipt_id,
      action_id: receipt.action_id,
    });

    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "1";

    return NextResponse.json(receipt, {
      headers: {
        "Cache-Control": "no-store",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="${receipt.receipt_id}.json"`,
            }
          : {}),
      },
    });
  } catch (error) {
    logSigillumError("receipts.api.failed", error, {
      receipt_id: receiptId,
    });

    return NextResponse.json(
      {
        error: "receipt_unavailable",
        message: "Sigillum could not load this persisted receipt.",
      },
      { status: 503 },
    );
  }
}
