---
title: "Part 1: Tracing commit_goal—How Goal, Event, and Dispatch Are Persisted"
summary: "Follow the path from MainAgent's tool call to three database tables, explaining commit_goal's transaction, idempotency, and asynchronous dispatch boundaries."
---

This article is based on `prod-dive-in` commit `aa7af64`. Instead of reading a single function in isolation, we will follow one real tool invocation and see how `commit_goal` turns a conversational objective into system state that can be persisted, retried, and handed to background execution.

If you are new to source reading, begin with one sentence: **`commit_goal` does not “start the phone call”; it reliably registers confirmed work in the Goal runtime.**

## 1. What this article explains

The user says, “Call the restaurant and ask whether it has a table for two tomorrow at 7 PM.” At first, that request is only conversational text. A background executor cannot safely start from it without also knowing:

- what outcome must ultimately be achieved;
- which facts have already been confirmed;
- which boundaries must not be crossed;
- how completion will be judged;
- whether a retry of the same tool call has already created a Goal;
- where background work should resume after the foreground response ends.

`commit_goal` sits on this boundary. Its input is a structured objective prepared by MainAgent. Its output is a persisted Goal and corresponding events. The actual GoalAgent iteration, RunSpec generation, and phone execution belong to later stages.

This article answers four central questions:

1. Why does MainAgent submit work instead of executing it?
2. What do `calle_goals`, `calle_goal_events`, and `calle_goal_dispatches` each store?
3. How do the tool transaction and `tool_call_id` prevent partial state and duplicate Goals?
4. When the foreground turn ends, how does the background know to start `GoalIterationRunner`?

## 2. Start with the complete call chain

Before opening every function, put the entry point, transaction boundary, and background handoff into one picture:

```text
root_orchestrator.md
  │  MainAgent decides that the objective is ready to commit
  ▼
create_commit_goal_tool()
  ▼
create_wrapped_tool(...)
  │  CommitGoalArgs.model_validate_json(...)
  ▼
commit_goal(...)
  ├─ get_committed_goal_for_session_by_idempotency_key(...)
  ├─ create_goal_for_session(...)
  │    └─ _create_goal_locked(...)
  │         ├─ INSERT calle_goals
  │         ├─ INSERT calle_goal_dispatches (needs_dispatch = false)
  │         └─ APPEND goal_created
  ├─ optional update_goal_state(...)
  │    └─ APPEND payload_updated (in this article's example)
  ├─ append_goal_event(event_type="goal_committed", request_dispatch=True)
  │    └─ calle_goal_dispatches.needs_dispatch = true
  └─ _track_pending_dispatch(...)

create_wrapped_tool commits the isolated tool transaction
  ▼
The foreground Agent turn completes
  ▼
CallEAgent.record_run_completion(...)
  ├─ commits the product-owned foreground transaction
  ├─ reads needs_dispatch from the database again
  └─ creates a background task that enters GoalIterationRunner
```

There is one subtle source-level detail here. `commit_goal` adds the `goal_id` to `AgentCTX.pending_dispatch_goal_ids`, but the current automatic scheduling path in `CallEAgent` does not directly consume that list. After commit, `record_run_completion()` calls `_pending_goal_dispatch_ids()` and **reads `needs_dispatch` from the database again**. The fact that actually crosses transaction and process boundaries is durable database state, not the in-memory list.

## 3. Why MainAgent can only “commit” a Goal

`root_orchestrator.md` defines MainAgent as the orchestration entry point for the CALL-E Agentic Runtime. It understands the user's objective, collects blocking information, selects a `goal_type`, and calls `commit_goal` when the work is ready. The same instructions explicitly prohibit it from placing calls, producing RunSpecs, retrieving evidence, or writing Reports.

This is separation of responsibility, not a lack of capability:

| Role | Question it owns |
|---|---|
| MainAgent | What is the user trying to accomplish, and is it sufficiently clear? |
| `commit_goal` | How is the confirmed WHAT written to durable state safely? |
| GoalAgent / Runner | How should the next step be planned, executed, or paused? |
| Voice runtime | How does one real phone call run? |
| Report path | How do results and evidence return to the user? |

If MainAgent started a phone call inside the conversational turn, model retries, network timeouts, or frontend disconnects could entangle “confirming user intent” with a real-world side effect. Committing a Goal first is like recording a traceable work order before a background consumer acts on it.

The instructions define another easy-to-miss product boundary: after `commit_goal` returns, MainAgent cannot claim that the phone task has started based on that result alone. A successful commit means that a Goal was registered and dispatch was requested. It does not mean that a Voice Run has been queued, connected, or completed.

## 4. The first boundary: CommitGoalArgs

`create_commit_goal_tool()` passes the tool name, description, `CommitGoalArgs`, and the `commit_goal` handler to the generic `create_wrapped_tool()`. Before the handler runs, model-generated JSON goes through:

`CommitGoalArgs.model_validate_json(input_json or "{}")`

`CommitGoalArgs` uses `extra="forbid"`, so undeclared fields are not silently ignored. Its main fields are:

| Field | Purpose |
|---|---|
| `objective` | The user-visible objective; it cannot be empty |
| `collaboration_context` | Context passed on the first GoalAgent dispatch; currently contains `response_language` |
| `goal_type` | The objective type used by the dispatch registry; defaults to `one_shot_outbound` |
| `project_id` | Optional project ownership |
| `brief` | An optional but stable WHAT contract represented by `GoalBrief` |

Conceptually, the restaurant example would produce tool arguments like these:

```json
{
  "objective": "Call Northstar Bistro and confirm whether it has a table for two tomorrow at 7 PM",
  "collaboration_context": {
    "response_language": "English"
  },
  "goal_type": "one_shot_outbound",
  "project_id": null,
  "brief": {
    "objective": "Confirm table availability for two at Northstar Bistro tomorrow at 7 PM",
    "facts": {
      "venue": "Northstar Bistro",
      "party_size": 2,
      "requested_time": "tomorrow 19:00 America/Los_Angeles"
    },
    "constraints": [
      "Do not make a reservation without another user confirmation"
    ],
    "success_criteria": [
      "The restaurant clearly states whether a table is available",
      "Record any deposit or minimum-spend requirement"
    ],
    "narrative": "The user is comparing dinner options and wants availability first.",
    "source_refs": [
      "chat://session-restaurant/messages/1"
    ]
  }
}
```

`GoalBrief` is not an execution script. It describes the stable WHAT: an `objective`, known `facts`, `constraints`, observable `success_criteria`, optional background in `narrative`, and `source_refs`. How the phone prompt is written, whether a retry is needed, and how a Run is arranged remain decisions for downstream domain agents.

There are also two different meanings of “language.” `collaboration_context.response_language` constrains CALL-E's user-facing prose. It is not the callee's language, and it does not automatically authorize translating names or identifiers grounded in source material.

## 5. The second boundary: Tool Wrapper and the transaction

`create_wrapped_tool()` does more than adapt a Python function into a `FunctionTool`. When the context has an `AgentCTX`, a `memory_engine`, and a current `db_session`, `_invocation_tool_context()` creates an isolated `AsyncSession` for that tool invocation and installs a new `CalleGoalStore` into the copied context.

The transaction semantics can be understood through the following **conceptual pseudocode**. This is not a verbatim copy of the implementation:

```python
# Pseudocode: illustrates transaction ownership and is not directly executable
with isolated_tool_session() as db_session:
    try:
        args = CommitGoalArgs.validate(tool_json)
        response = await commit_goal(context_with(db_session), args)
    except Exception:
        await db_session.rollback()
        raise
    else:
        await db_session.commit()

return serialize(response)
```

The repeated `flush()` calls inside `commit_goal()` and the Store therefore send SQL through the current transaction; they are **not the final commit**. On the isolated-tool path, the wrapper owns `db_session.commit()` and performs a uniform `rollback()` on exceptions.

The source also preserves contexts where no isolated session is created. If those preconditions are absent, the wrapper yields the original `ToolContext`, and the outer product flow owns the transaction. The accurate statement is not “`commit_goal` commits the transaction itself,” but “the transaction owner that invoked it decides when to commit.”

## 6. commit_goal begins by checking idempotency

After entering `commit_goal()`, the first important action is not creating a Goal. It derives a commit idempotency key from `tool_call_id`:

`commit_goal:{tool_call_id}:committed`

For the restaurant example, assume `tool_call_id = call_restaurant_01`. The key becomes:

`commit_goal:call_restaurant_01:committed`

`get_committed_goal_for_session_by_idempotency_key()` then:

1. locks the current session row;
2. joins `calle_goals` and `calle_goal_events`;
3. finds the first event in that session with `event_type = goal_committed` and the same idempotency key;
4. returns the original Goal and Event immediately if it finds one.

Why query an Event instead of only querying the Goal? “This Goal exists” and “this particular tool submission completed successfully” are different facts. The `goal_committed` event records the tool invocation's idempotency key, so it can serve as the retry receipt.

Locking the session row also matters under concurrency. Two identical submissions arriving at the same time cannot both pass the lookup and independently create results. After the first transaction completes, the second lookup can see the committed event.

## 7. What happens to the three tables when a Goal is created

When no idempotent record is found, `commit_goal()` first checks for an active Voice Run in the session and then calls `create_goal_for_session()`. The Store locks the session and enters `_create_goal_locked()`.

For a brand-new restaurant objective, the three tables change like this:

| Table | Before the call | After `_create_goal_locked()` | After `commit_goal()` completes |
|---|---|---|---|
| `calle_goals` | No such Goal | New snapshot: `planning`, `goal_version=1`, `state_revision=1` | `brief` stored in `payload`; `state_revision=2` in this example |
| `calle_goal_dispatches` | No such Goal | New consumer state: `idle`, cursor `0`, `needs_dispatch=false` | `needs_dispatch=true` |
| `calle_goal_events` | No events for this Goal | Append `goal_created` | Append `payload_updated`, then `goal_committed` |

The tables have three different roles. Goal is the current snapshot, Event is the append-only history of what happened, and Dispatch records how far the background consumer has progressed and whether it needs waking.

### 7.1 calle_goals: create the current snapshot

The `CalleGoal` primary key comes from `generate_goal_id()`. The new row records session, tenant, user, project, `goal_type`, and `objective`, with these initial values:

- `current_status = "planning"`;
- `goal_version = 1`;
- `state_revision = 1`;
- `payload` is initially empty.

`goal_version` is closer to the version of the user-visible objective contract, while `state_revision` supports concurrent-update checks. When the brief is stored later, the objective text has not changed, so this example increments only `state_revision`, not `goal_version`.

### 7.2 calle_goal_dispatches: create idle consumer state first

`_ensure_goal_dispatch_row()` immediately creates a Dispatch row for the same `goal_id`:

- `last_processed_goal_event_id = 0`;
- `active_iteration_id = null`;
- `iteration_status = "idle"`;
- `needs_dispatch = false`.

Why is it not `true` as soon as the Goal exists? At this point, the system has only initialized the base object. `GoalBrief` and `goal_committed` have not been written yet. If a background consumer saw dispatchable work too early, it could read a partial Goal.

### 7.3 calle_goal_events: append goal_created

Finally, `_create_goal_locked()` appends `goal_created` under a system actor:

- `from_goal_version` and `from_state_revision` are both `null`;
- `to_goal_version = 1`;
- `to_state_revision = 1`;
- the payload records `reason = goal_created`.

This event means “the domain object was created.” It does not mean “the user's objective is ready for dispatch,” so it does not enable `needs_dispatch`.

## 8. Why GoalBrief produces payload_updated

After creating the base Goal, `commit_goal()` compares the supplied arguments with the current snapshot:

- the new Goal's `objective` already equals `args.objective`, so it usually needs no second update;
- an outbound Goal remains in `planning`;
- when a `brief` is supplied, `_payload_with_brief()` preserves other payload keys and sets `payload.brief`.

If the old and new payloads differ, the function calls `update_goal_state()`. The Store uses `expected_state_revision` for an optimistic concurrency check, locks the Goal row, stores the payload, increments `state_revision` from 1 to 2, and appends a state-change event.

In this outbound example, `payload` is the only patch, so the event type is `payload_updated`. If the same patch had changed `objective` or `current_status` first, the Store would select `objective_updated` or `status_updated` according to the earlier change. It would be incorrect to assume that every update containing a brief must be named `payload_updated`.

This step pins `GoalBrief` into the current Goal snapshot. A downstream GoalAgent does not need to infer confirmed facts and boundaries from the entire chat history again.

## 9. How goal_committed opens the dispatch gate

Once the snapshot is ready, `commit_goal()` builds the `goal_committed` event payload with:

- `objective`;
- `goal_type`;
- `project_id`;
- `collaboration_context`;
- the optional `brief`.

It then calls:

`append_goal_event(event_type="goal_committed", request_dispatch=True)`

The event name itself does not magically open the gate. `request_dispatch=True` does. After appending the event, `append_goal_event()` calls `_mark_dispatch_needed()`, locks the Dispatch row, and sets `needs_dispatch` to `true`.

The three events mean different things:

| Event | What it proves | Requests dispatch? |
|---|---|---|
| `goal_created` | The Goal, initial Dispatch, and version 1 exist | No |
| `payload_updated` | The current snapshot's payload/brief changed | No, not in this invocation |
| `goal_committed` | This MainAgent submission is now a traceable fact | Yes; the call also sets `needs_dispatch=true` |

After writing, `commit_goal()` also puts the `goal_id` into `pending_dispatch_goal_ids` and returns the `goal_id`, `event_id`, `event_type`, current status, and `needs_dispatch`. That response helps the current turn understand the outcome, but the database Event and Dispatch are the durable facts.

## 10. Why repeated calls do not create repeated Goals

Suppose the model or network layer retries the same tool invocation with the same `tool_call_id = call_restaurant_01`:

```text
First invocation
  → idempotency key commit_goal:call_restaurant_01:committed
  → create goal_A
  → append goal_committed(event_3)

Retry with the same tool_call_id
  → find the same idempotency key
  → return goal_A + event_3
  → create no new Goal and append no new event

New tool_call_id = call_restaurant_02
  → derive a different idempotency key
  → treat it as a new submission that may create a new Goal
```

The retry branch also reads the current Dispatch. If `needs_dispatch` is still `true`, it records the Goal in the current context's pending list again. If the background has advanced the cursor and cleared the flag, the retry only returns the original result; an old retry does not wake the background again.

`append_goal_event()` also supports event-level idempotency keys, which provides a second layer of protection. In the normal `commit_goal()` retry path, however, the function has already returned from its opening lookup and does not repeat the creation flow.

Idempotency does not mean “merge requests whose text looks equal.” The source uses a stable `tool_call_id`. Two submissions with identical text but different `tool_call_id` values can become two distinct Goals when no other product constraint prevents them.

## 11. How the foreground turn hands work to the background

On the isolated-tool-session path, the wrapper first commits the `commit_goal` transaction. When the foreground Agent Run completes, `CallEAgent.record_run_completion()` also finishes the product-owned foreground transaction before scheduling background work.

The ordering matters:

1. commit foreground persistent state;
2. use a new database session in `_pending_goal_dispatch_ids()` to read the current Goal's Dispatch again;
3. return the `goal_id` only when `needs_dispatch=true`;
4. let `_schedule_goal_dispatches()` create a background task for each deduplicated Goal;
5. enter `_run_goal_iteration_once()` from `_run_goal_dispatch()`, handing control to `GoalIterationRunner`.

This is why `needs_dispatch` is a durable wake-up signal. Even if the in-memory list is lost, the system can still determine from the database that work is pending after the transaction commits. Conversely, if the database transaction rolls back, a temporary in-memory `goal_id` cannot cause a partial Goal to be dispatched because the scheduler reads the database again.

This article stops at that boundary. How the background acquires a lease, reads the Event cursor, and recovers or waits for the next event belongs to Part 2.

## 12. Failures and transaction rollback

Along the call chain, failures fall into roughly three layers:

| Failure location | Example | Result |
|---|---|---|
| Schema validation | Empty `objective`, unknown fields, or missing `collaboration_context` | The handler has not run, so no Goal write occurs |
| Domain / Store | Missing session, an active Voice Run, or a revision conflict | An exception is raised and the current tool transaction must not commit |
| Transaction commit | Database connection or commit failure | The wrapper rolls back the isolated session and re-raises the error |

Because all three tables are written in one tool transaction, a normal result cannot leave “a `calle_goals` row without `goal_created`,” nor can it leave “`needs_dispatch=true` but no successful `goal_committed`.” The multiple `flush()` calls allow later SQL to use keys and state generated earlier, but they do not break atomicity early.

There is also a design-level safety net: background scheduling reads the database after commit instead of trusting temporary in-memory state from tool execution. That makes a genuinely successful transaction a precondition for dispatch.

## 13. Verify the model with tests

`test_commit_goal_tool_commits_goal_and_requests_dispatch` in `tests/test_calle_agentic_goal_store.py` turns the important conclusions from this call chain into executable assertions:

- the returned `goal_id` begins with `goal_`;
- the returned event is `goal_committed`;
- the Goal's `payload.brief` equals the supplied brief;
- Dispatch has `needs_dispatch=true`;
- collaboration context can be recovered from durable events;
- after the cursor advances, `needs_dispatch` returns to `false`;
- retrying with the same `ToolContext` returns the same `goal_id` and `event_id`, and the Goal count remains 1;
- changing `tool_call_id` creates another Goal.

The test asserts the event list as:

`["goal_committed", "payload_updated", "goal_created"]`

Be careful here: `list_goal_events()` uses `event_id.desc()`, so it returns the **newest event first**. The real append order is the reverse: `goal_created`, then `payload_updated`, then `goal_committed`. Ignoring the query's sort direction makes it easy to read the call chain backward.

Another test, `test_ensure_goal_for_session_creates_compact_goal_and_event`, verifies the creation-stage defaults: version and revision are both 1, `goal_created` is the only Event, and Dispatch is `idle` with cursor 0 and `needs_dispatch=false`.

## 14. Source-reading checklist

A useful reading order is “rules → tool boundary → domain writes → data model → background handoff → tests”:

1. `services/seleven-mcp/src/calle/agentic/instructions/root_orchestrator.md`
   - Read MainAgent's responsibilities and prohibitions.
2. `services/seleven-mcp/src/calle/agentic/tools/goals/lifecycle.py`
   - Follow `CommitGoalArgs`, `create_commit_goal_tool()`, and `commit_goal()`.
3. `services/seleven-mcp/src/calle/agentic/tools/wrapper.py`
   - Confirm who owns validation, the isolated session, commit, and rollback.
4. `services/seleven-mcp/src/calle/agentic/goals/store.py`
   - Trace `_create_goal_locked()`, `update_goal_state()`, `append_goal_event()`, and the idempotency lookup.
5. `services/seleven-mcp/src/calle/db/models/goal.py`
   - Compare the columns, indexes, and defaults for all three tables.
6. `services/seleven-mcp/src/calle/schemas/agentic/goal.py`
   - Understand `GoalBrief`, `GoalPayload`, Event payloads, and collaboration context.
7. `services/seleven-mcp/src/calle/schemas/agents/ctx.py`
   - Find the in-process meaning of `pending_dispatch_goal_ids`.
8. `services/seleven-mcp/src/calle/agentic/agents/calle.py`
   - Read `record_run_completion()`, `_pending_goal_dispatch_ids()`, and `_schedule_goal_dispatches()`.
9. `services/seleven-mcp/tests/test_calle_agentic_goal_store.py`
   - Check your mental model against persistence assertions.

Source code continues to evolve, so file paths and symbol names are more useful than transient line numbers. Every conclusion in this article is based on commit `aa7af64`.

## 15. The mental model to keep

The whole article can be compressed into five statements:

1. MainAgent organizes a confirmed user objective into `CommitGoalArgs` but does not perform real-world side effects.
2. The tool wrapper creates validation and transaction boundaries; `commit_goal()` performs domain actions but does not own the final commit itself.
3. `calle_goals` stores the current snapshot, `calle_goal_events` stores append-only history, and `calle_goal_dispatches` stores consumer progress and the wake-up signal.
4. An idempotency key derived from `tool_call_id` makes the same submission safe to retry; `goal_committed + needs_dispatch=true` means the background may take over.
5. After the foreground turn commits, it reads durable Dispatch state again and then schedules `GoalIterationRunner`, decoupling the chat response from long-running work.

The next article starts from the `needs_dispatch=true` state left here and enters `GoalIterationRunner` to explain leases, the Event cursor, transactions, and recovery. It will trace how a background worker safely “takes” a Goal without expanding those internals prematurely in this article.
