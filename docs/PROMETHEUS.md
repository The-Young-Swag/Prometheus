# Prometheus

> **Understand. Decide. Validate. Act.**
>
> A local-first personal AI assistant with persistent conversations, controlled tool use, and a measured investigation into whether fine-tuning a small open-weight model improves structured tool calling.

**Status:** Active development (Phase 1 in progress)
**Last consolidated:** 10 November 2026
**Environment last verified:** 23 October 2026
**Supersedes:** `PROJECT_CONTEXT.md`, `PROJECT_FEATURES_SPECS.md`, `PROMETHEUS_LOCAL_INFERENCE_ENVIRONMENT.md`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Guiding Principles](#2-guiding-principles)
3. [Features](#3-features)
4. [Action Contract (Tool Calling)](#4-action-contract-tool-calling)
5. [Technology Stack](#5-technology-stack)
6. [Architecture](#6-architecture)
7. [Repository Structure](#7-repository-structure)
8. [Local Inference Environment](#8-local-inference-environment)
9. [Current Implementation Status](#9-current-implementation-status)
10. [API Design](#10-api-design)
11. [Data Model](#11-data-model)
12. [Dataset and Training Specification](#12-dataset-and-training-specification)
13. [Evaluation Specification](#13-evaluation-specification)
14. [Security and Reliability](#14-security-and-reliability)
15. [Hardware and Performance Constraints](#15-hardware-and-performance-constraints)
16. [Testing Strategy](#16-testing-strategy)
17. [Roadmap](#17-roadmap)
18. [Open Decisions](#18-open-decisions)
19. [Development Workflow and Coding Standards](#19-development-workflow-and-coding-standards)
20. [AI Coding Agent Instructions](#20-ai-coding-agent-instructions)
21. [Definition of Done](#21-definition-of-done)
22. [Immediate Next Steps](#22-immediate-next-steps)

---

## 1. Overview

### 1.1 What Prometheus is

Prometheus is a personal AI assistant that runs on the user's own machine. It talks to a locally hosted language model through Ollama, keeps conversations and approved memories in a local SQLite database, and can take real actions (saving notes, creating tasks and events, doing arithmetic) through a tightly controlled tool layer.

It has two connected halves:

- **The assistant:** a React chat interface backed by a Bun + Hono API, with persistent conversations, model management, context handling, and memory.
- **The structured-action layer:** the model translates natural-language requests into structured, schema-validated actions. The application, not the model, validates, authorizes, resolves dates and math deterministically, and executes.

A separate Python pipeline investigates whether fine-tuning a small model (QLoRA) improves tool-calling accuracy over a well-established baseline. The application never depends on that pipeline to run.

### 1.2 Core idea

> **The model proposes; the application decides and executes.**

The model never receives unrestricted access to the operating system, filesystem, shell, or network. All model output is untrusted input.

### 1.3 Goals

**Product**
- A useful personal assistant that runs entirely locally.
- Persistent conversations and user-approved memory.
- Natural-language requests converted into validated, inspectable tool actions.
- Switching between supported local models.
- A responsive React interface.
- No paid inference APIs or mandatory cloud services (target cost: $0 where feasible).

**Machine learning**
- A curated, validated dataset of tool-selection and argument-generation examples.
- Reproducible baseline measurements before any training.
- QLoRA (or another parameter-efficient method) fine-tuning of a compatible open-weight model, optionally with teacher-generated supervision.
- Base vs. fine-tuned comparison on the same held-out set, reported honestly, including limitations and licensing.

**Engineering and learning**
- Proficiency in TypeScript, React, Bun, Hono, Zod, SQL, and testing.
- Practice in system design, API contracts, error handling, and security.
- Python-based dataset preparation, fine-tuning, and evaluation.
- AI assistance used to support understanding, not replace it.

### 1.4 Non-goals (initial release)

- Training a model from scratch or matching frontier-model capability.
- Unrestricted autonomous behavior.
- Executing arbitrary model-generated code or shell commands.
- Requiring paid AI APIs.
- Claiming fine-tuning succeeded without measured evidence.

---

## 2. Guiding Principles

1. **The model proposes; the application decides and executes.**
2. **Validate before execution.** Schema validity is not proof of safety or authorization.
3. **Deterministic code for dates, arithmetic, and persistence.**
4. **One shared contract** across runtime, tests, and evaluation data.
5. **Measure before optimizing or fine-tuning.**
6. **Smallest complete vertical slice first**, then expand.
7. **Local-first and private by default.**
8. **Modularity:** business logic independent of framework-specific code.
9. **Type safety:** TypeScript plus Zod at every boundary.
10. **Resource awareness:** limited RAM and 4 GB of VRAM shape every decision.
11. **Human control:** no destructive or write operation without appropriate authorization.
12. **Reproducibility and honest results** over impressive claims.

---

## 3. Features

Features are grouped by capability. Priority and status are tracked in the [Roadmap](#17-roadmap).

### 3.1 Chat and model communication *(Phase 1, in progress)*

- `POST /api/chat`: validate input with Zod, reject empty messages, call Ollama's `/api/chat`, return generated text.
- Handle connection failures, malformed upstream responses, and request timeouts.
- Do not leak sensitive internal details in production errors.
- Health endpoints for the API and for Ollama/model availability.

### 3.2 Model management *(planned)*

- List available local models and identify the configured one.
- Check availability and retrieve metadata where supported.
- Switch the active model; handle missing or unavailable models gracefully.

### 3.3 Streaming *(planned)*

- Stream tokens to the frontend and render partial responses.
- Support cancellation and handle interrupted connections.
- Close streams and release resources correctly.
- Investigate Ollama streaming and transport options before implementing.

### 3.4 Chat interface *(planned)*

- Message composer; user and assistant bubbles.
- Loading/generation indicators, error messages, empty-conversation state.
- Markdown and code-block rendering; copy-response action.
- Auto-scroll and responsive layout.

### 3.5 Conversations and messages *(planned)*

- Create, rename, delete, and retrieve conversations; show history.
- Store user and assistant messages with ordering, timestamps, model used, and generation metadata where appropriate.

### 3.6 Context and memory *(planned)*

- Build model history from stored messages within context-window limits (truncation or summarization), preserving system instructions.
- **Persistent memory** is user-approved, transparent, editable, and removable, with a recorded source. Conversation history and memory are distinct; not every conversation becomes a memory.
- **Retrieval (future):** embeddings, vector search, and RAG are investigated only when a concrete retrieval requirement exists. No vector database before then.

### 3.7 Structured actions and tools *(planned)*

- Seven supported actions (five productivity tools, two control actions); see [Section 4](#4-action-contract-tool-calling).
- Validation, permission checks, confirmation before writes, deterministic date and math resolution, whitelisted execution, execution logging.
- Possible later tools: date/time, file search, local document retrieval, code assistance, system information. These require explicit design, schemas, and approval.

### 3.8 Transparent interface *(planned)*

Show the user's message, assistant response, proposed action and arguments, validation and execution status, results or errors, confirmation controls, and panels for saved notes, tasks, and events.

### 3.9 Python AI pipeline *(planned, separate)*

Dataset preparation and validation, baseline and fine-tuned evaluation, QLoRA training configuration, reports, model comparison, and export/quantization for Ollama where supported.

### 3.10 Deferred stretch features

Evaluation dashboard, Taglish robustness tests, browser-only demo. Deferred until the core flow is reliable.

---

## 4. Action Contract (Tool Calling)

In the initial release the model proposes **exactly one** supported action per request.

| Action | Arguments | Purpose |
|---|---|---|
| `create_event` | `title`, `when_text`, optional `duration_min` | Create a calendar event |
| `add_note` | `text`, optional `tags` | Save a note |
| `search_notes` | `query` | Search stored notes |
| `add_task` | `title`, optional `due_text` | Create a task |
| `calculate` | `expression` | Evaluate arithmetic with a safe parser |
| `respond` | `message` | Conversational reply |
| `clarify` | `question` | Ask for missing information |

Every tool needs an explicit schema, documented behavior, bounded inputs, and tests. No other tools exist unless explicitly implemented and approved.

### 4.1 Output format

The model produces one JSON object with an action name and matching arguments:

```json
{
  "name": "add_note",
  "arguments": {
    "text": "Review TypeScript tomorrow",
    "tags": ["learning"]
  }
}
```

```json
{
  "name": "clarify",
  "arguments": {
    "question": "What time should the event start?"
  }
}
```

Implement as a TypeScript discriminated union keyed by `name`, validated at runtime with Zod.

> **Canonical contract:** the nested `name` / `arguments` shape above is the intended contract. The flat object used in the PowerShell smoke tests (`action`, `title`, `when_text`, `duration_min`) was an experiment only. Use one contract consistently across prompts, schemas, tests, and evaluation data.

### 4.2 Execution rules

1. Parse output as structured data and validate with the shared Zod schema.
2. Reject malformed output, unknown action names, invalid arguments, and unexpected fields.
3. Retry once on validation failure, where appropriate.
4. Check permissions independently of model output.
5. Require user confirmation before write actions (initial implementation).
6. Resolve dates and arithmetic in application code, never in the model.
7. Reject or route ambiguous output to `clarify`; never execute it.

### 4.3 Dates and arithmetic

The model extracts the user's **original phrase** (e.g. `when_text: "tomorrow at 7 PM"`) or expression. Deterministic code does the resolving:

- Use `chrono-node` or an equivalent tested date parser.
- Use a restricted math expression parser; never JavaScript `eval`.
- Define a timezone and a current-time source.
- Ask for clarification when a date is ambiguous.

---

## 5. Technology Stack

### 5.1 Runtime application

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 19 | Scaffold exists |
| Frontend tooling | Vite | Scaffold exists |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | Planned; verify installation before use |
| Frontend ↔ backend | Native Fetch API | |
| Backend runtime | Bun | Existing |
| HTTP framework | Hono | Existing (Bun serves the default-exported app) |
| Validation | Zod | Runtime validation and shared schemas |
| Database | SQLite | Planned; Bun-compatible library to be selected after verifying compatibility |
| Date parsing | `chrono-node` | Planned |
| Arithmetic | Restricted expression parser | Planned |
| Model runtime | Ollama (Windows host) | Existing |
| Model client | Ollama HTTP API (via Fetch) | Existing |
| Testing | Vitest or Bun-compatible setup | To be selected deliberately |
| Static checks | TypeScript + ESLint | |

Bun (runtime) and Hono (framework) serve different purposes and are used together. Node.js 24 remains in the devcontainer for the frontend and tooling. Do not assume every Node-native package works under Bun, especially native SQLite bindings. Pin dependency versions and verify compatibility before adoption.

### 5.2 Model training and evaluation (separate from the runtime)

| Layer | Technology |
|---|---|
| Language | Python |
| Training | PyTorch, Hugging Face Transformers |
| Datasets | Hugging Face Datasets or JSONL utilities |
| Parameter-efficient tuning | PEFT (LoRA adapters), QLoRA if supported |
| Fine-tuning utilities | TRL or Unsloth |
| Dataset format | JSONL chat examples |
| Compute | Free Kaggle/Colab GPU where available |
| Optional hosting | Hugging Face Hub |
| Evaluation | Python scripts with JSON/CSV reports |

### 5.3 Development environment

- Windows 11 host with a Linux VS Code devcontainer (`mcr.microsoft.com/devcontainers/typescript-node:24`).
- Bun 1.4.4, Node.js 24, Git.
- **pnpm for the existing frontend (unchanged); Bun for the backend.**
- Windsurf as the editor; Antigravity CLI for independent, read-only code review.

---

## 6. Architecture

### 6.1 Backend layers

```text
HTTP Request
     │
     ▼
Presentation Layer       Hono routes: parse, validate (Zod), call services, return responses
     │
     ▼
Application Layer        Use cases: SendChatMessage, CreateConversation,
     │                   RetrieveConversationHistory, DeleteConversation, SwitchActiveModel
     ▼
Domain Layer             Conversation, Message, Model, Memory, Tool, UserSettings
     │                   (no dependency on Hono, SQLite, or Ollama)
     ▼
Infrastructure Layer     Ollama client, SQLite repositories, external integrations
```

Routes stay thin: no database queries, Ollama details, or complex business logic. Adopt the layering gradually; avoid premature abstraction.

### 6.2 Request flow with structured actions

```text
React + TypeScript frontend
        │  HTTP
        ▼
Bun + Hono API
        │
        ├─► Prompt builder ─► Ollama (Windows host) ─► raw model output
        │
        └─► Output parser
                │
                ▼
          Shared Zod validation
                │
                ▼
          Authorization + user confirmation
                │
                ▼
          Deterministic date / math resolver
                │
                ▼
          Whitelisted tool executor
                │
                ▼
          SQLite persistence
                │
                ▼
          Structured response to frontend
```

Plain chat (Phase 1) uses only the prompt-builder → Ollama → response path. The action pipeline is added in Phase 5; see [Open Decisions](#18-open-decisions) for how the two relate.

### 6.3 Shared contract

A single shared package is the source of truth for action names and arguments, response variants, Zod schemas, inferred TypeScript types, prompt/tool definitions, and validation fixtures. Frontend and backend must not invent incompatible structures independently.

### 6.4 Offline training pipeline

```text
Examples ─► Dataset generation ─► Schema validation and review
        ─► Train/validation/test splits ─► Baseline evaluation
        ─► Optional teacher-generated data ─► Fine-tune student
        ─► Evaluate checkpoint ─► Export/quantize if compatible
        ─► Ollama local inference
```

Training must not be required for the application to run. Keep this pipeline out of the Bun backend and do not couple normal operation to Python dependencies.

---

## 7. Repository Structure

Current and intended layout. Treat planned directories as targets, not existing files.

```text
Prometheus/
├── apps/
│   ├── web/                     # React + Vite frontend (existing, pnpm)
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── server/                  # Bun + Hono backend (existing)
│       ├── schemas/
│       │   ├── ollama.schema.ts
│       │   └── chat.schema.ts
│       ├── services/
│       │   └── ollama.service.ts
│       ├── routes/              # planned
│       ├── middleware/          # planned
│       ├── lib/                 # shared backend utilities
│       ├── db/                  # planned SQLite integration
│       ├── index.ts
│       ├── package.json
│       ├── bun.lock
│       ├── tsconfig.json
│       ├── .env                 # never committed
│       └── .env.example
│
├── packages/
│   └── contracts/               # planned shared Zod schemas and types
│
├── python/                      # planned model experimentation
│   ├── datasets/
│   ├── notebooks/
│   └── evaluations/
│
├── docs/                        # PROMETHEUS.md lives here (or at repo root)
├── .agents/
├── .devcontainer/
├── .gitignore
└── README.md
```

Rules:
- The frontend lives in `apps/web`; the backend in `apps/server`.
- Do not initialize another Git repository or replace the frontend scaffold.
- Do not migrate the frontend from pnpm to Bun.
- Do not add workspace configuration or competing lockfiles unless deliberately planned.
- Inspect the real tree before changing workspace configuration.

---

## 8. Local Inference Environment

A development-machine record, not a claim of production readiness. Verified 23 October 2026.

### 8.1 Host

| Item | Value |
|---|---|
| Laptop | Acer Nitro 5 (model AN515-55) |
| Operating system | Windows 11 host (PowerShell) |
| GPU | NVIDIA GeForce GTX 1650 Ti |
| Dedicated GPU memory | 4,096 MiB (4 GB) |
| NVIDIA driver | 610.47 (WDDM) |
| CUDA user-mode version (per `nvidia-smi`) | 13.3 |
| System RAM | 15.8 GB detected (~16 GB installed) |
| GPU memory in use before inference | 879 MiB (desktop apps), 3% utilization |

The `nvidia-smi` CUDA version is driver-reported and does not mean a separate CUDA Toolkit is required for Ollama.

### 8.2 Ollama

| Item | Value |
|---|---|
| Installation | Official script: `irm https://ollama.com/install.ps1 \| iex` |
| CLI version | `0.40.9` at install time (re-check with `ollama --version`) |
| Location | Windows host, not the devcontainer (so Ollama can use the host GPU) |
| Host API | `http://localhost:11434` (`/api/generate`, `/api/tags`) |
| Backend access from devcontainer | `http://host.docker.internal:11434` (verified working) |

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

Inside the container, `localhost` refers to the container itself, not the Windows host.

### 8.3 Models

| Model | Status | Notes |
|---|---|---|
| `qwen2.5:1.5b` | Configured baseline | ID `65ec06548149`; ~986 MB download; 1.2 GB loaded; `100% GPU`; 4,096 context; runner `llamacpp` |
| `gemma4:12b` | Installed, not yet evaluated | Will not fit in 4 GB VRAM; expect CPU offload and slower inference |

The download size and the loaded size from `ollama ps` are different measurements and do not contradict each other. `ollama ps` confirms GPU placement for the observed run, but not throughput, peak VRAM, long-context behavior, or production suitability.

### 8.4 Initial inference tests

**A. Interactive CLI:** `ollama run qwen2.5:1.5b` extracted the expected event fields from "Remind me to study Express.js tomorrow at 7 PM," but wrapped the JSON in a Markdown code fence. Prompt-only instructions do not guarantee raw JSON.

**B. HTTP API, no schema:** `POST /api/generate` with `stream = false` returned `{"action": "study", "title": "Express.js"}`. Valid JSON, but the action was unsupported and date/duration fields were missing. A useful baseline failure.

**C. HTTP API with JSON Schema:** supplying a schema in the `format` field with `temperature = 0` returned:

```json
{
  "title": "Study Express.js",
  "when_text": "tomorrow at 7 PM",
  "action": "create_event",
  "duration_min": 60
}
```

A successful smoke test, but a single case, not evidence of reliability. Backend Zod validation remains required. A response can have the right shape and still be wrong, ambiguous, or unsuitable to execute.

### 8.5 Limitations and pending checks

- Only a handful of manual prompts have been tried; no evaluation dataset exists yet.
- Latency and tokens per second are not benchmarked.
- No post-inference `nvidia-smi` snapshot has been recorded.
- Larger context lengths will increase memory use.
- The Ollama API must stay local and must not be exposed publicly without a deliberate security design.
- `qwen2.5:1.5b` is an initial baseline, not a final model choice.

### 8.6 Verification commands (Windows PowerShell)

```powershell
ollama --version                                  # CLI version
ollama list                                       # downloaded models
ollama ps                                         # loaded models and processor placement
nvidia-smi                                        # GPU and VRAM usage
Invoke-RestMethod http://localhost:11434/api/tags # API reachability
```

For schema-constrained requests, send the model tag, prompt, `stream = $false`, and a JSON schema in `format`; use `ConvertTo-Json -Depth 10` for nested schemas.

---

## 9. Current Implementation Status

**Working**

| Item | Detail |
|---|---|
| React/Vite scaffold | `apps/web` |
| Bun backend scaffold | `apps/server`, Bun 1.4.4 |
| `GET /health` | Returns `{ "status": "OK" }` |
| `GET /health/model` | Verified HTTP 200 |
| Zod model-list schema | `ollamaTagsSchema` |
| Container → host Ollama connectivity | Verified via `host.docker.internal` |

`GET /health/model` reads `OLLAMA_BASE_URL` and `OLLAMA_MODEL`, lists registered models, confirms the configured model exists, and returns:

```json
{
  "status": "OK",
  "ollama": "connected",
  "model": "qwen2.5:1.5b",
  "availableModels": ["gemma4:12b", "qwen2.5:1.5b"]
}
```

```typescript
import { z } from "zod";

export const ollamaTagsSchema = z.object({
  models: z.array(
    z.object({
      name: z.string(),
    }),
  ),
});

export type OllamaTags = z.infer<typeof ollamaTagsSchema>;
```

**In progress:** chat request/response schemas, Ollama text-generation service, `POST /api/chat`.

**Not started:** frontend chat UI, streaming, model management, SQLite, conversation persistence, context, memory, tools, action validation and execution, dataset, evaluation, fine-tuning.

---

## 10. API Design

Consistent HTTP semantics: `GET` retrieves, `POST` creates or executes, `PATCH` partially updates, `PUT` replaces, `DELETE` removes. Responses should be predictable and consistently structured.

**Chat request / response (Phase 1)**

```json
{ "message": "Explain what an API is." }
```

```json
{ "status": "OK", "reply": "An API is..." }
```

**Endpoints** (proposed; only the first two and the chat endpoint are in progress or implemented)

```text
GET     /health
GET     /health/model

POST    /api/chat

GET     /api/models
GET     /api/models/active
PUT     /api/models/active

GET     /api/conversations
POST    /api/conversations
GET     /api/conversations/:id
PATCH   /api/conversations/:id
DELETE  /api/conversations/:id

GET     /api/conversations/:id/messages
POST    /api/conversations/:id/messages
```

Action, note, task, and event endpoints will be defined in Phase 5.

---

## 11. Data Model

Proposed initial SQLite schema, to be reviewed before implementation.

**conversations**

| Column | Type | Purpose |
|---|---|---|
| id | TEXT | Primary key |
| title | TEXT | Conversation title |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update |

**messages**

| Column | Type | Purpose |
|---|---|---|
| id | TEXT | Primary key |
| conversation_id | TEXT | Foreign key to conversations |
| role | TEXT | `user` / `assistant` / `system` |
| content | TEXT | Message content |
| model | TEXT | Model used |
| created_at | TEXT | Creation timestamp |

Notes, tasks, events, and memories get their own tables when those features are designed.

Requirements:
- Foreign key constraints; indexes on frequently queried columns.
- Preserved conversation ordering; transactions where appropriate.
- Parameterized SQL only.
- A migration or schema-versioning strategy.
- Avoid unnecessary database abstraction.
- Database files stay out of version control.

---

## 12. Dataset and Training Specification

- Start with a small, manually reviewed seed dataset; expand only when evaluation reveals coverage gaps.
- Sources: hand-written, template-generated, and appropriately licensed open examples. Consider teacher-generated examples when a suitable source and permitted workflow exist.
- Store as JSONL chat records; validate every expected response against the shared contract.
- Deduplicate near-identical examples; avoid leakage across related template families.
- Keep the held-out test set separate from training and model-selection decisions.
- Record provenance and licenses.
- Rough target: ~800 seed examples, growing toward 1,500–3,000 if justified. This is an estimate, not a requirement.
- Select a compatible instruction-tuned model, establish the baseline **before** fine-tuning, save configurations, seeds, checkpoints, and results, and test exported or quantized artifacts locally.
- Knowledge distillation is optional; teacher-generated supervision followed by student fine-tuning is a possible first approach.

---

## 13. Evaluation Specification

Evaluate all configurations on the same held-out examples.

| Condition | Configuration |
|---|---|
| A | Base model, prompt-only or few-shot |
| B | Base model, schema-constrained output |
| C | Fine-tuned model, prompting |
| D | Fine-tuned model, schema-constrained output |

Include a rules-based baseline when practical.

**Metrics**
- JSON-valid rate and schema-valid rate.
- Tool-selection accuracy.
- Argument-level precision, recall, and F1 where appropriate.
- Correct handling of clarification and ordinary responses.
- Error categories and representative failures.
- End-to-end latency on the target laptop.
- Model artifact size and memory requirements.

Possible initial targets: schema-valid ≥ 95%, tool-selection accuracy ≥ 90%, argument F1 ≥ 85%. These are goals, not promised results. Report actual numbers, regressions, and limitations.

---

## 14. Security and Reliability

Local does not automatically mean secure.

**Model and tool safety**
- Treat all model-generated content as untrusted.
- Expose only explicitly whitelisted tools.
- Never execute arbitrary model-generated shell commands or code.
- Enforce authorization and confirmation separately from schema validation.
- Keep destructive operations behind explicit authorization.
- Validate file paths for file-related tools and protect against path traversal.
- Revisit the threat model before retrieved notes or tool results influence later model decisions.

**Application**
- Validate every incoming request and model output.
- Parameterized SQL; never `eval` for arithmetic.
- Request size limits, upstream timeouts, graceful handling of unavailable Ollama and malformed responses.
- Retry validation failures at most once initially.
- Appropriate CORS and origin checks for the deployment mode.
- Do not expose environment variables; never commit `.env`; keep `.env.example` current.
- Avoid logging sensitive conversation content unnecessarily.
- Add tool-execution logging.

**Network and data**
- Bind the local API to `127.0.0.1` where compatible; configure devcontainer port forwarding deliberately.
- Keep the Ollama API off the public internet.
- Keep database files, credentials, and local model artifacts out of Git unless intentionally released.
- Do not send private user data to external teacher models or cloud services without an explicit, informed decision.

**Future:** authentication if the app becomes network-accessible, per-tool authorization, audit logging for sensitive operations.

---

## 15. Hardware and Performance Constraints

| Resource | Specification |
|---|---|
| Laptop | Acer Nitro 5 (AN515-55) |
| GPU | NVIDIA GTX 1650 Ti |
| VRAM | 4 GB |
| System RAM | ~16 GB |
| Host OS | Windows 11 |

- Do not assume all model weights fit in VRAM; consider CPU offload.
- Benchmark real inference speed and memory use before choosing a final model.
- Choose models by measured performance and output quality, not parameter count.
- Avoid loading multiple large models unnecessarily.
- Make context length configurable.
- Design the interface around realistic latency.
- Keep model execution separate from request validation and persistence.

Zero cost is a design objective, not a guarantee of unlimited compute, hosting, or availability. Run everything locally in development, use free compute for optional training, and do not depend on a continuously running free cloud GPU endpoint. A public frontend demo and a fully hosted AI service are separate deployment modes.

---

## 16. Testing Strategy

Introduce testing progressively. Every meaningful feature needs a clear way to verify it works.

- **Unit:** Zod schemas, application services, domain rules, utilities, date and math resolvers.
- **Integration:** Hono routes, Ollama service, SQLite repositories, error handling.
- **Frontend:** component behavior, API integration, message rendering, conversation management.
- **Manual:** Ollama unavailable, model missing, empty messages, malformed JSON, long generations, interrupted requests, restart and persistence.
- **Model:** the evaluation suite in [Section 13](#13-evaluation-specification).

---

## 17. Roadmap

| Priority | Milestone | Status |
|---|---|---|
| P0 | React/Vite frontend scaffold | Existing |
| P0 | Bun backend scaffold | Existing |
| P0 | Hono health endpoint | Verified |
| P0 | Ollama connectivity endpoint | Verified |
| P0 | Zod model-list schema | Existing |
| P0 | Chat request/response schemas | In progress |
| P0 | Ollama text generation service | In progress |
| P0 | Chat API endpoint | In progress |
| P1 | React chat interface | Planned |
| P1 | Streaming responses | Planned |
| P1 | Model management | Planned |
| P1 | SQLite integration | Planned |
| P1 | Conversation persistence | Planned |
| P2 | Conversation context | Planned |
| P2 | Persistent memory | Planned |
| P2 | Structured action and tool framework | Planned |
| P3 | Document retrieval / RAG | Planned |
| P3 | Python dataset and QLoRA pipeline | Planned |
| P3 | Model evaluation framework | Planned |

**Phases**

1. **Core AI communication:** frontend ↔ backend ↔ local LLM, reliably.
2. **Conversational interface:** usable chat UI, conversations, messages.
3. **SQLite persistence:** conversations survive restarts.
4. **Context and memory:** relevant prior information, controlled and transparent.
5. **Tool integration:** structured actions, validation, confirmation, execution.
6. **Python AI pipeline:** dataset, baseline, fine-tuning, evaluation.

Priorities are directional; reassess dependencies before starting each milestone.

---

## 18. Open Decisions

| Decision | Notes |
|---|---|
| Shared package name | Earlier notes used `packages/shared` and `packages/contracts`; this document uses `contracts`. Confirm and keep one. |
| Workspace configuration | Frontend stays on pnpm, backend on Bun. Decide whether a root workspace config is needed at all; avoid competing lockfiles. |
| Canonical action contract | Nested `name`/`arguments` is intended; finalize before backend work and align prompts, schemas, tests, and datasets. |
| Chat vs. action pipeline | Decide whether `/api/chat` evolves to emit actions (with `respond` as the conversational action) or whether actions use a separate endpoint. |
| SQLite library | Select one that is verified under Bun. |
| Test framework | Vitest or a Bun-compatible setup. |
| Action-layer model | `qwen2.5:1.5b` is a baseline only; `gemma4:12b` and others to be benchmarked. |
| Confirmation policy | Confirmation before all write actions initially; revisit once the pipeline is trusted. |

---

## 19. Development Workflow and Coding Standards

### 19.1 Per-feature workflow

1. Define requirements and acceptance criteria.
2. Explain the relevant programming and system-design concepts.
3. Write pseudocode or a small architecture sketch.
4. Implement core logic with guided, hands-on coding.
5. Use autocomplete and delegated AI assistance selectively.
6. Run tests, linting, and production builds as applicable.
7. Get an independent review for meaningful changes.
8. Fix confirmed defects and document unresolved risks.
9. Record learning and architectural decisions.
10. Commit a stable milestone to Git.

Keep one active writer per set of files; reviewers inspect without overwriting.

### 19.2 TypeScript

- Strict type checking; avoid `any`; prefer `unknown` for untrusted data.
- Validate external inputs with Zod and infer types from schemas where practical.
- Avoid unnecessary type assertions; keep functions focused; use descriptive names.

### 19.3 Backend

- Thin route handlers; infrastructure separated from application logic.
- No direct database access in routes.
- Centralize shared error handling when justified.
- Configuration through environment variables.
- Use asynchronous operations appropriately.

### 19.4 Frontend

- Reusable components; UI separated from API communication.
- Avoid excessive component complexity.
- Strongly typed API contracts.
- Handle loading, error, and empty states.
- Do not duplicate backend business rules.

### 19.5 Dependencies

- Avoid unnecessary packages and explain why each is needed.
- Prefer native platform functionality where appropriate.
- Pin versions and verify compatibility.
- Do not change existing package managers without approval.

---

## 20. AI Coding Agent Instructions

Mandatory for any coding agent working on Prometheus.

### 20.1 Role

Act as a senior software engineer, technical mentor, and pair-programming partner. The goal is not just code, but the developer's understanding of the architecture, tradeoffs, and decisions. The developer wants to improve real programming skills, not copy generated code.

### 20.2 Workflow

1. Understand the existing codebase.
2. Identify relevant files and dependencies.
3. Explain the problem and proposed solution, including tradeoffs.
4. Present a small implementation step.
5. Let the developer implement or approve the change.
6. Review the implementation.
7. Run relevant checks and tests.
8. Explain errors and how to diagnose them.
9. Update documentation when necessary.

Do not jump ahead through multiple major milestones. Explain what the code does, why it is needed, why the approach fits, what alternatives exist, and how it works internally. Use pseudocode, diagrams, and concise examples where useful.

### 20.3 Editing rules

- Do not rewrite entire files when a small change is enough.
- Inspect existing code first; preserve working functionality.
- Avoid unrelated refactoring and duplicate implementations.
- Never delete files without explaining why.
- Never silently change the architecture.
- Do not introduce dependencies without justification.
- Do not assume a file exists just because it was proposed earlier.
- The developer edits in Windsurf and uses the terminal for commands, tests, and Git. Antigravity CLI is for independent read-only review. Never let multiple agents modify the same files at once.

### 20.4 Git rules

- Preserve the existing repository and history; never run `git init`.
- Inspect `git status` before staging.
- Never stage `.env`, secrets, or generated dependencies.
- Explain Git commands before destructive operations.
- Do not commit without the developer's approval.

### 20.5 Communication

- Technically precise, concise but sufficiently explanatory, no generic filler.
- Prefer meaningful incremental steps; do not dump huge implementations.
- Use diagrams and tables when they clarify.
- Ask only necessary clarification questions.
- Never claim code has been tested unless it actually has been.

---

## 21. Definition of Done

### 21.1 A feature is done when

- Requirements are clear and the implementation follows the existing architecture.
- Input validation and error cases are handled.
- Type checking and relevant tests pass.
- Nothing unrelated is broken.
- Documentation is updated where appropriate.
- The developer understands the implementation.

### 21.2 Prometheus v1 is done when

- The frontend communicates with Hono on Bun, and the shared contract is used consistently and tested.
- The backend gets responses from a compatible local model, and conversations, notes, tasks, and events persist locally.
- Invalid model output cannot execute a tool.
- All five productivity tools and both control actions behave as specified.
- Date parsing and arithmetic are deterministic and tested.
- Actions, validation, and execution results are visible in the UI.
- Unit and integration tests, linting, and production builds pass.
- Setup instructions are reproducible; dataset generation and evaluation are reproducible.
- Baseline and fine-tuned results are reported honestly; model and dataset licensing is documented.
- The README explains architecture, setup, limitations, and results.

If fine-tuning does not improve performance enough, the application can still ship with the best measured baseline. Report the outcome honestly.

---

## 22. Immediate Next Steps

Continue from the existing implementation; do not rebuild. Complete **Phase 1 — Core AI Communication**:

1. Confirm `apps/server/schemas/chat.schema.ts` exists.
2. Complete the Ollama chat response schema.
3. Ensure `ollama.service.ts` exports both `getOllamaModels()` and `generateOllamaResponse()`.
4. Correct imports in `index.ts`.
5. Run `bun check`.
6. Start the backend.
7. Test `POST /api/chat`.
8. Test invalid input and upstream-failure handling.
9. Review the implementation before moving on to streaming.

Do not start SQLite, conversation history, memory, or frontend integration until the basic chat API works reliably.

---

**Project:** Prometheus
**Primary deliverable:** A working local-first assistant with controlled tool calling and measurable model evaluation.
**Primary engineering objective:** A maintainable full-stack application, built while learning to design, implement, test, and explain its architecture.
**Primary ML objective:** Determine empirically whether a small fine-tuned model improves structured tool use over a well-established baseline.
