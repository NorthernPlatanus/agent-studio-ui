import { PageHeader } from "@/shared/ui/page-header";
import { Placeholder } from "@/shared/ui/placeholder";

export function StatsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stats"
        description="Tokens by channel, cache hit rate, cost per task, solve rate per model."
      />
      <Placeholder title="Stats" phase="phase 5" />
    </div>
  );
}
