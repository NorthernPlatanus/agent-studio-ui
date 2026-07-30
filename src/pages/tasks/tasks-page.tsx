import { PageHeader } from "@/shared/ui/page-header";
import { Placeholder } from "@/shared/ui/placeholder";

export function TasksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Filterable backlog across status, milestone, domain, risk and complexity."
      />
      <Placeholder title="Tasks" phase="phase 2" />
    </div>
  );
}
