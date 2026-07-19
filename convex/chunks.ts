import { internalQuery, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getById = internalQuery({
  args: { chunkId: v.id("chunks") },
  handler: async (ctx, { chunkId }) => {
    return await ctx.db.get(chunkId);
  },
});

export const insertChunk = internalMutation({
  args: {
    sourceId: v.string(),
    sourceType: v.union(
      v.literal("doc"),
      v.literal("diagram"),
      v.literal("code"),
      v.literal("incident"),
    ),
    content: v.string(),
    metadata: v.object({
      title: v.optional(v.string()),
      filePath: v.optional(v.string()),
      lineRange: v.optional(v.string()),
      pageNumber: v.optional(v.number()),
    }),
    embedding: v.array(v.float64()),
    chunkIndex: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chunks", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getBySource = query({
  args: { sourceId: v.string() },
  handler: async (ctx, { sourceId }) => {
    return await ctx.db
      .query("chunks")
      .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
      .collect();
  },
});

export const deleteBySource = internalMutation({
  args: { sourceId: v.string() },
  handler: async (ctx, { sourceId }) => {
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    return { deleted: chunks.length };
  },
});
