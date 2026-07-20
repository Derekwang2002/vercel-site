---
title: "Understanding the CALL-E Agentic Goal Architecture: From a Chat Request to a Real Phone Call"
summary: "A beginner-friendly guide to CALL-E's Agentic Goal system and how MainAgent, GoalBrief, GoalAgent, Iteration, RunSpec, Run, Event, Report, and the persistent runtime work together."
---

Many AI products look like little more than a chat box. The moment they must complete a real-world task for the user, however, the problem becomes much more complicated. Does the task continue after the user closes the page? Should the system retry after an unanswered call? Who decides whether the task is finished? Can the system treat “done” from the model as a fact?

CALL-E's Goal system is designed for these questions. It does not hand one user sentence to a large model and ask it to execute everything. It turns a natural-language objective into a persistent, recoverable, and auditable long-lived work order, then lets several roles advance that work in stages.

This article describes the implementation around commit `aa7af64` of the `prod-dive-in` repository. It focuses on:

- `services/seleven-mcp/src/calle/agentic/`
- `services/seleven-mcp/src/calle/voice_runtime/`
- `services/seleven-mcp/src/calle/apps/api/`

If you remember only one sentence, remember this:

> **GoalBrief says what to do, RunSpec says how to do it, Run represents one real attempt, and Report says what ultimately happened.**

## Series guide

This series moves from intuition toward source-level understanding. Each article adds only one layer of complexity so that implementation details do not overwhelm the mental model.

- **Part 0 (this article):** Build the complete mental model and locate every concept in the source.
- **[Part 1: Trace `commit_goal`](/blog/calle-agentic-goal/commit-goal):** Learn how Goal, Event, and Dispatch are written to the database.
- **Part 2 (planned):** Read `GoalIterationRunner` line by line and understand leases, cursors, transactions, and recovery.
- **Part 3 (planned):** Trace the real phone execution path from `RunSpec → Run → VoiceRunExecutor`.
- **Part 4 (planned):** Trace the result path from `Report → Context Delivery → MainAgent`.

If the relationship between CALL-E, the desktop Agent, the Bridge, and the browser capabilities is not yet clear, start with [The Agentic Systems Overview](/blog/agentic-system-overview).

## 1. Start with an everyday example

Suppose a user tells CALL-E:

> Call a restaurant and ask whether they have a table for two at 7:00 PM on Friday.

The simplest implementation might turn that sentence directly into a prompt and ask a phone bot to dial. That leaves many unanswered questions:

- What is the restaurant's phone number?
- Which region does the number belong to?
- Which language should the call use?
- Does “a table is available” finish the task, or should the Agent book it automatically?
- If nobody answers, has the task failed, or should it retry?
- What happens if the service restarts halfway through the call?
- How does the UI recover progress after the user refreshes the page?

CALL-E divides the work into the following flow:

```text
The user states an objective
  ↓
MainAgent understands the request and fills in blocking information
  ↓
Create a Goal and GoalBrief
  ↓
GoalAgent creates a RunSpec
  ↓
Create a Run and place one real phone call
  ↓
Store state, Transcript, and execution results
  ↓
GoalAgent decides whether the objective succeeded, failed, or needs a retry
  ↓
Commit a Report
  ↓
MainAgent explains the result to the user in natural language
```

An unanswered call means only that one `Run` did not reach the objective. It does not necessarily mean the entire `Goal` has failed. GoalAgent can use constraints and evidence to decide whether to wait, retry, revise the approach, or stop.

## 2. Core concepts

| Concept | Beginner analogy | Actual responsibility |
|---|---|---|
| User Chat Session | A chat window | Stores the long-lived conversation between the user and MainAgent |
| Foreground Turn | One question and answer | The user sends a message and MainAgent handles it once |
| Goal | A long-lived work order | Represents what the user actually wants to accomplish |
| GoalBrief | The work-order requirements | Fixes the objective, facts, constraints, and success criteria |
| GoalAgent Session | The owner's working notes | Preserves GoalAgent's continuous understanding of one Goal |
| Goal Event | The work-order activity log | Records creation, updates, confirmation, execution results, and other facts |
| Goal Iteration | One work session by the owner | Processes a batch of new Events and then waits again |
| RunSpec | An execution plan or SOP | Describes how the phone call should be executed |
| Run | One real attempt | Represents one outbound call or another real execution |
| RunGroup | A group of executions | Organizes multiple Runs for batch calling |
| Report | A result report | Summarizes execution results and supporting evidence |
| Workspace | The work-order folder | Stores large YAML, Markdown, and raw-result files |

Session, Goal, GoalAgent, Iteration, and Run are the easiest terms to confuse.

### 2.1 A Session is not a Goal

A `User Chat Session` is the chat container visible to the user. A `Goal` is one concrete task created inside that conversation.

For example, a user might first ask CALL-E to contact a restaurant, then ask it to contact a hotel after the first task ends. Those can become two historical Goals in one chat. The architecture aims to allow at most one Active Goal at a time so that “stop” or “continue” never has an ambiguous target.

### 2.2 A Goal is not a GoalAgent

- A Goal is a business object in the database.
- GoalAgent is the AI role responsible for advancing that Goal.
- Stopping the GoalAgent process does not make the Goal disappear.
- After the service recovers, another GoalAgent can continue from Goal state and Events.

A Goal is therefore neither a prompt nor one model call.

### 2.3 An Iteration is not a Run

- An `Iteration` is one round in which GoalAgent reasons, decides, and invokes tools.
- A `Run` is one real attempt by the system in the outside world.

GoalAgent may need several Iterations before creating one Run. In a batch task, it may also create several Runs within one Iteration.

## 3. Overall architecture

The main CALL-E Goal flow looks like this:

```text
┌────────┐
│  User  │
└───┬────┘
    │ Natural-language objective
    ▼
┌─────────────────────┐
│ MainAgent            │
│ Understand, clarify, │
│ and commit objective │
└──────────┬──────────┘
           │ commit_goal / notify_goal
           ▼
┌─────────────────────────────────┐
│ Goal Product State              │
│ calle_goals + calle_goal_events │
└──────────┬──────────────────────┘
           │ needs_dispatch
           ▼
┌──────────────────────────────┐
│ Goal Runtime                 │
│ Cursor, lease, dispatch,     │
│ transaction, and recovery    │
└──────────┬───────────────────┘
           │ By goal_type
           ├───────────────┐
           ▼               ▼
┌──────────────────┐  ┌─────────────────┐
│ OutboundGoalAgent│  │ InboundGoalAgent│
└─────────┬────────┘  └────────┬────────┘
          │                    │
          ├── RunSpec          ├── RunSpec
          ├── Run / RunGroup   ├── Simulation
          ├── Voice Executor   ├── Hotline Binding
          └── Report           └── Report
                    │
                    ▼
          Context Delivery
                    │
                    ▼
                MainAgent
                    │
                    ▼
                   User
```

The most important architectural seam is this:

> MainAgent and GoalAgent do not call each other directly, and they do not use an SDK handoff inside one model loop.

They communicate through database state, Goal Events, and Runtime dispatch. MainAgent writes information into the Goal's event stream, and the Runtime wakes GoalAgent asynchronously. When GoalAgent finishes one round of work, it sends a structured Context Delivery back to MainAgent.

This design separates task execution from the browser connection. Closing the page, losing the SSE connection, or refreshing the browser does not automatically cancel an accepted Goal. The Web page observes the task; it does not own the task.

## 4. MainAgent: the user-facing front desk

MainAgent is the role that speaks directly with the user. Its core rules live at:

```text
services/seleven-mcp/src/calle/agentic/instructions/root_orchestrator.md
```

MainAgent is primarily responsible for:

1. Determining which kind of phone objective the user has requested.
2. Asking only questions that truly block execution.
3. Validating the phone number, region, time zone, and call language.
4. Producing a stable `GoalBrief`.
5. Calling `commit_goal` to create the Goal.
6. Sending later updates, confirmations, and stop requests through `notify_goal`.
7. Receiving GoalAgent results and explaining them to the user in natural language.

MainAgent is not responsible for:

- Writing the phone prompt.
- Creating a RunSpec.
- Placing the call.
- Analyzing the Transcript.
- Writing the final report.

This is a separation of responsibilities. MainAgent focuses on what the user is expressing. GoalAgent focuses on what should happen next for a task the system has already accepted.

## 5. GoalBrief fixes the WHAT, not the HOW

`GoalBrief` is the stable requirements contract that MainAgent submits when it creates a Goal. Its definition lives at:

```text
services/seleven-mcp/src/calle/schemas/agentic/goal.py
```

It contains:

| Field | Meaning |
|---|---|
| `objective` | The final outcome to achieve |
| `facts` | Known facts such as phone number, time, party size, and language |
| `constraints` | Privacy, safety, exact wording, and forbidden actions |
| `success_criteria` | Observable results that mean the work is complete |
| `narrative` | Background and a context summary |
| `source_refs` | References to user uploads or other materials |

A restaurant-availability GoalBrief might look conceptually like this:

```yaml
objective: Confirm whether the restaurant has a table for two at 7 PM on Friday
facts:
  phone_number: "+1..."
  region: US
  call_language: English
  date: Friday
  time: 7 PM
  party_size: 2
constraints:
  - Ask only about availability; do not book automatically
success_criteria:
  - Obtain a clear available or unavailable answer
  - Record the specific reason if availability cannot be confirmed
```

GoalBrief answers only “what should be done.” Execution details such as the opening, voicemail handling, and closing belong to RunSpec.

## 6. `commit_goal` and `notify_goal`: a command is not a direct call

MainAgent drives the Goal lifecycle through two main tools:

```text
commit_goal
notify_goal
```

Their implementation lives at:

```text
services/seleven-mcp/src/calle/agentic/tools/goals/lifecycle.py
```

### 6.1 `commit_goal`

`commit_goal`:

1. Creates the Goal.
2. Stores the GoalBrief.
3. Writes `goal_created` and `goal_committed` Events.
4. Marks the Goal as needing dispatch.
5. Returns a stable `goal_id`.

The tool is deliberately not called `run_goal` or `execute_goal`. Those names could imply that MainAgent calls GoalAgent synchronously and waits until all work is complete.

Its actual semantics are:

```text
Commit Goal → Write Events → Request asynchronous dispatch → Current MainAgent turn may end
```

### 6.2 `notify_goal`

When the user later says “change it to Saturday,” “continue,” “stop,” or approves a proposal, MainAgent calls `notify_goal` and writes an explicit Event:

```text
user_update
nudge_requested
confirmed
declined
stop_requested
```

On the next Iteration, GoalAgent only needs to read these new Events. It does not need to reanalyze the entire user conversation.

## 7. Three kinds of persistent Goal data

Three main tables support a Goal.

### 7.1 `calle_goals`: current snapshot

`calle_goals` stores the current state needed for fast reads:

```text
goal_id
session_id
goal_type
objective
current_status
goal_version
state_revision
payload
```

It is like the details page in a work-order system.

### 7.2 `calle_goal_events`: immutable history

`calle_goal_events` stores an append-only audit log, including:

```text
goal_created
goal_committed
user_update
confirmed
run_spec_created
run_completed
report_committed
stop_requested
```

It is like a bank ledger: the current balance may change, but refreshing a page cannot erase historical transactions.

### 7.3 `calle_goal_dispatches`: consumer state

`calle_goal_dispatches` stores GoalAgent runtime-control information:

```text
last_processed_goal_event_id
active_iteration_id
lease_until
iteration_status
next_wakeup_at
needs_dispatch
```

Think of this relationship as an inbox:

```text
Goal Events     = Received messages
Dispatch Cursor = The last message already read
Iteration Lease = Which worker currently owns the inbox
needs_dispatch  = Whether unread messages remain
```

## 8. `GoalIterationRunner`: the core Runtime module

The following module drives one GoalAgent Iteration:

```text
services/seleven-mcp/src/calle/agentic/runtime/goal_iteration_runner.py
```

External code only needs to call:

```python
run_goal_iteration(goal_id=...)
```

Internally, it hides a large amount of complex behavior:

1. Read Goal and Dispatch state.
2. Check for unprocessed Events.
3. Acquire an expiring Iteration Lease.
4. Read new Events after the previous cursor.
5. Create or restore the Goal-specific GoalAgent Session.
6. Select the GoalAgent based on `goal_type`.
7. Assemble this Iteration's model input.
8. Run the model and tools.
9. Validate the structured completion result.
10. Update the Goal, append Events, and advance the cursor.
11. Release the Lease.
12. Write user-facing results into the User Chat Session.

The lease prevents two Workers from modifying one Goal concurrently. The cursor tells GoalAgent which Events it has already processed and which information has just arrived.

## 9. GoalAgent Session: important, but not business truth

Every Goal has an independent, persistent GoalAgent Session whose ID is derived deterministically from `goal_id`.

It stores GoalAgent's model context, so an Agent awakened several times for the same Goal does not need to understand the entire task from scratch. That continuity matters for the quality of long-running work.

It is not, however, the sole source of business truth:

- Current Goal state is in `calle_goals`.
- Historical facts are in `calle_goal_events`.
- Execution results are in Run and Run Events.
- Large evidence lives in the Workspace.
- Report metadata lives in Report records.

Think of the GoalAgent Session as the owner's working notes. Database state and Events are the official work-order record.

## 10. OutboundGoalAgent and InboundGoalAgent

The Runtime selects a GoalAgent adapter based on `goal_type`.

### 10.1 OutboundGoalAgent

This Agent is responsible for outbound calls:

```text
one_shot_outbound
batch_outbound
progressive_outbound
```

Its main tools include:

```text
read_current_goal
list_supported_voice_targets
create_run_spec
submit_voice_run
commit_report
complete_goal_iteration
```

Its objective is generally to move a bounded task toward a verifiable terminal state.

### 10.2 InboundGoalAgent

The Goal Type in the current implementation is:

```text
inbound
```

It is responsible for hotline knowledge preparation, RunSpec generation, simulation testing, hotline binding, and periodic reports.

InboundGoalAgent does not conduct the low-latency real-time conversation for every incoming call. Voice Agent still executes the live call. InboundGoalAgent handles preparation before calls and organization after calls.

## 11. RunSpec: a versioned HOW

RunSpec describes an execution plan, not a real execution.

For example, a restaurant-availability RunSpec might be:

```yaml
bot_name: RestaurantAvailability
task_base_prompt: |
  # Task
  Ask whether a table for two is available Friday at 7 PM.
  # Opening
  Hello.
  # Identity Disclosure
  I am Call-E, an AI assistant calling on behalf of a user.
  # Live Message
  Do you have a table for two available this Friday at 7 PM?
  # Completion
  Capture a clear available or unavailable answer.
  # Closing
  Thank you, bye.
```

One Goal can have several RunSpec versions:

```text
RunSpec v1: Ask only about indoor seating
RunSpec v2: If indoor seating is unavailable, also ask about outdoor seating
RunSpec v3: The user changes the time to Saturday
```

The RunSpec creation entry point is:

```text
services/seleven-mcp/src/calle/agentic/tools/goals/voice_run.py
```

GoalAgent first writes YAML in the Workspace, then calls `create_run_spec` to register it. The tool stores its path, checksum, version, Lineage, and Runtime Profile instead of repeating the whole prompt in every tool argument.

## 12. Run: one real execution

A `Run` represents one real outbound-call attempt.

```text
Goal: Confirm whether the restaurant has availability

Run 1
  Uses RunSpec v1
  Result: No answer

Run 2
  Uses RunSpec v1
  Result: Connected; a table is available
```

A Run records:

- The RunSpec version and checksum.
- A snapshot of the target phone number.
- A snapshot of the Runtime Profile.
- Current status.
- Provider Task ID.
- Transcript snapshot.
- Structured results.
- Evidence references.
- Start and end times.

`submit_voice_run` only creates a Run in `queued` state and returns immediately. GoalAgent does not wait for the call to finish.

```text
GoalAgent
  → submit_voice_run
  → Run: queued
  → Current Iteration ends and waits for an Event

VoiceRunExecutor
  → Claims the Run
  → Calls Botlab / Calling
  → Updates running / completed / failed
  → Writes a Run Event and Goal Event
  → Wakes GoalAgent again
```

Batch tasks use a RunGroup to organize multiple Runs. When different recipients need different scripts, they should receive different RunSpecs instead of forcing all recipient differences into one prompt.

## 13. `complete_goal_iteration`: ending a round structurally

GoalAgent cannot establish system truth merely by outputting “done.” Every Iteration must call:

```text
complete_goal_iteration
```

Its arguments correspond to `GoalIterationResult` and mainly include:

| Field | Responsibility |
|---|---|
| `summary` | Internal summary of this Iteration |
| `goal_state_patch` | Proposed Goal-state update |
| `events_to_emit` | Goal Events to append |
| `iteration_status` | Whether to become idle or wait for Events |
| `resume_after_minutes` | Suggested delay before another wakeup |
| `projection` | Small state view for MainAgent or the UI |
| `artifact_refs` | References to Runs, Reports, Evidence, and other artifacts |
| `context_deliveries` | Explicit messages to deliver to MainAgent |
| `related_run_ids` | Runs involved in this Iteration |

GoalAgent makes the judgment. The Runtime validates it and persists it safely. The Runtime does not parse Goal state from ordinary Assistant text, and it does not update the database merely because the model wrote “completed.”

## 14. Context Delivery: GoalAgent does not speak directly to the user

When GoalAgent needs the user to confirm something, provide information, or view a result, it creates a Context Delivery:

```text
status
result
user_input_required
confirmation_request
```

For example:

```yaml
kind: confirmation_request
summary: The phone execution plan is ready and requires approval before dialing
ref:
  kind: run_spec
  id: run_spec_xxx
delivery_mode: wake_with_context
```

The Runtime persists it as a User Chat Session Event, then wakes MainAgent. MainAgent generates a natural response using the user's language and the current conversation.

This prevents:

- GoalAgent's internal JSON from appearing directly in the chat UI.
- GoalAgent from bypassing MainAgent to address the user.
- A confirmation request from disappearing when the browser disconnects.
- MainAgent from guessing business meaning from ambiguous GoalAgent prose.

## 15. Report: a result file is not completion state

GoalAgent can generate a Markdown or JSON report from Runs, Transcripts, and Evidence. Writing a file, however, does not mean the system has formally accepted that report.

The formal flow is:

```text
GoalAgent writes a report in the Workspace
  ↓
commit_report validates the path, format, and JSON Schema
  ↓
Store Report metadata, version, and checksum
  ↓
Write a report_committed Goal Event
  ↓
Tell MainAgent through Context Delivery
```

`commit_report` lives at:

```text
services/seleven-mcp/src/calle/agentic/tools/goals/report.py
```

It does not write the report automatically, notify the user directly, or execute recommendations inside the report. Its only responsibility is to register an existing Report Artifact as a traceable formal result.

## 16. Responsibilities of the database and Workspace

The database stores authoritative, queryable product state:

```text
Current Goal state
Goal Events
RunSpec versions and status
Run status and structured results
Transcript snapshots
Report metadata
Dispatch cursor and lease
```

The Workspace stores larger Artifacts:

```text
RunSpec YAML
Markdown reports
Raw Provider JSON
Recording references
Debug Traces
Evidence files
```

The Runtime therefore cannot decide that a Goal is complete by checking whether the folder contains `report.md`. A file may exist without having been committed, or it may be a draft, an old version, or an Artifact left by a failed attempt.

## 17. Three important reliability mechanisms

### 17.1 Lease: guarantee a single writer

GoalIterationRunner acquires a Lease before calling the model. While the Lease remains valid, another Worker cannot advance the same Goal concurrently. This prevents duplicate calls and conflicting state updates.

### 17.2 Cursor: process only new Events

Dispatch records `last_processed_goal_event_id`. The first Iteration receives the Goal Bootstrap and all initial Events. Later Iterations read only Events after the cursor.

### 17.3 Idempotency Key: handle duplicate submission

HTTP retries, duplicate message delivery, and process failures can all deliver one command more than once. Goal Events, Runs, and Reports use Idempotency Keys to avoid creating duplicate real-world side effects.

A Goal also distinguishes:

- `goal_version`: increments when the objective itself changes.
- `state_revision`: increments on any state update.

This lets the system distinguish “the user changed the objective” from “the same objective simply moved forward.”

## 18. A complete outbound Goal sequence

Putting the concepts together, a complete outbound call looks roughly like this:

```text
1. User: Ask the restaurant whether it has a table for two at 7 PM Friday

2. MainAgent
   - Determines one_shot_outbound
   - Runs phone-number and language Preflight
   - Creates GoalBrief
   - Calls commit_goal

3. Goal Store
   - Creates Goal
   - Appends goal_created / goal_committed
   - Sets needs_dispatch = true

4. GoalIterationRunner
   - Acquires Lease
   - Reads new Events
   - Restores GoalAgent Session
   - Selects OutboundGoalAgent

5. OutboundGoalAgent
   - Loads voice-agent-run-strategy
   - Writes RunSpec YAML
   - Calls create_run_spec

6. If user confirmation is required
   - Calls complete_goal_iteration
   - context_delivery: confirmation_request
   - MainAgent asks the user
   - After approval, notify_goal: confirmed

7. Next Goal Iteration
   - Reads confirmed Event
   - Calls submit_voice_run
   - Creates queued Run
   - Ends Iteration and waits for a result

8. VoiceRunExecutor
   - Executes the real call through Botlab / Calling
   - Updates Run status
   - Stores Transcript and results
   - Writes run_completed or run_failed

9. GoalAgent is awakened again
   - Evaluates results and success criteria
   - Completes, fails, retries, or requests user input
   - Generates and commits Report
   - Updates Goal state

10. Context Delivery
    - Delivers result or report_ready to MainAgent
    - MainAgent returns the final result in the user's language
```

## 19. Signs of evolution in the current source

This architecture is still evolving quickly. While reading the source, you will encounter differences between historical designs and the current implementation.

### 19.1 The multi-Goal migration is not fully consolidated

An accepted ADR allows one User Chat Session to keep multiple historical Goals and specifies at most one Active Goal at a time. GoalStore can already create multiple Goals.

The current automatic dispatch path, however, still uses the older `get_v1_goal_by_session_id()`. When a Session already has multiple Goals, that path can still trigger a one-goal-per-session error.

Relevant locations:

```text
services/seleven-mcp/src/calle/agentic/goals/store.py
services/seleven-mcp/src/calle/agentic/agents/calle.py
```

### 19.2 Goal-state vocabulary is not fully unified

`current_status` is still a string instead of a strict state enum. The code and tests contain values such as:

```text
planning
onboarding
needs_confirmation
awaiting_confirmation
calling
active
live
```

This indicates that state-machine semantics still need further consolidation.

### 19.3 The Inbound Goal Type was renamed

Earlier specifications use `inbound_hotline`; the current code uses `inbound`. When reading historical documents, prefer current runtime code and the Active Spec.

### 19.4 The current hot path still includes in-process background tasks

Goal Dispatch already has persistent cursors and Leases, but after MainAgent finishes, the current implementation mainly starts a Goal Iteration through an in-process `asyncio` background task. Complete cross-process scheduling, timed wakeups, and crash recovery remain directions for continued evolution.

## 20. Recommended source-reading order

If you are ready to read the code, use this order:

1. `services/seleven-mcp/src/calle/agentic/CONTEXT.md`
2. `services/seleven-mcp/src/calle/agentic/instructions/root_orchestrator.md`
3. `services/seleven-mcp/src/calle/schemas/agentic/goal.py`
4. `services/seleven-mcp/src/calle/agentic/tools/goals/lifecycle.py`
5. `services/seleven-mcp/src/calle/agentic/goals/store.py`
6. `services/seleven-mcp/src/calle/agentic/runtime/goal_iteration_runner.py`
7. `services/seleven-mcp/src/calle/agentic/instructions/goal/base.md`
8. `services/seleven-mcp/src/calle/agentic/instructions/domain/outbound.md`
9. `services/seleven-mcp/src/calle/agentic/tools/goals/voice_run.py`
10. `services/seleven-mcp/src/calle/agentic/tools/goals/finalization.py`
11. `services/seleven-mcp/src/calle/agentic/tools/goals/report.py`

## 21. Final mental model

Compress all the concepts into one main flow:

```text
User conversation
  → MainAgent organizes GoalBrief
  → commit_goal
  → Runtime dispatches GoalAgent
  → GoalAgent creates RunSpec
  → Create a real Run
  → External phone execution
  → Run Event wakes GoalAgent again
  → GoalAgent evaluates the result and creates Report
  → Context Delivery wakes MainAgent
  → MainAgent tells the user
```

From an architectural perspective, the CALL-E Goal system is not primarily solving “how to make a model place one phone call.” It is solving this problem:

> How can a natural-language objective maintain a clear, recoverable, and auditable lifecycle through disconnections, retries, collaboration, asynchronous execution, and multiple attempts in the real world?
