import { DashboardClient } from "./dashboard-client";
import { loadInitialLiveActions } from "./load-initial-live-actions";

export default async function DashboardPage() {
  const initialResponse = await loadInitialLiveActions();

  return <DashboardClient initialResponse={initialResponse} mode="overview" />;
}
