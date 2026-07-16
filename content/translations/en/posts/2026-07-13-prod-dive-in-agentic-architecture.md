---
title: "prod-dive-in Architecture: How an Agent Turns One Sentence into a Real Phone Call"
summary: "From CALL-E and the desktop Agent to browser takeover, this article explains prod-dive-in's main flows, layered architecture, technology stack, and the Agentic design behind Goal, RunSpec, Run, and Report."
---

Many AI applications can chat, but the hardest work usually happens outside the chat box. When a user provides one natural-language request, how does a system confirm the objective, fill in missing information, call real services, keep working for minutes or days, and continue after failures?

`prod-dive-in` addresses that class of problem. It is not a monolith, but an evolving collection of Agent products and infrastructure. Its most complete business flow is **CALL-E**: users describe phone tasks in natural language; the system plans, calls, tracks the conversation, and turns the result into an auditable report. The repository also contains a general desktop Agent, browser automation, human takeover, and real-time audio understanding.

This article is based on source at commit `14837ff`. To avoid presenting design documents as shipped behavior, it distinguishes:

- implementations already in the current main path;
- capabilities retained in specifications or later-stage designs;
- older flows that still run in parallel.

If you remember one sentence, remember this:

> The core of `prod-dive-in` is not “letting one large model call tools repeatedly.” It turns a natural-language objective into a stateful, recoverable, auditable long-running task, then assigns different Agents to complete it.

## 1. The global view: two Agent products

The monorepo's top-level `apps/`, `services/`, and `packages/` directories do more than separate front end from back end. They support two relatively independent product flows.

### 1.1 CALL-E: an Agent organized around phone objectives

| Module | Responsibility |
|---|---|
| `apps/calle-web` | User accounts, billing, phone-Agent conversation, and task-result UI |
| `services/seleven-mcp` | CALL-E API, Agent runtime, call execution, MCP tools, and persistence |
| `services/seleven-mcp/src/calle/agentic` | New Goal-driven Agentic core |
| `services/seleven-mcp/src/calle/voice_runtime` | Phone-Agent prompt assembly, provider integration, and execution lifecycle |
| `apps/seleven-mcp-console-web` | Operations and debugging console |

The main flow can be compressed into one line:

```text
User conversation
  → MainAgent understands the request and commits a Goal
  → GoalAgent creates a RunSpec
  → VoiceRunExecutor places a real call
  → Transcript and result flow back
  → GoalAgent decides the next step and commits a Report
  → The Web UI receives progress and results through SSE
```

### 1.2 The general desktop Agent: browser and local tools

| Module | Responsibility |
|---|---|
| `apps/electron` | Electron desktop client, chat UI, and local-process management |
| `services/seleven-bridge` | FastAPI bridge between the desktop client and Python Agent |
| `services/seleven-agents` | General Agent, tools, sub-Agents, browser automation, and LiveLens |
| `apps/devtools-host` / `apps/devtools-frontend` | Browser debugging and visual operation |
| Browser extensions | Page connection, audio capture, and local bridging |

Its flow is:

```text
Electron UI
  → seleven-bridge
  → SelevenAgent
  → local tools / Browser Agent / dynamic sub-Agent / LiveLens
  → NDJSON event stream
  → Electron renders the process as a readable timeline
```

The two systems share ideas such as models, tools, event streams, and observability, but **they are not one unified runtime**. CALL-E's GoalAgent, the desktop Agent's dynamic sub-Agents, and the legacy MCP phone tools live at different layers.

### 1.3 Monorepo map

```text
prod-dive-in/
├── apps/                              # user- and developer-facing applications
│   ├── calle-web/                     # CALL-E Web product
│   ├── seleven-mcp-console-web/       # MCP / CALL-E operations console
│   ├── electron/                      # desktop Agent client
│   ├── chrome-extension/              # first-generation browser extension
│   ├── chrome-extension-v2/           # newer browser extension
│   ├── devtools-host/                 # local DevTools host
│   ├── devtools-frontend/             # visual DevTools front end
│   └── ios/                           # iOS client direction
├── services/                          # Python services and Agent runtimes
│   ├── seleven-mcp/                   # CALL-E, MCP, and phone runtime
│   ├── seleven-bridge/                # Electron ↔ Agent bridge
│   ├── seleven-agents/                # general desktop-Agent capabilities
│   └── seleven-cloud/                 # cloud-service capabilities
├── packages/                          # reusable cross-application packages
│   ├── py/                            # shared Python packages
│   └── ts/                            # shared TypeScript packages
├── contracts/                         # cross-process and cross-language contracts
├── specs/                             # feature specifications and staged designs
├── docs/                              # architecture, experiments, and internal notes
├── mocks/                             # simulated sites for local exercises
├── playground/                        # CUA, recording, and other experiments
└── scripts/                           # development and repository scripts
```

The two business paths are:

```text
Phone Agent: apps/calle-web
               └─→ services/seleven-mcp

Desktop Agent: apps/electron
                 └─→ services/seleven-bridge
                       └─→ services/seleven-agents
                             └─→ browser / local system / audio
```

## 2. Overall layers: interface, orchestration, domain, and infrastructure

| Layer | Responsibility | Representative modules |
|---|---|---|
| Presentation | Collect input and display streaming progress and results | CALL-E Web, Electron, console, browser extensions |
| Application and orchestration | Route requests into Agents, run tools, and schedule background work | API session, turn pump, Goal iteration runner, bridge use cases |
| Domain | Define Goal, RunSpec, Run, Report, Session, Message, and their rules | `calle/agentic`, bridge domain |
| Infrastructure | Database, queues, model and phone providers, browser and local capabilities | PostgreSQL, Redis, RabbitMQ, Botlab, Calling, OpenAI, CDP |

```text
┌────────────────────────────────────────────────────────────┐
│ Presentation: CALL-E Web / Electron / Console / Extension │
└───────────────────────┬────────────────────────────────────┘
                        │ HTTP + SSE / NDJSON / IPC
┌───────────────────────▼────────────────────────────────────┐
│ Orchestration: Session, Turn Pump, Goal Runner, Use Case   │
└───────────────────────┬────────────────────────────────────┘
                        │ domain commands and events
┌───────────────────────▼────────────────────────────────────┐
│ Domain: Goal → RunSpec → Run → Report                      │
│         Session → Message → Event                          │
└───────────────────────┬────────────────────────────────────┘
                        │ ports / providers
┌───────────────────────▼────────────────────────────────────┐
│ Infrastructure: DB, queues, LLM, phone, browser, OS, obs. │
└────────────────────────────────────────────────────────────┘
```

The important point is not the number of layers but that **the model does not directly own system facts**. The model interprets and decides; databases, events, state machines, and validators record what has actually happened.

## 3. CALL-E: from one sentence to a phone report

### 3.1 Core CALL-E directory map

```text
services/seleven-mcp/src/calle/
├── apps/api/                          # HTTP and SSE interface
│   ├── v1/sessions/
│   │   ├── chat_routes.py             # receives user messages
│   │   └── routes.py                  # session CRUD
│   └── runtime/
│       ├── agent_session.py           # one API Agent session
│       ├── turn_pump.py               # SDK events → product events
│       └── event_stream.py            # persisted events + live stream
├── agentic/                           # Goal-driven domain core
│   ├── agents/
│   │   ├── calle.py                   # CallEAgent entry point
│   │   ├── orchestrator.py            # MainAgent orchestration
│   │   ├── outbound.py                # outbound GoalAgent
│   │   └── goal.py                    # shared Goal-Agent structure
│   ├── goals/                         # Goal records and storage
│   ├── runs/                          # RunSpec, Run, and state
│   ├── reports/                       # Report reading and persistence
│   ├── runtime/goal_iteration_runner.py
│   ├── sessions/                      # context, memory, session storage
│   ├── tools/builtins/                # preflight, questions, planning
│   ├── tools/goals/                   # Goal / Run / Report tools
│   ├── skills/                        # on-demand domain knowledge
│   └── events.py                      # Agentic domain events
├── voice_runtime/                     # single-call execution
│   ├── executor/
│   │   ├── botlab.py
│   │   ├── botlab_calling.py
│   │   ├── prompt.py
│   │   └── providers.py
│   └── instructions/                  # IVR, voicemail, transfer rules
├── db/models/                         # SQLAlchemy persistence models
├── schemas/                           # API and domain Schemas
└── workspace/                         # isolated Goal artifacts
```

Shortest reading path:

```text
chat_routes.py
  → agent_session.py / turn_pump.py
  → agentic/agents/calle.py
  → agentic/agents/outbound.py
  → agentic/runtime/goal_iteration_runner.py
  → agentic/tools/goals/voice_run.py
  → voice_runtime/executor/botlab_calling.py
  → reports/ + session_events
```

Suppose the user says:

> Call the restaurant and ask whether they have a table for four at 7 p.m. Friday. If so, reserve one by the window.

### 3.2 The Web client creates a session, then sends a message

`apps/calle-web` uses React. A new conversation performs roughly three actions:

1. `POST /v1/sessions` creates a session;
2. `POST /v1/sessions/{id}/messages` submits the message;
3. `GET /v1/sessions/{id}/events` opens SSE and continuously receives Agent events.

SSE is not merely an ephemeral view of the present. The client stores an event cursor and reconnects with `Last-Event-ID`. The server replays persisted events after that cursor before switching to the live stream. A refresh or temporary network loss therefore restores the UI without rerunning the model.

Events include more than text tokens:

- message snapshots and deltas;
- reasoning stages;
- tool calls and results;
- plan updates;
- Goal dispatch state;
- phone Run state;
- user-confirmation requests;
- Report commit events.

The front end presents a **task process**, not only a typewriter effect.

### 3.3 The API accepts the message without holding HTTP open until completion

`chat_routes.py` authenticates the request and verifies tenant and session ownership, then returns `202 Accepted`. `ApiSessionRegistry` executes the Agent turn as a background task.

The user message is first persisted as `message.snapshot`. `turn_pump.py` converts model text, tool output, and reasoning events from the OpenAI Agents SDK into CALL-E event envelopes for SSE and the database.

This means:

- the HTTP request does not wait for the phone call to finish;
- raw model-provider events do not leak into the product protocol, whose semantics remain stable.

### 3.4 MainAgent is a front-desk requirements manager

MainAgent has a deliberately narrow job:

- understand the actual desired outcome;
- normalize phone numbers to E.164;
- infer or confirm region, timezone, call language, and caller profile;
- ask only for genuinely blocking missing information;
- reject unsafe tasks;
- commit a stable objective as a Goal.

It **does not place the call or write the final Report**. It converts natural language into a task description that will not drift with conversational wording.

The resulting `GoalBrief` emphasizes **WHAT**:

- the objective;
- known facts;
- constraints;
- success criteria;
- original request and source references.

It does not prematurely prescribe how many calls to make or when to retry. That belongs to GoalAgent.

### 3.5 GoalAgent is the persistent project manager

After Goal commit, the foreground turn can end while the Goal continues. `CallEAgent` discovers dispatchable Goals and starts `GoalIterationRunner`.

GoalAgent has persistent context separate from MainAgent. It is not a one-time SDK handoff or ordinary tool call. It wakes repeatedly around the same Goal:

```text
Goal created
  ↓
Iteration 1: plan and submit a phone Run
  ↓
Wait for external execution
  ↓
Receive success, failure, or new evidence
  ↓
Iteration 2: retry, revise, or create a Report
  ↓
Goal reaches a terminal state
```

Each iteration:

1. reads the persisted Goal;
2. checks dispatch state and event cursor;
3. acquires a database lease to prevent concurrent duplicate execution;
4. loads only events after the previous cursor;
5. reuses the deterministic Goal-specific Agent session;
6. requires one `complete_goal_iteration` call;
7. atomically applies state patches, appends events, and advances the cursor;
8. releases the lease.

It resembles a project manager reading only mail received since yesterday instead of loading the entire chat, recordings, and database every morning.

### 3.6 RunSpec turns the Goal into an executable work order

For the Goal “reserve Friday dinner,” a `RunSpec` describes what this attempt will do. It includes:

- whom to contact;
- number and region;
- exact call objective;
- required confirmations;
- acceptable and unacceptable conditions;
- handling of IVR, voicemail, transfer, and waiting;
- structured fields to return.

Phone instructions are written to YAML in the Goal workspace. `create_run_spec` validates path, content, version, and checksum, then persists an auditable RunSpec.

The extra object preserves the Goal while execution strategy changes and answers: “Which version of the work order governed this real attempt?”

### 3.7 Side effects receive another validation pass

`submit_voice_run`, the tool closest to the external side effect, validates again:

- legal E.164 number;
- region and route compatibility;
- available voice-runtime profile;
- ready SIP or Calling route;
- whether the idempotency key already owns a Run;
- whether user confirmation is required.

A complete, immediate, single-recipient call with clear risk can be pre-authorized by policy. Ambiguous, scheduled, batch, or subtly irreversible tasks produce a confirmation request that MainAgent delivers to the conversation.

The principle is: **do not merely write “be careful” in a prompt. Concentrate risky actions in a few tools and enforce hard checks at their boundaries.**

### 3.8 VoiceRunExecutor hands the work order to the field operator

`VoiceRunExecutor` owns the call lifecycle. Current calling uses Botlab and Calling adapters:

- Botlab creates the phone Bot and version;
- IAMS OAuth provides service identity and authorization;
- Calling resolves routes, creates dialing jobs, and initiates calls;
- a Redis stream can carry DM events during calls;
- after completion, the runtime retrieves transcript and final result.

The Voice Agent prompt is assembled in layers:

```text
Shared core rules
  + this RunSpec's instructions
  + IVR handling
  + voicemail handling
  + screening, waiting, and transfer
  + human conversation rules
  + weak-signal and uncertainty handling
  + structured-output contract
```

This separates what to say on the phone from how the system schedules work. The Voice Agent focuses on one call and need not understand product sessions, billing, or recovery.

### 3.9 Results re-enter the Goal loop

When a call reaches success, failure, cancellation, or another terminal state, the system persists Run events, evidence, and artifacts, then wakes GoalAgent again.

GoalAgent decides:

- whether evidence is sufficient;
- whether to try another number or attempt;
- whether user input is needed;
- whether the Goal can close;
- what Report to create.

When complete, a Report skill creates immutable `report.md` and `report.json`. `commit_report` validates workspace boundaries, checksums, and Schema; records the version; and delivers it through `context.delivery` and SSE.

The real loop is not:

```text
user → LLM → phone tool → answer
```

It is:

```text
user → understanding → persisted Goal → versioned plan → external Run
     → evidence and events → another Goal decision → versioned Report → user
```

## 4. Where the Agentic capability lives

Using a model is not the same as building an Agent. The repository's formula is:

```text
Model + Instructions + Tools + Context + State + Memory
      + Harness + Guardrails + Evals
```

### 4.1 Three roles, not one universal Agent

| Role | Analogy | Main responsibility | Deliberately avoids |
|---|---|---|---|
| MainAgent | Front desk / requirements manager | Understand, fill blockers, commit Goal, deliver state | Calling or long-term execution detail |
| GoalAgent | Project manager | Plan across iterations, submit Runs, absorb results, decide, report | Web protocol and direct provider APIs |
| Voice Agent | Field operator | Complete one call and return evidence | Long-term Goal state |
| Runtime | Dispatch, accounting, archive | Persistence, leases, cursors, idempotency, events, recovery | Semantic judgment |

Splitting roles limits cognitive and permission scope. A universal Agent that remembers preferences, retries, IVR, and provider failures accumulates an enormous prompt and overly broad tools.

### 4.2 Goal, RunSpec, Run, and Report are different concepts

| Object | Question | Restaurant example |
|---|---|---|
| Goal | What final outcome is wanted? | A suitable table for four at 19:00 Friday |
| RunSpec | What will this attempt do? | Call restaurant A and ask about capacity, window seating, and hold time |
| Run | What attempt actually happened? | Call at 13:05, waited 32 seconds, no answer |
| Report | What is delivered to the user? | Restaurant B booked; confirmation, time, and cancellation terms |

Separation expresses reality:

- one Goal can have multiple RunSpec versions;
- one RunSpec can produce one or more attempts;
- a failed Run does not mean a failed Goal;
- a Report can cite evidence from multiple Runs;
- changed constraints do not erase history.

### 4.3 Foreground and background loops are separate

```text
Foreground conversation (seconds)
message → MainAgent → explain / ask / commit Goal → respond

Background Goal loop (minutes, hours, eventually longer)
event → GoalAgent → plan / execute / wait → event → GoalAgent
```

The browser need not remain connected, and MainAgent need not occupy a model response while waiting. Persisted events and `context.delivery` connect the loops instead of shared volatile memory.

### 4.4 Context, State, and Memory have distinct jobs

- **Context is the current desk**: the small amount visible to the model now.
- **State is the business ledger**: authoritative Goal, Run, cursor, and confirmation facts.
- **Memory is the archive**: semantic continuity across turns, never a replacement for database truth.

GoalAgent reads only new events after its cursor and structured current Goal data. Large files, prompts, and Reports live in an isolated workspace referenced by relative path and checksum. OpenAI Responses `previous_response_id` and compaction records are persisted for continuity and audit.

This avoids loading all history until cost, latency, and distraction explode, and avoids treating what the model remembers as truth that disappears after restart or compaction.

### 4.5 Skills load knowledge; Tools execute controlled actions

Not every rule lives in the system prompt. MainAgent loads `outbound-planner` only when planning an outbound call. GoalAgent similarly loads phone-runtime and one-shot-report skills when needed.

- **Skill**: a job handbook for reasoning about a class of problem.
- **Tool**: a permissioned, validated business action that reads state or creates effects.
- **Schema**: a form constraining result structure.

GoalAgent's domain actions are deliberately small:

```text
read_current_goal
create_run_spec
submit_voice_run
commit_report
complete_goal_iteration
```

It cannot bypass `submit_voice_run` to call providers or merely claim completion without `complete_goal_iteration`.

### 4.6 Events are receipts, not debug logs

Besides current snapshots, the database contains ordered append-only events. Session events have monotonic cursors, and Goal dispatch tracks a consumption cursor.

Events:

- support SSE replay;
- wake the background Goal loop;
- exchange context between Agents;
- preserve causality for audit, recovery, and debugging.

A tool's success is proven by its persisted record, not the model's final sentence. Events are the bank statement of the system.

### 4.7 Idempotency, leases, and cursors make recovery possible

SSE reconnects, retries, duplicate consumption, double clicks, and duplicate callbacks are routine. Without constraints, even a capable Agent can place duplicate calls.

The code uses:

- Goal leases to prevent concurrent iterations;
- dispatch cursors to consume only new events;
- RunSpec versions and checksums to prevent silent overwrite;
- idempotency keys for Runs and external operations;
- terminal events to wake GoalAgent instead of trusting one coroutine forever;
- immutable, versioned Report artifacts;
- workspaces isolated by tenant, session, and Goal.

These unglamorous mechanisms determine whether a Demo can become a production system.

### 4.8 Human-in-the-loop belongs to the protocol

Confirmation is a formal context-delivery type, not an emergency dialog. GoalAgent emits `confirmation_request`; MainAgent turns it into a user-facing question; a new event resumes the Goal after approval.

Safety policy rejects or restricts:

- deception and impersonation;
- fraud, harassment, and malicious bulk calling;
- requests for OTPs, payment credentials, or similar secrets;
- routing emergencies to an ordinary phone Agent.

Soft rules belong in instructions; hard boundaries belong in tools, identity, route capabilities, and data validation.

### 4.9 Evals and tracing are part of Agent architecture

Langfuse and OpenInference tracing connect sessions, Runs, and provider execution. The older one-shot flow also has:

- hard-rule checks;
- LLM judges;
- end-to-end harnesses;
- user and text simulators;
- a voice gym for real spoken interactions.

Unit tests prove functions for fixed inputs. Evals ask whether the model understood the Goal, asked when necessary, obeyed constraints, and regressed between prompt versions. Without traces and evals, an Agent is not production-ready.

## 5. Why the legacy one-shot phone flow still exists

`services/seleven-mcp` retains a mature one-shot phone toolchain:

```text
plan_call
  → clarify if necessary
  → produce confirmation token
  → run_call
  → Taskiq worker
  → Botlab + Calling
  → monitor, transcribe, summarize
  → get_call_run
```

It centers on one call run and suits “plan one call, execute it, then query the result.” It includes prompt generation and repair, runtime prompts, a summarization Agent, Widget, guardrails, and end-to-end evals.

The difference is not that the old flow lacks AI. The state models differ:

| Dimension | Legacy one-shot | New Goal-driven flow |
|---|---|---|
| Core object | One CallRun | One long-lived Goal |
| Planning | Plan one call | Produce versioned RunSpecs for an outcome |
| After failure | Caller decides whether to retry | GoalAgent can absorb evidence and continue |
| User interaction | plan / confirm / run / get | conversation + background loop + context delivery |
| Result | One call result and summary | Versioned Report combining multiple Runs |
| Background execution | Taskiq worker | Persisted state plus in-process async tasks in the current implementation |

The repository is therefore gradually transferring lessons from the old flow into the new architecture, not replacing the old system all at once.

## 6. Desktop Agent: extending conversation into the browser and OS

CALL-E is a vertical Agent. `services/seleven-agents` is a general desktop-Agent runtime.

### 6.1 Desktop-Agent directory map

```text
prod-dive-in/
├── apps/electron/                     # presentation and local processes
│   └── src/
│       ├── main/                      # Electron main process
│       ├── preload/                   # constrained IPC exposure
│       └── renderer/                  # React chat and event timeline
├── services/seleven-bridge/
│   └── src/seleven_bridge/
│       ├── interface/api/             # /agent_chat and other routes
│       ├── application/use_cases/     # AgentChatUseCase
│       ├── domain/
│       │   ├── entities/              # Session, Message, File
│       │   ├── repositories/          # repository ports
│       │   └── services/              # Agent and concurrency-lock ports
│       └── infrastructure/
│           ├── adapters/              # SelevenAgent adapter
│           └── repositories/          # SQLite / local-file implementations
└── services/seleven-agents/
    └── src/seleven_agents/
        ├── agents/
        │   ├── seleven_agent.py       # general Agent entry point
        │   ├── agent_factory.py       # YAML-driven assembly
        │   ├── subagent/              # dynamic sub-Agents
        │   ├── browser/               # Browser Agent and CDP
        │   ├── computer_agent/        # OS / CUA adapters
        │   └── livelens/              # real-time audio understanding
        ├── tools/
        │   ├── plan/ shell/ search/   # planning, terminal, search
        │   ├── sandbox/ file/         # Python and file processing
        │   └── takeover/ report/      # human takeover and reports
        ├── integrations/
        │   ├── extension/             # browser-extension audio bridge
        │   └── speech/                # STT provider adapters
        ├── schemas/                   # stream-event and tool Schemas
        └── scheduler/                 # general task scheduler
```

Electron knows only the Bridge protocol. Bridge calls the Agent through an adapter; the Agent accesses browser and local tools. The UI need not know `browser-use`, STT, or Python-sandbox details.

### 6.2 Electron does not run the Python Agent directly

The renderer sends `/agent_chat?protocol=data`; `services/seleven-bridge` handles it with FastAPI and a hexagonal architecture:

- domain: Session, Message, and repository interfaces;
- application: `AgentChatUseCase`;
- infrastructure: SQLite/in-memory repositories and `SelevenAgentAdapter`;
- interface: HTTP routes.

Bridge stores model-facing messages separately from display events. Model context stays concise; the UI timeline retains tool activity, browser steps, and human takeover. This mirrors CALL-E's separation of Context and State.

### 6.3 Agent Factory assembles instead of hard-coding one Agent

`SelevenAgent` uses the OpenAI Agents SDK streaming runner. `agent_factory` combines YAML-defined:

- instructions and persona;
- model and reasoning parameters;
- allowed tools;
- statically configured sub-Agents;
- permission to create dynamic sub-Agents.

Configured sub-Agents are wrapped as tools. Dynamic `spawn_subagent` first checks that requested tools belong to the parent's allow-list, then creates an independent Agent and forwards source-labelled events through a queue.

This differs from CALL-E GoalAgent:

- a desktop sub-Agent is temporary delegation inside a general task;
- GoalAgent is a domain role with independent persistent context and lifecycle.

Both decompose complexity, but one focuses on runtime delegation and the other on persistent domain orchestration.

### 6.4 Tools cover the local system, data, and browser

The desktop toolset includes:

- planning and task workspaces;
- local shell;
- Firecrawl search;
- Python sandbox and data processing;
- file and document conversion;
- scheduler;
- Computer Agent;
- final Reports;
- browser launch, shutdown, and Browser Agent;
- Human Takeover;
- LiveLens.

Browser Agent wraps `browser-use`, connects through CDP, and emits structured `browser.step` events. For CAPTCHA, login authorization, or pages unsuitable for the model, Human Takeover emits an inspector URL. The desktop client lets the user take control, then the Agent resumes.

### 6.5 LiveLens gives the Agent hearing

```text
Browser extension captures audio
  → local audio bridge
  → TEN VAD detects speech spans
  → OpenAI / Omni STT transcribes
  → optional sherpa-onnx speaker diarization
  → incremental and post-session summaries
  → transcript / summary artifacts and live events
```

This is not simply uploading a recording to one model. It continuously emits consumable transcript and summary events while a meeting or web audio is still in progress.

## 7. Features already implemented in the repository

| Capability | Concrete features |
|---|---|
| CALL-E conversation | Session creation, messages, streaming events, replay, search, rename, delete |
| Goal management | Goal commit, dispatch, state projection, confirmation, context delivery |
| Phone execution | Number preflight, route-capability checks, RunSpec, dialing, IVR/voicemail/wait/transfer handling |
| Result delivery | Transcript, structured final result, evidence artifacts, Markdown/JSON Reports |
| Account and business | Login, profile, balance, recharge, usage, and billing UI |
| Phone numbers | Directory, purchase, activation, billing, and release services |
| Legacy MCP | `plan_call`, `run_call`, `get_call_run`, and other one-shot tools |
| Desktop Agent | Conversation, planning, files, shell, analysis, reports, and task workspace |
| Browser automation | Browser Agent, CDP debugging, step events, and human takeover |
| Real-time understanding | Audio capture, VAD, STT, diarization, live and post-session summaries |
| Operations and quality | Console, tracing, logs, eval sets, simulators, and E2E harness |

Isolated simulators and test namespaces allow phone and Agent exercises without contaminating production data.

## 8. Technology stack

This is a TypeScript + Python multi-runtime system.

### 8.1 CALL-E Web

| Category | Technology |
|---|---|
| UI | React 19, TypeScript 5.9, Vite 7 |
| Routing and data | React Router 7, TanStack Query 5, Zustand 5 |
| Agent UI | assistant-ui, AI SDK 6 |
| Styling and components | Tailwind CSS 4, shadcn/Radix |
| Forms and validation | React Hook Form, Zod |
| Tests | Vitest |

The front end uses domain-oriented `app / platform / design-system / shared-kernel / bounded-contexts` directories. TanStack Query owns server data, Zustand owns mainly local UI state, and a platform client centralizes HTTP access.

### 8.2 CALL-E server

| Category | Technology |
|---|---|
| Language and Web | Python 3.13, FastAPI, Uvicorn |
| Agent / MCP | OpenAI Agents SDK, FastMCP 3 |
| Data models | Pydantic, Pydantic Settings, JSON Schema |
| Database | SQLAlchemy 2 async, Alembic, PostgreSQL |
| Async infrastructure | Redis, RabbitMQ, Taskiq, FastStream / Kafka |
| Network and templates | HTTPX, Jinja, YAML |
| Observability | Langfuse, OpenInference |
| Integrations | Botlab, Calling, IAMS, phone-number services |

In this source snapshot, the new main CALL-E Agent defaults to `gpt-5.5` with medium reasoning, detailed summaries, and a context-compaction threshold. That is a runtime default, not an architectural dependency on one model.

### 8.3 Desktop and general Agent

| Module | Technology |
|---|---|
| Electron UI | Electron 38, React 19, TypeScript, Vite, Redux Toolkit, Lexical, RxJS, Radix |
| Bridge | Python 3.13, FastAPI, SQLAlchemy, SQLite, croniter, OpenTelemetry |
| Agent runtime | Python 3.12+, OpenAI Agents SDK, browser-use, Firecrawl, LangChain sandbox |
| Data and documents | pandas, polars, matplotlib, openpyxl, PyMuPDF |
| System | PyObjC and Computer Use / CUA adapters |
| Audio | TEN VAD, OpenAI/Omni STT, sherpa-onnx |
| Browser | Manifest V3 extensions, CDP, DevTools host, Playwright |
| Observability | OpenTelemetry, SigNoz, LangSmith, OpenReplay |

## 9. What this architecture does well

### 9.1 It wraps Agent uncertainty in deterministic systems

Models interpret language and create plans, while code enforces number formats, permissions, tenant boundaries, route capabilities, state transitions, idempotency, and Report Schemas. This is more reliable than trying to write one perfect prompt.

### 9.2 It separates outcome from execution

A Goal is not one phone call. The system can naturally represent retries, multiple targets, changed conditions, and aggregated evidence. The model also supports future batch outbound, progressive Goals, and scheduled wakeups.

### 9.3 It separates conversation UX from background lifecycle

`202` responses, SSE replay, persisted events, and context delivery prevent minutes-long external work from pretending to be one long chat request. The user sees a task that keeps progressing instead of a fragile request waiting to time out.

### 9.4 The code has domain verbs

`commit_goal`, `create_run_spec`, `submit_voice_run`, and `commit_report` express business meaning more clearly than `execute_tool`, making permissions, audit, and tests easier to attach.

## 10. Current boundaries and evolving areas

### 10.1 New GoalAgent currently focuses on outbound work

Specifications discuss inbound work and MainAgent recognizes more Goal types, but the current dispatcher constructs an outbound GoalAgent for one-shot, batch, and progressive outbound types. Inbound GoalAgent remains a design direction rather than a completed main-path capability.

### 10.2 Data structures for batch and progressive tasks precede the complete product loop

RunGroup, `multi_item`, per-recipient RunSpecs, and detailed specifications already exist, but some batch and progressive flows remain staged work. The architecture prepares for them; not every scenario has shipped end to end.

### 10.3 Wakeups are currently driven mainly by events

A Goal can record `next_wakeup_at`, but the current loop primarily reacts to new events. Reliable arbitrary-future scheduling and self-wakeup remain future work.

### 10.4 Old and new background execution are not fully unified

The legacy one-shot flow uses Taskiq workers. Current Goal dispatch and voice lifecycle start mainly with in-process `asyncio.create_task`, while database state, leases, and events provide recovery foundations. Greater certainty across processes and crashes will usually require moving the new loops fully into replayable worker scheduling.

### 10.5 Multiple Agent-runtime generations add cognitive cost

The repository contains:

- legacy one-shot MCP phone Agents;
- new Goal-driven CALL-E Agents;
- general desktop Agents and dynamic sub-Agents.

They solve different problems and come from different phases. Coexistence helps migration, but clearer names, boundary documentation, and shared contracts will eventually be needed to prevent tracing, event, tool, and provider abstractions from diverging.

## 11. Recommended source-reading order

1. Read the root README and `docs/monorepo-map.md` to identify both product lines.
2. Read `services/seleven-mcp/docs/agent-design.md` for Agent design principles.
3. Follow the `apps/calle-web` chat transport to `/v1/sessions/.../events`.
4. Read `chat_routes.py`, API session, and `turn_pump.py`.
5. Read `CallEAgent`, MainAgent tools, and `commit_goal`.
6. Read `GoalIterationRunner` and `OutboundGoalAgent`.
7. Follow `create_run_spec` and `submit_voice_run` into `VoiceRunExecutor`.
8. Read Reports, event store, workspace, and database models.
9. Compare legacy `one_shot_call` to see why Goal was introduced.
10. For the desktop Agent, follow Electron's `/agent_chat` client through Bridge to `SelevenAgent`.

Keep asking four questions:

- Who owns authoritative state?
- Which action creates a real side effect?
- If the process crashes here, where does it resume?
- When the model says “done,” what evidence lets the code believe it?

Most of the repository's important design answers those questions.

## 12. Summary

`prod-dive-in` shows a clear path from an “AI feature” to an “Agent system”:

1. MainAgent turns natural language into a stable objective.
2. GoalAgent owns the outcome over time, not one tool call.
3. RunSpec, Run, and Report preserve plans, facts, and deliverables.
4. Voice Agent performs a bounded field task.
5. Events, cursors, leases, idempotency, and workspaces wrap uncertain models in a recoverable system.
6. Human-in-the-loop, guardrails, traces, and evals manage risk and quality.
7. Desktop Agent, browser takeover, and LiveLens extend the same ideas to general computer tasks.

The most reusable lesson is not a framework or prompt, but a simple engineering judgment:

> An Agent may decide what to do next, but the system must remember what happened, what is allowed, and where to resume after failure.
