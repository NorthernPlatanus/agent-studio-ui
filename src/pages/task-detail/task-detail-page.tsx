import { PageHeader } from "@/shared/ui/page-header";
import { Placeholder } from "@/shared/ui/placeholder";

export function TaskDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Task"
        description="Spec, dependencies, retries, cost and the candidate board."
      />
      <Placeholder title="Task" phase="phase 2" />
    </div>
  );
}
