import { describe, expect, it, vi } from "vitest";

import { createMockCtx } from "./testUtils";

describe("createMockCtx", () => {
  it("provides isolated mock helpers by default", async () => {
    const ctx = createMockCtx();

    await ctx.db.insert("music", {} as never);
    await ctx.db.insert("music", {} as never);

    expect(ctx.db.insert).toHaveBeenCalledTimes(2);
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.auth.getUserIdentity).not.toHaveBeenCalled();
  });

  it("allows overriding specific behaviors", async () => {
    const runMutation = vi.fn().mockResolvedValue({ ok: true });
    const ctx = createMockCtx({
      runMutation,
      db: {
        insert: vi.fn().mockResolvedValue("mockId"),
      },
    });

    const inserted = await ctx.db.insert("music", {} as never);
    const result = await ctx.runMutation("internal.test.fn" as never, {});

    expect(inserted).toBe("mockId");
    expect(runMutation).toHaveBeenCalledWith("internal.test.fn", {});
    expect(ctx.db.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });
});
