"use node";

import { GoogleGenAI } from "@google/genai";
import {
  FaithfulnessResult,
  FAITHFULNESS_RESULT_JSON_SCHEMA,
} from "./schemas";
import type { GroundedAnswer } from "./schemas";
import type { RetrievedChunk } from "./retriever";

export async function verifyFaithfulness(
  answer: GroundedAnswer,
  chunks: RetrievedChunk[],
  apiKey: string,
): Promise<FaithfulnessResult> {
  if (answer.claims.length === 0) {
    return {
      verdicts: [],
      overallScore: 0,
      allSupported: false,
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const chunkContext = chunks
    .map((c) => `[CHUNK_ID: ${c._id}]\n${c.content}`)
    .join("\n\n---\n\n");

  const claimsList = answer.claims
    .map(
      (c, i) =>
        `Claim ${i}: "${c.text}" (cites chunk ${c.chunkId} from source ${c.sourceId})`,
    )
    .join("\n");

  const prompt = `You are a strict factual accuracy checker. Your ONLY job is to determine whether each claim below is FULLY SUPPORTED by the provided context chunks.

Rules:
1. A claim is SUPPORTED only if the context chunks contain information that directly states or clearly implies the claim.
2. A claim is UNSUPPORTED if it contains ANY information not found in the chunks, even if it seems plausible.
3. A claim is UNSUPPORTED if it cites a chunk that doesn't contain the relevant information.
4. Check that the cited chunk ID actually contains the information in the claim.
5. Be strict — when in doubt, mark as UNSUPPORTED.

CONTEXT CHUNKS:
${chunkContext}

CLAIMS TO VERIFY:
${claimsList}

For each claim, provide:
- claimIndex: the claim number (0-indexed)
- supported: true if FULLY supported, false otherwise
- reason: brief explanation of your judgment

Then provide:
- overallScore: fraction of supported claims (0.0 to 1.0)
- allSupported: true only if every single claim is supported`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: FAITHFULNESS_RESULT_JSON_SCHEMA,
      temperature: 0,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Faithfulness verifier returned empty response");
  }

  const parsed = JSON.parse(text);
  const validated = FaithfulnessResult.parse(parsed);

  return validated;
}

export async function verifyWithRetry(
  answer: GroundedAnswer,
  chunks: RetrievedChunk[],
  apiKey: string,
  maxAttempts: number = 2,
): Promise<{
  result: FaithfulnessResult;
  passed: boolean;
  attempts: number;
}> {
  let lastResult: FaithfulnessResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await verifyFaithfulness(answer, chunks, apiKey);
    lastResult = result;

    if (result.allSupported) {
      return { result, passed: true, attempts: attempt };
    }
  }

  return {
    result: lastResult!,
    passed: false,
    attempts: maxAttempts,
  };
}
