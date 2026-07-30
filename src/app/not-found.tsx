import { Link } from "react-router";
import { PageHeader } from "@/shared/ui/page-header";

export function NotFoundPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Not found" description="That route does not exist in the panel." />
      <Link to="/" className="text-sm underline underline-offset-4">
        Back to the dashboard
      </Link>
    </div>
  );
}
