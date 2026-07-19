"use node";

import { GoogleGenAI } from "@google/genai";

export async function generateEmbedding(
  text: string,
  apiKey: string,
): Promise<number[]> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  if (
    !response.embeddings ||
    response.embeddings.length === 0 ||
    !response.embeddings[0].values
  ) {
    throw new Error("Embedding API returned no embeddings");
  }

  return response.embeddings[0].values;
}

export async function generateEmbeddings(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  const results: number[][] = [];
  const batchSize = 5;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(
      batch.map((text) => generateEmbedding(text, apiKey)),
    );
    results.push(...embeddings);
  }

  return results;
}
