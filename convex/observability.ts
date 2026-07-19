import {
  query,
  mutation,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";

export const logQueryResult = internalMutation({
  args: {
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
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("queryLogs", args);
  },
});

export const getHallucinationRate = query({
  args: {
    sinceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const since = Date.now() - (args.sinceMs ?? 7 * 24 * 60 * 60 * 1000);

    const allLogs = await ctx.db
      .query("queryLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .collect();

    const totalAnswered = allLogs.filter(
      (l) => l.outcome === "answered",
    ).length;
    const totalFaithfulnessFailed = allLogs.filter(
      (l) => l.outcome === "faithfulness_failed",
    ).length;
    const totalHumanFlagged = allLogs.filter(
      (l) => l.humanReviewResult === "hallucinated",
    ).length;
    const totalInsufficientContext = allLogs.filter(
      (l) => l.outcome === "insufficient_context",
    ).length;
    const totalValidationFailed = allLogs.filter(
      (l) => l.outcome === "validation_failed",
    ).length;

    const totalProcessed = allLogs.length;
    const hallucinationCount = totalFaithfulnessFailed + totalHumanFlagged;
    const hallucinationRate =
      totalProcessed > 0 ? hallucinationCount / totalProcessed : 0;

    return {
      totalProcessed,
      totalAnswered,
      totalInsufficientContext,
      totalFaithfulnessFailed,
      totalValidationFailed,
      totalHumanFlagged,
      hallucinationRate,
      hallucinationRatePercent: (hallucinationRate * 100).toFixed(2) + "%",
      periodStartMs: since,
    };
  },
});

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const allLogs = await ctx.db.query("queryLogs").collect();

    const totalQueries = allLogs.length;
    const answered = allLogs.filter((l) => l.outcome === "answered").length;
    const avgLatency =
      totalQueries > 0
        ? allLogs.reduce((sum, l) => sum + l.latencyMs, 0) / totalQueries
        : 0;

    const faithfulnessScores = allLogs
      .filter((l) => l.faithfulnessScore !== undefined)
      .map((l) => l.faithfulnessScore!);
    const avgFaithfulness =
      faithfulnessScores.length > 0
        ? faithfulnessScores.reduce((a, b) => a + b, 0) /
          faithfulnessScores.length
        : 0;

    const pendingReviews = allLogs.filter(
      (l) => l.flaggedForReview && !l.humanReviewResult,
    ).length;

    const retrievalScoresAll = allLogs.flatMap((l) => l.retrievalScores);
    const avgRetrievalScore =
      retrievalScoresAll.length > 0
        ? retrievalScoresAll.reduce((a, b) => a + b, 0) /
          retrievalScoresAll.length
        : 0;

    return {
      totalQueries,
      answered,
      passRate: totalQueries > 0 ? ((answered / totalQueries) * 100).toFixed(1) + "%" : "0%",
      avgLatencyMs: Math.round(avgLatency),
      avgFaithfulnessScore: avgFaithfulness.toFixed(3),
      avgRetrievalScore: avgRetrievalScore.toFixed(3),
      pendingReviews,
    };
  },
});

export const getPendingReviews = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("queryLogs")
      .withIndex("by_review", (q) => q.eq("flaggedForReview", true))
      .filter((q) => q.eq(q.field("humanReviewResult"), undefined))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const submitHumanReview = mutation({
  args: {
    logId: v.id("queryLogs"),
    result: v.union(
      v.literal("correct"),
      v.literal("hallucinated"),
      v.literal("partial"),
    ),
  },
  handler: async (ctx, { logId, result }) => {
    await ctx.db.patch(logId, { humanReviewResult: result });
  },
});

export const getRecentLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("queryLogs")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const sampleForReview = internalMutation({
  args: { percentage: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const sampleRate = (args.percentage ?? 10) / 100;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const recentAnswered = await ctx.db
      .query("queryLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", oneWeekAgo))
      .filter((q) =>
        q.and(
          q.eq(q.field("outcome"), "answered"),
          q.eq(q.field("flaggedForReview"), false),
        ),
      )
      .collect();

    let flagged = 0;
    for (const log of recentAnswered) {
      if (Math.random() < sampleRate) {
        await ctx.db.patch(log._id, { flaggedForReview: true });
        flagged++;
      }
    }

    return { sampled: recentAnswered.length, flagged };
  },
});
