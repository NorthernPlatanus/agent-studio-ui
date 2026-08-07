import { Link } from "react-router";
import { Banner } from "@/shared/ui/banner";

export function NotFoundPage() {
  return (
    <div className="pt-2">
      <Banner tone="warn">
        That route does not exist in the panel.{" "}
        <Link to="/" className="underline underline-offset-2">
          Back to the dashboard
        </Link>
      </Banner>
    </div>
  );
}
