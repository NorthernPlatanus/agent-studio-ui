import { Link } from "react-router";
import { Banner } from "@/shared/ui/banner";
import { Screen } from "@/shared/ui/screen";

export function NotFoundPage() {
  return (
    <Screen>
      <Banner tone="warn">
        That route does not exist in the panel.{" "}
        <Link to="/" className="underline underline-offset-2">
          Back to the dashboard
        </Link>
      </Banner>
    </Screen>
  );
}
