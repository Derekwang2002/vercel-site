---
title: "CALL-E Goals, Runs, and Calls: Conceptual Structure, Actors, and the Complete Execution Flow"
summary: "Starting from the relationships among Session, Goal, RunSpec, RunGroup, Run, and Call, this article progressively explains the responsibility boundaries of MainAgent, GoalAgent, the CALL-E Runtime, the Voice Runtime, and external Providers in a real outbound call."
---

An agent system that only answers questions generally needs to manage only conversational context. Once it begins placing real phone calls for users, however, it must answer more questions: What is the user's long-term objective? What script should this attempt use? Does one failed dial mean the entire task failed? Who handles retries? How are model decisions turned into recoverable, auditable database state?

CALL-E answers these questions with the main chain `Goal → RunSpec → Run`. A voice `Call` is not a unified core entity at the same level as Goal and Run; it is the concrete execution record produced in an external calling system by a certain type of Run.

If you remember only one sentence, remember this:

> **A Goal describes what must be accomplished, a RunSpec describes how the system plans to do it, and a Run means it was actually executed once; a Call is the call record produced on the Provider side by a voice-type Run.**

This article focuses on two things:

1. The relationships among Goal, RunSpec, RunGroup, Run, Call, Iteration, Event, and Report.
2. Who decides each step of a real outbound call, and which Runtime or Agent actually executes it.

The relevant implementation is primarily located in:

```text
services/seleven-mcp/src/calle/agentic/
services/seleven-mcp/src/calle/voice_runtime/
services/seleven-mcp/src/calle/apps/api/
```

## 1. Core Conceptual Structure

The main CALL-E Agentic structure can be represented as:

```text
Chat Session
└── Goal                              Product state of a long-running task
    ├── GoalAgent Session             GoalAgent's internal persistent context
    ├── Goal Events[]                 Goal-level facts and audit log
    ├── Goal Dispatch                 Cursor, lease, and wake-up state
    │
    ├── RunSpec[]                     Versionable execution plans
    │   └── Run[]                     Real executions based on the plan
    │
    ├── RunGroup[]                    Organizational units for single or batch execution
    │   └── Run[]
    │
    ├── Report / Artifacts            Reports, evidence, and large files
    │
    └── Run[]
        ├── Run Events[]              Execution-process events
        ├── Result Payload            Structured result
        ├── Evidence Refs             Evidence references
        ├── Transcript Snapshot       Call text and summary
        └── Provider IDs
            ├── external_run_id       Current Calling task_id
            └── provider call_id      Concrete call-record ID
```

From the database perspective, the core cardinalities are:

```text
Session  1 ── N Goal                  # v1 runtime policy limits one Goal per Session
Goal     1 ── N GoalEvent
Goal     1 ── 1 GoalDispatch
Goal     1 ── N RunSpec
Goal     1 ── N RunGroup
Goal     1 ── N Run
RunSpec  1 ── N Run
RunGroup 1 ── N Run
Run      1 ── N RunEvent
Run      1 ── 0..1 Result/Transcript Snapshot
```

### 1.1 Chat Session

A `Chat Session` is the chat thread visible to the user and the entry point for the API and client.

The current v1 runtime policy is:

```text
1 Chat Session ≈ 1 Goal
```

This is a code-level policy, not a permanent database constraint. The database does not add a unique constraint to `calle_goals.session_id`, so the structure preserves the future possibility of one Session managing multiple Goals.

The system also has another kind of Session: the `GoalAgent Session`.

| Session | Owner | Purpose | Business source of truth? |
|---|---|---|---|
| Chat Session | MainAgent | Store the conversational context of the user and MainAgent | No |
| GoalAgent Session | GoalAgent | Store the long-term working context of one Goal | No |

The GoalAgent Session ID is deterministically derived from `goal_id`. It is the main continuity layer through which GoalAgent resumes work across turns and wake-ups, but it is not the business source of truth. Actual product facts remain in Goal State, Goal Events, Run results, and Report.

### 1.2 Goal

A Goal is the product-state entity for the entire long-running task. It answers:

> What does the user ultimately want CALL-E to accomplish?

Its main fields include:

```text
goal_id
session_id
goal_type
objective
current_status
goal_version
state_revision
payload.brief
```

Where:

- `objective`: Description of the objective.
- `GoalBrief`: Facts, constraints, success criteria, and sources stabilized when the Goal is committed.
- `goal_version`: Incremented when the semantics of the objective change, such as when `objective` is edited.
- `state_revision`: Incremented on any state change, for optimistic concurrency control.
- `current_status`: Whether the Goal is currently planning, waiting, running, completed, failed, or in another stage.

A Goal should not be split into sub-Goals merely because there are more contacts. A batch of outbound calls remains one Goal; RunGroup, RunSpec, and Run express its multiple execution targets and real attempts.

### 1.3 GoalBrief

GoalBrief is the stable `WHAT` contract that MainAgent commits after intake. Typical content includes:

```text
objective          Final objective
facts              Confirmed facts such as numbers, regions, times, and languages
constraints        Prohibited actions, compliance requirements, and other boundaries
success_criteria   Observable results that mean the task is complete
narrative          Context, priority, and tone
source_refs        References to input material
```

GoalBrief does not describe exactly how the phone bot should open, follow up, or end the call. Those `HOW` details belong to RunSpec.

### 1.4 Goal Events

`calle_goal_events` is the append-only fact and audit log at the Goal level, for example:

```text
goal_committed
user_update
confirmed
status_updated
run_created
run_completed
run_failed
transcript_attached
goal_completed
```

Only business events that affect Goal progress are recorded here. Low-level Provider status, real-time ASR, and callback details belong in Run Events rather than all being placed in Goal Events.

### 1.5 Goal Dispatch and Goal Iteration

GoalAgent is not an always-running model loop. Events wake it, and each processing pass over a batch of new events is called a `Goal Iteration`:

```text
Goal Event arrives
  ↓
Runtime claims iteration lease
  ↓
GoalAgent consumes unprocessed events
  ↓
GoalAgent decides and invokes tools
  ↓
complete_goal_iteration
  ↓
Runtime applies state, advances cursor, and releases lease
  ↓
idle / waiting_event
```

`calle_goal_dispatches` stores Runtime control state:

```text
last_processed_goal_event_id
active_iteration_id
lease_until
iteration_status
next_wakeup_at
needs_dispatch
```

It is neither product state nor evidence. It only ensures that one Goal has one valid writer at a time, events are not missed, and the lease can be reacquired after an abnormal exit.

The distinction is therefore essential:

- `Iteration`: One round of thought, decisions, and tool calls after Runtime wakes GoalAgent.
- `Run`: One real execution performed by the system in the outside world.

An Iteration may create no Run at all, or it may create one or more Runs.

### 1.6 RunSpec

RunSpec answers:

> What execution plan does this Goal intend to use?

In a voice scenario, RunSpec usually includes:

```text
Voice Agent instruction
Opening, task description, and questions
How to handle voicemail, refusals, and follow-up questions
Runtime configuration and Voice Runtime Profile
```

RunSpec has a lineage and version:

```text
lineage_id
version
status = draft / active / superseded / archived
instruction_ref
instruction_checksum
runtime_profile_key
```

One RunSpec can be used by multiple Runs. When a Run is created, the system snapshots the RunSpec's lineage, version, and checksum onto it. Even if the script is later upgraded, the system can therefore identify exactly which version a historical Run used.

The two can be compared as follows:

```text
RunSpec = template, SOP, or operational plan
Run     = one actual execution according to that plan
```

### 1.7 RunGroup

RunGroup is the execution-organization layer used to represent:

- `singleton`: One independent outbound call.
- `multi_item`: Multiple targets in one batch task.

It primarily answers:

- Which targets one user confirmation covers.
- Which Runs belong to a batch.
- Which Run corresponds to each item.
- Whether the entire batch has reached terminal states.

Even for a single outbound voice call, the current implementation ensures that a singleton RunGroup exists. In a batch, multiple Runs share one RunGroup. If different contacts need different scripts, separate RunSpecs are created, but they can still belong to the same RunGroup.

### 1.8 Run

A Run represents one real trigger or execution, for example:

```text
One outbound voice call
One inbound call
One scheduler tick
In the future, it could also be an email, a webhook, or a browser task
```

Its core fields fall into several groups:

```text
Ownership:
  goal_id
  session_id
  run_group_id
  run_spec_id

Execution type:
  run_kind
  executor_kind
  trigger_kind

Target:
  target_kind
  target_ref
  target_snapshot

State:
  status
  queued_at
  started_at
  ended_at

Result:
  result_payload
  evidence_refs
  transcript_snapshot

External system:
  external_provider
  external_run_id
  external_status
```

A voice submission usually creates:

```text
run_kind      = voice_call
executor_kind = voice_agent
status        = queued
target_kind   = phone
```

### 1.9 Run Events

Run Events are an append-only execution-level log, for example:

```text
run_queued
voice_run_requested
run_status_updated
provider_run_created
provider_callback_received
transcript_received
result_summarized
```

Each Run Event has a visibility level:

- `user`: Curated and safe to display as user-facing progress.
- `internal`: Provider, audit, or debugging details.

### 1.10 What Exactly Is a Call?

The repository contains at least four meanings of “call.”

#### Voice Business Call

In the Agentic model, an outbound voice call is first of all:

```text
Run(run_kind="voice_call")
```

It is not a unified core entity at the same level as Goal and Run.

#### Calling task_id

After Voice Runtime submits a Run to Calling, Calling creates a dialing task:

```text
CALL-E run_id
  → Calling task_id
```

The current implementation stores `task_id` as:

```text
calle_runs.external_provider = "calling"
calle_runs.external_run_id   = task_id
```

#### Provider call_id

A Calling task's result may also contain a specific `call_id`, which is stored in the Run's Provider diagnostics. More precisely, the relationship is:

```text
CALL-E run_id
  → Calling task_id / external_run_id
  → Calling call_id
```

`task_id` identifies the dialing task; `call_id` identifies the concrete call record produced by that task.

#### Developer API call_id

The Developer API has its own `call_id`:

```text
POST /calls
  → Developer API call_id
  → one-shot plan_id
  → one-shot run_id
```

This `call_id` is the API-layer `call_task` aggregate ID, encapsulating the request, recipients, idempotency, Webhook, and result projection. It currently follows the legacy One-Shot Call Plan/Run path; it is neither an Agentic Goal nor Calling Provider's call_id.

The model SDK also has `tool_call_id`, which is merely the correlation ID for a model tool call and has nothing to do with phone records.

## 2. Who Decides and Who Executes

The complete flow has five kinds of actors:

| Actor | Primary responsibilities |
|---|---|
| API Runtime | Receive requests, drive turns, and publish Session Events and SSE |
| MainAgent | Interact with users, understand intent, form GoalBrief, and commit or notify a Goal |
| GoalAgent | Advance the Goal over time and decide plans, calls, retries, completion, and reports |
| CALL-E Runtime | Deterministic execution layer, including tools, stores, dispatch, leases, and background tasks |
| Voice Runtime / Provider | Create Voice Agents, dial, monitor calls, and save results |

The most important principle is:

> **Agents make semantic judgments; Runtime performs deterministic execution, authorization, idempotency, and persistence.**

For example:

```text
GoalAgent: “This phone call should be placed.”
Runtime: Validate parameters, create a Run, write events, and start a background task.

GoalAgent: “This Goal is complete.”
Runtime: Validate GoalIterationResult, update the Goal, advance the cursor, and release the lease.

GoalAgent: “This result should be communicated to the user.”
Runtime: Publish context.delivery.
MainAgent: Turn the structured result into a user-readable response.
```

## 3. Complete Outbound-Call Flow with Actors

The following traces one user message through the final response.

### 3.1 A User Message Enters MainAgent

```text
[User / CALL-E Web]
Send user message

→ [API Runtime / AgentSession / TurnPump]
Receive message, create turn, restore Chat Session, start MainAgent loop

→ [MainAgent]
Perform intake: understand user intent, determine goal_type, identify missing information

→ [MainAgent / outbound-planner skill]
Form GoalBrief: objective, facts, constraints, success criteria, resolved target
```

At this step, API Runtime only hosts one foreground turn. MainAgent and its planner skill actually decide what the user wants and whether the information is complete.

### 3.2 Commit the Goal

```text
[MainAgent]
Determine that the Goal is ready to commit and call commit_goal

→ [CALL-E Runtime / commit_goal tool + CalleGoalStore]
Create calle_goals
Write GoalBrief
Append goal_committed Goal Event
Set calle_goal_dispatches.needs_dispatch = true
Record goal_id in pending_dispatch_goal_ids
```

MainAgent makes the semantic decision to commit the Goal; the Runtime's `commit_goal` tool and GoalStore create the database records.

`commit_goal` is an asynchronous dispatch boundary. It does not execute GoalAgent directly inside the tool call.

### 3.3 Runtime Dispatches a GoalAgent Iteration

```text
[CALL-E Runtime / CallEAgent]
After MainAgent's current turn finishes, read pending_dispatch_goal_ids
Create background goal dispatch task

→ [CALL-E Runtime / GoalIterationRunner]
Check Goal Event backlog
Claim iteration lease
Load unconsumed Goal Events
Restore GoalAgent Session
Create OutboundGoalAgent based on goal_type

→ [GoalAgent / OutboundGoalAgent]
Read GoalBrief and new Goal Events
Decide whether to generate a plan, wait for confirmation, submit a call, retry, finish, or generate a report
```

Runtime handles scheduling, leases, cursors, transactions, and recovery; GoalAgent makes business-progress decisions.

### 3.4 Generate a Script and Create a RunSpec

```text
[GoalAgent / sandbox filesystem]
Generate voice-script artifact, for example:
goals/{goal_id}/run_specs/{slug}/voice_instruction.yaml

→ [GoalAgent]
Call create_run_spec

→ [CALL-E Runtime / create_run_spec tool + CalleRunSpecStore]
Read and validate workspace artifact
Calculate instruction checksum
Create or reuse calle_run_specs
Maintain lineage, version, and active status
Return run_spec_id
```

GoalAgent decides the script and writes it to the Workspace. Runtime reads the artifact, validates its path and checksum, and creates the persistent RunSpec.

### 3.5 User Confirmation or Preauthorization

Not every outbound call requires a separate question. Current rules allow ordinary, immediate, single-contact requests to count as preauthorized; batch, scheduled, ambiguous, or high-risk execution generally requires explicit confirmation.

If confirmation is needed:

```text
[GoalAgent]
Call complete_goal_iteration, submitting:
confirmation_request
projection
context_delivery(delivery_mode="wake_with_context")

→ [CALL-E Runtime / iteration finalizer]
Update Goal status to waiting_user_input
Append Goal Events
Advance event cursor
Release iteration lease
Publish context.delivery

→ [MainAgent]
Wake on context.delivery
Read confirmation request and ask user

→ [User]
Confirm or decline

→ [API Runtime]
Start a new MainAgent turn

→ [MainAgent]
Call notify_goal(confirm/stop)

→ [CALL-E Runtime / notify_goal tool + GoalStore]
Append confirmed / stopped Goal Event
Set needs_dispatch = true
Dispatch another GoalAgent iteration
```

GoalAgent does not converse with users directly. It gives a structured confirmation request to Runtime; Runtime wakes MainAgent, which presents the question to the user.

### 3.6 Create a RunGroup and Queued Run

After confirmation or when preauthorization already exists:

```text
[GoalAgent]
Receive confirmed event or recognize existing preauthorization
Decide to execute outbound call
Call submit_voice_run

→ [CALL-E Runtime / submit_voice_run tool]
Validate Goal, RunSpec, target number, region, locale, runtime profile, SIP line, and authorization scope

→ [CALL-E Runtime / CalleRunRegistry]
Create or reuse RunGroup: singleton or multi_item

→ [CALL-E Runtime / CalleRunRegistry]
Create queued Run
Save RunSpec snapshot, target snapshot, and runtime config snapshot

→ [CALL-E Runtime / CalleRunRegistry]
Append run_queued and voice_run_requested Run Events
Put VoiceRunRequestedEvent into GoalAgent context queue
```

GoalAgent only selects parameters and calls the tool. Runtime deterministically creates the RunGroup, Run, and events.

### 3.7 GoalAgent Ends the Current Iteration

```text
[GoalAgent]
Call complete_goal_iteration:
iteration_status = waiting_event
related_run_ids = [...]
Then end this iteration without waiting for the call to finish

→ [CALL-E Runtime / GoalIterationEventBridge]
Collect VoiceRunRequestedEvent from context queue
Write run_id into GoalIterationRunResult

→ [CALL-E Runtime / GoalIterationRunner]
Apply Goal state and events
Advance Goal Event cursor
Release iteration lease
```

GoalAgent should not keep one model invocation open while waiting for the phone call. The real call has a separate asynchronous lifecycle.

### 3.8 Voice Runtime Starts the Real Outbound Call

```text
[CALL-E Runtime / CallEAgent]
After Goal iteration finishes, create background Voice Run lifecycle task for run_id

→ [Voice Runtime / VoiceRunExecutor]
Load queued Run and RunSpec
Claim Run and change status from queued to running

→ [Voice Runtime / BotlabVoiceEngineProvider]
Create or reuse Botlab Voice Agent / Version from RunSpec instruction

→ [Voice Runtime / CallingVoiceDialerProvider]
Create dialing task in Calling

→ [Calling Provider]
Return task_id

→ [Voice Runtime / CalleRunRegistry]
Write:
external_provider = calling
external_run_id = Calling task_id
external_status = created
status = running
and append Provider/Run Events
```

The business trigger comes from GoalAgent, but creating the Voice Agent, invoking Calling, and updating the Run belong to Voice Runtime.

### 3.9 Real-Time Events, Transcript, and Terminal State

```text
[Calling + DM Realtime]
Conduct real phone call
Produce status, real-time call events, ASR, and final CallDetail

→ [Voice Runtime / BotlabCallingVoiceRunExecutor]
Listen to DM realtime event
Poll or refresh Calling task detail
Normalize status and determine result

→ [Voice Runtime / CalleRunRegistry]
Write result into Run:
transcript_snapshot
result_payload
evidence_refs
provider diagnostics
Calling call_id
terminal status
ended_at
At the same time, append Run Events

→ [Voice Runtime / CalleGoalStore]
Append Goal Event based on terminal Run state:
run_completed or run_failed
and request_dispatch(goal_id)
```

A terminal Run does not mean the Goal automatically completes. An unanswered call may trigger a retry, and a successful call may be only one item in a batch.

### 3.10 GoalAgent Decides the Next Step from the Result

```text
[CALL-E Runtime / CallEAgent]
Discover terminal_goal_event_id
Invoke GoalIterationRunner again

→ [CALL-E Runtime / GoalIterationRunner]
Claim new iteration
Load run_completed / run_failed Goal Event
Restore the same GoalAgent Session

→ [GoalAgent]
Evaluate Run result and evidence, then decide to:
Complete Goal
Retry the same RunSpec
Create a new RunSpec version and retry
Execute fallback
Continue to the next item in the batch
Or generate the final Report
```

Retrying is GoalAgent's business decision, but new RunSpecs and Runs are still created through Runtime tools.

### 3.11 Report and Goal Completion

If the Goal has reached a terminal state:

```text
[GoalAgent]
Organize report content and call commit_report

→ [CALL-E Runtime / commit_report tool + ReportStore]
Persist Report record and workspace content
Return report_id and artifact ref

→ [GoalAgent]
Call complete_goal_iteration, submitting:
goal_state_patch(current_status=completed/failed)
events_to_emit
artifact_refs
projection
context_delivery(
  kind=report_ready/result,
  delivery_mode=wake_with_context
)

→ [CALL-E Runtime / iteration finalizer]
Apply Goal state update
Append Goal Events
Advance dispatch cursor
Release iteration lease
Construct ContextDelivery
```

GoalAgent's ordinary assistant text cannot directly become the final business result. It must submit structured state and a delivery request through `complete_goal_iteration` for Runtime to apply.

### 3.12 Runtime Wakes MainAgent and Produces the Final Message

```text
[CALL-E Runtime / CallEAgent]
Publish ContextDelivery as Session Event:
type = context.delivery

→ [CALL-E Agent Result Wrapper / TurnPump]
Recognize delivery_mode = wake_with_context
Set trigger_next_turn = true
Convert Runtime Context Delivery into MainAgent input

→ [MainAgent]
Read result summary and Report, Run, and Evidence references
Generate a genuinely user-facing natural-language response

→ [API Runtime / SSE]
Persist and push assistant message to CALL-E Web

→ [User]
See final result
```

Thus, GoalAgent produces result facts and delivery intent, while MainAgent handles the final user-facing expression.

## 4. Responsibility Boundary Cheat Sheet

| Action | Who makes the business decision | Who actually executes it |
|---|---|---|
| Understand user objective | MainAgent | MainAgent loop |
| Form GoalBrief | MainAgent + planner skill | MainAgent |
| Create Goal | MainAgent | `commit_goal` tool + GoalStore |
| Start GoalAgent | Runtime | CallEAgent + GoalIterationRunner |
| Generate script | GoalAgent | GoalAgent + sandbox filesystem |
| Create RunSpec | GoalAgent | `create_run_spec` tool + RunSpecStore |
| Request user confirmation | GoalAgent | Runtime delivers to MainAgent; MainAgent asks |
| Record user confirmation | User decides; MainAgent forwards | `notify_goal` tool + GoalStore |
| Initiate outbound call | GoalAgent | `submit_voice_run` tool |
| Create RunGroup / Run | GoalAgent supplies parameters | CalleRunRegistry |
| Start background voice task | Runtime | CallEAgent background task |
| Create Voice Agent | Voice Runtime | Botlab Provider |
| Create dialing task | Voice Runtime | Calling Provider |
| Monitor call result | Voice Runtime | Realtime stream + Calling refresh |
| Write Transcript / Result | Voice Runtime | CalleRunRegistry |
| Decide retry or completion | GoalAgent | Next Goal Iteration |
| Update final Goal state | GoalAgent submits patch | Runtime finalizer + GoalStore |
| Generate report | GoalAgent organizes content | `commit_report` tool + ReportStore |
| Wake MainAgent | GoalAgent declares delivery | Runtime publishes context.delivery |
| Produce user response | MainAgent | API Runtime persists and pushes |

## 5. Understanding It Through a Batch of Restaurant Calls

Suppose the user says:

> Call three restaurants, ask whether they have a table for six tonight, and summarize the results for me.

The system can form:

```text
Chat Session
└── Goal
    objective = Find an available table for six tonight

    RunGroup(kind=multi_item)
    ├── item: restaurant-A
    │   ├── RunSpec: Script for A
    │   └── Run: Actual call to A
    │       └── Calling task_id / call_id
    │
    ├── item: restaurant-B
    │   ├── RunSpec: Script for B
    │   └── Run: Actual call to B
    │       └── Calling task_id / call_id
    │
    └── item: restaurant-C
        ├── RunSpec: Script for C
        └── Run: Actual call to C
            └── Calling task_id / call_id

    Report
      Comparison of the three results, evidence, and recommended next step
```

If A does not answer, only A's Run enters a failed or unanswered terminal state. GoalAgent can still continue with B and C and decide whether to retry A according to the Goal's constraints. The Goal enters its final state only after GoalAgent considers all Runs, success criteria, and evidence together.

## 6. Where the Current Runtime Lives in the Code

The logical `CALL-E Runtime` is not currently an independent external service. It is primarily composed of:

```text
CallEAgent
  Foreground MainAgent wrapper, background Goal Dispatch, Voice lifecycle scheduling

GoalIterationRunner
  Lease, cursor, GoalAgent Session, iteration input, and finalization

Goal/Run/Report Tools
  Deterministic boundaries callable by Agents

GoalStore / RunSpecStore / CalleRunRegistry / ReportStore
  Data persistence and concurrency control

VoiceRunExecutor
  Voice Runtime routing, Provider calls, result collection, and state persistence

SessionEventPublisher / TurnPump
  Session Events, Context Delivery, MainAgent wake-up, and user output
```

Current Goal Dispatch and Voice lifecycle work is primarily carried by in-process `asyncio` background tasks. Conceptually, they belong to Runtime; in deployment terms, they are not yet an independent persistent Worker queue.

## 7. Final Mental Model

The following definitions can quickly locate any log, table, or code:

```text
Session
  Container for user interaction and MainAgent context

Goal
  WHAT: long-running task and its product state

GoalBrief
  Stable objective contract after intake completes

Goal Event
  Goal-level facts, input, and business audit log

Goal Iteration
  One round of progress after Runtime wakes GoalAgent

RunSpec
  HOW: reusable, versionable execution plan

RunGroup
  Organization and confirmation scope for a set of related Runs

Run
  One real execution or attempt

Run Event
  Internal state and Provider events for one execution

Call
  Concrete dialing and call record in an external Provider for a voice-type Run

Artifact
  Large content such as scripts, raw Provider data, and recording references

Report
  User-facing result artifact

Context Delivery
  Structured envelope through which GoalAgent delivers results or requests to MainAgent via Runtime
```

The essence of this structure is not introducing more terminology, but separating model judgment from real-world side effects: Agents can understand, plan, and evaluate, but every state change, outbound call, callback, retry, and result delivery must pass through a verifiable, recoverable Runtime boundary.
