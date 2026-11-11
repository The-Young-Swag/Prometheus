# Prometheus — Project Specification & Feature Roadmap

**Document type:** Product Requirements Document (PRD) + Technical Specification  
**Project:** Prometheus  
**Status:** Active Development  
**Architecture:** Local-first, modular AI assistant  
**Primary goal:** Build a personal AI assistant with local LLM inference, persistent memory, extensible tools, and a modern conversational interface.

---

# 1. Project Overview

## 1.1 Vision

Prometheus is a local-first personal AI assistant designed to provide intelligent conversational assistance while maintaining control over data, model inference, and persistence.

It should function as a personal AI environment where users can:

- Interact with locally hosted language models.
- Maintain persistent conversations and contextual memory.
- Execute tools and application actions through controlled integrations.
- Organize conversations and manage AI-generated information.
- Switch between supported local models.
- Eventually customize, evaluate, and fine-tune models.

Prometheus prioritizes privacy, modularity, extensibility, maintainability, and practical performance on consumer hardware.

## 1.2 Core Principles

1. **Local-first:** Prefer local inference and local persistence.
2. **Privacy:** User conversations and personal data should remain under user control.
3. **Modularity:** Keep business logic independent from framework-specific code.
4. **Type safety:** Use TypeScript and Zod to enforce contracts.
5. **Maintainability:** Prefer clear abstractions over premature complexity.
6. **Extensibility:** Design the system to support additional models, tools, and capabilities.
7. **Resource awareness:** Account for limited RAM and GPU VRAM.
8. **Human control:** Never execute potentially destructive operations without appropriate authorization.

---

# 2. Technology Stack

## 2.1 Frontend

| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| Vite | Development server and build tooling |
| TypeScript | Static typing |
| Tailwind CSS | Styling |
| Native Fetch API | Backend communication |

Frontend requirements:
- Responsive conversational interface.
- Component-based architecture.
- Reusable UI components.
- Strongly typed API contracts.
- Clear loading, error, and empty states.
- Support for streaming responses in a future iteration.

## 2.2 Backend

| Technology | Purpose |
|---|---|
| Bun | JavaScript/TypeScript runtime |
| Hono | HTTP framework |
| TypeScript | Static typing |
| Zod | Runtime validation |
| Fetch API | Ollama communication |
| SQLite | Planned local persistence |

Bun is the runtime and Hono is the HTTP framework. They serve different purposes and should be used together.

## 2.3 AI Infrastructure

| Technology | Purpose |
|---|---|
| Ollama | Local model runtime |
| Qwen 2.5 1.5B | Initial configured model |
| Gemma 4 12B | Additional available model |
| Python | Separate model experimentation pipeline |
| QLoRA | Planned parameter-efficient fine-tuning |

The backend communicates with Ollama through its HTTP API.

Current development environment:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

The Ollama runtime is installed on the Windows host, while the application backend runs inside a Linux development container.

Do not assume `localhost:11434` inside the container points to the Windows host.

## 2.4 Development Environment

- Windows 11 host.
- Linux VS Code development container.
- Bun 1.4.4.
- Node.js 24.
- pnpm for the existing frontend.
- Bun for the backend.
- Git for version control.
- Windsurf for development.
- Antigravity CLI for independent code review.

The frontend package manager must remain unchanged.

---

# 3. Repository Structure

Current and intended structure:

```text
Prometheus/
│
├── apps/
│   │
│   ├── web/                     # React frontend
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── server/                  # Bun + Hono backend
│       ├── schemas/
│       │   ├── ollama.schema.ts
│       │   └── chat.schema.ts
│       │
│       ├── services/
│       │   └── ollama.service.ts
│       │
│       ├── routes/              # Planned API route modules
│       ├── middleware/          # Planned middleware
│       ├── lib/                 # Shared backend utilities
│       ├── db/                  # Planned SQLite integration
│       │
│       ├── index.ts
│       ├── package.json
│       ├── bun.lock
│       ├── tsconfig.json
│       ├── .env
│       └── .env.example
│
├── packages/
│   └── contracts/               # Planned shared TypeScript contracts
│
├── python/                      # Planned model experimentation
│
├── .agents/
├── .devcontainer/
├── .gitignore
└── README.md
```

Important:
- The frontend already exists under `apps/web`.
- The backend exists under `apps/server`.
- Do not initialize another Git repository.
- Do not migrate the frontend from pnpm to Bun.
- Do not introduce unnecessary workspace configuration.
- Treat planned directories as architectural targets, not necessarily existing files.

---

# 4. Backend Architecture

The backend should gradually adopt a layered architecture.

```text
HTTP Request
     │
     ▼
Presentation Layer
(Hono Routes / Controllers)
     │
     ▼
Application Layer
(Use Cases / Application Services)
     │
     ▼
Domain Layer
(Entities / Business Rules)
     │
     ▼
Infrastructure Layer
(Ollama / SQLite / External Services)
```

## 4.1 Presentation Layer

Responsibilities:
- Define HTTP endpoints.
- Parse incoming requests.
- Validate input using Zod.
- Invoke application services.
- Return appropriate HTTP responses.

Routes should not contain database queries, direct Ollama implementation details, or complex business logic.

## 4.2 Application Layer

Responsibilities:
- Coordinate application operations.
- Execute use cases.
- Enforce application workflows.
- Coordinate domain logic and infrastructure interfaces.

Examples:
- SendChatMessage.
- CreateConversation.
- RetrieveConversationHistory.
- DeleteConversation.
- SwitchActiveModel.

## 4.3 Domain Layer

Responsibilities:
- Represent core application concepts.
- Define business rules.
- Define domain-level interfaces.
- Avoid dependencies on Hono, SQLite, or Ollama.

Potential domain concepts:
- Conversation.
- Message.
- Model.
- Memory.
- Tool.
- UserSettings.

## 4.4 Infrastructure Layer

Responsibilities:
- Communicate with Ollama.
- Persist information in SQLite.
- Implement repositories.
- Handle external integrations.
- Manage low-level technical concerns.

---

# 5. Current Implementation

The following capabilities have already been established during development.

## 5.1 Hono Server

The backend uses a default-exported Hono application.

Existing endpoint:

```http
GET /health
```

Expected response:

```json
{
  "status": "OK"
}
```

Bun can serve the default-exported Hono application directly.

## 5.2 Ollama Connectivity

Existing endpoint:

```http
GET /health/model
```

Responsibilities:
- Read `OLLAMA_BASE_URL`.
- Read `OLLAMA_MODEL`.
- Retrieve registered Ollama models.
- Verify that the configured model is available.
- Return connectivity and model information.

Verified response:

```json
{
  "status": "OK",
  "ollama": "connected",
  "model": "qwen2.5:1.5b",
  "availableModels": [
    "gemma4:12b",
    "qwen2.5:1.5b"
  ]
}
```

This endpoint has successfully returned HTTP 200.

## 5.3 Zod Validation

Existing model-list schema:

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

A chat request schema and chat response schema are part of the current development task.

---

# 6. Feature Specifications

Features are grouped by development priority.

## Phase 1 — Core AI Communication

**Goal:** Establish reliable communication between the frontend, backend, and local LLM.

### 6.1 Chat API

Endpoint:

```http
POST /api/chat
```

Request:

```json
{
  "message": "Explain what an API is."
}
```

Response:

```json
{
  "status": "OK",
  "reply": "An API is..."
}
```

Requirements:
- Validate incoming messages with Zod.
- Reject empty messages.
- Communicate with Ollama using its `/api/chat` endpoint.
- Return generated text.
- Handle connection failures and invalid upstream responses.
- Apply request timeouts.
- Avoid exposing sensitive internal details in production errors.

### 6.2 Model Management

Planned capabilities:
- List available local models.
- Identify the configured model.
- Switch the active model.
- Check model availability.
- Retrieve model metadata when supported.
- Handle unavailable models gracefully.

### 6.3 Streaming Responses

Planned capabilities:
- Stream generated tokens to the frontend.
- Display partial responses as they arrive.
- Support cancellation.
- Handle interrupted connections.
- Properly close streams and release resources.

Investigate Ollama streaming and suitable transport mechanisms before implementation.

---

## Phase 2 — Conversational Interface

**Goal:** Build a usable personal AI chat interface.

### 6.4 Chat Interface

Requirements:
- Message composer.
- User and assistant message bubbles.
- Loading and generation indicators.
- Markdown rendering.
- Code block rendering.
- Copy response functionality.
- Auto-scroll behavior.
- Error messages.
- Empty conversation state.
- Responsive layout.

### 6.5 Conversation Management

Planned capabilities:
- Create conversations.
- Rename conversations.
- Delete conversations.
- Retrieve previous conversations.
- Display conversation history.
- Automatically associate messages with conversations.

### 6.6 Message Management

Planned capabilities:
- Store user messages.
- Store assistant responses.
- Preserve message ordering.
- Record timestamps.
- Associate messages with models.
- Support generation metadata where appropriate.

---

## Phase 3 — SQLite Persistence

**Goal:** Make conversations survive application restarts.

Use SQLite for local persistence.

Proposed initial schema:

### conversations

| Column | Type | Purpose |
|---|---|---|
| id | TEXT | Primary key |
| title | TEXT | Conversation title |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update |

### messages

| Column | Type | Purpose |
|---|---|---|
| id | TEXT | Primary key |
| conversation_id | TEXT | Conversation reference |
| role | TEXT | user / assistant / system |
| content | TEXT | Message content |
| model | TEXT | Model used |
| created_at | TEXT | Creation timestamp |

Requirements:
- Use foreign key constraints.
- Index frequently queried columns.
- Preserve conversation ordering.
- Use transactions where appropriate.
- Avoid unnecessary database abstraction.
- Introduce migrations or a reliable schema-versioning strategy.

The final schema should be reviewed before implementation.

---

## Phase 4 — Context and Memory

**Goal:** Enable Prometheus to use relevant previous information.

### 6.7 Conversation Context

Planned capabilities:
- Retrieve previous messages.
- Construct model conversation history.
- Respect context-window limits.
- Implement message truncation or summarization strategies.
- Preserve system instructions.

### 6.8 Persistent Memory

Planned capabilities:
- Store user-approved memories.
- Retrieve relevant memories.
- Update or remove memories.
- Associate memories with their source.
- Distinguish conversation history from persistent memory.

Memory should be controlled and transparent. Do not automatically treat every conversation as a permanent memory.

### 6.9 Context Retrieval

Future investigation:
- Embeddings.
- Vector search.
- Semantic retrieval.
- SQLite-compatible vector extensions or alternative local solutions.
- Retrieval-augmented generation (RAG).

Do not introduce a vector database before establishing a concrete retrieval requirement.

---

## Phase 5 — Tool Integration

**Goal:** Allow Prometheus to perform useful tasks beyond text generation.

Potential tools:
- Calculator.
- Date and time.
- File search.
- Local document retrieval.
- Code assistance.
- System information.
- Controlled application actions.

Requirements:
- Explicit tool definitions.
- Zod validation for tool inputs.
- Tool execution separated from model inference.
- Permission checks.
- Execution timeouts.
- Error handling.
- Tool execution logging.

Never execute arbitrary model-generated code or shell commands without an explicit security design and authorization.

---

## Phase 6 — Python AI Pipeline

**Goal:** Maintain a separate environment for model experimentation and customization.

Potential capabilities:
- Dataset preparation.
- Dataset validation.
- Model evaluation.
- QLoRA fine-tuning.
- Training configuration.
- Evaluation reports.
- Model comparison.
- Export and integration with Ollama where supported.

Keep this pipeline separate from the main Bun backend.

Do not couple normal application operation to Python training dependencies.

---

# 7. API Design Guidelines

Use consistent HTTP semantics.

| Method | Purpose |
|---|---|
| GET | Retrieve resources |
| POST | Create resources or execute operations |
| PATCH | Partially update resources |
| PUT | Replace resources |
| DELETE | Delete resources |

Potential endpoint structure:

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

These are proposed endpoints, not all implemented.

API responses should be predictable and consistently structured.

---

# 8. Coding Standards

## TypeScript

- Enable strict type checking.
- Avoid `any`.
- Prefer `unknown` for untrusted data.
- Validate external inputs with Zod.
- Infer types from schemas where practical.
- Avoid unnecessary type assertions.
- Keep functions focused.
- Prefer descriptive names.

## Backend

- Keep route handlers thin.
- Separate infrastructure from application logic.
- Avoid direct database access in routes.
- Centralize shared error handling when justified.
- Use environment variables for configuration.
- Never commit `.env`.
- Keep `.env.example` updated.
- Use asynchronous operations appropriately.

## Frontend

- Use reusable React components.
- Separate UI from API communication.
- Avoid excessive component complexity.
- Keep API contracts strongly typed.
- Handle loading, error, and empty states.
- Do not duplicate backend business rules in the frontend.

## Dependencies

- Avoid unnecessary packages.
- Explain why a dependency is needed.
- Prefer native platform functionality when appropriate.
- Do not change existing package managers without approval.

---

# 9. Security and Reliability

Prometheus is a local-first application, but local does not automatically mean secure.

Requirements:
- Validate every external request.
- Avoid exposing environment variables.
- Do not commit secrets.
- Apply sensible request size limits.
- Apply timeouts to upstream requests.
- Prevent uncontrolled tool execution.
- Validate file paths for file-related tools.
- Protect against path traversal.
- Handle malformed upstream responses.
- Avoid logging sensitive conversation content unnecessarily.
- Use appropriate CORS configuration.
- Keep destructive operations behind explicit authorization.

Future consideration:
- Authentication if the application becomes network-accessible.
- Authorization for individual tools and resources.
- Audit logging for sensitive operations.

---

# 10. Hardware and Performance Constraints

Current development hardware:

| Resource | Specification |
|---|---|
| GPU | NVIDIA GTX 1650 Ti |
| VRAM | 4 GB |
| System RAM | Approximately 16 GB |
| Host OS | Windows 11 |

Available local models:
- `qwen2.5:1.5b`
- `gemma4:12b`

Performance requirements:
- Avoid assuming all model weights fit in VRAM.
- Benchmark actual inference speed and memory usage.
- Consider CPU offloading.
- Avoid loading multiple large models unnecessarily.
- Use configurable context lengths.
- Consider response latency when designing the interface.
- Keep model execution separate from API request validation and persistence.

The initial model should be selected based on measured performance and output quality, not parameter count alone.

---

# 11. Testing Strategy

Testing should be introduced progressively.

### Unit Tests
- Zod schemas.
- Application services.
- Domain rules.
- Utility functions.

### Integration Tests
- Hono routes.
- Ollama service communication.
- SQLite repositories.
- Error handling.

### Frontend Tests
- Component behavior.
- API integration.
- Message rendering.
- Conversation management.

### Manual Tests
- Ollama unavailable.
- Model missing.
- Empty messages.
- Malformed JSON.
- Long generation times.
- Interrupted requests.
- Application restart and persistence.

Every meaningful feature should have a clear way to verify that it works.

---

# 12. Development Roadmap

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
| P2 | Tool execution framework | Planned |
| P3 | Document retrieval / RAG | Planned |
| P3 | Python QLoRA pipeline | Planned |
| P3 | Model evaluation framework | Planned |

Priorities are directional. Reassess dependencies before starting each milestone.

---

# 13. AI Coding Agent Instructions

This section is mandatory for any coding agent working on Prometheus.

## 13.1 Role

Act as a senior software engineer, technical mentor, and pair-programming partner.

Your objective is not merely to produce code. Help the developer understand the architecture, implementation, tradeoffs, and engineering decisions.

## 13.2 Development Workflow

For every feature:

1. Understand the existing codebase.
2. Identify the relevant files and dependencies.
3. Explain the problem and proposed solution.
4. Explain architectural tradeoffs.
5. Present a small implementation step.
6. Let the developer implement or approve the changes.
7. Review the implementation.
8. Run relevant checks and tests.
9. Explain errors and how to diagnose them.
10. Update documentation when necessary.

Do not jump ahead through multiple major milestones.

## 13.3 Teaching Requirements

Explain:
- What the code does.
- Why the implementation is needed.
- Why the chosen approach is appropriate.
- What alternative approaches exist.
- What tradeoffs are involved.
- How the implementation works internally.

Use pseudocode, diagrams, and concise examples when useful.

The developer wants to improve actual programming and software engineering skills, not simply copy generated code.

## 13.4 Editing Rules

- Do not rewrite entire files when a small modification is sufficient.
- Inspect existing code before suggesting changes.
- Preserve working functionality.
- Avoid unrelated refactoring.
- Never delete existing files without explaining why.
- Never silently change the architecture.
- Do not introduce dependencies without justification.
- Do not create duplicate implementations.
- Do not assume a file exists just because it was previously proposed.

The developer primarily uses Windsurf's editor for code changes and the terminal for commands, testing, and Git.

Antigravity CLI may be used for independent read-only reviews. Do not let multiple agents modify the same files simultaneously.

## 13.5 Git Rules

- Preserve the existing repository and Git history.
- Never run `git init` in this project.
- Inspect `git status` before staging changes.
- Never stage `.env`, secrets, or generated dependencies.
- Explain Git commands before destructive operations.
- Do not commit changes without the developer's approval.

## 13.6 Communication Style

- Be technically precise.
- Be concise but sufficiently explanatory.
- Avoid generic AI-generated filler.
- Prefer meaningful incremental steps.
- Use diagrams and tables when they clarify the subject.
- Do not overwhelm the developer with a huge implementation dump.
- Ask only necessary clarification questions.
- Never claim code has been tested unless it actually has been tested.

---

# 14. Definition of Done

A feature is complete when:

- Its requirements are clear.
- Its implementation follows the existing architecture.
- Input validation is implemented where necessary.
- Error cases are handled.
- Type checking passes.
- Relevant tests pass.
- No unrelated functionality is broken.
- Documentation is updated when appropriate.
- The developer understands the implementation.

---

# 15. Immediate Development Objective

Continue from the existing implementation rather than rebuilding the project.

The immediate task is to complete **Phase 1 — Core AI Communication**.

Current next steps:

1. Confirm `apps/server/schemas/chat.schema.ts` exists.
2. Complete the Ollama chat response schema.
3. Ensure `ollama.service.ts` exports both:
   - `getOllamaModels()`
   - `generateOllamaResponse()`
4. Correct imports in `index.ts`.
5. Run `bun check`.
6. Start the backend.
7. Test `POST /api/chat`.
8. Test invalid input and upstream failure handling.
9. Review the implementation before proceeding to streaming.

Do not start SQLite, conversation history, memory, or frontend integration until the basic chat API is working reliably.

---

**End of Project Specification**  
**Canonical project name: Prometheus**