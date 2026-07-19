import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const claimTask = internalMutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (task.status !== "pending") {
      throw new Error(`Task ${taskId} is ${task.status}, cannot claim`);
    }

    await ctx.db.patch(taskId, {
      status: "in_progress",
      startedAt: Date.now(),
    });

    return task;
  },
});

export const completeTask = internalMutation({
  args: {
    taskId: v.id("tasks"),
    result: v.any(),
  },
  handler: async (ctx, { taskId, result }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    await ctx.db.patch(taskId, {
      status: "done",
      completedAt: Date.now(),
      result,
    });
  },
});

export const failTask = internalMutation({
  args: {
    taskId: v.id("tasks"),
    error: v.string(),
  },
  handler: async (ctx, { taskId, error }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const newRetries = task.retries + 1;

    if (newRetries < task.maxRetries) {
      await ctx.db.patch(taskId, {
        status: "pending",
        retries: newRetries,
        error,
        startedAt: undefined,
      });
    } else {
      await ctx.db.patch(taskId, {
        status: "failed",
        retries: newRetries,
        completedAt: Date.now(),
        error,
      });
    }
  },
});

export const getPendingTasks = internalQuery({
  args: { batchId: v.string() },
  handler: async (ctx, { batchId }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_batch", (q) => q.eq("batchId", batchId).eq("status", "pending"))
      .collect();
  },
});

export const getBatchStatus = query({
  args: { batchId: v.string() },
  handler: async (ctx, { batchId }) => {
    const statuses = ["pending", "in_progress", "done", "failed"] as const;
    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_batch", (q) => q.eq("batchId", batchId).eq("status", status))
        .collect();
      counts[status] = tasks.length;
    }

    return {
      batchId,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  },
});

export const getTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    return await ctx.db.get(taskId);
  },
});

export const listTasks = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("done"),
        v.literal("failed"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const q = args.status
      ? ctx.db
          .query("tasks")
          .withIndex("by_status", (idx) => idx.eq("status", args.status!))
      : ctx.db.query("tasks");

    return await q.order("desc").take(args.limit ?? 50);
  },
});
