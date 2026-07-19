import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type SourceTypeFilter = "doc" | "diagram" | "code" | "incident" | undefined;

interface QueryResult {
  outcome: "answered" | "insufficient_context" | "faithfulness_failed" | "validation_failed";
  message?: string;
  faithfulnessScore?: number;
  validationWarnings?: string[];
  answer?: {
    summary: string;
    claims: Array<{
      text: string;
      sourceId: string;
      chunkId: string;
      relevanceScore: number;
    }>;
  };
}

export default function QueryPage() {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceTypeFilter>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<Id<"tasks"> | null>(null);

  const submitQuery = useAction(api.batchRunner.submitQuery);
  const task = useQuery(
    api.taskManager.getTask,
    activeTaskId ? { taskId: activeTaskId } : "skip",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await submitQuery({
        query: query.trim(),
        sourceTypeFilter: sourceFilter,
      });
      setActiveTaskId(result.taskId as Id<"tasks">);
    } catch (err) {
      console.error("Query submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProcessing = task?.status === "pending" || task?.status === "in_progress";
  const isDone = task?.status === "done";
  const isFailed = task?.status === "failed";
  const result = task?.result as QueryResult | undefined;

  return (
    <div>
      <div className="page-header">
        <h1>Query Knowledge Base</h1>
        <p>
          Ask questions against your engineering documentation.
          Every answer is retrieval-gated, citation-required, and faithfulness-verified.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: "var(--space-2xl)" }}>
        <div className="input-group" style={{ marginBottom: "var(--space-sm)" }}>
          <input
            className="input"
            type="text"
            placeholder="How does the VPC network connect to our database?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSubmitting}
            id="query-input"
          />
          <select
            className="input"
            style={{ flex: "0 0 160px" }}
            value={sourceFilter ?? ""}
            onChange={(e) =>
              setSourceFilter(
                (e.target.value as SourceTypeFilter) || undefined,
              )
            }
            id="source-filter"
          >
            <option value="">All Sources</option>
            <option value="doc">Docs</option>
            <option value="diagram">Diagrams</option>
            <option value="code">Code</option>
            <option value="incident">Incidents</option>
          </select>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !query.trim()}
            id="submit-query"
          >
            {isSubmitting ? (
              <>
                <span className="loading-spinner" /> Submitting…
              </>
            ) : (
              "Ask"
            )}
          </button>
        </div>
      </form>

      {isProcessing && (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
          <div className="loading-spinner" style={{ width: 32, height: 32, marginBottom: "var(--space-md)" }} />
          <h3 style={{ color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
            Processing your query…
          </h3>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
            Retrieving → Threshold Check → Generating → Verifying → Validating
          </p>
          <div style={{ marginTop: "var(--space-md)" }}>
            <span className={`badge badge-info`}>
              <span className={`status-dot ${task?.status}`} />
              {task?.status === "pending" ? "Queued" : "In Progress"}
            </span>
          </div>
        </div>
      )}

      {isDone && result && (
        <div>
          <div style={{ marginBottom: "var(--space-md)", display: "flex", gap: "var(--space-sm)" }}>
            {result.outcome === "answered" && (
              <span className="badge badge-success">✓ Grounded Answer</span>
            )}
            {result.outcome === "insufficient_context" && (
              <span className="badge badge-warning">⚠ Insufficient Context</span>
            )}
            {result.outcome === "faithfulness_failed" && (
              <span className="badge badge-danger">✗ Faithfulness Failed</span>
            )}
            {result.outcome === "validation_failed" && (
              <span className="badge badge-danger">✗ Validation Failed</span>
            )}
            {result.faithfulnessScore !== undefined && (
              <span className="badge badge-indigo">
                Faithfulness: {(result.faithfulnessScore * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {result.outcome === "answered" && result.answer ? (
            <div className="answer-panel">
              <div className="answer-summary">{result.answer.summary}</div>

              <div style={{ marginBottom: "var(--space-md)" }}>
                <div className="card-title" style={{ marginBottom: "var(--space-sm)" }}>
                  Citations ({result.answer.claims?.length ?? 0})
                </div>
                {result.answer.claims?.map((claim, i) => (
                  <div key={i} className="citation-block">
                    <div className="citation-text">{claim.text}</div>
                    <div className="citation-source">
                      Source: {claim.sourceId} → Chunk: {claim.chunkId}
                    </div>
                    <div className="citation-score">
                      Relevance: {(claim.relevanceScore * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>

              <div className="answer-meta">
                <span className="badge badge-success">
                  ✓ Retrieval-Gated
                </span>
                <span className="badge badge-success">
                  ✓ Citations Verified
                </span>
                <span className="badge badge-success">
                  ✓ Faithfulness Passed
                </span>
                {result.validationWarnings && result.validationWarnings.length > 0 && (
                  <span className="badge badge-warning">
                    ⚠ {result.validationWarnings.length} Warning(s)
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <p style={{ color: "var(--text-secondary)" }}>
                {result.message || "No answer available."}
              </p>
            </div>
          )}
        </div>
      )}

      {isFailed && (
        <div className="card" style={{ borderColor: "rgba(244, 63, 94, 0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
            <span className="badge badge-danger">Failed</span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>
            {task?.error || "Unknown error"}
          </p>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: "var(--space-sm)" }}>
            Retries: {task?.retries}/{task?.maxRetries}
          </p>
        </div>
      )}

      {!activeTaskId && (
        <div className="empty-state">
          <div className="icon">🧠</div>
          <h3>Ask your knowledge base</h3>
          <p>
            Type a question above. Answers come with source citations —
            no hallucinated context.
          </p>
        </div>
      )}
    </div>
  );
}
