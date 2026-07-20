---
title: "Agentic Systems Overview: CALL-E, the Desktop Agent, and Browser Takeover"
summary: "A systems-level tour of CALL-E, the desktop Agent, and browser takeover: their product boundaries, layered architecture, technology stack, and evolving Agent runtimes."
---

> This article is a repository-level map of `prod-dive-in`. It explains how the applications and services fit together.
> To learn the CALL-E Agentic Goal architecture from the beginning, start with [Understanding the CALL-E Agentic Goal Architecture](/blog/calle-agentic-goal-architecture-guide).

Many AI applications can chat. `prod-dive-in` is concerned with what happens outside the chat box: how a system places a real phone call, operates a browser, lets a long-running task continue in the background, and shows the user a trustworthy account of the process and result.

This is not a monolithic application. It is an evolving monorepo with at least two relatively independent product lines: **CALL-E**, which works toward phone-based objectives, and a **general desktop Agent**, which can use the browser and local tools. The two lines share ideas such as Agents, tools, event streams, and observability, but they do not use one unified runtime.

This article is based on source at commit `aa7af64`. It answers three questions:

1. Which product line owns each top-level directory?
2. Which applications, services, and external systems does a user request cross?
3. Where should you start when you want to read the source in depth?

If you remember only one sentence, remember this:

> `prod-dive-in` is not “one Agent.” It is a collection of products and infrastructure that connect model decisions to phones, browsers, and operating systems.

## 1. The global view: two Agent product lines

### 1.1 CALL-E: working toward phone objectives

CALL-E lets a user describe a phone task in natural language. The system clarifies the objective, creates an execution plan, places the call, tracks the result, and organizes the evidence into a report.

| Module | Responsibility |
|---|---|
| `apps/calle-web` | Accounts, billing, conversation, task progress, and results UI |
| `services/seleven-mcp` | CALL-E API, Agent runtime, phone execution, persistence, and MCP tools |
| `services/seleven-mcp/src/calle/agentic` | Goal-driven domain model and background loop |
| `services/seleven-mcp/src/calle/voice_runtime` | Prompts, providers, and the lifecycle of one call |
| `apps/seleven-mcp-console-web` | Operations and debugging console |

The internal details can first be compressed into one flow:

```text
User conversation
  → MainAgent understands the request and commits a Goal
  → GoalAgent creates a RunSpec
  → VoiceRunExecutor places a call
  → Call status and results flow back
  → GoalAgent continues, stops, or commits a Report
  → The Web client renders progress and results through SSE
```

There are two time scales here. A foreground conversation usually takes seconds, while a real call and its Goal lifecycle may take minutes or longer. CALL-E therefore cannot depend on a single HTTP request or model response.

### 1.2 The general desktop Agent: browser and local tools

The second product line is closer to a desktop AI workspace. A user assigns a task in the Electron client. The Python Agent can inspect local information, call tools, create sub-Agents, and delegate browser work to specialized browser capabilities.

| Module | Responsibility |
|---|---|
| `apps/electron` | Electron desktop app, chat UI, and local process management |
| `services/seleven-bridge` | FastAPI bridge between Electron and the Python Agent |
| `services/seleven-agents` | General Agent, tools, sub-Agents, browser automation, and LiveLens |
| `apps/devtools-host` / `apps/devtools-frontend` | Browser debugging, observation, and interaction |
| `apps/chrome-extension*` | Page connectivity, audio capture, and local bridging |

Its main flow is:

```text
Electron UI
  → seleven-bridge
  → SelevenAgent
  → Local tools / browser Agent / dynamic sub-Agent / LiveLens
  → NDJSON event stream
  → Electron renders the process as a timeline
```

### 1.3 Why these are not one Agent

Both product lines use words such as “Agent,” “Tool,” “Session,” and “Event,” but a shared name does not imply a shared implementation:

- CALL-E centers on Goal, RunSpec, Run, and Report in the phone domain.
- The desktop Agent centers on a conversational runtime, dynamic tools, and computer interaction.
- The legacy CALL-E one-shot flow is another implementation centered on a single call.
- Each flow also has its own event protocol, persistence model, and process model.

When reading the monorepo, do not begin by looking for one “master Agent.” First identify which product flow you are following.

## 2. Repository map

The following tree keeps only the trunk needed to understand the architecture. Ordinary configuration, fixtures, and build output are omitted.

```text
prod-dive-in/
├── apps/                              # User- and developer-facing applications
│   ├── calle-web/                     # CALL-E Web product
│   ├── seleven-mcp-console-web/       # CALL-E / MCP operations console
│   ├── electron/                      # Desktop Agent client
│   ├── chrome-extension/              # First-generation browser extension
│   ├── chrome-extension-v2/           # New browser extension
│   ├── devtools-host/                 # Local DevTools host
│   ├── devtools-frontend/             # Visual DevTools frontend
│   └── ios/                           # iOS client direction
│
├── services/                          # Python services and Agent runtimes
│   ├── seleven-mcp/                   # CALL-E, MCP, and phone runtime
│   ├── seleven-bridge/                # Electron ↔ Agent bridge
│   ├── seleven-agents/                # General desktop Agent capabilities
│   └── seleven-cloud/                 # Cloud-service capabilities
│
├── packages/                          # Packages shared across applications
│   ├── py/                            # Shared Python packages
│   └── ts/                            # Shared TypeScript packages
│
├── contracts/                         # Cross-process and cross-language contracts
├── specs/                             # Feature specifications and phased designs
├── docs/                              # Architecture, experiments, and internal notes
├── mocks/                             # Mock sites for local exercises
├── playground/                        # CUA, recording, and other experiments
└── scripts/                           # Development and repository scripts
```

When following business flows, simplify it further:

```text
Phone Agent: apps/calle-web
               └─→ services/seleven-mcp

Desktop Agent: apps/electron
               └─→ services/seleven-bridge
                     └─→ services/seleven-agents
                           └─→ Browser / local / audio capabilities
```

## 3. A shared layering method

The runtimes are not unified, but both product lines can be understood with the same four layers.

| Layer | Responsibility | Representative modules |
|---|---|---|
| Presentation | Collect input and render streaming progress and results | CALL-E Web, Electron, console, browser extensions |
| Application and orchestration | Accept requests, assemble Agents, schedule background work, and translate events | API session, Goal runner, bridge use case |
| Domain | Define task objects, state, rules, and business actions | CALL-E `agentic`, bridge domain |
| Infrastructure | Connect databases, queues, models, phone providers, browsers, and the OS | PostgreSQL, Redis, RabbitMQ, provider adapters, CDP |

```text
┌──────────────────────────────────────────────────────────┐
│ Presentation: CALL-E Web / Electron / Console / Extension │
└───────────────────────┬──────────────────────────────────┘
                        │ HTTP + SSE / NDJSON / IPC
┌───────────────────────▼──────────────────────────────────┐
│ Application: Session, Goal Runner, Bridge Use Case         │
└───────────────────────┬──────────────────────────────────┘
                        │ Commands, events, and domain objects
┌───────────────────────▼──────────────────────────────────┐
│ Domain: Goal / Run / Report, or desktop task/tool protocol │
└───────────────────────┬──────────────────────────────────┘
                        │ Ports / Providers
┌───────────────────────▼──────────────────────────────────┐
│ Infrastructure: DB, queues, LLM, phone, browser, OS, obs. │
└──────────────────────────────────────────────────────────┘
```

This layering creates an important boundary: **the model proposes judgments and actions; deterministic code stores facts and controls side effects.** The model may suggest placing a call or clicking a button, but number validation, authorization, tenant isolation, state transitions, and idempotency cannot be guaranteed by a prompt alone.

## 4. CALL-E from a repository-level perspective

The CALL-E Web client creates a session, sends a message, and subscribes to events through SSE. The API can quickly return `202 Accepted` while Agents and phone work continue in the background. Persistent events and cursors let the UI recover after a refresh or a short disconnection.

The server is broadly divided into three parts:

```text
services/seleven-mcp/src/calle/
├── apps/api/          # HTTP, SSE, session ingress, and product events
├── agentic/           # Goal, RunSpec, Run, Report, and iteration runtime
└── voice_runtime/     # Providers and lifecycle for one phone call
```

Each part answers a different question:

- The API layer answers, “How does the user start work and observe change?”
- The Agentic layer answers, “What is the objective, what happens next, and is the task over?”
- The voice runtime answers, “How is one call created, started, monitored, and finalized?”

Remember the essential domain objects with four sentences:

| Object | Question it answers |
|---|---|
| Goal | What outcome does the user ultimately want? |
| RunSpec | How will this particular execution proceed? |
| Run | Which attempt actually happened in the real world? |
| Report | How does the system deliver the result and evidence? |

These objects are only coordinates on the repository map. For their state machines, events, leases, cursors, Workspace, and source-level call relationships, continue with Part 0 of the series: [Understanding the CALL-E Agentic Goal Architecture](/blog/calle-agentic-goal-architecture-guide). This overview intentionally does not duplicate that material.

## 5. Why the legacy one-shot phone flow remains

`services/seleven-mcp` still contains a relatively mature single-call toolchain:

```text
plan_call
  → Clarify when necessary
  → Generate a confirmation token
  → run_call
  → Taskiq worker
  → Botlab + Calling
  → Monitor, transcribe, and summarize
  → get_call_run
```

It centers on one CallRun and suits “plan one phone call, execute it, and query the result.” The Goal-driven flow centers on a long-lived outcome, allowing one Goal to include several attempts and continue when new evidence arrives.

| Dimension | One-shot flow | Goal-driven flow |
|---|---|---|
| Core object | One CallRun | One long-lived Goal |
| Planning | Generate a plan for one call | Generate a versioned RunSpec for an outcome |
| After failure | Caller decides whether to retry | GoalAgent can continue from the result |
| Result | One call result and summary | A Report can combine multiple Runs |
| Background execution | Taskiq worker | Persistent state, events, and Goal iterations |

The legacy flow is not “without an Agent,” and the new flow is not merely an extra naming layer. Their real difference is the state model and lifecycle. The old flow also retains valuable prompts, guardrails, Widgets, and E2E evals, so its continued presence during migration is reasonable.

## 6. Desktop Agent: why Electron still needs a Bridge

The desktop flow begins in `apps/electron`. Electron is good at windows, the system tray, IPC, permissions, and updates, while the core Agent code runs in a Python service. `services/seleven-bridge` therefore sits between them:

```text
Renderer (React)
  → Electron Main Process
  → Start and manage seleven-bridge locally
  → POST /agent_chat
  → Python SelevenAgent
  → NDJSON streaming events
  → Renderer timeline
```

The Bridge is more than a reverse proxy. It also owns process-boundary responsibilities:

- Validate desktop requests.
- Assemble an Agent use case.
- Translate Python runtime events into a stable NDJSON protocol.
- Isolate Electron from a particular model or Agent SDK.
- Provide a common boundary for cancellation, errors, and lifecycle management.

This split lets the TypeScript client and Python Agent evolve independently. The cost is that the cross-process contract must be maintained carefully, and logging, errors, and cancellation semantics must span both sides.

## 7. Browser takeover is not one `click()` tool

Browser capabilities span several directories because “letting an Agent operate a website” actually includes connection, observation, reasoning, execution, and human takeover.

```text
Desktop Agent
  → Specialized browser Agent / Tool
  → DevTools host or browser extension
  → Chrome DevTools Protocol / Playwright
  → Screenshots, DOM, network, and interaction results
  → Agent makes the next decision
```

The relevant components divide responsibilities roughly as follows:

| Component | Main responsibility |
|---|---|
| Chrome Extension | Establish page-side connectivity and capture page or audio information |
| DevTools Host | Manage local browser debugging connections and command ingress |
| DevTools Frontend | Visualize observation and interaction |
| Browser Agent / Tools | Decompose high-level tasks into browser actions |
| Human Takeover | Return control for login, CAPTCHA, or high-risk steps |

Human takeover is not a patch applied after automation fails. It is part of the real product boundary. Login, CAPTCHA, and payment confirmation may legitimately require the user. A sound architecture must define when to pause, how to return control, and how to resume afterward.

## 8. LiveLens: real-time context for the desktop Agent

The LiveLens direction in `services/seleven-agents` lets the Agent process real-time audio or meeting context. Unlike ordinary chat, its input is not one complete message but a continuing time series.

That introduces a different set of engineering questions:

- How is audio captured and chunked?
- How are transcripts associated with time?
- What enters short-term context, and what should be stored long term?
- When should the Agent proactively speak, and when should it remain silent?
- How does the user know what the system is listening to and processing?

LiveLens is therefore closer to a real-time perception pipeline than one more ordinary tool attached to an existing Agent.

## 9. Technology stack

### 9.1 CALL-E Web

| Category | Technology |
|---|---|
| Web framework | Next.js, React, TypeScript |
| UI | Tailwind CSS and repository components |
| Data and authentication | Supabase / PostgreSQL-related capabilities |
| Streaming updates | HTTP + Server-Sent Events |
| Payments and product services | Stripe and other external integrations |

### 9.2 CALL-E server

| Category | Technology |
|---|---|
| API | Python, FastAPI, Pydantic |
| Agent | OpenAI Agents SDK and domain tool layer |
| Persistence | SQLAlchemy, PostgreSQL |
| Cache and messaging | Redis, RabbitMQ, Taskiq |
| Phone execution | Botlab, Calling, SIP / WebRTC capabilities |
| Observability | Langfuse, OpenInference, OpenTelemetry, and others |

### 9.3 Desktop and browser

| Category | Technology |
|---|---|
| Desktop | Electron, React, TypeScript |
| Bridge | FastAPI, NDJSON streaming |
| General Agent | Python Agent runtime, dynamic tools, and sub-Agents |
| Browser | Manifest V3 extensions, CDP, DevTools, Playwright |
| Observability | OpenTelemetry, SigNoz, LangSmith, OpenReplay |

A technology table only tells us what is used. The important things to trace are the boundary contracts: how an HTTP request becomes a domain command, how a model tool creates a persistent record, how a provider callback becomes an event, and how that event returns to the UI.

## 10. Architectural strengths

### 10.1 Deterministic systems contain model uncertainty

The model has room to understand language and generate plans. Code constrains number formats, permissions, tenant boundaries, state transitions, idempotency, and result schemas. That is more reliable than trying to write one super-prompt that “never makes mistakes.”

### 10.2 Long tasks are decoupled from foreground connections

SSE replay, persistent events, and background lifecycles keep a multi-minute phone task from pretending to be one long chat request. NDJSON on the desktop also presents the process structurally instead of emitting only text tokens.

### 10.3 External providers sit behind adapters

Phone, model, browser, and observability systems have explicit integration boundaries. Business Agents do not need to understand OAuth, SIP, CDP, or tracing-exporter details at every decision point.

### 10.4 The code is developing domain verbs

`commit_goal`, `create_run_spec`, `submit_voice_run`, and `commit_report` express business meaning better than a generic `execute_tool`. They also provide natural locations for authorization, auditing, and tests.

## 11. Current boundaries and signs of evolution

### 11.1 Multiple runtime generations coexist

The repository contains the legacy one-shot phone Agent, the Goal-driven CALL-E implementation, and the general desktop Agent. They solve different problems and come from different phases. Mark the owning flow before reading source; do not apply a conclusion from one runtime directly to another.

### 11.2 Goal foundations precede every product loop

Data structures and specifications already discuss batch work, progressive objectives, and future wakeups, but some capabilities remain under phased construction. “The architecture leaves room for it” is not the same as “the product fully delivers it.”

### 11.3 In-process work and persistent workers are not fully unified

The legacy one-shot flow uses Taskiq workers. The new Goal hot path still includes in-process asynchronous tasks while relying on database state, leases, and events for recovery foundations. The scheduling model can become more unified to provide stronger cross-process recovery guarantees.

### 11.4 Cross-language, cross-process contracts cost maintenance

Electron, Bridge, Python Agent, browser extensions, and DevTools communicate through several protocol layers. The separation improves independent evolution, but the team must continuously maintain event names, error semantics, cancellation, and version compatibility.

These boundaries do not invalidate the architecture. They help readers distinguish the current hot path, migration-era implementations, and designs for later phases.

## 12. Choose a source-reading path

### Path A: understand the whole monorepo

1. Read the root README and `docs/monorepo-map.md`.
2. Read the top-level READMEs under `apps/`, `services/`, and `packages/`.
3. Inspect startup scripts and local-development instructions for both product lines.
4. Read the cross-boundary data structures under `contracts/`.

### Path B: go deep on CALL-E Goals

Read [Understanding the CALL-E Agentic Goal Architecture](/blog/calle-agentic-goal-architecture-guide), then follow its source-reading order into `services/seleven-mcp/src/calle/agentic/`. Build a mental model of Goal, Iteration, RunSpec, Run, Event, and Report before focusing on individual functions.

### Path C: trace one phone call

1. Start with the chat transport in `apps/calle-web`.
2. Follow `/v1/sessions/.../messages` and `/events`.
3. Inspect the CALL-E API session and event translation.
4. Follow an Agentic tool into `voice_runtime`.
5. Finish with provider callbacks, persisted state, and Report creation.

### Path D: trace one desktop browser task

1. Start with the Agent chat client in Electron.
2. See how the Main Process manages the Bridge.
3. Follow `/agent_chat` into the Python use case.
4. See how `SelevenAgent` chooses a tool or sub-Agent.
5. Follow browser tools into extensions, DevTools Host, and CDP.

Whichever path you choose, keep asking four questions:

- Who owns the authoritative state?
- Which action creates a real side effect?
- If the process crashes here, where does the system resume?
- When the model says “done,” why should the code believe it?

## 13. Summary

The value of `prod-dive-in` is not that it puts every capability into one universal Agent. It places different problems inside appropriate product boundaries:

1. CALL-E uses a domain model and background loop to manage long-lived phone objectives.
2. The voice runtime owns the execution details of one real call.
3. The desktop Agent connects Electron to Python capabilities through the Bridge.
4. Browser extensions, DevTools, and specialized Agents work together on browser interaction.
5. LiveLens extends input from discrete messages to real-time perception.
6. Databases, events, queues, protocols, and observability make these capabilities recoverable and explainable.

Once you draw the product and process boundaries before entering an Agent prompt or tool implementation, the repository stops looking like a mass of unrelated directories and becomes a set of execution paths that can be followed one segment at a time.
