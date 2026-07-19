import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const splitIngestionBatch = mutation({
  args: {
    sources: v.array(
      v.object({
        ref: v.string(),
        sourceType: v.union(
          v.literal("doc"),
          v.literal("diagram"),
          v.literal("code"),
          v.literal("incident"),
        ),
        payload: v.any(),
      }),
    ),
    tokenBudget: v.optional(v.number()),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchId = crypto.randomUUID();
    const taskIds: Id<"tasks">[] = [];

    for (const source of args.sources) {
      const taskId = await ctx.db.insert("tasks", {
        batchId,
        taskType: "ingest",
        status: "pending",
        retries: 0,
        maxRetries: 3,
        inputRef: source.ref,
        inputPayload: { ...source.payload, sourceType: source.sourceType },
        expectedOutputSchema: "IngestResult",
        result: undefined,
        error: undefined,
        tokenBudget: args.tokenBudget ?? 50000,
        startedAt: undefined,
        completedAt: undefined,
        timeoutMs: args.timeoutMs ?? 120000,
      });
      taskIds.push(taskId);
    }

    return { batchId, taskCount: taskIds.length, taskIds };
  },
});

export const splitQueryBatch = mutation({
  args: {
    queries: v.array(
      v.object({
        query: v.string(),
        sourceTypeFilter: v.optional(
          v.union(
            v.literal("doc"),
            v.literal("diagram"),
            v.literal("code"),
            v.literal("incident"),
          ),
        ),
      }),
    ),
    tokenBudget: v.optional(v.number()),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchId = crypto.randomUUID();
    const taskIds: Id<"tasks">[] = [];

    for (const q of args.queries) {
      const taskId = await ctx.db.insert("tasks", {
        batchId,
        taskType: "query",
        status: "pending",
        retries: 0,
        maxRetries: 3,
        inputRef: `query:${batchId}:${taskIds.length}`,
        inputPayload: q,
        expectedOutputSchema: "GroundedAnswer",
        result: undefined,
        error: undefined,
        tokenBudget: args.tokenBudget ?? 32000,
        startedAt: undefined,
        completedAt: undefined,
        timeoutMs: args.timeoutMs ?? 60000,
      });
      taskIds.push(taskId);
    }

    return { batchId, taskCount: taskIds.length, taskIds };
  },
});
