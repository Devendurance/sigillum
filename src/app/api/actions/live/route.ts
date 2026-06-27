import { NextResponse } from "next/server";
import { logSigillumError, logSigillumInfo } from "@/lib/server/sigillum-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { listLiveActions } = await import("@/lib/server/sigillum-store");
    const actions = await listLiveActions();

    logSigillumInfo("actions.live.success", {
      action_count: actions.length,
    });

    return NextResponse.json({
      actions,
      sourceAvailable: true,
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logSigillumError("actions.live.failed", error);

    return NextResponse.json(
      {
        actions: [],
        sourceAvailable: false,
        error: "live_actions_unavailable",
        message: error instanceof Error ? error.message : "Live actions feed failed.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
