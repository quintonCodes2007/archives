import { useCallback } from "react";
import { adminApi } from "../api/adminApi";
import { usePolling } from "../hooks/usePolling";
import { DataState, Live, PageHeader } from "../components/UI";
import { RestaurantReport, StatusChart } from "../components/ReportPanels";
export default function ReportsPage() {
  const load = useCallback(async () => {
    const [statuses, reports] = await Promise.all([
      adminApi.statuses(),
      adminApi.reports(),
    ]);
    return { statuses, reports };
  }, []);
  const query = usePolling(load, 10000);
  return (
    <>
      <PageHeader
        eyebrow="REAL NUMBERS. BETTER DECISIONS."
        title="Reports & insights"
        actions={<Live {...query} />}
      >
        Current order totals and delivered revenue across your restaurants.
      </PageHeader>
      <DataState query={query}>
        {query.data && (
          <>
            <StatusChart statuses={query.data.statuses} />
            <RestaurantReport reports={query.data.reports} />
          </>
        )}
      </DataState>
    </>
  );
}
