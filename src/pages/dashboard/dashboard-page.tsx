import { PageHeader } from "@/shared/ui/page-header";
import { Placeholder } from "@/shared/ui/placeholder";

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Active run, stage pipeline, queue board and recent events."
      />
      <Placeholder title="Dashboard" phase="phase 2" />
    </div>
  );
}
