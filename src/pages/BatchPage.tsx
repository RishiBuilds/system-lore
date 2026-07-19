import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function BatchPage() {
  const [activeTab, setActiveTab] = useState<"ingest" | "query">("ingest");
  const [batchId, setBatchId] = useState<string | null>(null);

  const [ingestContent, setIngestContent] = useState("");
  const [ingestRef, setIngestRef] = useState("");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestType, setIngestType] = useState<"doc" | "diagram" | "code" | "incident">("doc");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [queryText, setQueryText] = useState("");

  const submitIngestion = useAction(api.batchRunner.submitIngestion);
  const splitQueryBatch = useMutation(api.taskSplitter.splitQueryBatch);
  const startBatch = useAction(api.batchRunner.startBatch);
  const batchStatus = useQuery(
    api.taskManager.getBatchStatus,
    batchId ? { batchId } : "skip",
  );
  const recentTasks = useQuery(api.taskManager.listTasks, { limit: 20 });

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestContent.trim() || !ingestRef.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await submitIngestion({
        ref: ingestRef,
        sourceType: ingestType,
        content: ingestContent,
        title: ingestTitle || undefined,
      });
      setBatchId(result.batchId);
      setIngestContent("");
      setIngestRef("");
      setIngestTitle("");
    } catch (err) {
      console.error("Ingestion failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQueryBatch = async () => {
    const queries = queryText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (queries.length === 0) return;

    setIsSubmitting(true);
    try {
      const batch = await splitQueryBatch({
        queries: queries.map((q) => ({ query: q })),
      });
      setBatchId(batch.batchId);
      await startBatch({ batchId: batch.batchId });
      setQueryText("");
    } catch (err) {
      console.error("Query batch failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Batch Jobs</h1>
        <p>Ingest documents and run query batches with isolated execution.</p>
      </div>

      <div style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-xl)" }}>
        <button
          className={`btn ${activeTab === "ingest" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("ingest")}
          id="tab-ingest"
        >
          📥 Ingest Document
        </button>
        <button
          className={`btn ${activeTab === "query" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("query")}
          id="tab-query-batch"
        >
          🔄 Query Batch
        </button>
      </div>

      {activeTab === "ingest" && (
        <form onSubmit={handleIngest} className="card" style={{ marginBottom: "var(--space-xl)" }}>
          <div className="card-title" style={{ marginBottom: "var(--space-md)" }}>
            Ingest a Document
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
            <input
              className="input"
              placeholder="Source reference (e.g., docs/architecture.md)"
              value={ingestRef}
              onChange={(e) => setIngestRef(e.target.value)}
              id="ingest-ref"
            />
            <input
              className="input"
              placeholder="Title (optional)"
              value={ingestTitle}
              onChange={(e) => setIngestTitle(e.target.value)}
              id="ingest-title"
            />
          </div>

          <div style={{ marginBottom: "var(--space-sm)" }}>
            <select
              className="input"
              value={ingestType}
              onChange={(e) => setIngestType(e.target.value as typeof ingestType)}
              style={{ width: "100%" }}
              id="ingest-type"
            >
              <option value="doc">📄 Document (Markdown, HTML, PDF)</option>
              <option value="code">💻 Code Repository</option>
              <option value="diagram">🖼️ Diagram (description)</option>
              <option value="incident">🚨 Incident Report</option>
            </select>
          </div>

          <textarea
            className="input"
            placeholder="Paste document content here..."
            value={ingestContent}
            onChange={(e) => setIngestContent(e.target.value)}
            style={{ width: "100%", marginBottom: "var(--space-md)" }}
            id="ingest-content"
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !ingestContent.trim() || !ingestRef.trim()}
            id="submit-ingest"
          >
            {isSubmitting ? (
              <>
                <span className="loading-spinner" /> Ingesting…
              </>
            ) : (
              "Ingest Document"
            )}
          </button>
        </form>
      )}

      {activeTab === "query" && (
        <div className="card" style={{ marginBottom: "var(--space-xl)" }}>
          <div className="card-title" style={{ marginBottom: "var(--space-md)" }}>
            Submit Query Batch
          </div>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", marginBottom: "var(--space-md)" }}>
            Enter one query per line. Each runs in isolation — no cross-contamination.
          </p>

          <textarea
            className="input"
            placeholder={"How does the VPC network work?\nWhat happened during the Jan 15 outage?\nExplain the auth flow in the API gateway."}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            style={{ width: "100%", minHeight: "140px", marginBottom: "var(--space-md)" }}
            id="batch-queries"
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
              {queryText.split("\n").filter((l) => l.trim()).length} queries
            </span>
            <button
              className="btn btn-primary"
              onClick={handleQueryBatch}
              disabled={isSubmitting || !queryText.trim()}
              id="submit-query-batch"
            >
              {isSubmitting ? (
                <>
                  <span className="loading-spinner" /> Submitting…
                </>
              ) : (
                "Run Batch"
              )}
            </button>
          </div>
        </div>
      )}

      {batchId && batchStatus && (
        <div className="card" style={{ marginBottom: "var(--space-xl)" }}>
          <div className="card-header">
            <div className="card-title">
              Batch Status
            </div>
            <span className="badge badge-indigo" style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
              {batchId.slice(0, 8)}…
            </span>
          </div>

          <div className="stats-grid">
            <div className="stat-card accent-amber">
              <div className="stat-label">Pending</div>
              <div className="stat-value text-amber">{batchStatus.counts.pending}</div>
            </div>
            <div className="stat-card accent-cyan">
              <div className="stat-label">In Progress</div>
              <div className="stat-value text-cyan">{batchStatus.counts.in_progress}</div>
            </div>
            <div className="stat-card accent-emerald">
              <div className="stat-label">Done</div>
              <div className="stat-value text-emerald">{batchStatus.counts.done}</div>
            </div>
            <div className="stat-card accent-rose">
              <div className="stat-label">Failed</div>
              <div className="stat-value text-rose">{batchStatus.counts.failed}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ marginBottom: "var(--space-md)" }}>
          Recent Tasks
        </div>

        {recentTasks && recentTasks.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Input</th>
                  <th>Retries</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <span className={`status-dot ${task.status}`} />
                        <span className={`badge badge-${
                          task.status === "done" ? "success" :
                          task.status === "failed" ? "danger" :
                          task.status === "in_progress" ? "info" : "warning"
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{task.taskType}</span>
                    </td>
                    <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {task.inputRef}
                    </td>
                    <td>{task.retries}/{task.maxRetries}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                      {task.startedAt && task.completedAt
                        ? `${((task.completedAt - task.startedAt) / 1000).toFixed(1)}s`
                        : task.startedAt
                        ? "…"
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="icon">📦</div>
            <h3>No tasks yet</h3>
            <p>Ingest a document or submit a query batch to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
