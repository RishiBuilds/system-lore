"use node";

import { action } from "./_generated/server";
import { api, internal, components } from "./_generated/api";
import { v } from "convex/values";
import { Workpool } from "@convex-dev/workpool";


const pool = new Workpool(components.taskPool, {
  maxParallelism: 8,
  retryActionsByDefault: false,
});

export const startBatch = action({
  args: { batchId: v.string() },
  handler: async (ctx, { batchId }) => {
    const tasks = await ctx.runQuery(internal.taskManager.getPendingTasks, {
      batchId,
    });

    if (tasks.length === 0) {
      return { batchId, enqueued: 0, message: "No pending tasks found" };
    }

    let enqueued = 0;
    for (const task of tasks) {
      if (task.taskType === "query") {
        await pool.enqueueAction(
          ctx,
          internal.workers.queryWorker.process,
          { taskId: task._id },
        );
      } else if (task.taskType === "ingest") {
        await pool.enqueueAction(
          ctx,
          internal.workers.ingestWorker.process,
          { taskId: task._id },
        );
      }
      enqueued++;
    }

    return { batchId, enqueued, message: `Enqueued ${enqueued} tasks` };
  },
});

export const submitQuery = action({
  args: {
    query: v.string(),
    sourceTypeFilter: v.optional(
      v.union(
        v.literal("doc"),
        v.literal("diagram"),
        v.literal("code"),
        v.literal("incident"),
      ),
    ),
  },
  handler: async (ctx, args): Promise<{ batchId: string; taskId: string }> => {
    const batch: { batchId: string; taskIds: string[] } = await ctx.runMutation(api.taskSplitter.splitQueryBatch, {
      queries: [
        {
          query: args.query,
          sourceTypeFilter: args.sourceTypeFilter,
        },
      ],
    });

    const tasks = await ctx.runQuery(internal.taskManager.getPendingTasks, {
      batchId: batch.batchId,
    });

    if (tasks.length > 0) {
      await pool.enqueueAction(
        ctx,
        internal.workers.queryWorker.process,
        { taskId: tasks[0]._id },
      );
    }

    return {
      batchId: batch.batchId,
      taskId: batch.taskIds[0],
    };
  },
});

export const submitIngestion = action({
  args: {
    ref: v.string(),
    sourceType: v.union(
      v.literal("doc"),
      v.literal("diagram"),
      v.literal("code"),
      v.literal("incident"),
    ),
    content: v.string(),
    title: v.optional(v.string()),
    filePath: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ batchId: string; taskId: string }> => {
    const batch: { batchId: string; taskIds: string[] } = await ctx.runMutation(
      api.taskSplitter.splitIngestionBatch,
      {
        sources: [
          {
            ref: args.ref,
            sourceType: args.sourceType,
            payload: {
              sourceType: args.sourceType,
              content: args.content,
              title: args.title,
              filePath: args.filePath,
            },
          },
        ],
      },
    );

    const tasks = await ctx.runQuery(internal.taskManager.getPendingTasks, {
      batchId: batch.batchId,
    });

    if (tasks.length > 0) {
      await pool.enqueueAction(
        ctx,
        internal.workers.ingestWorker.process,
        { taskId: tasks[0]._id },
      );
    }

    return {
      batchId: batch.batchId,
      taskId: batch.taskIds[0],
    };
  },
});
