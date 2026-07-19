"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { generateEmbedding } from "../lib/embeddings";

export const process = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    try {
      const task = await ctx.runMutation(internal.taskManager.claimTask, {
        taskId,
      });

      const { sourceType, content, title, filePath } = task.inputPayload as {
        sourceType: "doc" | "diagram" | "code" | "incident";
        content: string;
        title?: string;
        filePath?: string;
      };

      const apiKey = globalThis.process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY not set");

      const sourceId = task.inputRef;

      await ctx.runMutation(internal.chunks.deleteBySource, { sourceId });

      const chunks = splitIntoChunks(content, sourceType);

      let chunksCreated = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk.text, apiKey);

        await ctx.runMutation(internal.chunks.insertChunk, {
          sourceId,
          sourceType,
          content: chunk.text,
          metadata: {
            title,
            filePath,
            lineRange: chunk.lineRange,
            pageNumber: chunk.pageNumber,
          },
          embedding,
          chunkIndex: i,
        });

        chunksCreated++;
      }

      await ctx.runMutation(internal.taskManager.completeTask, {
        taskId,
        result: {
          sourceId,
          chunksCreated,
          sourceType,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.taskManager.failTask, {
        taskId,
        error: `Ingestion error: ${errorMessage}`,
      });
    }
  },
});

interface ChunkResult {
  text: string;
  lineRange?: string;
  pageNumber?: number;
}

function splitIntoChunks(
  content: string,
  sourceType: string,
): ChunkResult[] {
  if (sourceType === "diagram") {
    return [{ text: content }];
  }

  if (sourceType === "code") {
    return splitCodeChunks(content);
  }

  return splitTextChunks(content, {
    targetTokens: 500,
    overlapTokens: 50,
  });
}

function splitTextChunks(
  text: string,
  options: { targetTokens: number; overlapTokens: number },
): ChunkResult[] {
  const { targetTokens, overlapTokens } = options;
  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: ChunkResult[] = [];
  let currentChunk = "";
  let currentLineStart = 1;
  let lineCounter = 1;

  for (const paragraph of paragraphs) {
    const paragraphLines = paragraph.split("\n").length;

    if (currentChunk.length + paragraph.length > targetChars && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        lineRange: `${currentLineStart}-${lineCounter - 1}`,
      });

      const overlapText = currentChunk.slice(-overlapChars);
      currentChunk = overlapText + "\n\n" + paragraph;
      currentLineStart = Math.max(1, lineCounter - Math.ceil(overlapChars / 40));
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }

    lineCounter += paragraphLines;
  }

  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      lineRange: `${currentLineStart}-${lineCounter - 1}`,
    });
  }

  return chunks.length > 0 ? chunks : [{ text }];
}

function splitCodeChunks(code: string): ChunkResult[] {
  const lines = code.split("\n");
  const chunks: ChunkResult[] = [];
  let currentChunk: string[] = [];
  let chunkStart = 1;

  const boundaryPattern =
    /^(?:export\s+)?(?:async\s+)?(?:function|class|const\s+\w+\s*=\s*(?:async\s+)?(?:\(|function))|^(?:export\s+)?(?:interface|type|enum)\s/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNewBoundary = boundaryPattern.test(line.trim());

    if (isNewBoundary && currentChunk.length > 10) {
      chunks.push({
        text: currentChunk.join("\n"),
        lineRange: `${chunkStart}-${i}`,
      });
      currentChunk = [];
      chunkStart = i + 1;
    }

    currentChunk.push(line);

    if (currentChunk.length > 100) {
      chunks.push({
        text: currentChunk.join("\n"),
        lineRange: `${chunkStart}-${i + 1}`,
      });
      currentChunk = [];
      chunkStart = i + 2;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.join("\n"),
      lineRange: `${chunkStart}-${lines.length}`,
    });
  }

  return chunks.length > 0 ? chunks : [{ text: code }];
}
