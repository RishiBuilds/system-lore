"use node";

import type { Doc } from "../_generated/dataModel";
import type { GroundedAnswer } from "./schemas";
import { SCHEMA_REGISTRY } from "./schemas";

export type ChunkLookup = (chunkId: string) => Promise<Doc<"chunks"> | null>;

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  layer: "schema" | "source_existence" | "content_diff";
  message: string;
  claimIndex?: number;
}

export interface ValidationWarning {
  layer: string;
  message: string;
  claimIndex?: number;
}

function validateSchema(
  data: unknown,
  schemaName: string,
): { valid: boolean; errors: ValidationError[] } {
  const schema = SCHEMA_REGISTRY[schemaName];
  if (!schema) {
    return {
      valid: false,
      errors: [
        {
          layer: "schema",
          message: `Unknown schema: ${schemaName}`,
        },
      ],
    };
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        layer: "schema" as const,
        message: `${issue.path.join(".")}: ${issue.message}`,
      })),
    };
  }

  return { valid: true, errors: [] };
}

async function validateSourceExistence(
  answer: GroundedAnswer,
  chunkLookup: ChunkLookup,
): Promise<{ valid: boolean; errors: ValidationError[] }> {
  const errors: ValidationError[] = [];

  for (let i = 0; i < answer.claims.length; i++) {
    const claim = answer.claims[i];

    try {
      const chunk = await chunkLookup(claim.chunkId);

      if (!chunk) {
        errors.push({
          layer: "source_existence",
          message: `Claim ${i}: cited chunk "${claim.chunkId}" does not exist in vector store`,
          claimIndex: i,
        });
        continue;
      }

      if (chunk.sourceId !== claim.sourceId) {
        errors.push({
          layer: "source_existence",
          message: `Claim ${i}: sourceId mismatch — claim says "${claim.sourceId}" but chunk belongs to "${chunk.sourceId}"`,
          claimIndex: i,
        });
      }
    } catch (e) {
      errors.push({
        layer: "source_existence",
        message: `Claim ${i}: failed to verify chunk "${claim.chunkId}" — ${e}`,
        claimIndex: i,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateContentDiff(
  answer: GroundedAnswer,
  chunkContents: Map<string, string>,
): { warnings: ValidationWarning[]; errors: ValidationError[] } {
  const warnings: ValidationWarning[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < answer.claims.length; i++) {
    const claim = answer.claims[i];
    const chunkContent = chunkContents.get(claim.chunkId);

    if (!chunkContent) {
      continue;
    }

    const ungroundedEntities = findUngroundedEntities(
      claim.text,
      chunkContent,
    );

    if (ungroundedEntities.length > 0) {
      const totalEntities = extractEntities(claim.text).length;
      const ungroundedRatio =
        totalEntities > 0 ? ungroundedEntities.length / totalEntities : 0;

      if (ungroundedRatio > 0.3) {
        errors.push({
          layer: "content_diff",
          message: `Claim ${i}: ${Math.round(ungroundedRatio * 100)}% of entities not found in cited chunk. Ungrounded: [${ungroundedEntities.join(", ")}]`,
          claimIndex: i,
        });
      } else if (ungroundedEntities.length > 0) {
        warnings.push({
          layer: "content_diff",
          message: `Claim ${i}: entities not found in cited chunk: [${ungroundedEntities.join(", ")}]`,
          claimIndex: i,
        });
      }
    }
  }

  return { warnings, errors };
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];

  const numbers = text.match(/\b\d+(?:\.\d+)?%?\b/g);
  if (numbers) entities.push(...numbers);

  const skipWords = new Set([
    "The", "This", "That", "These", "Those", "A", "An",
    "It", "They", "We", "He", "She", "I", "You",
    "In", "On", "At", "By", "For", "With", "From",
    "Is", "Are", "Was", "Were", "Has", "Have", "Had",
    "If", "When", "While", "After", "Before", "During",
  ]);

  const capitalizedWords = text.match(/\b[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*\b/g);
  if (capitalizedWords) {
    for (const word of capitalizedWords) {
      if (!skipWords.has(word)) {
        entities.push(word);
      }
    }
  }

  const techTerms = text.match(
    /\b[a-z]+(?:[A-Z][a-z]+)+\b|\b\w+(?:_\w+)+\b|\b\w+(?:-\w+)+\b|\/[\w/]+/g,
  );
  if (techTerms) entities.push(...techTerms);

  return [...new Set(entities)];
}

function findUngroundedEntities(
  claimText: string,
  chunkContent: string,
): string[] {
  const entities = extractEntities(claimText);
  const contentLower = chunkContent.toLowerCase();

  return entities.filter((entity) => {
    const entityLower = entity.toLowerCase();

    if (contentLower.includes(entityLower)) return false;

    if (entity.length > 4) {
      for (let i = 0; i <= contentLower.length - entityLower.length + 2; i++) {
        const windowSize = Math.min(
          entityLower.length + 2,
          contentLower.length - i,
        );
        const window = contentLower.substring(i, i + windowSize);
        if (levenshteinDistance(entityLower, window) <= 2) return false;
      }
    }

    return true;
  });
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

export async function validateBeforePersist(
  data: unknown,
  schemaName: string,
  chunkLookup?: ChunkLookup,
  chunkContents?: Map<string, string>,
): Promise<ValidationResult> {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];

  const schemaResult = validateSchema(data, schemaName);
  allErrors.push(...schemaResult.errors);

  if (!schemaResult.valid) {
    return { valid: false, errors: allErrors, warnings: allWarnings };
  }

  if (schemaName === "GroundedAnswer") {
    const answer = data as GroundedAnswer;

    if (chunkLookup) {
      const sourceResult = await validateSourceExistence(answer, chunkLookup);
      allErrors.push(...sourceResult.errors);
    }

    if (chunkContents) {
      const diffResult = validateContentDiff(answer, chunkContents);
      allErrors.push(...diffResult.errors);
      allWarnings.push(...diffResult.warnings);
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
