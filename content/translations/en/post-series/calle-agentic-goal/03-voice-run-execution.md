---
title: "Tracing RunSpec → Run → VoiceRunExecutor—How a Real Phone Call Is Executed Safely"
summary: "Follow an execution strategy from GoalAgent to Botlab and Calling, explaining RunSpec versions, Run snapshots, asynchronous submission, state transitions, evidence, and terminal handoff."
---

This article is based on `prod-dive-in` commit `aa7af64`. The previous article stopped where `GoalIterationRunner` returned `voice_run_ids`. This one continues downward, following a voice execution strategy as it becomes a durable Run and eventually creates a Botlab Voice Agent and a Calling dialer task.

If you are new to source reading, begin with one sentence: **a RunSpec is a reusable, versioned execution instruction; a Run freezes one objective, configuration, and instruction version into one real attempt; VoiceRunExecutor is the component that crosses the external side-effect boundary.**

## 1. What this article explains

Continue with the restaurant example. GoalAgent has decided to call and ask whether a table for two is available tomorrow at 7 PM, but a long path remains between “decide to call” and actual dialing:

- What exactly should the phone Agent say, and where is it stored?
- After the strategy changes, how can an old Run prove which version it used?
- Can a repeated click or model retry create two identical calls?
- Has the phone call started when `submit_voice_run` returns?
- Who hands a `queued` Run to the actual voice executor?
- Where are the external task ID, transcript, and raw response stored?
- How does GoalAgent learn that it should evaluate the result after the call ends?

Those questions map to three different objects:

| Object | Central question | Does it represent a real-world side effect? |
|---|---|---|
| RunSpec | How should this kind of call be executed? | No |
| Run | Who should be contacted with which version and configuration this time? | Not yet; initially it is only a `queued` record |
| VoiceRunExecutor | How are an external Agent and dialer task created and their terminal result collected? | Yes |

This article follows the main outbound real-call path. It points out relevant inbound hotline and multi-target batch differences without letting them replace the main thread.

## 2. Start with the complete call chain

Compress one successful single-target phone call into this picture:

```text
OutboundGoalAgent
  ├─ Use voice-agent-run-strategy to form a call strategy
  ├─ Write goals/{goal_id}/run_specs/.../voice_instruction.yaml
  ├─ create_run_spec(...)
  │    ├─ Validate the workspace path
  │    ├─ Compute the instruction checksum
  │    ├─ Create / reuse CalleRunSpec
  │    └─ APPEND Goal Event: run_spec_created
  ├─ Wait for confirmation, or decide that the request is preauthorized
  └─ submit_voice_run(...)
       ├─ Resolve target, runtime profile, and SIP line
       ├─ ensure RunGroup
       ├─ create Run(status=queued)
       ├─ APPEND Run Event: run_queued
       ├─ APPEND Run Event: voice_run_requested
       └─ emit VoiceRunRequestedEvent / pending_voice_run_ids

Goal iteration product transaction commits
  ▼
CallEAgent._schedule_voice_run_lifecycles(...)
  ▼
VoiceRunExecutor.submit(run_id)
  ▼
BotlabCallingVoiceRunExecutor
  ├─ claim queued → running
  ├─ Verify the frozen RunSpec checksum
  ├─ Botlab: create voice agent
  ├─ Calling: create dialer task
  ├─ Realtime event stream + Calling result polling
  ├─ Store transcript / raw evidence / terminal status
  └─ APPEND Goal Event: run_completed or run_failed
                         request_dispatch=true
  ▼
Enter GoalIterationRunner again
```

The most important boundary in the chain is this: `submit_voice_run` **registers and requests asynchronous execution**. It does not wait for the call to finish. A post-commit background lifecycle performs the external calls.

## 3. What RunSpec, Run, and Run Event each store

On a first reading, it is easy to treat all three names as one “phone task table.” A software-release analogy helps:

```text
RunSpec ≈ versioned release configuration
Run     ≈ one deployment instance
RunEvent≈ the timeline of that deployment
```

Mapped back to the restaurant call:

- RunSpec: the opening, questions, boundaries, and stop conditions;
- Run: use RunSpec v2 to dial `+1...`, target Northstar Bistro, with a particular frozen runtime profile;
- Run Event: queued, running, Voice Agent created, dialer task created, transcript available, and call ended.

`CalleRunRecord` also aggregates the current result, evidence references, transcript snapshot, external provider, and external task ID. Events provide history; Run provides a fast current snapshot. Neither replaces the other.

## 4. GoalAgent writes a strategy artifact instead of putting a large prompt in tool arguments

Outbound GoalAgent instructions say that once ready, it should load `voice-agent-run-strategy` and write RunSpec YAML under:

```text
goals/{goal_id}/run_specs/{slug}/voice_instruction.yaml
```

It then passes only small fields such as `instruction_path`, description, and optional title to `create_run_spec`. Conceptual YAML might look like:

```yaml
bot_name: RestaurantAvailability
task_base_prompt: |
  Call Northstar Bistro.
  Ask whether a table for two is available tomorrow at 7 PM.
  Record deposit or minimum-spend requirements.
  Do not make a reservation without additional authorization.
```

This separates two kinds of data:

| Data | Location |
|---|---|
| Longer execution instructions that an Agent can inspect and revise | Goal workspace artifact |
| Identity, version, and references required by the database and APIs | RunSpec record |

The tool does not accept an arbitrary file path. `_read_instruction_artifact()` allows only the `goals/` root within the current Goal scope. It rejects absolute paths, `../` traversal, and files owned by another Goal. An empty file also fails.

## 5. How create_run_spec turns a file into a durable version

`create_run_spec` reads the artifact and computes a SHA-256 checksum. For a voice RunSpec, the Store records:

- `spec_kind="voice_call"`;
- `executor_kind="voice_agent"`;
- `instruction_ref` and `instruction_checksum`;
- `lineage_id`, `version`, and `status`;
- `runtime_profile_key`;
- `input_refs.workspace_refs`;
- `generated_by="OutboundGoalAgent"`;
- Goal Event `run_spec_created`.

Two version concepts must be kept separate:

```text
lineage_id: the family across the long-term evolution of one strategy
version:    this version's position within that family
```

With `activate=true`, a new version marks the previous active version in the same lineage as superseded and records `supersedes_run_spec_id`. This makes the currently executable version explicit while preserving history referenced by older Runs.

The tool first searches active or draft candidates by `instruction_checksum + runtime_profile_key`. A retry with the same artifact returns the existing `run_spec_id` and `reused=true` instead of manufacturing another version.

## 6. Creating a RunSpec does not authorize dialing

A RunSpec is an inspectable execution proposal, not the call itself. Outbound instructions describe two paths:

- A complete, immediate, single-recipient request is normally considered preauthorized.
- Ambiguity, safety or compliance risk, future scheduling, batch execution, or another non-obvious irreversible action requires confirmation.

When confirmation is required, GoalAgent uses `run_spec_id` as the immutable authorization subject that MainAgent presents to the user. Only that approved version can be submitted. A new ID or version created after confirmation cannot borrow approval from the old one.

The current source boundary must also be described precisely: `submit_voice_run()` validates scope, RunSpec identity, target, and runtime configuration, but it does not query a durable “user approved” table. The calling GoalAgent is responsible for following confirmation or preauthorization policy. In other words:

```text
Agent policy decides “may I invoke it now?”
Tool boundary guarantees “what exactly will this invocation execute and persist?”
```

Do not mistake the calling-agent responsibility in the tool description for an independently implemented runtime authorization ledger.

## 7. First layer of submit_voice_run: reject ambiguous targets

`SubmitVoiceRunArgs` includes at least `goal_id`, `run_spec_id`, and a `RunTargetSnapshot`. The target snapshot can preserve display name, phone number, region, timezone, call locale, and per-target task, opening, or question wording.

Before it creates a Run, the tool:

1. verifies that the invocation scope may operate only on the current Goal;
2. normalizes the phone number to a unique E.164 number;
3. checks for conflict between number region and explicit region;
4. requires an active voice RunSpec owned by the current Goal;
5. resolves a voice runtime profile from target region and locale;
6. verifies that the profile supports the target language and region;
7. resolves a SIP line from explicit input or OAuth user company and line configuration.

A bare number such as `15517028333` is therefore not dialed by guesswork here. The earlier target-preparation stage must resolve it into a unique E.164 number such as `+8615517028333`.

## 8. Why the runtime profile is resolved and then frozen

A voice runtime profile describes actual execution infrastructure, including:

- engine kind and Botlab voice configuration;
- dialer kind, region, timezone, and scheduling window;
- supported locales;
- Calling line region;
- polling and wait parameters.

`submit_voice_run` resolves the active profile first. `CalleRunRegistry.create_run()` then saves the resolution under `RunInputPayload.runtime_config.voice_runtime_profile` as a Run snapshot.

This solves a time problem. If an administrator changes the profile after the call is queued, this Run should execute with the configuration that existed at submission, not silently drift to whatever is latest at startup. The snapshot contains config key, entry ID, version, scope, checksum, and payload, making later backend, language, and dialer choices auditable.

## 9. Why even one phone call has a RunGroup

`submit_voice_run` first ensures a `RunGroup`. An ordinary restaurant call uses:

```text
kind = singleton
item_key = primary
lifecycle = finite
status = running
```

A RunGroup can seem redundant for one attempt, but it provides one aggregation boundary for batches. Several supplier calls can share one `multi_item` group, each with a stable `run_group_item_key`. Only after every item is terminal does the runtime emit one `run_group_completed` Goal Event.

For batches, the code also protects a subtle semantic rule: if each recipient has different task, opening, live-message, or question wording, they cannot pretend to share one RunSpec. Separate wording requires separate RunSpecs.

## 10. Which identities create_run freezes

`CalleRunRegistry.create_run()` creates a `queued` Run under the Goal row lock and fixes these fields:

| Field | Meaning |
|---|---|
| `run_spec_id` | Selected concrete RunSpec |
| `run_spec_lineage_id/version/checksum` | Strategy identity at submission |
| `target_snapshot` | Actual contact target for this attempt |
| `runtime_config` snapshot | Actual configuration version for this attempt |
| `run_group_id/item_key` | Aggregation and batch identity |
| `trigger_kind/ref` | Who triggered it and why |
| `status="queued"` | Registered but not yet executed |

It also appends a `run_queued` Run Event. Notice that Run holds snapshots. A later superseded RunSpec, changed contact record, or updated runtime profile must not rewrite this queued attempt's history.

## 11. What the two idempotency layers protect

The chain has two different kinds of deduplication.

### RunSpec deduplication

The same instruction checksum and runtime profile reuse an existing active or draft RunSpec.

### Run deduplication

One Run's idempotency key is derived from stable information:

```text
goal_id + run_group_id + run_group_item_key + target_digest
```

`target_digest` prefers `target_ref`, then phone hash, phone number, or complete target JSON. `create_run()` queries the key under the Goal lock and returns the original Run on retry.

The `voice_run_requested:{run_id}` Run Event idempotency key then prevents the same queued Run from receiving duplicate execution requests. The `submit_requested` response field tells the caller whether this invocation produced a new request.

These mechanisms protect CALL-E's durable registration. They do not prove provider-side, end-to-end exactly-once behavior. External side-effect crash windows are discussed separately below.

## 12. submit returns queued, not “the call has started”

After creating the Run, the tool performs only three scheduling-related actions:

```text
APPEND Run Event: voice_run_requested
add run_id to AgentCTX.pending_voice_run_ids
write VoiceRunRequestedEvent(run_id) to the context queue
```

It immediately returns:

```json
{
  "run_id": "run_restaurant_01",
  "run_spec_id": "rspec_restaurant_v2",
  "run_group_id": "rgroup_restaurant",
  "run_group_item_key": "primary",
  "status": "queued",
  "submit_requested": true
}
```

There is no Botlab Agent and no Calling task yet. Product copy may say “queued” or “will start,” but not “connected” or “completed.” This is the most important semantic boundary between submit and actual execution.

## 13. Why the lifecycle starts only after the Goal iteration commits

As the previous article showed, `GoalIterationRunner` collects Run IDs from the context queue and `pending_voice_run_ids` into `GoalIterationRunResult.voice_run_ids`. Only after the product transaction commits does `CallEAgent` execute `schedule_pending_work()`:

```text
Goal iteration COMMIT
  ↓
read result.voice_run_ids
  ├─ if empty, query queued voice Runs from the database
  ↓
_schedule_voice_run_lifecycles(run_ids)
```

The database fallback matters. The in-process queue is a fast handoff, not the source of truth. If a tool transaction created a queued Run but the iteration failed before it collected the memory event, a later successful dispatch can still recover that Run by querying the database.

This also explains why `submit_voice_run()` must not dial inline. A tool transaction may still roll back, but an external call cannot be undone by a database rollback. Persisting a durable Run before the side effect at least gives the real-world action a traceable local identity.

## 14. VoiceRunExecutor is the backend routing layer

`VoiceRunExecutor` itself is thin. It reads the Run first:

- terminal: return the current status immediately;
- `running`: `submit()` also returns immediately to avoid recreating resources;
- `queued`: select a backend from the frozen profile;
- anything else: reject it.

The backend key is:

```text
(voice_profile.engine.kind, voice_profile.dialer.kind)
```

The default registration is `("botlab", "calling") → BotlabCallingVoiceRunExecutor`. The Run records the desired capability combination, the facade selects the implementation, and GoalAgent remains independent of provider SDK details.

## 15. queued → running: the local Claim before side effects

`BotlabCallingVoiceRunExecutor.submit()` begins with `claim_queued_run()`. The Store locks the Run row and allows only:

```text
queued → running
```

If it is already `running` or terminal, it returns `claimed=false`. Only one caller can cross this gate. A successful Claim stores `started_at` and a `run_status_updated` Event.

The Executor then rereads the RunSpec instruction and checks all of these together:

1. the `run_spec_checksum` frozen in Run;
2. the checksum currently stored in the RunSpec record;
3. the actual hash of inline instruction, when present;
4. the actual hash of the workspace artifact, when present.

Any mismatch fails before a provider call. Even if the YAML file is changed after queueing, this Run does not silently execute the new content.

The Executor appends `voice_run_started` and commits the `running` state before invoking a provider. An external system therefore does not receive a call with no corresponding local Run record.

## 16. The two Provider calls that cross the side-effect boundary

The Botlab + Calling backend creates external resources in two steps:

```text
engine_provider.create_agent(...)
  ├─ Read the RunSpec base prompt
  ├─ Merge voice runtime core / channel rules / output contract
  └─ Create a Botlab Voice Agent and version

dialer_provider.create_task(...)
  ├─ Resolve the Calling robot_id
  ├─ Compute a schedule window from the IAMS account timezone
  ├─ Bind SIP line and target E.164 number
  └─ Create the Calling dialer task
```

Each step is followed by Run Events and a commit:

- `voice_agent_created` records provider, agent ID, and version ID;
- `voice_dialer_task_created` records Calling `task_id` and robot ID;
- the Run snapshot stores `external_provider`, `external_run_id`, and `external_status`.

Prompt responsibility is layered here as well. RunSpec contains only the restaurant-specific task. Voice runtime uniformly injects IVR, voicemail, screening, live-human, weak-signal, and output-contract rules. GoalAgent does not copy shared transport behavior into every RunSpec.

## 17. Why terminal state listens to both realtime events and polling

After creating the dialer task, the Executor starts two operations in parallel:

- the DM realtime Event stream;
- Calling task-detail polling.

Realtime has low latency and supplies ASR and progress Events. Calling final detail commonly has more complete provider status, call IDs, hangup data, and transcript. The code does not permanently trust whichever returns first. It uses a race grace window and attempts to reconcile a realtime terminal result with Calling final detail.

Conceptually:

```text
               ┌─ DM realtime ── progress events / fast terminal ─┐
Calling task ──┤                                                  ├─ status decision
               └─ Calling polling ─ final detail / transcript ───┘
```

If realtime is unavailable, the system records an internal `dm_realtime_unavailable` Event and continues through Calling detail. Realtime is enhanced evidence, not the only completion path.

## 18. Terminal state is a body of evidence, not one status string

`_apply_dialer_result()` maps a provider result into internal Run state and persists:

- a raw provider JSON artifact;
- a normalized transcript artifact;
- realtime raw and transcript artifacts, when available;
- `RunTranscriptSnapshot`;
- `RunEvidenceRefs`;
- `RunResultPayload` with outcome, summary, reason bucket, and provider diagnostics;
- Run Events such as `transcript_ready` and `voice_call_completed`;
- a user-facing `voice_run.update` Session Event.

Terminal status includes more than success and failure: `COMPLETED`, `FAILED`, `NO ANSWER`, `DECLINED`, cancellation, and timeout forms all count. Most importantly, a completed provider lifecycle is not the same as a successful user objective. `NO ANSWER` can be terminal for the Run while GoalAgent chooses to retry. Even `COMPLETED` requires transcript evidence to determine whether the restaurant answered the question.

The Executor therefore records structured facts and evidence. It does not replace GoalAgent's final business judgment.

## 19. How a completed call wakes GoalAgent again

When Run becomes terminal, the Executor appends a Goal Event:

```text
failure terminal → run_failed
other terminal   → run_completed
```

The Event payload contains `run_id`, status, and available evidence references, and it sets:

```text
request_dispatch = true
```

The `needs_dispatch` from Part 1 becomes true again. The `GoalIterationRunner` from Part 2 reads this terminal Event after its Cursor. The complete loop is:

```text
GoalAgent decides to execute
  → queued Run
  → VoiceRunExecutor
  → terminal Run + evidence
  → Goal Event(request_dispatch=true)
  → next GoalAgent cycle decides retry, wait, or completion
```

For a singleton, one terminal Run wakes the Goal. For a `multi_item` RunGroup, only the first point where all items are terminal appends `run_group_completed`, avoiding an incomplete summary cycle for every batch item.

When `CallEAgent._run_voice_run_lifecycle()` receives a `terminal_goal_event_id`, it immediately calls `_run_goal_dispatch(goal_id)`, turning the durable wake-up signal into the next actual iteration.

## 20. The real boundary of failure recovery and exactly-once

The backend catches ordinary provider exceptions. `_mark_failed()` performs:

```text
Run.status = FAILED
APPEND Run Event: run_failed
APPEND Goal Event: run_failed, request_dispatch=true
COMMIT
return terminal VoiceRunExecutionResult
```

Configuration errors, Botlab creation failures, and Calling failures can therefore flow back to GoalAgent instead of leaving Run permanently unknown.

Source-level understanding must ask one more question: what if the process crashes immediately after an external side effect? The current implementation reduces the window with a Run idempotency key, a `queued → running` Claim, staged commits, and persisted external IDs, but it cannot claim end-to-end exactly-once:

- a Botlab Agent may exist if the process dies before `voice_agent_created` commits;
- a Calling task may exist if the process dies before `external_run_id` is saved;
- if Run is durably `running` but has no `external_run_id`, `refresh()` has no provider task to query.

Once `external_run_id` is durable, `refresh()` can resume polling without recreating the Agent or task. Earlier crash windows need a provider idempotency key, reconciliation by `run_id`, or operational recovery to close completely. This commit does not show a complete automatic reconcile for them.

The accurate conclusion is: **CALL-E has a reliable local identity, state machine, and evidence chain, but “an external side effect can never repeat” cannot be inferred from a database transaction alone.**

## 21. Validate the mental model with tests and source

Start with these behavior tests:

| Test | Contract it fixes |
|---|---|
| `test_create_run_spec_tool_reads_goal_workspace_artifact_and_reuses_checksum` | Artifact scope, checksum, and RunSpec reuse |
| `test_submit_voice_run_queues_executor_request_for_selected_run_spec` | Queued Run, RunGroup, and asynchronous request |
| `test_submit_voice_run_rejects_invalid_run_spec_identity_without_side_effects` | Invalid spec fails before writes |
| `test_create_run_snapshots_selected_run_spec_and_is_idempotent` | Frozen RunSpec identity and Run deduplication |
| `test_create_run_freezes_runtime_profile_snapshot` | Configuration snapshot does not drift with later edits |
| `test_voice_run_executor_rejects_instruction_identity_before_provider_calls` | Checksum mismatch never touches a provider |
| `test_voice_run_executor_commits_started_state_before_provider_calls` | Commit running before external side effects |
| `test_voice_run_executor_writes_events_artifacts_and_terminal_goal_event` | Terminal state, evidence, and Goal wake-up loop |
| `test_voice_run_executor_refreshes_existing_running_task_without_recreating` | Refresh an existing external task without recreating it |

Read the source in this order:

1. `agentic/instructions/domain/outbound.md` and `agentic/skills/voice-agent-run-strategy/SKILL.md`
2. `agentic/tools/goals/voice_run.py`
3. `agentic/runs/spec_store.py` and `agentic/runs/registry.py`
4. `schemas/agentic/run.py` and `db/models/run.py`
5. post-commit scheduling in `agentic/agents/calle.py`
6. `voice_runtime/executor/__init__.py`
7. `voice_runtime/executor/botlab_calling.py`
8. `voice_runtime/executor/providers.py`, `prompt.py`, and `botlab.py`
9. `tests/test_calle_agentic_run_store.py` and `tests/test_calle_voice_runtime.py`

Paths are relative to `services/seleven-mcp/src/calle/`, except for tests. The source will continue to change, so symbols and behavior tests are more useful than transient line numbers.

Finally, compress the article into six sentences:

1. RunSpec is an execution strategy with lineage, version, and checksum; it is not a phone call.
2. `submit_voice_run` validates target and configuration and creates a snapshotted `queued` Run without waiting for real execution.
3. RunSpec reuse, the Run idempotency key, and the `voice_run_requested` Event prevent duplicate registration at different layers.
4. Only after the Goal iteration commits does CallEAgent hand the Run to VoiceRunExecutor, which selects a backend from the frozen profile.
5. Botlab creates the Voice Agent, Calling creates and executes the dialer task, and realtime plus polling produce status, transcript, and evidence.
6. A terminal Run appends a `run_completed` / `run_failed` Goal Event and redispatches the Goal; only then does GoalAgent decide whether the objective is truly complete.

The next article starts from that terminal Goal Event and traces `Report → Context Delivery → MainAgent`: how evidence becomes a committed Report and how a background result reliably returns to the user conversation.
