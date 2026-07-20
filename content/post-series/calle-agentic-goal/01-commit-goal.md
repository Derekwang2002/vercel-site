---
title: "第 1 篇：追踪 commit_goal——Goal、Event 与 Dispatch 如何持久化"
summary: "从 MainAgent 的工具调用一路追到三张数据库表，解释 commit_goal 的事务、幂等和异步派发边界。"
---

本文基于 `prod-dive-in` 提交 `aa7af64`。我们不只看一个函数，而是沿着一次真实工具调用，追踪 `commit_goal` 如何把对话中的目标变成可持久化、可重试、可交给后台继续执行的系统状态。

如果你刚开始读源码，可以先记住一句话：**`commit_goal` 不是“开始打电话”，而是把已经确认的工作可靠地登记进 Goal runtime。**

## 1. 这一篇解决什么问题

用户在聊天框里说“帮我打电话问餐厅明晚七点有没有两人位”，这句话最初只是对话文本。后台执行器不能安全地直接拿这句话开工，因为系统还需要知道：

- 最终要达成什么结果；
- 哪些事实已经确认；
- 哪些边界不能越过；
- 怎样判断任务完成；
- 重试同一次工具调用时，是否已经创建过 Goal；
- 前台回复结束后，后台从哪里接手。

`commit_goal` 就位于这条分界线上。它的输入是 MainAgent 整理好的结构化目标，输出是一个持久化的 Goal 和对应事件；真正的 GoalAgent 迭代、RunSpec 生成与电话执行则属于后续阶段。

这一篇会回答四个核心问题：

1. MainAgent 为什么只负责提交，不负责执行？
2. `calle_goals`、`calle_goal_events`、`calle_goal_dispatches` 各自保存什么？
3. 工具事务和 `tool_call_id` 怎样阻止半成品与重复 Goal？
4. 当前台 Turn 结束时，后台为什么知道该启动 `GoalIterationRunner`？

## 2. 先看完整调用链

先不要钻进每个函数。把入口、事务边界和后台交接放在一张图里：

```text
root_orchestrator.md
  │  MainAgent 判断目标已经具备提交条件
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
  │    └─ APPEND payload_updated（本篇示例）
  ├─ append_goal_event(event_type="goal_committed", request_dispatch=True)
  │    └─ calle_goal_dispatches.needs_dispatch = true
  └─ _track_pending_dispatch(...)

create_wrapped_tool 完成独立工具事务的 commit
  ▼
前台 Agent Turn 完成
  ▼
CallEAgent.record_run_completion(...)
  ├─ 提交产品拥有的前台事务
  ├─ 从数据库重新读取 needs_dispatch
  └─ 创建后台任务，进入 GoalIterationRunner
```

这里有一个值得源码读者注意的细节：`commit_goal` 会把 `goal_id` 加入 `AgentCTX.pending_dispatch_goal_ids`，但当前 `CallEAgent` 的自动调度路径并不是直接消费这个列表。`record_run_completion()` 会在提交之后，通过 `_pending_goal_dispatch_ids()` **重新读取数据库中的 `needs_dispatch`**。因此，真正跨越事务与进程边界的事实是数据库状态，而不是内存列表。

## 3. MainAgent 为什么只能“提交”Goal

`root_orchestrator.md` 把 MainAgent 定义成 CALL-E Agentic Runtime 的编排入口。它负责理解用户目标、补齐阻塞信息、选择 `goal_type`，并在准备完成后调用 `commit_goal`。同一份指令也明确禁止它执行电话、生成 RunSpec、检索证据或撰写 Report。

这不是能力不足，而是职责隔离：

| 角色 | 负责的问题 |
|---|---|
| MainAgent | 用户究竟想完成什么，现在是否已经足够明确？ |
| `commit_goal` | 怎样把确认后的 WHAT 可靠地写入持久状态？ |
| GoalAgent / Runner | 下一步应该怎样规划、执行和等待？ |
| Voice runtime | 一次真实电话怎样运行？ |
| Report 链路 | 结果与证据怎样回到用户？ |

如果 MainAgent 在对话 Turn 中直接启动电话，模型重试、网络超时或前端断线都可能把“用户意图确认”和“现实副作用”纠缠在一起。先提交 Goal，相当于先写下一份可追踪的工作订单，再由后台消费者处理它。

指令中还有一条容易忽略的产品边界：`commit_goal` 返回以后，MainAgent 不能仅凭这个返回值宣称电话已经开始。提交成功只说明 Goal 已经登记并请求派发，不等于 Voice Run 已经排队、接通或完成。

## 4. 第一层边界：CommitGoalArgs

`create_commit_goal_tool()` 把工具名、描述、`CommitGoalArgs` 和处理函数 `commit_goal` 交给通用的 `create_wrapped_tool()`。模型传来的 JSON 在处理函数运行前先经过：

`CommitGoalArgs.model_validate_json(input_json or "{}")`

`CommitGoalArgs` 使用 `extra="forbid"`，所以未声明字段不会被静默吞掉。它的主要字段是：

| 字段 | 作用 |
|---|---|
| `objective` | 用户可见的目标，不能为空 |
| `collaboration_context` | 首次派发给 GoalAgent 的协作上下文；当前包含 `response_language` |
| `goal_type` | 派发注册表使用的目标类型，默认 `one_shot_outbound` |
| `project_id` | 可选项目归属 |
| `brief` | 可选但稳定的 WHAT 合同，即 `GoalBrief` |

把餐厅例子写成概念上的工具参数，大致如下：

```json
{
  "objective": "致电 Northstar Bistro，确认明晚 7 点是否有两人位",
  "collaboration_context": {
    "response_language": "Chinese"
  },
  "goal_type": "one_shot_outbound",
  "project_id": null,
  "brief": {
    "objective": "确认 Northstar Bistro 明晚 7 点的两人桌供应情况",
    "facts": {
      "venue": "Northstar Bistro",
      "party_size": 2,
      "requested_time": "tomorrow 19:00 America/Los_Angeles"
    },
    "constraints": [
      "未经用户再次确认，不要直接预订"
    ],
    "success_criteria": [
      "餐厅明确说明是否有位",
      "如有押金或最低消费，记录具体要求"
    ],
    "narrative": "用户正在比较晚餐选项，希望先确认空位。",
    "source_refs": [
      "chat://session-restaurant/messages/1"
    ]
  }
}
```

`GoalBrief` 不是执行脚本。它描述稳定的 WHAT：`objective`、已知 `facts`、`constraints`、可观察的 `success_criteria`、补充背景 `narrative` 和来源引用 `source_refs`。至于电话提示词怎样写、是否需要重试、如何安排一次 Run，仍由后面的领域 Agent 决定。

还要区分两个“语言”：`collaboration_context.response_language` 约束 CALL-E 面向用户的表达语言，不等同于受话人的语言，也不自动授权系统翻译来源中的姓名或标识符。

## 5. 第二层边界：Tool Wrapper 与事务

`create_wrapped_tool()` 不只是把 Python 函数包装成 `FunctionTool`。当上下文同时具有 `AgentCTX`、`memory_engine` 和当前 `db_session` 时，`_invocation_tool_context()` 会为这次工具调用创建一个隔离的 `AsyncSession`，并把新的 `CalleGoalStore` 放进复制后的上下文。

它的事务语义可以用下面这段**概念性伪代码**理解；这不是源码逐字复制：

```python
# 伪代码：说明事务所有权，不是可直接运行的实现
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

因此，`commit_goal()` 和 Store 中看到的多次 `flush()` 只是把 SQL 推送到当前事务，**不是最终提交**。在这条隔离工具路径上，`db_session.commit()` 属于 wrapper；发生异常时，wrapper 统一 `rollback()`。

源码也保留了不创建隔离会话的上下文：如果条件不满足，wrapper 会直接沿用原来的 `ToolContext`，此时事务由外层产品流程拥有。准确的说法不是“`commit_goal` 自己提交事务”，而是“调用它的事务所有者决定何时提交”。

## 6. commit_goal 的第一步：先查幂等记录

进入 `commit_goal()` 后，第一件关键的事不是创建 Goal，而是从 `tool_call_id` 生成提交幂等键：

`commit_goal:{tool_call_id}:committed`

餐厅例子假设 `tool_call_id = call_restaurant_01`，那么键就是：

`commit_goal:call_restaurant_01:committed`

随后 `get_committed_goal_for_session_by_idempotency_key()` 会：

1. 锁定当前 session 行；
2. 联结 `calle_goals` 与 `calle_goal_events`；
3. 查找同一 session、`event_type = goal_committed`、幂等键相同的第一条事件；
4. 如果找到，直接返回原来的 Goal 和 Event。

为什么要先查 Event，而不是只查 Goal？因为“这个 Goal 存在”和“这次具体的工具提交已经成功完成”是两件事。`goal_committed` 事件同时记录了工具调用的幂等键，正好能成为重试凭证。

锁定 session 行还有并发意义：同一 session 中两个同时到达的相同提交不能都越过查询再各自创建一份结果。前一个事务完成后，后一个查询会看到已经提交的事件。

## 7. 创建 Goal 时三张表发生了什么

没有命中幂等记录时，`commit_goal()` 会先检查当前 session 是否有活动中的 Voice Run，然后调用 `create_goal_for_session()`。Store 锁定 session，并进入 `_create_goal_locked()`。

以一个全新的餐厅任务为例，三张表的变化可以先看成下面这张“前后对照表”：

| 表 | 调用前 | `_create_goal_locked()` 后 | `commit_goal()` 完成后 |
|---|---|---|---|
| `calle_goals` | 没有此 Goal | 新快照：`planning`，`goal_version=1`，`state_revision=1` | `brief` 写入 `payload`；本例 `state_revision=2` |
| `calle_goal_dispatches` | 没有此 Goal | 新消费者状态：`idle`、游标 `0`、`needs_dispatch=false` | `needs_dispatch=true` |
| `calle_goal_events` | 没有此 Goal 的事件 | 追加 `goal_created` | 再追加 `payload_updated` 与 `goal_committed` |

这里体现了三种不同的数据角色：Goal 是当前快照，Event 是发生过什么的追加历史，Dispatch 是后台消费者处理到哪里、现在要不要被唤醒。

### 7.1 calle_goals：创建当前快照

`CalleGoal` 的主键由 `generate_goal_id()` 生成。新行会写入 session、tenant、user、project、`goal_type` 与 `objective`，并使用这些初始值：

- `current_status = "planning"`；
- `goal_version = 1`；
- `state_revision = 1`；
- `payload` 初始为空。

`goal_version` 更接近用户可见目标合同的版本，`state_revision` 则用于并发更新检查。后面写入 `brief` 时，目标文字没有改变，所以本例只增加 `state_revision`，不增加 `goal_version`。

### 7.2 calle_goal_dispatches：先创建空闲消费者状态

`_ensure_goal_dispatch_row()` 紧接着为同一个 `goal_id` 创建 Dispatch 行：

- `last_processed_goal_event_id = 0`；
- `active_iteration_id = null`；
- `iteration_status = "idle"`；
- `needs_dispatch = false`。

为什么创建 Goal 时不立即设为 `true`？因为此时系统只完成了基础对象初始化，`GoalBrief` 和 `goal_committed` 还没有写完。如果后台消费者过早看到可派发状态，就可能读取一个半成品 Goal。

### 7.3 calle_goal_events：追加 goal_created

最后，`_create_goal_locked()` 追加由 system actor 产生的 `goal_created`：

- `from_goal_version` 与 `from_state_revision` 都是 `null`；
- `to_goal_version = 1`；
- `to_state_revision = 1`；
- payload 中记录 `reason = goal_created`。

这个事件表达“领域对象被创建”，不表达“用户目标已经准备好派发”。因此它不会打开 `needs_dispatch`。

## 8. GoalBrief 为什么会产生 payload_updated

创建基础 Goal 后，`commit_goal()` 比较传入参数和当前快照：

- 新 Goal 的 `objective` 已经等于 `args.objective`，通常无需再次修改；
- outbound Goal 仍保持 `planning`；
- 如果提供 `brief`，`_payload_with_brief()` 会保留 payload 中的其他键，并设置 `payload.brief`。

只要新旧 payload 不同，就会调用 `update_goal_state()`。Store 先用 `expected_state_revision` 做乐观并发检查，再锁定 Goal 行、写入 payload、把 `state_revision` 从 1 增加到 2，并追加状态变化事件。

在本篇 outbound 示例里，唯一的 patch 是 `payload`，所以事件类型是 `payload_updated`。如果同一次 patch 更早改变了 `objective` 或 `current_status`，Store 会根据优先发生的变化选择 `objective_updated` 或 `status_updated`；不能把所有包含 brief 的更新都机械地理解成 `payload_updated`。

这一步把 `GoalBrief` 固定在 Goal 当前快照中，后续 GoalAgent 不必重新从整段聊天记录猜测用户已经确认的事实与边界。

## 9. goal_committed 如何打开派发开关

快照准备好以后，`commit_goal()` 组装 `goal_committed` 的事件 payload，其中包括：

- `objective`；
- `goal_type`；
- `project_id`；
- `collaboration_context`；
- 可选的 `brief`。

然后调用：

`append_goal_event(event_type="goal_committed", request_dispatch=True)`

真正打开开关的不是事件名字本身，而是 `request_dispatch=True`。`append_goal_event()` 在追加事件后调用 `_mark_dispatch_needed()`，锁住 Dispatch 行并将 `needs_dispatch` 设为 `true`。

三个事件可以这样区分：

| 事件 | 它证明什么 | 是否请求派发 |
|---|---|---|
| `goal_created` | Goal、初始 Dispatch 和版本 1 已建立 | 否 |
| `payload_updated` | 当前快照中的 payload/brief 已改变 | 否（本调用未请求） |
| `goal_committed` | 这次 MainAgent 提交已形成可追踪的事实 | 是，调用同时设置 `needs_dispatch=true` |

写完以后，`commit_goal()` 还把 `goal_id` 放入 `pending_dispatch_goal_ids`，并返回 `goal_id`、`event_id`、`event_type`、当前状态和 `needs_dispatch`。这个返回值方便当前 Turn 理解结果，但数据库中的事件与 Dispatch 才是耐久事实。

## 10. 为什么重复调用不会重复创建 Goal

假设模型或网络层重试了同一个工具调用，而且沿用同一个 `tool_call_id = call_restaurant_01`：

```text
第一次调用
  → 幂等键 commit_goal:call_restaurant_01:committed
  → 创建 goal_A
  → 追加 goal_committed(event_3)

同一个 tool_call_id 重试
  → 查询到同一个幂等键
  → 返回 goal_A + event_3
  → 不创建新 Goal，不追加新事件

新的 tool_call_id = call_restaurant_02
  → 生成不同幂等键
  → 被视为新的提交，可以创建新的 Goal
```

重试分支还会读取当前 Dispatch。如果 `needs_dispatch` 仍为 `true`，它会重新把 Goal 记录到当前上下文的 pending 列表；如果后台已经推进游标并清除了开关，它只返回原结果，不会凭一次旧重试重新唤醒后台。

此外，`append_goal_event()` 自身也支持事件级幂等键。这是第二道保护。不过 `commit_goal()` 的正常重试在函数开头就已经返回，不会再次走完整创建流程。

幂等并不等于“内容看起来相同就合并”。源码依据的是稳定的 `tool_call_id`。两个文字完全相同但 `tool_call_id` 不同的提交，在没有其他产品约束阻止时，可以成为两个不同 Goal。

## 11. 前台 Turn 怎样把工作交给后台

在隔离工具会话路径中，wrapper 先提交 `commit_goal` 的事务。当前台 Agent Run 完成时，`CallEAgent.record_run_completion()` 还会完成产品拥有的前台事务，然后才安排后台工作。

调度顺序很重要：

1. 提交前台持久化状态；
2. `_pending_goal_dispatch_ids()` 使用新的数据库会话重新读取当前 Goal 的 Dispatch；
3. 只有 `needs_dispatch=true` 才返回 `goal_id`；
4. `_schedule_goal_dispatches()` 为去重后的 Goal 创建后台 task；
5. `_run_goal_dispatch()` 进入 `_run_goal_iteration_once()`，由 `GoalIterationRunner` 接手。

这解释了为什么 `needs_dispatch` 是“耐久唤醒信号”。即使进程内列表丢失，只要事务已经提交，系统仍能从数据库判断有工作待处理。反过来，如果数据库事务回滚，即使内存中曾短暂追加 `goal_id`，重新读取也不会把半成品派发出去。

本篇到这里停下。后台怎样获取 lease、读取 Event cursor、恢复或等待下一事件，是第 2 篇的范围。

## 12. 失败与事务回滚

沿调用链看，失败大致分成三层：

| 失败位置 | 例子 | 结果 |
|---|---|---|
| Schema 验证 | `objective` 为空、出现未知字段、缺少 `collaboration_context` | handler 尚未执行，不产生 Goal 写入 |
| 领域/Store | session 不存在、仍有活动 Voice Run、revision 冲突 | 抛出异常，当前工具事务不应提交 |
| 事务提交 | 数据库连接或 commit 失败 | wrapper 回滚隔离会话并向上抛错 |

因为三张表的写入都处在同一工具事务中，正常结果不会是“有 `calle_goals`，却没有 `goal_created`”，也不会是“`needs_dispatch=true`，但 `goal_committed` 没写成功”。多个 `flush()` 让后续 SQL 能使用前面生成的主键和状态，但不会提前破坏原子性。

还有一个设计上的保险：后台调度在提交之后重新读数据库，而不是相信工具执行过程中的临时内存。这让“事务是否真正成功”成为派发的前置条件。

## 13. 用测试验证我们的理解

`tests/test_calle_agentic_goal_store.py` 中的 `test_commit_goal_tool_commits_goal_and_requests_dispatch` 把这条链路的关键结论固定成可执行断言：

- 返回的 `goal_id` 以 `goal_` 开头；
- 返回事件是 `goal_committed`；
- Goal 的 `payload.brief` 等于传入 brief；
- Dispatch 的 `needs_dispatch` 为 `true`；
- collaboration context 能从持久事件中恢复；
- 推进 cursor 后，`needs_dispatch` 变回 `false`；
- 使用同一个 `ToolContext` 重试，返回相同 `goal_id` 与 `event_id`，Goal 数量仍为 1；
- 换一个 `tool_call_id`，会创建另一个 Goal。

测试中事件断言写成：

`["goal_committed", "payload_updated", "goal_created"]`

这里必须特别小心：`list_goal_events()` 使用 `event_id.desc()`，也就是**最新事件在前**。真实追加顺序恰好相反：先 `goal_created`，再 `payload_updated`，最后 `goal_committed`。读测试时如果忽略排序方向，很容易把调用链倒过来理解。

另一个测试 `test_ensure_goal_for_session_creates_compact_goal_and_event` 验证了创建阶段的初始状态：版本与 revision 都是 1，只有 `goal_created`，Dispatch 是 `idle`、cursor 为 0、`needs_dispatch=false`。

## 14. 源码阅读清单

建议按“规则 → 工具边界 → 领域写入 → 数据模型 → 后台交接 → 测试”的顺序阅读：

1. `services/seleven-mcp/src/calle/agentic/instructions/root_orchestrator.md`
   - 看 MainAgent 的责任与禁区。
2. `services/seleven-mcp/src/calle/agentic/tools/goals/lifecycle.py`
   - 从 `CommitGoalArgs`、`create_commit_goal_tool()` 读到 `commit_goal()`。
3. `services/seleven-mcp/src/calle/agentic/tools/wrapper.py`
   - 确认验证、隔离 session、commit/rollback 属于谁。
4. `services/seleven-mcp/src/calle/agentic/goals/store.py`
   - 跟进 `_create_goal_locked()`、`update_goal_state()`、`append_goal_event()` 与幂等查询。
5. `services/seleven-mcp/src/calle/db/models/goal.py`
   - 对照三张表的列、索引和默认值。
6. `services/seleven-mcp/src/calle/schemas/agentic/goal.py`
   - 理解 `GoalBrief`、`GoalPayload`、Event payload 与 collaboration context。
7. `services/seleven-mcp/src/calle/schemas/agents/ctx.py`
   - 找到 `pending_dispatch_goal_ids` 的进程内语义。
8. `services/seleven-mcp/src/calle/agentic/agents/calle.py`
   - 阅读 `record_run_completion()`、`_pending_goal_dispatch_ids()` 与 `_schedule_goal_dispatches()`。
9. `services/seleven-mcp/tests/test_calle_agentic_goal_store.py`
   - 用持久化断言校验自己的心智模型。

源码会继续变化，所以文件路径和符号名比本文中的瞬时行号更值得记忆。本文所有结论都以提交 `aa7af64` 为准。

## 15. 本篇心智模型

最后把整篇压缩成五句话：

1. MainAgent 把已经确认的用户目标整理成 `CommitGoalArgs`，但不执行现实副作用。
2. Tool wrapper 建立验证与事务边界；`commit_goal()` 负责领域动作，不自行拥有最终 commit。
3. `calle_goals` 保存当前快照，`calle_goal_events` 保存追加历史，`calle_goal_dispatches` 保存消费者进度与唤醒信号。
4. `tool_call_id` 派生的幂等键让同一次提交可以安全重试；`goal_committed + needs_dispatch=true` 表示后台可以接手。
5. 前台 Turn 提交后重新读取耐久 Dispatch 状态，再调度 `GoalIterationRunner`，所以聊天响应与长任务执行得以解耦。

下一篇将从这里留下的 `needs_dispatch=true` 开始，进入 `GoalIterationRunner`，理解 Lease、Event Cursor、事务与恢复。我们会追踪后台怎样安全地“接走”一个 Goal，但不会在本篇提前展开它的内部实现。
