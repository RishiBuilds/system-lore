import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    batchId: v.string(),
    taskType: v.union(v.literal("ingest"), v.literal("query")),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("failed"),
    ),
    retries: v.number(),
    maxRetries: v.number(),
    inputRef: v.string(),
    inputPayload: v.any(),
    expectedOutputSchema: v.string(),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    tokenBudget: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    timeoutMs: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_batch", ["batchId", "status"]),

  chunks: defineTable({
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
    createdAt: v.number(),
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["sourceType"],
    })
    .index("by_source", ["sourceId"]),

  queryLogs: defineTable({
    taskId: v.optional(v.id("tasks")),
    query: v.string(),
    retrievedChunkIds: v.array(v.string()),
    retrievalScores: v.array(v.number()),
    generatedAnswer: v.optional(v.string()),
    citations: v.optional(v.any()),
    faithfulnessScore: v.optional(v.number()),
    faithfulnessPass: v.optional(v.boolean()),
    confidencePass: v.boolean(),
    thresholdUsed: v.number(),
    outcome: v.union(
      v.literal("answered"),
      v.literal("insufficient_context"),
      v.literal("faithfulness_failed"),
      v.literal("validation_failed"),
    ),
    latencyMs: v.number(),
    tokenCount: v.optional(v.number()),
    flaggedForReview: v.boolean(),
    humanReviewResult: v.optional(
      v.union(
        v.literal("correct"),
        v.literal("hallucinated"),
        v.literal("partial"),
      ),
    ),
    createdAt: v.number(),
  })
    .index("by_outcome", ["outcome"])
    .index("by_review", ["flaggedForReview", "humanReviewResult"])
    .index("by_created", ["createdAt"]),
});
