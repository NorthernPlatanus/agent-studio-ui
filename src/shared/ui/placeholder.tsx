import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

/**
 * "Not built yet" panel. Phase 0 ships a routed shell only — every screen says
 * which phase fills it in, so an empty page is never mistaken for a broken one.
 */
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Arrives in {phase}.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          The shell is wired: routing, theme, query cache and the API client are in place. This
          panel has no data source yet.
        </p>
      </CardContent>
    </Card>
  );
}
