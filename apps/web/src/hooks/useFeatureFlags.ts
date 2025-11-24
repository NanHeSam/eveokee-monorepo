import { useQuery } from "convex/react";
import { api } from "@backend/convex";

export function useFeatureFlags() {
  const flags = useQuery(api.featureFlags.getUserFlags, { userId: undefined });

  /**
   * Check if a feature flag is enabled.
   * Returns false if flags are still loading or if the flag is missing/false.
   */
  const hasFeature = (flagKey: string): boolean => {
    if (!flags) return false;
    return !!flags[flagKey];
  };

  return {
    isLoading: flags === undefined,
    hasFeature,
    flags: flags || {},
  };
}

