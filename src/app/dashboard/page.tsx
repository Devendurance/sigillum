import { headers } from "next/headers";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const initialResponse = await loadInitialResponse();

  return <DashboardClient initialResponse={initialResponse} />;
}

async function loadInitialResponse() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  if (!host) {
    return {
      ok: false,
      status: 503,
      body: null,
    };
  }

  const protocol = headerStore.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");

  try {
    const response = await fetch(`${protocol}://${host}/api/actions/live`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      body: (await response.json().catch(() => null)) as unknown,
    };
  } catch {
    return {
      ok: false,
      status: 503,
      body: null,
    };
  }
}
