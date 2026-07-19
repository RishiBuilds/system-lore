"use node";

import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export interface RetrievedChunk {
  _id: string;
  sourceId: string;
  sourceType: string;
  content: string;
  metadata: {
    title?: string;
    filePath?: string;
    lineRange?: string;
    pageNumber?: number;
  };
  chunkIndex: number;
  score: number;
}

export interface ThresholdCheckResult {
  pass: boolean;
  maxScore: number;
  avgScore: number;
  scores: number[];
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;

export async function retrieveChunks(
  ctx: ActionCtx,
  queryEmbedding: number[],
  chunkLookup: (chunkId: string) => Promise<Doc<"chunks"> | null>,
  options?: {
    topK?: number;
    sourceTypeFilter?: "doc" | "diagram" | "code" | "incident";
  },
): Promise<RetrievedChunk[]> {
  const topK = options?.topK ?? 10;

  const searchArgs: {
    vector: number[];
    limit: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: (q: any) => any;
  } = {
    vector: queryEmbedding,
    limit: topK,
  };

  if (options?.sourceTypeFilter) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    searchArgs.filter = (q: any) =>
      q.eq("sourceType", options.sourceTypeFilter);
  }

  const results = await ctx.vectorSearch("chunks", "by_embedding", searchArgs);

  const chunks: RetrievedChunk[] = [];
  for (const result of results) {
    const doc = await chunkLookup(result._id);

    if (doc) {
      chunks.push({
        _id: result._id,
        sourceId: doc.sourceId,
        sourceType: doc.sourceType,
        content: doc.content,
        metadata: doc.metadata,
        chunkIndex: doc.chunkIndex,
        score: result._score,
      });
    }
  }

  return chunks;
}

export function checkConfidenceThreshold(
  scores: number[],
  threshold?: number,
): ThresholdCheckResult {
  const t = threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  if (scores.length === 0) {
    return { pass: false, maxScore: 0, avgScore: 0, scores: [] };
  }

  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  return {
    pass: maxScore >= t,
    maxScore,
    avgScore,
    scores,
  };
}
