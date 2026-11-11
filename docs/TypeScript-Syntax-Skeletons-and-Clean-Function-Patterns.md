# TypeScript Syntax Skeletons & Clean Function Patterns

A reference for writing, reading, and refactoring TypeScript. The goal is **recognizable structures** that are easy to read and maintain. These are starting points, not rigid templates: pick a pattern because it fits the task, not to make every function look alike.

## Which pattern do I need?

| I need to... | Use |
|---|---|
| Compute something synchronously | §1 Basic function |
| Wait on I/O (DB, network, files) | §2 Async function |
| Run steps that depend on each other | §3 Sequential |
| Run independent steps together | §3 `Promise.all` / `allSettled` |
| Reject bad or missing conditions | §4 Early returns |
| Accept data I don't trust | §5 Validation |
| Signal failure | §6 Errors |
| Fetch, change, or remove a record | §7 Lookup, §8 CRUD |
| Release a connection, lock, or stream | §9 `try/finally` |
| Loop over items | §10 Iteration |
| Model "one of several shapes" | §11 Discriminated unions |

---

## 1. Basic Function

```ts
function functionName(input: InputType): ReturnType {
  // One focused responsibility.

  return result;
}
```

Concrete:

```ts
function formatPublicationDate(date: Date): string {
  return date.toLocaleDateString("en-PH", { dateStyle: "long" });
}
```

For many or optional parameters (roughly 3+), use one options object so call sites stay readable:

```ts
interface CreateReportOptions {
  title: string;
  authorId: string;
  publishAt?: Date;
}

function createReport(options: CreateReportOptions): Report {
  const { title, authorId, publishAt } = options;
  // ...
}
```

**Keep in mind**

- Name it after what it does.
- Make inputs and outputs explicit.
- Stay at one level of abstraction.
- Don't add parameters the function doesn't use.

## 2. Async Function

```ts
async function functionName(input: InputType): Promise<ReturnType> {
  const result = await performOperation(input);

  return result;
}
```

**Remember**

- An `async` function always returns a `Promise`.
- Don't mark a function `async` if it never awaits.
- Never use `async` callbacks inside `forEach`. It doesn't wait for them. Use `for...of` or `Promise.all(items.map(...))`.

Entry point. `void main()` alone swallows failures, so handle them deliberately:

```ts
main().catch((error: unknown) => {
  reportError(error);
  process.exitCode = 1;
});
```

## 3. Sequential vs. Independent Async Work

**Sequential:** each step needs the previous result.

```ts
async function functionName(): Promise<void> {
  const first = await firstOperation();
  const second = await secondOperation(first);

  await finalOperation(second);
}
```

**Parallel:** steps are independent and safe to overlap.

```ts
const [first, second] = await Promise.all([
  firstOperation(),
  secondOperation(),
]);
```

`Promise.all` rejects as soon as one fails. When you need every outcome, use `allSettled`:

```ts
const results = await Promise.allSettled([firstOperation(), secondOperation()]);

for (const result of results) {
  if (result.status === "fulfilled") {
    useResult(result.value);
  } else {
    reportError(result.reason);
  }
}
```

**Caution:** `Promise.all(items.map(...))` over a large list fires everything at once. For rate-limited APIs or big datasets, process in batches or sequentially.

## 4. Early Returns (Guard Clauses)

Handle disqualifying conditions first, so the main path reads top to bottom:

```ts
function getDisplayName(user: User | null): string {
  if (!user) return "User not found";
  if (!user.isActive) return "User is inactive";

  return user.name;
}
```

**Use when:** input is missing, invalid, unauthorized, or otherwise disqualified.

## 5. Validating Untrusted Input

Type `unknown` at the boundary, then narrow it with a type guard. Never use `as SomeType` in place of validation.

```ts
function isCreateReportInput(input: unknown): input is CreateReportInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "title" in input &&
    typeof input.title === "string"
  );
}

function parseCreateReportInput(input: unknown): CreateReportInput {
  if (!isCreateReportInput(input)) {
    throw new ValidationError("Invalid report input.");
  }

  return input;
}
```

For anything beyond a couple of fields, a schema library such as Zod (free, open source) is cleaner than hand-written guards.

## 6. Error Handling

**Rule:** catch an error only where you can *do something useful*: recover, add context, translate it, or clean up. Otherwise let it propagate. Catching just to log and rethrow causes duplicate logs.

Custom errors let callers tell failures apart:

```ts
class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}
```

Adding context while preserving the original error:

```ts
async function loadReport(id: string): Promise<Report> {
  try {
    return await reportApi.fetch(id);
  } catch (error: unknown) {
    throw new Error(`Failed to load report ${id}.`, { cause: error });
  }
}
```

For **expected** outcomes the caller must branch on, return an explicit result instead of throwing:

```ts
type OperationResult<T> =
  | { success: true; value: T }
  | { success: false; message: string };
```

## 7. Reusable Lookup

```ts
async function findRecordById(id: string): Promise<RecordData | null> {
  return (await database.findById(id)) ?? null;
}
```

- `find…` means it may not exist, so it returns `null`.
- `get…` means absence is unexpected, so it throws:

```ts
async function getRecordById(id: string): Promise<RecordData> {
  const record = await findRecordById(id);

  if (!record) throw new NotFoundError("Record", id);

  return record;
}
```

Don't build a generic repository for one simple lookup.

## 8. Create, Update, Delete

Flow: **validate → operate → return a clear result.**

```ts
async function createRecord(input: CreateRecordInput): Promise<RecordData> {
  validateCreateRecordInput(input);

  return database.create(input);
}

async function updateRecord(
  id: string,
  input: UpdateRecordInput,
): Promise<RecordData> {
  validateUpdateRecordInput(input);

  const updated = await database.update(id, input);

  if (!updated) throw new NotFoundError("Record", id);

  return updated;
}

async function deleteRecord(id: string): Promise<void> {
  const wasDeleted = await database.delete(id);

  if (!wasDeleted) throw new NotFoundError("Record", id);
}
```

Let the write itself report "not found". Reading first and writing second can race, because the record may change between the two calls. If you genuinely must check first, wrap both in a transaction. Always follow your real DB API, auth rules, and error conventions.

## 9. Resource Cleanup

```ts
async function functionName(): Promise<void> {
  const resource = await openResource();

  try {
    await useResource(resource);
  } finally {
    await resource.close();
  }
}
```

**Use when:** connections, locks, streams, temp files. Prefer a built-in disposal pattern if your project already has one.

## 10. Iteration

```ts
// Transform: prefer map/filter when it stays readable
const names = users.map((user) => user.name);

// Multi-step or sequential work: for...of
for (const item of items) {
  await processItem(item);
}

// Async sources (streams): for await...of. Not for plain arrays.
for await (const chunk of stream) {
  await processChunk(chunk);
}
```

**Generators** (`function*`, `async function*`) produce values incrementally. Use them for streams or large/lazy data, not when returning an array is simpler.

Use a named callback only when it's reused, complex, or benefits from a name. Don't extract every one-liner.

## 11. Modeling States: Discriminated Unions

When a value can be one of several shapes, give each a literal `kind` tag, then handle all cases with an exhaustive `switch`:

```ts
type ReportStatus =
  | { kind: "draft" }
  | { kind: "published"; publishedAt: Date }
  | { kind: "archived"; reason: string };

function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}

function describeStatus(status: ReportStatus): string {
  switch (status.kind) {
    case "draft":
      return "Draft";
    case "published":
      return `Published ${formatPublicationDate(status.publishedAt)}`;
    case "archived":
      return `Archived: ${status.reason}`;
    default:
      return assertNever(status);
  }
}
```

If you add a new `kind` later, TypeScript flags every `switch` that forgot to handle it.

## 12. Composition

```ts
function functionName(input: Input): Output {
  const validated = validateInput(input);
  const transformed = transformInput(validated);

  return buildResult(transformed);
}
```

Each step should be meaningful work. Extract a function when it names a real responsibility, enables reuse, or makes logic testable, not to split a simple expression.

## 13. Naming

| Verb | Meaning |
|---|---|
| `get` | Retrieve; absence is unexpected (throws) |
| `find` | Search; may return `null` |
| `create` / `update` / `delete` | Mutate a record or resource |
| `validate` | Check requirements; throw or report |
| `parse` | Turn raw input into a structured type |
| `format` | Convert a value for display |
| `build` | Construct a value or object |
| `handle` | Coordinate a response to an event |
| `is` / `has` / `can` | Boolean checks |

Preserve existing project terminology when it's already clear.

## 14. Review Checklist

- Does the name describe its one responsibility?
- Are inputs and return type explicit?
- Can invalid conditions exit early?
- Is `async` actually needed? Is parallel work safe?
- Is each error handled at the right boundary, or allowed to propagate?
- Are side effects visible and intentional?
- Is any extracted helper genuinely reused or meaningful?
- Could a simpler version do the same job?

## 15. Rules for Applying These Patterns

1. **Consistency over novelty.** Follow the project's existing patterns first.
2. **Clarity over cleverness.** A few explicit lines beat compressed syntax.
3. **No forced templates.** Skip `Promise.all`, `try/catch`, generators, or abstractions the task doesn't need.
4. **Explicit behavior.** Async work, mutations, and errors should be easy to spot.
5. **Preserve behavior when refactoring.** Don't silently change contracts or business rules.
6. **Write code you can explain.** If you can't, simplify it.

**For you (learning):** study one pattern at a time, write it from memory, explain each line, then adapt it to a real task.

**For a coding agent:** read this alongside `SKILL-CleanCode.md`, apply patterns only where they fit, don't mechanically rewrite working code, and explain meaningful deviations.

**Core principle:** learn a small set of clear patterns, recognize them in real code, and apply them when they fit.
