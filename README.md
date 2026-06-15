# SystemLore

> **Contextual answers from your engineering knowledge base — docs, code, diagrams, and incidents — all in one place.**

---

## What is SystemLore?

SystemLore is a developer-focused RAG (Retrieval-Augmented Generation) system that ingests your team's technical documentation, architecture diagrams, code repositories, and incident reports — then lets you query all of it in plain language.

Built to reduce onboarding time, accelerate troubleshooting, and surface institutional knowledge that usually stays buried.

---

## The Three Pillars

| Use Case                    | What it does                                                 |
| --------------------------- | ------------------------------------------------------------ |
| **Contextual Q&A**          | Ask questions against your docs and architecture diagrams    |
| **Faster Onboarding**       | New engineers self-serve instead of interrupting senior devs |
| **Smarter Troubleshooting** | Surface past incident patterns and verified resolutions      |

---

## Supported Data Sources

- **Docs** — Markdown, HTML, PDF, OpenAPI/Swagger specs
- **Diagrams** — PNG, SVG (multimodal vision indexing)
- **Code Repos** — TypeScript, Python, Go, Java + PR summaries
- **Incidents** — PagerDuty alerts, Jira tickets, postmortem PDFs

---

## Tech Stack

| Layer         | Technology                            |
| ------------- | ------------------------------------- |
| Frontend      | React + TypeScript                    |
| Backend & DB  | Convex (serverless, real-time)        |
| Vector Search | Convex Vector Search                  |
| Embeddings    | `text-embedding-004` (Google)         |
| LLM           | `gemini-2.5-flash` / `gemini-2.5-pro` |
| Auth          | Clerk                                 |

---

## Quick Start

```bash
# Ingest a document or diagram
npx systemlore ingest ./docs/architecture-overview.md --type doc
npx systemlore ingest ./diagrams/vpc-network.png --type diagram

# Query your knowledge base
npx systemlore query "How does the VPC network connect to our Convex database?"
```

Answers come back with source citations and diagram previews — no hallucinated context.

---

## Status

🚧 **Early development** — core ingestion pipeline and query interface are actively being built.

---

## Contributing

Issues and PRs are welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for guidelines.
