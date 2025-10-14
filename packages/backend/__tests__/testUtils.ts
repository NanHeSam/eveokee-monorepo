import { vi } from "vitest";

export type MockFunction<Args extends unknown[] = unknown[], Return = unknown> = ReturnType<
  typeof vi.fn<Args, Return>
>;

export interface MockMutationCtx {
  auth: {
    getUserIdentity: MockFunction;
  };
  db: {
    insert: MockFunction;
    patch: MockFunction;
    query: MockFunction;
    get: MockFunction;
  };
  runMutation: MockFunction;
  scheduler: {
    runAfter: MockFunction;
  };
}

export type MockCtxOverrides = {
  auth?: Partial<MockMutationCtx["auth"]>;
  db?: Partial<MockMutationCtx["db"]>;
  scheduler?: Partial<MockMutationCtx["scheduler"]>;
  runMutation?: MockFunction;
};

export const createMockCtx = (overrides: MockCtxOverrides = {}): MockMutationCtx => {
  const base: MockMutationCtx = {
    auth: {
      getUserIdentity: vi.fn(),
    },
    db: {
      insert: vi.fn(),
      patch: vi.fn(),
      query: vi.fn(),
      get: vi.fn(),
    },
    runMutation: vi.fn(),
    scheduler: {
      runAfter: vi.fn(),
    },
  };

  return {
    ...base,
    auth: {
      ...base.auth,
      ...overrides.auth,
    },
    db: {
      ...base.db,
      ...overrides.db,
    },
    scheduler: {
      ...base.scheduler,
      ...overrides.scheduler,
    },
    runMutation: overrides.runMutation ?? base.runMutation,
  };
};

export type { MockMutationCtx as TestMutationCtx };
