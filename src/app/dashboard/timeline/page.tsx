import { DashboardClient } from "../dashboard-client";
import { loadInitialLiveActions } from "../load-initial-live-actions";

export default async function TimelinePage() {
  const initialResponse = await loadInitialLiveActions();

  return <DashboardClient initialResponse={initialResponse} mode="timeline" />;
}
