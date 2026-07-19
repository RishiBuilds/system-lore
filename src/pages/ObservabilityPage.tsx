import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export default function ObservabilityPage() {
  const dashboardStats = useQuery(api.observability.getDashboardStats);
  const hallucinationRate = useQuery(api.observability.getHallucinationRate, {});
  const pendingReviews = useQuery(api.observability.getPendingReviews, { limit: 10 });
  const recentLogs = useQuery(api.observability.getRecentLogs, { limit: 20 });
  const submitReview = useMutation(api.observability.submitHumanReview);

  const handleReview = async (logId: Id<"queryLogs">, result: "correct" | "hallucinated" | "partial") => {
    await submitReview({ logId, result });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Observability Dashboard</h1>
        <p>Track hallucination rates, faithfulness scores, and review flagged queries.</p>
      </div>

      {dashboardStats && (
        <div className="stats-grid">
          <div className="stat-card accent-indigo">
            <div className="stat-label">Total Queries</div>
            <div className="stat-value text-indigo">
              {dashboardStats.totalQueries}
            </div>
          </div>
          <div className="stat-card accent-emerald">
            <div className="stat-label">Pass Rate</div>
            <div className="stat-value text-emerald">
              {dashboardStats.passRate}
            </div>
          </div>
          <div className="stat-card accent-cyan">
            <div className="stat-label">Avg Latency</div>
            <div className="stat-value text-cyan">
              {dashboardStats.avgLatencyMs}ms
            </div>
          </div>
          <div className="stat-card accent-amber">
            <div className="stat-label">Avg Faithfulness</div>
            <div className="stat-value text-amber">
              {dashboardStats.avgFaithfulnessScore}
            </div>
          </div>
          <div className="stat-card accent-rose">
            <div className="stat-label">Pending Reviews</div>
            <div className="stat-value text-rose">
              {dashboardStats.pendingReviews}
            </div>
          </div>
        </div>
      )}

      {hallucinationRate && (
        <div className="card" style={{ marginBottom: "var(--space-xl)" }}>
          <div className="card-header">
            <div className="card-title">Hallucination Rate (7-day)</div>
            <span
              className={`badge ${
                parseFloat(hallucinationRate.hallucinationRatePercent) < 5
                  ? "badge-success"
                  : parseFloat(hallucinationRate.hallucinationRatePercent) < 15
                  ? "badge-warning"
                  : "badge-danger"
              }`}
            >
              {hallucinationRate.hallucinationRatePercent}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "var(--space-md)",
              marginTop: "var(--space-md)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>
                Processed
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {hallucinationRate.totalProcessed}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>
                Answered
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-emerald)" }}>
                {hallucinationRate.totalAnswered}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>
                Insufficient Context
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-amber)" }}>
                {hallucinationRate.totalInsufficientContext}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>
                Faithfulness Failed
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-rose)" }}>
                {hallucinationRate.totalFaithfulnessFailed}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>
                Human Flagged
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-rose)" }}>
                {hallucinationRate.totalHumanFlagged}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="card-header">
          <div className="card-title">Pending Human Reviews</div>
          <span className="badge badge-warning">
            {pendingReviews?.length ?? 0} pending
          </span>
        </div>

        {pendingReviews && pendingReviews.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {pendingReviews.map((log) => (
              <div
                key={log._id}
                style={{
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "var(--space-sm)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>
                      {log.query}
                    </div>
                    {log.generatedAnswer && (
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                        {log.generatedAnswer.length > 200
                          ? log.generatedAnswer.slice(0, 200) + "…"
                          : log.generatedAnswer}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                    {log.faithfulnessScore !== undefined && (
                      <span className="badge badge-indigo">
                        Faith: {(log.faithfulnessScore * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className={`badge badge-${log.outcome === "answered" ? "success" : "warning"}`}>
                      {log.outcome}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-xs)", marginTop: "var(--space-sm)" }}>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => handleReview(log._id, "correct")}
                    id={`review-correct-${log._id}`}
                  >
                    ✓ Correct
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleReview(log._id, "hallucinated")}
                    id={`review-hallucinated-${log._id}`}
                  >
                    ✗ Hallucinated
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleReview(log._id, "partial")}
                    id={`review-partial-${log._id}`}
                  >
                    ~ Partial
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "var(--space-xl)" }}>
            <div className="icon">✅</div>
            <h3>All caught up</h3>
            <p>No queries pending human review.</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: "var(--space-md)" }}>
          Recent Query Logs
        </div>

        {recentLogs && recentLogs.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Outcome</th>
                  <th>Faithfulness</th>
                  <th>Chunks</th>
                  <th>Latency</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.query}
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          log.outcome === "answered"
                            ? "success"
                            : log.outcome === "insufficient_context"
                            ? "warning"
                            : "danger"
                        }`}
                      >
                        {log.outcome === "answered"
                          ? "✓"
                          : log.outcome === "insufficient_context"
                          ? "⚠"
                          : "✗"}{" "}
                        {log.outcome.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.8rem",
                        color:
                          log.faithfulnessScore !== undefined
                            ? log.faithfulnessScore >= 0.9
                              ? "var(--accent-emerald)"
                              : log.faithfulnessScore >= 0.7
                              ? "var(--accent-amber)"
                              : "var(--accent-rose)"
                            : "var(--text-muted)",
                      }}
                    >
                      {log.faithfulnessScore !== undefined
                        ? (log.faithfulnessScore * 100).toFixed(0) + "%"
                        : "—"}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                      {log.retrievedChunkIds.length}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                      {log.latencyMs}ms
                    </td>
                    <td>
                      {log.humanReviewResult ? (
                        <span
                          className={`badge badge-${
                            log.humanReviewResult === "correct"
                              ? "success"
                              : log.humanReviewResult === "hallucinated"
                              ? "danger"
                              : "warning"
                          }`}
                        >
                          {log.humanReviewResult}
                        </span>
                      ) : log.flaggedForReview ? (
                        <span className="badge badge-warning">pending</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "var(--space-xl)" }}>
            <div className="icon">📊</div>
            <h3>No logs yet</h3>
            <p>Query logs will appear here after processing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
