import { PageHeader } from "@/shared/ui/page-header";
import { Placeholder } from "@/shared/ui/placeholder";

export function RunDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Run"
        description="Wave and task timeline, per-role token breakdown, pause reason."
      />
      <Placeholder title="Run" phase="phase 3" />
    </div>
  );
}
