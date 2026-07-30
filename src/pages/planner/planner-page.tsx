import { PageHeader } from "@/shared/ui/page-header";
import { Placeholder } from "@/shared/ui/placeholder";

export function PlannerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planner"
        description="The discuss requirements loop, spec preview and the approve bar."
      />
      <Placeholder title="Planner" phase="phase 4" />
    </div>
  );
}
