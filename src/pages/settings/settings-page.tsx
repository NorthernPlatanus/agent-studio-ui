import { PageHeader } from "@/shared/ui/page-header";
import { Placeholder } from "@/shared/ui/placeholder";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Project switch, API base URL, effective profile, stream health."
      />
      <Placeholder title="Settings" phase="phase 2" />
    </div>
  );
}
