"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { generateEmbedding } from "../lib/embeddings";
import { retrieveChunks, checkConfidenceThreshold } from "../lib/retriever";
import { generateGroundedAnswer } from "../lib/generator";
import { verifyWithRetry } from "../lib/faithfulness";
import { validateBeforePersist } from "../lib/validator";
import type { Id } from "../_generated/dataModel";
import type { RetrievedChunk } from "../lib/retriever";

export const process = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const startTime = Date.now();
    let retrievedChunks: RetrievedChunk[] = [];

    try {
      const task = await ctx.runMutation(internal.taskManager.claimTask, {
        taskId,
      });

      const { query, sourceTypeFilter } = task.inputPayload as {
        query: string;
        sourceTypeFilter?: "doc" | "diagram" | "code" | "incident";
      };

      const apiKey = globalThis.process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY not set");

      const confidenceThreshold = parseFloat(
        globalThis.process.env.CONFIDENCE_THRESHOLD ?? "0.65",
      );

      const queryEmbedding = await generateEmbedding(query, apiKey);

      const chunkLookup = async (chunkId: string) =>
        ctx.runQuery(internal.chunks.getById, { chunkId: chunkId as Id<"chunks"> });

      retrievedChunks = await retrieveChunks(ctx, queryEmbedding, chunkLookup, {
        topK: 10,
        sourceTypeFilter,
      });

      const retrievalScores = retrievedChunks.map((c) => c.score);

      const thresholdResult = checkConfidenceThreshold(
        retrievalScores,
        confidenceThreshold,
      );

      if (!thresholdResult.pass) {
        await ctx.runMutation(internal.observability.logQueryResult, {
          taskId,
          query,
          retrievedChunkIds: retrievedChunks.map((c) => c._id),
          retrievalScores,
          confidencePass: false,
          thresholdUsed: confidenceThreshold,
          outcome: "insufficient_context",
          latencyMs: Date.now() - startTime,
          flaggedForReview: false,
          createdAt: Date.now(),
        });

        await ctx.runMutation(internal.taskManager.completeTask, {
          taskId,
          result: {
            outcome: "insufficient_context",
            message:
              "No confident match found. Top retrieval score: " +
              thresholdResult.maxScore.toFixed(3),
          },
        });
        return;
      }

      const answer = await generateGroundedAnswer(
        query,
        retrievedChunks,
        apiKey,
      );

      const faithfulness = await verifyWithRetry(
        answer,
        retrievedChunks,
        apiKey,
      );

      if (!faithfulness.passed) {
        await ctx.runMutation(internal.observability.logQueryResult, {
          taskId,
          query,
          retrievedChunkIds: retrievedChunks.map((c) => c._id),
          retrievalScores,
          generatedAnswer: answer.summary,
          citations: answer.claims,
          faithfulnessScore: faithfulness.result.overallScore,
          faithfulnessPass: false,
          confidencePass: true,
          thresholdUsed: confidenceThreshold,
          outcome: "faithfulness_failed",
          latencyMs: Date.now() - startTime,
          flaggedForReview: true,
          createdAt: Date.now(),
        });

        await ctx.runMutation(internal.taskManager.completeTask, {
          taskId,
          result: {
            outcome: "faithfulness_failed",
            message:
              "Answer failed faithfulness verification. " +
              `Score: ${faithfulness.result.overallScore.toFixed(2)}. ` +
              `Unsupported claims: ${faithfulness.result.verdicts.filter((v) => !v.supported).map((v) => v.reason).join("; ")}`,
          },
        });
        return;
      }

      const chunkContents = new Map(
        retrievedChunks.map((c) => [c._id, c.content]),
      );
      const validation = await validateBeforePersist(
        answer,
        "GroundedAnswer",
        chunkLookup,
        chunkContents,
      );

      if (!validation.valid) {
        await ctx.runMutation(internal.observability.logQueryResult, {
          taskId,
          query,
          retrievedChunkIds: retrievedChunks.map((c) => c._id),
          retrievalScores,
          generatedAnswer: answer.summary,
          citations: answer.claims,
          faithfulnessScore: faithfulness.result.overallScore,
          faithfulnessPass: true,
          confidencePass: true,
          thresholdUsed: confidenceThreshold,
          outcome: "validation_failed",
          latencyMs: Date.now() - startTime,
          flaggedForReview: true,
          createdAt: Date.now(),
        });

        await ctx.runMutation(internal.taskManager.completeTask, {
          taskId,
          result: {
            outcome: "validation_failed",
            message:
              "Output failed pre-persistence validation: " +
              validation.errors.map((e) => e.message).join("; "),
          },
        });
        return;
      }

      const shouldFlag = Math.random() < 0.1;

      await ctx.runMutation(internal.observability.logQueryResult, {
        taskId,
        query,
        retrievedChunkIds: retrievedChunks.map((c) => c._id),
        retrievalScores,
        generatedAnswer: answer.summary,
        citations: answer.claims,
        faithfulnessScore: faithfulness.result.overallScore,
        faithfulnessPass: true,
        confidencePass: true,
        thresholdUsed: confidenceThreshold,
        outcome: "answered",
        latencyMs: Date.now() - startTime,
        flaggedForReview: shouldFlag,
        createdAt: Date.now(),
      });

      await ctx.runMutation(internal.taskManager.completeTask, {
        taskId,
        result: {
          outcome: "answered",
          answer,
          faithfulnessScore: faithfulness.result.overallScore,
          validationWarnings: validation.warnings,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await ctx.runMutation(internal.taskManager.failTask, {
        taskId,
        error: `Unhandled error: ${errorMessage}. Retrieved ${retrievedChunks.length} chunks.`,
      });
    }
  },
});
