# SystemLore

> Contextual answers from your engineering knowledge base — docs, code, diagrams, and incidents — all in one place.

SystemLore is a developer-focused RAG (Retrieval-Augmented Generation) system that ingests your team's technical documentation, architecture diagrams, code repositories, and incident reports — then lets you query all of it in plain language.

Every answer is **retrieval-gated**, **citation-required**, and **faithfulness-verified** — three layers designed to prevent hallucination.

## Anti-Hallucination Pipeline

```
Query → Embed → Retrieve (top-K) → Confidence Gate → Generate (citations enforced)
     → Faithfulness Verify → Pre-Persistence Validate → Respond or Abstain
```

| Gate                           | What it does                                                   |
| ------------------------------ | -------------------------------------------------------------- |
| **Retrieval Gate**             | No chunks above threshold → abstain instead of guessing        |
| **Citation Schema**            | Gemini structured output forces every claim to cite a chunk    |
| **Faithfulness Pass**          | Second Gemini call verifies each claim against source chunks   |
| **Pre-Persistence Validation** | Schema + source-existence + content-diff checks before storage |

## Tech Stack

| Layer         | Technology                                                        |
| ------------- | ----------------------------------------------------------------- |
| Frontend      | React 19 · TypeScript · Vite                                      |
| Backend       | Convex (serverless, real-time)                                    |
| Vector Search | Convex Vector Search (768-dim)                                    |
| Embeddings    | `gemini-embedding-001`                                            |
| LLM           | `gemini-2.5-pro` (generation) · `gemini-2.5-flash` (verification) |
| Auth          | Clerk                                                             |
| Task Queue    | `@convex-dev/workpool` (8 concurrent)                             |
| Validation    | Zod 4                                                             |

## Quick Start

```bash
npm install

npx convex dev

npm run dev
```

### Environment Variables

Create a `.env.local` file:

```env
VITE_CONVEX_URL=<your-convex-deployment-url>
```

Set these in your Convex dashboard under Environment Variables:

```
GEMINI_API_KEY=<your-google-ai-api-key>
CLERK_ISSUER_URL=<your-clerk-issuer-url>
CONFIDENCE_THRESHOLD=0.65
```

## Supported Source Types

| Type       | Description                                                 |
| ---------- | ----------------------------------------------------------- |
| `doc`      | Markdown, HTML, PDF — paragraph-aware chunking with overlap |
| `code`     | TypeScript, Python, Go — split on function/class boundaries |
| `diagram`  | Architecture diagrams — single-chunk description            |
| `incident` | Postmortems, alerts — paragraph-aware chunking              |

## Project Structure

```
src/
├── main.tsx               # App entry with ConvexProvider
├── App.tsx                # Sidebar layout + page routing
├── index.css              # Design system (dark space theme)
└── pages/
    ├── QueryPage.tsx      # Single-query interface
    ├── BatchPage.tsx      # Batch ingest + query UI
    └── ObservabilityPage.tsx  # Dashboard, logs, human review

convex/
├── schema.ts              # Tasks, chunks, queryLogs tables
├── taskSplitter.ts        # Splits batches into atomic tasks
├── taskManager.ts         # Claim, complete, fail, retry lifecycle
├── batchRunner.ts         # Workpool orchestration
├── chunks.ts              # Vector store CRUD
├── observability.ts       # Logging, stats, human review sampling
├── crons.ts               # Weekly review sampling
├── lib/
│   ├── embeddings.ts      # gemini-embedding-001 wrapper
│   ├── retriever.ts       # Vector search + confidence threshold
│   ├── generator.ts       # Grounded answer generation (gemini-2.5-pro)
│   ├── faithfulness.ts    # Second-pass faithfulness verification
│   ├── validator.ts       # Three-layer pre-persistence validation
│   └── schemas.ts         # Zod schemas + Gemini JSON schemas
└── workers/
    ├── ingestWorker.ts    # Chunking + embedding pipeline
    └── queryWorker.ts     # Full query pipeline (8 steps)
```

## License

Private — not currently open source.
