# Prometheus --- Project Context

> **Project type:** Local-first AI assistant and applied LLM fine-tuning
> project\
> **Tagline:** Understand. Decide. Validate. Act.\
> **Primary goal:** Build a practical personal AI assistant that
> converts natural-language requests into structured actions, executes
> them safely, and measures whether fine-tuning a small language model
> improves tool-calling performance.\
> **Cost target:** \$0 infrastructure and software cost where feasible,
> prioritizing local execution and available free-tier resources.

## 1. Abstract

Prometheus is a local-first AI-powered personal assistant that
translates natural-language requests into structured, validated actions.
Planned capabilities include saving and searching notes, creating tasks
and calendar events, performing calculations, and responding
conversationally through a web-based chat interface.

A language model interprets a request and proposes a structured
response. The application---not the model---validates the response,
checks permissions, resolves dates and arithmetic deterministically, and
executes only explicitly supported operations. The model does not
receive unrestricted access to the operating system, filesystem, shell,
or network.

The project also investigates whether fine-tuning a small open-weight
language model improves structured tool use. The plan is to establish a
baseline, curate and validate examples, optionally use teacher-generated
supervision, fine-tune a compatible student model using
parameter-efficient methods such as QLoRA, and compare results on a
held-out evaluation set. If compatible with the chosen model and
hardware, the resulting model may be quantized and served locally
through Ollama.

## 2. Goals

### Product goals

-   Build a useful personal assistant that runs locally.
-   Convert natural-language requests into structured responses and tool
    actions.
-   Support notes, tasks, calendar events, arithmetic, clarification,
    and ordinary responses.
-   Validate every model-generated action before execution.
-   Make tool calls, validation outcomes, and execution results
    inspectable.
-   Persist application data locally.
-   Provide a responsive React web interface.
-   Operate without paid inference APIs or mandatory cloud services.

### Machine-learning goals

-   Build a curated dataset of tool-selection and argument-generation
    examples.
-   Establish reproducible baseline measurements before training.
-   Investigate teacher-generated supervision and knowledge distillation
    where feasible.
-   Fine-tune a compatible open-weight model using QLoRA or another
    suitable parameter-efficient method.
-   Compare base and fine-tuned model performance on the same held-out
    evaluation set.
-   Publish honest measurements, limitations, licensing information, and
    reproducibility instructions.

### Engineering and learning goals

-   Develop proficiency in TypeScript, React, Bun, Hono, Zod, SQL, and
    testing.
-   Practice system design, API contracts, error handling, and security.
-   Learn Python-based dataset preparation, fine-tuning, and evaluation.
-   Use Git for incremental development and traceable changes.
-   Use AI assistance to support learning rather than replace
    understanding.

## 3. Non-goals

The initial release will not attempt to train a model from scratch,
match frontier-model capabilities, provide unrestricted autonomous
behavior, execute arbitrary model-generated code or shell commands,
require paid AI APIs, or claim fine-tuning succeeded without measured
evidence.

## 4. Core features

### Natural-language interaction

-   Chat-based interface with user messages and assistant responses.
-   Structured responses for normal answers, clarification requests, and
    proposed tool actions.
-   Friendly errors when the model or application cannot complete a
    request.

### Tool-calling system

The model proposes exactly one supported action per request in the
initial release.

  -----------------------------------------------------------------------
  Tool or control action  Arguments               Purpose
  ----------------------- ----------------------- -----------------------
  `create_event`          `title`, `when_text`,   Create a calendar event
                          optional `duration_min` 

  `add_note`              `text`, optional `tags` Save a note

  `search_notes`          `query`                 Search stored notes

  `add_task`              `title`, optional       Create a task
                          `due_text`              

  `calculate`             `expression`            Evaluate arithmetic
                                                  using a safe parser

  `respond`               `message`               Return a conversational
                                                  response

  `clarify`               `question`              Ask for missing
                                                  information
  -----------------------------------------------------------------------

Every tool must have an explicit schema, documented behavior, bounded
inputs, and tests. No other tools are available unless explicitly
implemented and approved.

### Validation and controlled execution

-   Parse model output as structured data and validate it using shared
    Zod schemas.
-   Reject malformed output, unknown tool names, invalid arguments, and
    unexpected fields.
-   Retry once when a model response fails validation, where
    appropriate.
-   Check tool permissions independently of model output.
-   Require confirmation before write actions in the initial
    implementation.
-   Never treat schema validity as proof that an action is safe or
    authorized.

### Local persistence

-   Store notes, tasks, events, and approved local history in SQLite.
-   Use parameterized SQL.
-   Keep database files and sensitive data out of version control.

### Dates and arithmetic

The model extracts the user's original date phrase or arithmetic
expression. Deterministic application code performs the actual
resolution or calculation. - Use `chrono-node` or an equivalent tested
date parser. - Use a restricted mathematical expression parser; never
use JavaScript `eval`. - Define a timezone and current-time source. -
Ask for clarification when a date is ambiguous.

### Transparent interface

Display the user's message, assistant response, proposed tool and
arguments, validation/execution status, results or errors, confirmation
controls, and panels for saved notes, tasks, and events.

Stretch features such as streaming, conversation history, model
switching, evaluation dashboards, Taglish robustness tests, and a
browser-only demo are deferred until the core flow is reliable.

## 5. Technology stack

### Runtime application

  -----------------------------------------------------------------------
  Layer                   Technology              Responsibility / status
  ----------------------- ----------------------- -----------------------
  Frontend                React 19                UI; scaffold exists

  Language                TypeScript              Static typing

  Frontend tooling        Vite                    Development server and
                                                  production builds;
                                                  scaffold exists

  Styling                 Tailwind CSS            Planned; verify
                                                  installation before use

  Backend runtime         **Bun**                 Intended runtime for
                                                  `apps/api`

  Backend package manager **Bun**                 Intended for backend
                                                  dependencies

  HTTP framework          Hono                    Planned; not yet
                                                  installed

  Validation              Zod                     Planned runtime
                                                  validation and shared
                                                  schemas

  Database                SQLite                  Planned local
                                                  persistence

  SQLite access           Bun-compatible SQLite   Select after
                          library                 compatibility
                                                  verification

  Date parsing            `chrono-node`           Natural-language date
                                                  interpretation

  Arithmetic              Restricted expression   Safe deterministic
                          parser                  calculation

  Model runtime           Ollama on Windows host  Local model serving

  Model client            Ollama HTTP API or      Local inference
                          compatible JS client    requests

  Testing                 Vitest or               Select deliberately
                          Bun-compatible setup    

  Static checks           TypeScript and ESLint   Type and code-quality
                                                  checks

  Version control         Git                     Source history
  -----------------------------------------------------------------------

**Runtime decision:** Bun is the intended runtime for the backend.
Node.js is present in the devcontainer and may continue supporting the
existing frontend/tooling unless a separate migration is deliberately
planned. Do not assume every Node-native package works under Bun; verify
compatibility, especially for native SQLite bindings.

**Package-management decision:** The repository already has a frontend
scaffold and pnpm-related setup. Keep the frontend working while
deciding whether pnpm remains the root workspace manager and Bun runs
the API, or whether the repository deliberately migrates to Bun
workspaces. Do not mix package managers in the same package or create
competing lockfiles accidentally.

Dependency versions must be pinned and compatibility verified before
adoption.

### Model training and evaluation

  -----------------------------------------------------------------------
  Layer                   Technology              Responsibility
  ----------------------- ----------------------- -----------------------
  Language                Python                  Dataset processing and
                                                  experiments

  Training framework      PyTorch                 Tensor computation and
                                                  training

  Model library           Hugging Face            Load and train
                          Transformers            supported models

  Dataset library         Hugging Face Datasets   Dataset handling
                          or JSONL utilities      

  Parameter-efficient     PEFT                    LoRA adapters
  training                                        

  Fine-tuning utilities   TRL or Unsloth          Supervised fine-tuning

  Training method         QLoRA, if supported     Reduce training memory

  Dataset format          JSONL chat examples     Store requests and
                                                  expected responses

  Optional hosting        Hugging Face Hub        Publish compatible
                                                  artifacts

  Training compute        Free Kaggle/Colab GPU   Time-limited training
                          if available            

  Evaluation              Python scripts and      Reproducible metrics
                          JSON/CSV reports        
  -----------------------------------------------------------------------

The training stack is separate from the TypeScript runtime.

## 6. Verified local inference environment

This section records the state verified during initial testing on
**2026-10-23**. It is a development-machine record, not a claim of
production readiness.

### Windows host hardware and driver

  -----------------------------------------------------------------------
  Item                                Verified value
  ----------------------------------- -----------------------------------
  Operating system                    Windows PowerShell environment;
                                      Windows 11 previously reported

  GPU                                 NVIDIA GeForce GTX 1650 Ti

  Dedicated GPU memory                4,096 MiB (4 GB)

  NVIDIA-SMI version                  610.47

  Kernel-mode driver version          610.47

  CUDA user-mode version reported by  13.3
  `nvidia-smi`                        

  System RAM                          15.8 GB reported by PowerShell
  -----------------------------------------------------------------------

The CUDA UMD version shown by `nvidia-smi` is driver-reported
information; it does not by itself mean a separate CUDA Toolkit
installation is required for Ollama. The GPU initially reported about
879 MiB in use before model inference, with desktop applications also
using GPU memory.

### Ollama installation and model

  ---------------------------------------------------------------------------------
  Item                                Verified value
  ----------------------------------- ---------------------------------------------
  Ollama version                      `0.40.9`

  Installation                        Official Windows PowerShell installer:
                                      `irm https://ollama.com/install.ps1 \| iex`

  Model                               `qwen2.5:1.5b`

  Downloaded layer reported during    986 MB plus small metadata/layers
  pull                                

  `ollama ps` model size              1.2 GB

  Reported processor placement        `100% GPU`

  Reported context size               4096 tokens

  Runner                              `llamacpp`

  Tested API endpoint                 `http://localhost:11434/api/generate`
  ---------------------------------------------------------------------------------

The model was successfully downloaded and run on Windows. `ollama ps`
reported `100% GPU` for the observed run. This confirms model placement
for that run, but does not establish tokens per second, peak VRAM usage,
long-context performance, or production suitability. Those remain to be
benchmarked.

### Initial inference tests

**Test A --- Interactive CLI**

Command:

``` powershell
ollama run qwen2.5:1.5b
```

The model interpreted "Remind me to study Express.js tomorrow at 7 PM"
and returned the expected action, title, time phrase, and duration
wrapped in a Markdown JSON code fence. This demonstrated basic
instruction following, but prompt-only output may include formatting
outside raw JSON.

**Test B --- HTTP API without a schema**

A PowerShell `POST` request to `/api/generate` with `stream = $false`
succeeded. The model returned:

``` json
{
  "action": "study",
  "title": "Express.js"
}
```

This was semantically insufficient for the planned contract: the action
was unsupported and date/time and duration fields were missing. It is a
useful baseline failure.

**Test C --- HTTP API with JSON Schema**

A later request provided a schema through Ollama's `format` field and
set `temperature = 0`. The model returned:

``` json
{
  "title": "Study Express.js",
  "when_text": "tomorrow at 7 PM",
  "action": "create_event",
  "duration_min": 60
}
```

This successful smoke test matched the requested shape and values. It is
not a statistically meaningful evaluation. Backend-side Zod validation
remains required.

### Limitations and pending checks

-   Ollama runs natively on Windows; the backend will run in the Linux
    devcontainer. Container-to-host connectivity is not verified.
-   `localhost` inside the devcontainer refers to the container, not
    automatically the Windows host.
-   Test the current Docker/devcontainer host reachability before
    hardcoding the Ollama URL.
-   Keep the Ollama API local; do not expose it to the public internet.
-   Benchmark latency, output quality, and memory use before choosing
    the final baseline.
-   `qwen2.5:1.5b` is an initial baseline, not a final model choice.

## 7. Architecture

### Runtime architecture

``` text
User
 |
 v
React + TypeScript frontend
 |
 | HTTP
 v
Bun runtime + Hono API
 |
 +--> Prompt builder
 |      |
 |      v
 |    Ollama on Windows host
 |      |
 |      v
 |    Model output
 |
 +--> Output parser
        |
        v
      Shared Zod schema validation
        |
        v
      Tool authorization and confirmation
        |
        v
      Deterministic date/math resolver
        |
        v
      Whitelisted tool executor
        |
        v
      SQLite persistence
        |
        v
Structured response to frontend
```

### Shared contract

The shared package should be the single source of truth for allowed tool
names and arguments, response variants, Zod schemas, inferred TypeScript
types, prompt/tool definitions where appropriate, and validation
fixtures. Frontend and backend must not invent incompatible response
structures independently.

### Offline training pipeline

``` text
Examples -> Dataset generation -> Schema validation and review
         -> Train/validation/test splits -> Baseline evaluation
         -> Optional teacher-generated data -> Fine-tune student
         -> Evaluate checkpoint -> Export/quantize if compatible
         -> Ollama local inference
```

Training must not be required for the application to run.

## 8. Model output contract

The model should produce one JSON object with a supported action name
and matching arguments. Example:

``` json
{
  "name": "add_note",
  "arguments": {
    "text": "Review TypeScript tomorrow",
    "tags": ["learning"]
  }
}
```

Example clarification:

``` json
{
  "name": "clarify",
  "arguments": {
    "question": "What time should the event start?"
  }
}
```

Use a TypeScript discriminated union keyed by action name and validate
actual runtime output with Zod. Schema-constrained model output helps
but does not replace backend validation.

The PowerShell smoke test used a simpler flat object (`action`, `title`,
`when_text`, `duration_min`). That was an experiment only. Choose one
canonical contract before implementing the backend and use it
consistently across prompts, schemas, tests, and evaluation data.

## 9. Dataset and training specification

-   Start with a small, manually reviewed seed dataset.
-   Expand only when evaluation reveals coverage gaps.
-   Use hand-written, template-generated, and appropriately licensed
    open examples.
-   Consider teacher-generated examples when a suitable source and
    permitted workflow are available.
-   Store examples as JSONL chat records.
-   Validate every expected response against the shared contract.
-   Deduplicate near-identical examples.
-   Keep the held-out test set separate from training and
    model-selection decisions.
-   Avoid data leakage across related template families.
-   Record provenance and licenses.

A target of approximately 800 seed examples, expanding toward
1,500--3,000 if justified, is an estimate rather than a fixed
requirement.

Select a compatible instruction-tuned model, establish the baseline
before fine-tuning, save configurations/seeds/checkpoints/results, and
test exported or quantized artifacts locally. Knowledge distillation is
optional; teacher-generated supervision followed by student fine-tuning
is a possible initial approach.

## 10. Evaluation specification

Evaluate competing configurations on the same held-out examples.

  Condition   Configuration
  ----------- ---------------------------------------------------
  A           Base model with prompt-only or few-shot prompting
  B           Base model with schema-constrained output
  C           Fine-tuned model with prompting
  D           Fine-tuned model with schema-constrained output

Include a rules-based baseline when practical.

Metrics: - JSON-valid rate. - Schema-valid rate. - Tool-selection
accuracy. - Argument-level precision, recall, and F1 where
appropriate. - Correct handling of clarification and ordinary
responses. - Error categories and representative failures. - End-to-end
latency on the target laptop. - Model artifact size and memory
requirements.

Possible initial targets are schema-valid rate ≥95%, tool-selection
accuracy ≥90%, and argument F1 ≥85%. These are goals, not promised
results. Report actual numbers, regressions, and limitations.

## 11. Security and reliability requirements

-   Treat all model-generated content as untrusted.
-   Expose only explicitly whitelisted tools.
-   Never execute arbitrary model-generated shell commands or code.
-   Validate all incoming requests and model outputs.
-   Enforce authorization and confirmation separately from schema
    validation.
-   Use parameterized SQL; never use `eval` for arithmetic.
-   Apply sensible input limits, timeouts, and error handling.
-   Handle unavailable Ollama instances and malformed responses
    gracefully.
-   Retry validation failures at most once in the initial
    implementation.
-   Bind the local API to `127.0.0.1` by default where compatible;
    configure devcontainer port forwarding deliberately.
-   Configure CORS and origin checks for the deployment mode.
-   Keep database files, credentials, and local model artifacts out of
    Git unless intentionally released.
-   Do not send private user data to external teacher models or cloud
    services without an explicit, informed decision.
-   Revisit the threat model before retrieved notes or tool results
    influence later model decisions.

## 12. Zero-cost strategy

-   Run frontend and backend locally during development.
-   Run Ollama on the Windows host for local inference.
-   Store data in local SQLite.
-   Use available free compute for optional training.
-   Use free repositories for source code and optional public model
    artifacts.
-   Do not depend on a continuously running free cloud GPU endpoint.
-   Treat a public frontend demo and a fully hosted AI service as
    separate deployment modes.

Zero cost is a design objective, not a guarantee of unlimited compute,
hosting, storage, or availability.

## 13. Intended repository structure

``` text
Prometheus/
├── apps/
│   ├── web/                 # Existing React + Vite frontend
│   └── api/                 # Planned Bun + Hono backend
├── packages/
│   └── shared/              # Planned Zod schemas and shared definitions
├── training/
│   ├── datasets/
│   ├── notebooks/
│   └── evaluations/
├── docs/
│   ├── PROJECT_CONTEXT.md
│   ├── LOCAL_INFERENCE_ENVIRONMENT.md
│   ├── decisions.md
│   ├── progress.md
│   └── architecture.md
├── .agents/
├── .devcontainer/
├── README.md
└── .gitignore
```

This is a target structure, not a requirement to create every directory
immediately. The root package/workspace configuration remains a decision
to make after reviewing the existing frontend's pnpm setup.

## 14. Current repository and Bun status

Verified from the project terminal:

-   Repository root: `/workspaces/Prometheus`.
-   Existing branch: `main`.
-   Existing frontend directory: `apps/web`.
-   Existing devcontainer image:
    `mcr.microsoft.com/devcontainers/typescript-node:24`.
-   The repository already has `.devcontainer/`, `.agents/`,
    `skills-lock.json`, `.gitignore`, `README.md`, `apps/`, and `docs/`.
-   A search at `-maxdepth 2` did not find a package manifest because
    the frontend manifest is deeper under `apps/web/package.json`.
    Inspect the actual tree before changing workspace configuration.
-   Do not initialize a second Git repository or replace the frontend
    scaffold.

### Bun installation status

Bun was installed inside the Linux devcontainer using:

``` bash
curl -fsSL https://bun.com/install | bash
```

The installer reported that Bun was installed to `~/.bun/bin/bun` and
added `~/.bun/bin` to `~/.bashrc`. However, running `bun --version`
immediately afterward returned `bash: bun: command not found`.

Therefore, Bun appears to have been installed, but the current shell has
not picked up the updated PATH. Next diagnostic:

``` bash
source ~/.bashrc
bun --version
```

If it still fails, inspect `echo "$PATH"` and verify `~/.bun/bin/bun`
exists before reinstalling. A new terminal may load the updated profile.
If Bun must be available after container rebuilds, add a verified
installation step to `.devcontainer/setup.sh`; do not rely only on an
interactive shell's `.bashrc`.

Do not install Hono or create backend files until Bun is reachable and
the package-manager strategy is understood.

## 15. Development workflow

For each meaningful feature:

1.  Define requirements and acceptance criteria.
2.  Explain the relevant programming and system-design concepts.
3.  Write pseudocode or a small architecture sketch.
4.  Implement core logic with guided, hands-on coding.
5.  Use autocomplete and delegated AI assistance selectively.
6.  Run tests, linting, and production builds as applicable.
7.  Obtain an independent review for meaningful changes.
8.  Fix confirmed defects and document unresolved risks.
9.  Record learning and architectural decisions.
10. Commit a stable milestone to Git.

AI tools should support understanding and ownership, not replace them.
Keep one active writer per set of files; reviewers should inspect
changes without overwriting implementation.

## 16. Immediate next steps

1.  Run `source ~/.bashrc` in the devcontainer terminal.
2.  Verify `bun --version`.
3.  Inspect root and `apps/web` package manifests.
4.  Decide whether pnpm remains the workspace manager while Bun runs the
    API, or deliberately migrate to Bun workspaces.
5.  Create `apps/api` after those decisions are clear.
6.  Install Hono and Zod in the API package.
7.  Implement and test a minimal health-check route.
8.  Verify connectivity from the devcontainer to the Windows-hosted
    Ollama API.
9.  Integrate Ollama using schema-constrained output and validate the
    response with Zod.
10. Add persistence and tool execution only after the model-to-API path
    is reliable.

## 17. Definition of done

Prometheus v1 is complete when: - The frontend communicates with Hono
running on Bun. - The shared contract is used consistently and tested. -
The backend can obtain a response from a compatible local model. -
Invalid model output cannot execute a tool. - All five productivity
tools and two control actions behave as specified. - Notes, tasks, and
events persist locally. - Date parsing and arithmetic are deterministic
and tested. - Tool actions, validation, and execution results are
visible in the UI. - Unit and integration tests, linting, and production
builds pass. - Setup instructions are reproducible. - Dataset generation
and evaluation are reproducible. - Baseline and fine-tuned results are
reported honestly. - Model and dataset licensing is documented. - The
README explains architecture, setup, limitations, and results.

If fine-tuning does not improve performance sufficiently, the
application can still be completed with the best measured baseline.
Report the outcome honestly.

## 18. Guiding principles

1.  **The model proposes; the application decides and executes.**
2.  **Validate before execution.**
3.  **Use deterministic code for dates, arithmetic, and persistence.**
4.  **Share one contract across runtime and evaluation.**
5.  **Measure before optimizing or fine-tuning.**
6.  **Build the smallest complete vertical slice before expanding
    scope.**
7.  **Prefer local execution and privacy by default.**
8.  **Avoid unnecessary infrastructure and dependencies.**
9.  **Use AI assistance to accelerate learning, not bypass it.**
10. **Prioritize reproducibility, security, maintainability, and honest
    results.**

------------------------------------------------------------------------

**Project identity:** Prometheus\
**Primary deliverable:** A working local-first tool-calling assistant
with measurable model evaluation.\
**Primary engineering objective:** Build a maintainable full-stack
application while learning to design, implement, test, and explain its
architecture.\
**Primary ML objective:** Determine empirically whether a small
fine-tuned model improves structured tool use over a well-established
baseline.
