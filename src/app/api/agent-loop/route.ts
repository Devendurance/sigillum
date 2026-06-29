import { NextResponse, type NextRequest } from "next/server";
import {
  isSigillumAutomationEnabled,
  isValidAutomationAuthorization,
  runSigillumAutomationTick,
} from "@/lib/server/sigillum-automation";
import { logSigillumError, logSigillumInfo } from "@/lib/server/sigillum-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleAutomationRequest(request, "vercel-cron");
}

export async function POST(request: NextRequest) {
  return handleAutomationRequest(request, "manual");
}

async function handleAutomationRequest(request: NextRequest, triggerSource: "vercel-cron" | "manual") {
  if (!isSigillumAutomationEnabled()) {
    logSigillumInfo("automation.tick.disabled", {
      trigger_source: triggerSource,
      has_authorization: Boolean(request.headers.get("authorization")),
      cron_schedule: request.headers.get("x-vercel-cron-schedule"),
    });
    return NextResponse.json(
      {
        error: "automation_disabled",
        message: "Sigillum automation is disabled.",
      },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (!isValidAutomationAuthorization(authorization)) {
    logSigillumInfo("automation.tick.unauthorized", {
      trigger_source: triggerSource,
      has_authorization: Boolean(authorization),
      cron_schedule: request.headers.get("x-vercel-cron-schedule"),
    });
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sigillum automation authorization failed.",
      },
      { status: 401 },
    );
  }

  try {
    const baseUrl = new URL(request.url).origin;
    const cronSchedule = request.headers.get("x-vercel-cron-schedule") ?? undefined;
    const requestTag = `${triggerSource}:${cronSchedule ?? "manual"}:${new Date().toISOString()}`;

    logSigillumInfo("automation.tick.start", {
      trigger_source: triggerSource,
      cron_schedule: cronSchedule,
      base_url: baseUrl,
    });

    const result = await runSigillumAutomationTick({
      baseUrl,
      requestTag,
    });

    return NextResponse.json(
      {
        trigger_source: triggerSource,
        cron_schedule: cronSchedule ?? null,
        ...result,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    logSigillumError("automation.tick.failed", error, {
      trigger_source: triggerSource,
    });

    return NextResponse.json(
      {
        error: "automation_failed",
        message: error instanceof Error ? error.message : "Sigillum automation failed.",
      },
      { status: 500 },
    );
  }
}
