# Clean Code Standards — Prometheus (TypeScript)

Applies to all code in the Prometheus repository: the Bun + Hono backend (`apps/server`), the React + Vite frontend (`apps/web`), shared contracts (`packages/contracts`), and, where noted, the Python model pipeline (`python/`).

Read `PROMETHEUS.md` first. This file defines how code is written; `PROMETHEUS.md` defines what is built and the architecture it must follow.

---

## 1. Core Philosophy

Write code that is clean, readable, predictable, and maintainable.

The objective is not the shortest, cleverest, or most abstract implementation. It is to solve the problem correctly with straightforward code that the developer can understand, explain, and maintain. Prometheus is also a learning project: code the developer cannot explain is not finished.

- **Readability:** understandable without deciphering it.
- **Simplicity:** straightforward solutions over clever ones.
- **Consistency:** coherent naming, formatting, and structure.
- **Maintainability:** changes stay easy and unrelated complexity stays out.
- **Predictability:** functions behave as their names and signatures suggest.
- **Efficiency:** avoid unnecessary work without trading clarity for premature optimization.
- **Responsibility:** every function, module, and component has a clear purpose.

Apply Robert C. Martin's *Clean Code* principles with practical judgment.

**Primary rule: write the simplest implementation that correctly solves the problem while following Prometheus's established architecture.**

---

## 2. Naming: Be Descriptive and Intention-Revealing

A developer should not need to read an entire implementation to understand what a name stands for.

### Conventions

| Kind | Convention | Example |
|---|---|---|
| Variables, functions, parameters | `camelCase` | `conversationId`, `getOllamaModels` |
| Types, interfaces, React components | `PascalCase` | `ChatRequest`, `MessageBubble` |
| Zod schemas | `camelCase` + `Schema` suffix | `chatRequestSchema` |
| Types inferred from schemas | `PascalCase`, same base name | `type ChatRequest = z.infer<typeof chatRequestSchema>` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_MESSAGE_LENGTH` |
| Backend files | `name.kind.ts` | `chat.schema.ts`, `ollama.service.ts` |
| React component files | `PascalCase.tsx` | `MessageBubble.tsx` |
| Custom hooks | `use` prefix | `useChatMessages` |

Follow the naming already used in the file and folder you are editing.

### Variables

- Prefer nouns for values; use names that express intent, not implementation.
- Avoid cryptic abbreviations and unexplained single-letter names.
- Avoid generic names such as `data`, `value`, `item`, `result`, or `res` when something more specific exists.

```ts
// Avoid
const d = await getData();
const x = conversation.id;
const flag = true;

// Prefer
const conversationHistory = await getConversationHistory(conversationId);
const conversationId = conversation.id;
const isModelAvailable = true;
```

Short names are fine when obvious in a small scope or conventional (`i`, `id`, `url`, `key`).

### Functions

Use descriptive verb phrases.

```ts
// Avoid
function chat(input: unknown) {}
function process(value: string) {}
function handle(x: unknown) {}

// Prefer
function sendChatMessage(request: ChatRequest) {}
function parseModelAction(rawOutput: string) {}
function resolveEventTime(whenText: string, now: Date) {}
```

Name event handlers `handleX` and callback props `onX` in React.

### Booleans

Names must read as conditions: `isLoading`, `hasError`, `canRetry`, `shouldConfirm`, `wasValidated`. Avoid `status`, `check`, `flag`.

### Constants

Name by meaning, not value, and keep them out of function bodies when shared.

```ts
const MAX_MESSAGE_LENGTH = 4000;
const OLLAMA_REQUEST_TIMEOUT_MS = 60_000;
```

Include units in names where relevant (`_MS`, `_MIN`, `_BYTES`).

---

## 3. Keep Functions Small and Do One Thing

- Short enough to understand without tracking unrelated operations.
- One responsibility level per function.
- Do not mix validation, database access, business rules, model calls, and response formatting.
- Extract an operation when it makes the code easier to read; never split just to hit a line count.

### Example

Avoid (route handler doing everything):

```ts
app.post("/api/chat", async (c) => {
  const body = await c.req.json();

  if (typeof body.message !== "string" || body.message.trim() === "") {
    return c.json({ status: "ERROR", message: "Invalid message" }, 400);
  }

  const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL,
      messages: [{ role: "user", content: body.message }],
      stream: false,
    }),
  });

  const json = await response.json();
  return c.json({ status: "OK", reply: json.message.content });
});
```

Prefer (route delegates; each piece has one job):

```ts
app.post("/api/chat", async (c) => {
  const parsedRequest = chatRequestSchema.safeParse(await readJsonBody(c));

  if (!parsedRequest.success) {
    return c.json({ status: "ERROR", message: "Invalid chat request" }, 400);
  }

  const reply = await generateOllamaResponse(parsedRequest.data.message);
  return c.json({ status: "OK", reply });
});
```

The supporting functions (`readJsonBody`, `generateOllamaResponse`) must have real responsibilities, not exist merely to shrink another function.

**Small functions are useful only when they make code easier to understand.** Avoid fragmentation and pointless helpers.

---

## 4. Single Responsibility Principle (SRP)

Every function, module, and component has one clear responsibility and one primary reason to change.

Prometheus's intended backend layers:

| Layer | Responsibility | Must not contain |
|---|---|---|
| Routes (presentation) | Parse and validate the request, call a service, return an HTTP response | SQL, Ollama request details, business rules |
| Services / use cases (application) | Coordinate a workflow | HTTP types, raw SQL |
| Domain | Core concepts and rules | Hono, SQLite, or Ollama imports |
| Infrastructure | Ollama client, SQLite repositories | Business decisions |

Adopt layers gradually, as the code needs them. Do not create classes, interfaces, repositories, or dependency-injection machinery just to enforce SRP. Use practical separation, not architectural ceremony.

On the frontend, keep UI components separate from API communication and from state logic that can live in a hook.

---

## 5. Limit Function Arguments

- Accept only what the function needs.
- Avoid long lists of positional arguments and boolean flags.
- When values naturally belong together, pass a single typed object.
- Do not introduce parameter objects for simple one- or two-argument cases.

```ts
// Avoid
function createMessage(
  conversationId: string,
  role: string,
  content: string,
  model: string,
  isStreamed: boolean,
) {}

// Prefer
interface NewMessage {
  conversationId: string;
  role: MessageRole;
  content: string;
  model: string;
}

function createMessage(newMessage: NewMessage) {}
```

Avoid boolean parameters whose meaning is unclear at the call site (`fetchModels(true)`); use a named option or two functions instead.

---

## 6. Eliminate Side Effects

Functions must not unexpectedly change state outside their responsibility.

Avoid hidden changes to:

- Module-level or global variables.
- Shared application state.
- Arguments (do not mutate inputs; return new values).
- Unrelated database rows.
- DOM or React state outside the component's responsibility.
- Event listeners, timers, streams, or in-flight requests that outlive their scope.

A function that reads should not also write.

```ts
// Predictable
function getConversationById(conversationId: string): Conversation | null {}
function renameConversation(conversationId: string, title: string): void {}
```

Side effects (database writes, network calls, file access, tool execution) are sometimes necessary. Keep them explicit, intentional, and visible in the function's name. Pure logic (date resolution, math evaluation, validation) should stay free of I/O so it is easy to test.

---

## 7. Keep a Single Level of Abstraction (SLAP)

Statements in a function should sit at about the same level of abstraction. Do not mix high-level workflow with SQL strings, raw JSON handling, or low-level DOM work.

```ts
async function executeProposedAction(rawModelOutput: string) {
  const proposedAction = parseModelAction(rawModelOutput);

  if (!proposedAction) {
    return buildClarificationResponse();
  }

  if (!isActionPermitted(proposedAction)) {
    return buildRejectedResponse(proposedAction);
  }

  return runWhitelistedTool(proposedAction);
}
```

The top-level function reads as the workflow; helpers own the details. Do not add layers when existing code is already clear.

---

## 8. Use Early Returns and Fail Fast

- Handle invalid input first and exit.
- Avoid deeply nested conditionals; keep the main path flat.
- Never continue after a condition has made the operation invalid.

Avoid:

```ts
function getActiveModelName(config: ModelConfig | null) {
  if (config) {
    if (config.isEnabled) {
      if (config.modelName) {
        return config.modelName;
      }
    }
  }

  return null;
}
```

Prefer:

```ts
function getActiveModelName(config: ModelConfig | null) {
  if (!config) {
    return null;
  }

  if (!config.isEnabled) {
    return null;
  }

  return config.modelName ?? null;
}
```

Use early returns to simplify flow, not to scatter returns through a long function.

---

## 9. Consistent Structure and Formatting

- Follow the repository's Prettier/ESLint configuration. Do not hand-format against it.
- Consistent indentation, spacing, and brace placement.
- Group and order imports: external packages, then internal modules, then types.
- Separate logical sections with blank lines; keep related statements together.
- One operation per line; avoid dense one-liners.
- Prefer named exports. Use default exports only where the framework expects them (for example, the Hono app exported from `index.ts` for Bun).

Where it fits, order function bodies: validate → handle invalid cases → fetch what is needed → perform the main operation → return a clear result.

---

## 10. Conditional Logic and Expressions

- Keep conditions explicit and shallow.
- Avoid nested ternaries and long boolean chains.
- Use named booleans to explain complex conditions.
- Use `??` for null/undefined fallbacks and `||` only when falsy values (such as `""` or `0`) should also fall back. Do not mix them casually.
- Prefer optional chaining for genuinely optional values, not to hide values that should never be missing.

```ts
// Avoid
return user && user.isActive && user.role === "admin" ? true : false;

// Prefer
const isActiveAdmin = user !== null && user.isActive && user.role === "admin";
return isActiveAdmin;
```

Do not add temporary variables for trivial expressions.

---

## 11. Types and Validation (TypeScript-Specific)

TypeScript types disappear at runtime. Anything that crosses a boundary needs runtime validation.

- **Strict mode on.** Avoid `any`.
- Treat external data as `unknown` until validated: HTTP request bodies, Ollama responses, model output, environment variables, database rows from untrusted paths.
- **Validate with Zod at every boundary** and infer types from the schema so there is one source of truth.
- Use discriminated unions (for example, the action contract keyed by `name`) and exhaustive `switch` handling.
- Avoid `as` assertions and non-null `!`. If you need one, the type design or validation is probably wrong; if it is truly justified, add a comment explaining why.
- Use `interface` or `type` consistently with the surrounding code; prefer `type` for unions.
- Prefer `readonly` and `as const` for fixed lists such as action names.
- Do not duplicate types by hand when they can be inferred.

```ts
export const ollamaChatResponseSchema = z.object({
  message: z.object({
    role: z.string(),
    content: z.string(),
  }),
  done: z.boolean(),
});

export type OllamaChatResponse = z.infer<typeof ollamaChatResponseSchema>;
```

Schema-valid is not the same as safe or authorized. Validation checks shape; authorization and confirmation are separate steps.

---

## 12. Error Handling

Handle errors deliberately and consistently.

- Validate untrusted input at system boundaries; fail fast when an operation cannot safely continue.
- Never silently swallow errors (`catch {}` with no handling) and never return a success response for a failure.
- Use meaningful messages and the correct HTTP status: `400` invalid request, `404` missing resource, `502` bad upstream response, `503`/`504` Ollama unavailable or timed out.
- Do not expose stack traces, environment variables, file paths, or raw upstream errors to clients. Log the detail server-side; return a safe message.
- Apply timeouts to every upstream call (for example, `AbortSignal.timeout(OLLAMA_REQUEST_TIMEOUT_MS)`).
- `JSON.parse` and `request.json()` throw on malformed input. Catch at the boundary.
- Keep handling near the operation that can fail. Avoid stacking multiple try/catch layers that obscure the original failure.
- Avoid logging sensitive conversation content unnecessarily.

```ts
function parseModelAction(rawOutput: string): ProposedAction | null {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawOutput);
  } catch {
    return null;
  }

  const validation = proposedActionSchema.safeParse(parsedJson);

  if (!validation.success) {
    return null;
  }

  return validation.data;
}
```

---

## 13. Handling Model Output and Tools

Rules specific to Prometheus's AI layer:

- **The model proposes; the application decides and executes.** All model output is untrusted input.
- Never `eval`, `new Function`, or shell out with model-generated content.
- Only whitelisted tools exist. Each has an explicit Zod schema, bounded inputs, and tests.
- Do not rely on prompt instructions for output format. Use Ollama's schema-constrained output **and** backend validation.
- Do not ask the model to compute final dates or arithmetic. Extract the user's phrase (`when_text`, `expression`) and resolve it in deterministic code (`chrono-node` or an equivalent tested parser, and a restricted math parser).
- Build prompts in one place (a prompt-builder module), not inline in routes.
- Use one canonical action contract from `packages/contracts` across prompts, schemas, tests, and evaluation data. Never redefine it locally.
- Retry a failed validation at most once, then return a clarification or error.
- Keep tool execution separate from model inference, with permission checks, timeouts, and logging.

---

## 14. Comments and Documentation

Code explains itself through names and structure. Write comments only for:

- Why a non-obvious decision was made.
- Constraints future developers must preserve.
- Unexpected behavior or technical limitations (for example, Bun/native-module compatibility).
- Complex algorithms.

```ts
// Avoid
// Get models from Ollama
const models = await getOllamaModels();

// Prefer
// The container cannot reach the host via localhost, so the base URL
// comes from OLLAMA_BASE_URL (host.docker.internal in the devcontainer).
const models = await getOllamaModels();
```

Use TSDoc (`/** ... */`) for exported functions and types whose contract is not obvious from the signature. Remove outdated and redundant comments. Improve naming or structure before adding a comment to explain confusing code.

---

## 15. Backend Standards (Bun + Hono + SQLite)

- Keep route handlers thin: parse, validate, delegate, respond.
- Read configuration from environment variables through one validated config module; never read `process.env` scattered through the codebase. Never commit `.env`; keep `.env.example` current.
- **Parameterized SQL only.** Never build queries with string concatenation or template interpolation of user input.

  ```ts
  // Placeholders only, whichever SQLite library is selected
  const query = "SELECT id, title FROM conversations WHERE id = ?";
  ```

- No direct database access in route handlers. Use repository or service functions.
- Use transactions for multi-step writes; use foreign keys and indexes as defined in the schema.
- Do not assume Node-native packages work under Bun; verify compatibility first.
- Keep API responses consistently shaped (`{ status, ... }`) and HTTP semantics correct (`GET` reads, `POST` creates or executes, `PATCH` partial update, `PUT` replace, `DELETE` removes).
- Apply request size limits and sensible CORS configuration.
- Async code: use `async/await`, always handle rejection at a boundary, and never leave a promise unawaited unintentionally.

---

## 16. Frontend Standards (React 19 + TypeScript + Tailwind)

### Components and hooks

- One component per file; `PascalCase` names; typed props.
- Keep components focused. Extract a child component or a hook when a component mixes data fetching, state logic, and markup.
- Keep API communication in a separate module or hook, not inline in JSX.
- Do not duplicate backend business rules in the frontend.
- Do not store derived values in state; compute them during render.
- Use `useEffect` for synchronizing with external systems, not for transforming data or reacting to events that belong in handlers.
- Clean up effects: abort in-flight requests with `AbortController`, clear timers, close streams, remove listeners.
- Give list items stable `key`s (ids, not array indexes, for dynamic lists).
- Always implement loading, error, and empty states.
- Use semantic HTML and accessible controls (labels, button types, focus behavior).
- Use strongly typed API contracts imported from `packages/contracts` where available.

### Styling (Tailwind CSS)

Tailwind is planned. Verify it is installed and configured before using it.

- Use utility classes directly in components; do not write parallel custom CSS for the same thing.
- When a long class list repeats, extract a **component**, not a pile of `@apply` rules.
- Keep class lists readable: group by layout, spacing, typography, color, state, responsive.
- Use the theme configuration for genuinely shared design tokens (colors, spacing, fonts); do not add tokens for one-off values.
- Avoid arbitrary values (`w-[437px]`) and `!important` unless there is no clean alternative.
- If plain CSS is needed, use descriptive, consistent class names and avoid over-specific selectors and deep nesting.

### Responsive design

- Mobile-first with consistent breakpoints.
- Prevent horizontal overflow, especially for code blocks and long messages.
- Preserve media aspect ratios; avoid fixed dimensions that break on small screens.
- Keep touch targets usable.
- Test several viewport sizes.

### Library usage

Prefer an established, maintained library for a solved problem (Markdown rendering, syntax highlighting, date parsing) over a hand-rolled workaround, but add dependencies only with a stated reason, pinned versions, and verified compatibility. Do not add a dependency for something the platform or an existing dependency already does clearly.

---

## 17. Avoid Overengineering

Do not add complexity without a real requirement.

Avoid:

- Unnecessary design patterns, abstraction layers, classes, and interfaces.
- Tiny helpers with no meaningful purpose.
- Generic solutions for hypothetical future needs.
- Premature infrastructure: no vector database before a concrete retrieval requirement; no streaming transport before the basic chat API works; no ORM or heavy database abstraction unless clearly needed.
- Excessive configuration for simple behavior.
- Unnecessary dependencies; duplicate state and redundant transformations.
- Clever syntax that hides intent.

Do not refactor working code just to look more sophisticated. Introduce an abstraction only when it solves a real problem, removes meaningful duplication, or establishes a necessary architectural boundary.

**Prefer straightforward code over architectural complexity.**

---

## 18. Python Pipeline (`python/`)

The training and evaluation code is separate from the Bun backend and follows the same philosophy:

- PEP 8 naming (`snake_case` functions and variables, `PascalCase` classes, `UPPER_SNAKE_CASE` constants).
- Type hints on public functions; descriptive names; small single-purpose functions.
- Validate every dataset record against the shared action contract before use.
- Keep seeds, configs, and results saved so runs are reproducible.
- No coupling to the application runtime.

---

## 19. Performance and Optimization

Optimize only with a clear understanding of the problem.

- Avoid unnecessary database queries and network requests.
- Load only required resources; use pagination where lists can grow.
- Respect model and hardware limits (4 GB VRAM): avoid loading unnecessary models, keep context length configurable, and benchmark before concluding anything about speed or memory.
- Avoid unnecessary React re-renders only when there is a measured problem; do not scatter `useMemo`/`useCallback` preemptively.
- Clean up listeners, timers, and streams.

Do not sacrifice readability for negligible gains.

---

## 20. Refactoring Existing Code

Before modifying existing code:

1. Understand its current behavior.
2. Identify the actual problem.
3. Check its callers and dependencies.
4. Preserve existing functionality and contracts.
5. Make small, focused changes; do not rewrite whole files when a small edit is enough.
6. Follow the surrounding conventions.
7. Remove obsolete code only after confirming it is unused.
8. Test the affected functionality.

Do not change working behavior to satisfy a stylistic preference. When replacing an implementation, remove the old one and its dependencies when safe. Do not leave duplicate or competing approaches. Do not silently change the architecture.

---

## 21. Testing and Verification

Code is not complete because it was written.

- Run type checking, ESLint, and the relevant tests.
- Test expected failure cases: Ollama unavailable, model missing, empty or oversized input, malformed JSON, upstream timeout, interrupted request.
- Test Zod schemas and action validation with both valid and invalid fixtures, including output that is correct JSON but not an allowed action.
- Verify existing behavior has not regressed.
- Frontend: check the browser console, network responses, and responsive layout.
- Report anything that could not be tested because of environment limits.

**Never claim functionality works if it has not been verified.**

---

## 22. Final Code Review Checklist

**Readability**
- Are names descriptive and intention-revealing?
- Is control flow straightforward and formatting consistent?

**Function and module design**
- Is each function small, focused, and at one abstraction level?
- Are arguments limited to what is needed?
- Are side effects explicit and controlled?
- Are early returns used where they help?

**TypeScript and boundaries**
- Is strict typing respected, with no `any`, unjustified `as`, or `!`?
- Is every external input validated with Zod?
- Are types inferred from schemas instead of duplicated?

**Prometheus-specific**
- Is model output treated as untrusted and validated before use?
- Do dates and arithmetic go through deterministic code?
- Is only a whitelisted action executable, with authorization and confirmation separate from validation?
- Is SQL parameterized, and do routes avoid direct database access?
- Is the shared contract used instead of a local redefinition?

**Maintainability**
- Is there unnecessary abstraction, duplication, or a needless dependency?
- Does it follow existing conventions and architecture?

**Reliability**
- Are errors handled with correct status codes and no leaked internals?
- Do upstream calls have timeouts?
- Are existing contracts preserved?
- Were relevant checks actually run, and are limitations reported honestly?

---

## Final Principle

**Write code for the developer who will maintain it, not to impress the developer who reads it.**

Good code solves the problem correctly, has clear responsibilities, uses meaningful names, avoids hidden behavior, and stays easy to understand.

**Keep it small. Keep it clear. Keep it consistent. Keep it simple.**