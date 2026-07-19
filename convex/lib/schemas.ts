import { z } from "zod";

export const CitedClaim = z.object({
  text: z.string().min(1, "Claim text cannot be empty"),
  sourceId: z.string().min(1, "Source ID required"),
  chunkId: z.string().min(1, "Chunk ID required"),
  relevanceScore: z.number().min(0).max(1),
});
export type CitedClaim = z.infer<typeof CitedClaim>;

export const GroundedAnswer = z.object({
  summary: z.string().min(1),
  claims: z.array(CitedClaim).min(1, "At least one cited claim required"),
  confidence: z.number().min(0).max(1),
  modelUsed: z.string(),
});
export type GroundedAnswer = z.infer<typeof GroundedAnswer>;

export const FaithfulnessVerdict = z.object({
  claimIndex: z.number(),
  supported: z.boolean(),
  reason: z.string(),
});
export type FaithfulnessVerdict = z.infer<typeof FaithfulnessVerdict>;

export const FaithfulnessResult = z.object({
  verdicts: z.array(FaithfulnessVerdict),
  overallScore: z.number().min(0).max(1),
  allSupported: z.boolean(),
});
export type FaithfulnessResult = z.infer<typeof FaithfulnessResult>;

export const IngestResult = z.object({
  sourceId: z.string(),
  chunksCreated: z.number().int().nonnegative(),
  sourceType: z.string(),
});
export type IngestResult = z.infer<typeof IngestResult>;

export const GROUNDED_ANSWER_JSON_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    summary: { type: "STRING" as const },
    claims: {
      type: "ARRAY" as const,
      items: {
        type: "OBJECT" as const,
        properties: {
          text: { type: "STRING" as const },
          sourceId: { type: "STRING" as const },
          chunkId: { type: "STRING" as const },
          relevanceScore: { type: "NUMBER" as const },
        },
        required: ["text", "sourceId", "chunkId", "relevanceScore"],
      },
    },
    confidence: { type: "NUMBER" as const },
    modelUsed: { type: "STRING" as const },
  },
  required: ["summary", "claims", "confidence", "modelUsed"],
};

export const FAITHFULNESS_RESULT_JSON_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    verdicts: {
      type: "ARRAY" as const,
      items: {
        type: "OBJECT" as const,
        properties: {
          claimIndex: { type: "NUMBER" as const },
          supported: { type: "BOOLEAN" as const },
          reason: { type: "STRING" as const },
        },
        required: ["claimIndex", "supported", "reason"],
      },
    },
    overallScore: { type: "NUMBER" as const },
    allSupported: { type: "BOOLEAN" as const },
  },
  required: ["verdicts", "overallScore", "allSupported"],
};

export const SCHEMA_REGISTRY: Record<string, z.ZodSchema> = {
  GroundedAnswer,
  IngestResult,
  FaithfulnessResult,
};
