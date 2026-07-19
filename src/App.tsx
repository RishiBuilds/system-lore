import { useState } from "react";
import QueryPage from "./pages/QueryPage";
import BatchPage from "./pages/BatchPage";
import ObservabilityPage from "./pages/ObservabilityPage"

type Page = "query" | "batch" | "observability";

function App() {
  const [activePage, setActivePage] = useState<Page>("query");

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>SystemLore</h1>
          <div className="subtitle">Knowledge Agent</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-link ${activePage === "query" ? "active" : ""}`}
            onClick={() => setActivePage("query")}
          >
            <span className="icon">🔍</span>
            Query
          </button>
          <button
            className={`nav-link ${activePage === "batch" ? "active" : ""}`}
            onClick={() => setActivePage("batch")}
          >
            <span className="icon">📦</span>
            Batch Jobs
          </button>
          <button
            className={`nav-link ${activePage === "observability" ? "active" : ""}`}
            onClick={() => setActivePage("observability")}
          >
            <span className="icon">📊</span>
            Observability
          </button>
        </nav>

        <div style={{ padding: "0 16px", marginTop: "auto" }}>
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.15)",
              fontSize: "0.75rem",
              color: "var(--text-tertiary)",
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
              Anti-Hallucination
            </div>
            Retrieval-gated · Citation-required · Faithfulness-verified
          </div>
        </div>
      </aside>

      <main className="main-content">
        {activePage === "query" && <QueryPage />}
        {activePage === "batch" && <BatchPage />}
        {activePage === "observability" && <ObservabilityPage />}
      </main>
    </div>
  );
}

export default App;
