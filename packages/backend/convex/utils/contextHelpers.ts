import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Type guard to check if a context is a mutation context.
 * 
 * Mutation contexts have access to `runMutation`, while query contexts do not.
 * This can be used to conditionally execute mutation-only operations.
 * 
 * @param ctx - A Convex context (either MutationCtx or QueryCtx)
 * @returns true if ctx is a MutationCtx, false otherwise
 */
export const isMutationCtx = (ctx: MutationCtx | QueryCtx): ctx is MutationCtx => {
  return "runMutation" in ctx;
};

