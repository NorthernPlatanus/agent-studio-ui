import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { projectPath } from "@/shared/api/paths";
import type { Usage, UsageGrouping } from "../model";
import { usageKeys } from "../model/usage-keys";

export function usageQuery(project: string, groupBy: UsageGrouping) {
  return queryOptions({
    queryKey: usageKeys.list(project, { groupBy }),
    queryFn: ({ signal }) =>
      api.get<Usage>(projectPath(project, "/usage"), { query: { group_by: groupBy }, signal }),
  });
}

/** Rollups, always split by billing channel — see `groupUsageByKey`. */
export function useUsage(project: string | null, groupBy: UsageGrouping = "role") {
  return useQuery({ ...usageQuery(project ?? "", groupBy), enabled: project !== null });
}
