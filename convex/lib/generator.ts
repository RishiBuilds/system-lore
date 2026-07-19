"use node";

import { GoogleGenAI } from "@google/genai";
import {
  GroundedAnswer,
  GROUNDED_ANSWER_JSON_SCHEMA,
} from "./schemas";
import type { RetrievedChunk } from "./retriever";

export async function generateGroundedAnswer(
  query: string,
  chunks: RetrievedChunk[],
  apiKey: string,
): Promise<GroundedAnswer> {
  if (chunks.length === 0) {
    throw new Error(
      "GENERATION GATE: Cannot generate without retrieved chunks. " +
      "This should never happen — the retriever gate should have caught this.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const context = chunks
    .map(
      (c) =>
        `[CHUNK_ID:${c._id} | SOURCE_ID:${c.sourceId} | TYPE:${c.sourceType} | SCORE:${c.score.toFixed(3)}]\n${c.content}`,
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are a factual question-answering system for an engineering knowledge base.

CRITICAL RULES:
1. Answer ONLY using information from the provided context chunks.
2. Every claim in your answer MUST cite a specific CHUNK_ID and SOURCE_ID.
3. If the context doesn't contain enough information to fully answer the question, say so in the summary and only include claims you CAN support.
4. Never invent, extrapolate, or assume information not present in the chunks.
5. For the relevanceScore of each claim, use the retrieval score of the chunk you're citing.
6. Set confidence as the average relevance score of all cited chunks.
7. Set modelUsed to "gemini-2.5-pro".`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: `${systemPrompt}\n\nCONTEXT CHUNKS:\n${context}\n\nQUESTION: ${query}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: GROUNDED_ANSWER_JSON_SCHEMA,
      temperature: 0.1,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  const parsed = JSON.parse(text);
  const validated = GroundedAnswer.parse(parsed);

  return validated;
}
