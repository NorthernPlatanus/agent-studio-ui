import { PageHeader } from "@/shared/ui/page-header";
import { Placeholder } from "@/shared/ui/placeholder";

export function RunsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Runs" description="Every run with its token totals." />
      <Placeholder title="Runs" phase="phase 2" />
    </div>
  );
}
