---
title: "CALL-E Agentic Goal 完整链路"
date: 2026-07-22
summary: "从 Session、Goal、RunSpec、RunGroup、Run 和 Call 的关系出发，逐步说明 MainAgent、GoalAgent、CALL-E Runtime、Voice Runtime 与外部 Provider 在一次真实外呼中的职责边界。"
tags: [architecture, call-e]
selected: false
draft: false
---

一个 Agent 系统如果只负责回答问题，通常只需要管理对话上下文；但当它开始替用户拨打真实电话，系统就必须回答更多问题：用户的长期目标是什么？这次准备采用什么话术？一次拨号失败是否代表整个任务失败？谁负责重试？模型做出的决定如何变成可恢复、可审计的数据库状态？

CALL-E 用 `Goal → RunSpec → Run` 这条主链路回答这些问题。语音 `Call` 并不是与 Goal、Run 平级的统一核心实体，而是某类 Run 在外部通话系统中的具体执行记录。

如果只记住一句话，可以记住：

> **Goal 描述要完成什么，RunSpec 描述准备怎么做，Run 表示真实执行了一次；Call 是 voice 类型 Run 在 Provider 侧产生的通话记录。**

本文重点解释两件事：

1. Goal、RunSpec、RunGroup、Run、Call、Iteration、Event 和 Report 之间是什么关系。
2. 一次真实外呼中的每一步究竟由谁决定，又由哪个 Runtime 或 Agent 真正执行。

相关实现主要位于：

```text
services/seleven-mcp/src/calle/agentic/
services/seleven-mcp/src/calle/voice_runtime/
services/seleven-mcp/src/calle/apps/api/
```

## 1. 核心概念结构

CALL-E Agentic 的主体结构可以表示为：

```text
Chat Session
└── Goal                              长任务的产品状态
    ├── GoalAgent Session             GoalAgent 的内部持久化上下文
    ├── Goal Events[]                 Goal 级事实和审计日志
    ├── Goal Dispatch                 游标、租约和唤醒状态
    │
    ├── RunSpec[]                     可版本化的执行方案
    │   └── Run[]                     基于该方案发生的真实执行
    │
    ├── RunGroup[]                    单次或批量执行的组织单元
    │   └── Run[]
    │
    ├── Report / Artifacts            报告、证据和大文件
    │
    └── Run[]
        ├── Run Events[]              执行过程事件
        ├── Result Payload            结构化结果
        ├── Evidence Refs             证据引用
        ├── Transcript Snapshot       通话文本和摘要
        └── Provider IDs
            ├── external_run_id       当前 Calling task_id
            └── provider call_id      具体通话记录 ID
```

从数据库关系看，核心基数是：

```text
Session  1 ── N Goal                  # v1 运行策略限制为一个 Session 一个 Goal
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

`Chat Session` 是用户看到的聊天线程，也是 API 和客户端的入口。

当前 v1 运行策略是：

```text
1 个 Chat Session ≈ 1 个 Goal
```

这是一条代码层策略，不是永久数据库约束。数据库没有对 `calle_goals.session_id` 添加唯一约束，因此结构上仍保留未来一个 Session 管理多个 Goal 的可能性。

系统中还存在另一种 Session：`GoalAgent Session`。

| Session | 所有者 | 用途 | 是否是业务事实源 |
|---|---|---|---|
| Chat Session | MainAgent | 保存用户和 MainAgent 的对话上下文 | 否 |
| GoalAgent Session | GoalAgent | 保存一个 Goal 的长期工作上下文 | 否 |

GoalAgent Session ID 由 `goal_id` 确定性派生。它是 GoalAgent 跨多轮、跨唤醒继续工作的主连续性层，但不是业务事实源。真正的产品事实仍保存在 Goal State、Goal Events、Run 结果和 Report 中。

### 1.2 Goal

Goal 是整个长任务的产品状态主体，回答的问题是：

> 用户最终希望 CALL-E 达成什么？

主要字段包括：

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

其中：

- `objective`：目标描述。
- `GoalBrief`：提交 Goal 时稳定下来的事实、约束、成功标准和来源。
- `goal_version`：目标语义发生变化时递增，例如修改 objective。
- `state_revision`：任何状态变化时递增，用于乐观并发控制。
- `current_status`：Goal 当前处于 planning、waiting、running、completed 或 failed 等阶段。

Goal 不应该因为联系人变多而拆成多个子 Goal。一个批量外呼仍然是一个 Goal，下面使用 RunGroup、RunSpec 和 Run 表达多个执行对象与多次真实尝试。

### 1.3 GoalBrief

GoalBrief 是 MainAgent 在 intake 完成后提交的稳定 `WHAT` 契约，典型内容包括：

```text
objective          最终目标
facts              已确认的号码、地区、时间、语言等事实
constraints        不允许做什么、合规要求和其他边界
success_criteria   哪些可观察结果代表任务完成
narrative          背景、优先级和语气
source_refs        输入材料的引用
```

GoalBrief 不描述电话机器人具体怎么开场、怎么追问或如何结束。这些 `HOW` 层细节属于 RunSpec。

### 1.4 Goal Events

`calle_goal_events` 是 Goal 层的 append-only 事实和审计日志，例如：

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

这里只记录会影响 Goal 推进的业务事件。Provider 的低层状态、实时 ASR 和回调细节应写入 Run Events，而不是全部塞进 Goal Events。

### 1.5 Goal Dispatch 与 Goal Iteration

GoalAgent 不是一个永远常驻的模型循环。它由事件唤醒，每次处理一批新事件的过程称为一个 `Goal Iteration`：

```text
Goal Event 到达
  ↓
Runtime claim iteration lease
  ↓
GoalAgent 消费尚未处理的事件
  ↓
GoalAgent 决策并调用工具
  ↓
complete_goal_iteration
  ↓
Runtime 应用状态、推进 cursor、释放 lease
  ↓
idle / waiting_event
```

`calle_goal_dispatches` 保存的是 Runtime 控制状态：

```text
last_processed_goal_event_id
active_iteration_id
lease_until
iteration_status
next_wakeup_at
needs_dispatch
```

它不是产品状态，也不是证据。它只负责保证同一个 Goal 同一时刻只有一个有效写者、事件不会漏消费，以及异常退出后可以重新获得 lease。

因此必须区分：

- `Iteration`：GoalAgent 被唤醒后的一轮思考、决策和工具调用。
- `Run`：系统对现实世界进行的一次真实执行。

一次 Iteration 可能不创建任何 Run；也可能创建一个或多个 Run。

### 1.6 RunSpec

RunSpec 回答的问题是：

> 这个 Goal 准备采用什么执行方案？

语音场景里的 RunSpec 通常包括：

```text
Voice Agent instruction
开场白、任务说明和问题
对语音信箱、拒绝、追问的处理方式
运行配置和 Voice Runtime Profile
```

RunSpec 具有 lineage 和 version：

```text
lineage_id
version
status = draft / active / superseded / archived
instruction_ref
instruction_checksum
runtime_profile_key
```

一个 RunSpec 可以被多个 Run 使用。创建 Run 时，系统会把 RunSpec 的 lineage、version 和 checksum 快照到 Run 上，因此即使后续升级话术，也能准确知道某个历史 Run 当时使用的是哪个版本。

可以把两者类比为：

```text
RunSpec = 模板、SOP 或作战方案
Run     = 按该方案实际执行的一次
```

### 1.7 RunGroup

RunGroup 是执行组织层，用来表达：

- `singleton`：一次独立外呼。
- `multi_item`：一次批量任务中的多个对象。

它主要解决：

- 一次用户确认覆盖哪些对象。
- 一个批次包含哪些 Run。
- 每个 item 对应哪个 Run。
- 整个批次是否已经全部进入终态。

即使是单次语音外呼，当前实现也会确保存在一个 singleton RunGroup。批量任务中，多个 Run 共享同一个 RunGroup；如果不同联系人需要不同话术，则分别创建 RunSpec，但它们仍可属于同一个 RunGroup。

### 1.8 Run

Run 表示一次真实触发或执行，例如：

```text
一次 outbound voice call
一次 inbound call
一次 scheduler tick
未来也可以是一封 email、一次 webhook 或 browser task
```

核心字段分为几组：

```text
归属：
  goal_id
  session_id
  run_group_id
  run_spec_id

执行类型：
  run_kind
  executor_kind
  trigger_kind

目标：
  target_kind
  target_ref
  target_snapshot

状态：
  status
  queued_at
  started_at
  ended_at

结果：
  result_payload
  evidence_refs
  transcript_snapshot

外部系统：
  external_provider
  external_run_id
  external_status
```

语音提交通常创建：

```text
run_kind      = voice_call
executor_kind = voice_agent
status        = queued
target_kind   = phone
```

### 1.9 Run Events

Run Events 是执行级 append-only 日志，例如：

```text
run_queued
voice_run_requested
run_status_updated
provider_run_created
provider_callback_received
transcript_received
result_summarized
```

每个 Run Event 有可见性：

- `user`：已经过整理，可以安全展示为用户进度。
- `internal`：Provider、审计或调试细节。

### 1.10 Call 到底是什么

仓库中至少存在四种不同含义的 “call”。

#### 语音业务 Call

在 Agentic 模型里，一通语音外呼首先是：

```text
Run(run_kind="voice_call")
```

它不是一个与 Goal、Run 平级的统一核心实体。

#### Calling task_id

Voice Runtime 把 Run 提交给 Calling 后，Calling 创建一个拨号任务：

```text
CALL-E run_id
  → Calling task_id
```

当前实现把 `task_id` 保存为：

```text
calle_runs.external_provider = "calling"
calle_runs.external_run_id   = task_id
```

#### Provider call_id

Calling task 的执行结果里还可能包含具体的 `call_id`，它保存在 Run 的 Provider diagnostics 中。因此更准确的关系是：

```text
CALL-E run_id
  → Calling task_id / external_run_id
  → Calling call_id
```

`task_id` 是拨号任务，`call_id` 是该任务产生的具体通话记录。

#### Developer API call_id

Developer API 还有自己的 `call_id`：

```text
POST /calls
  → Developer API call_id
  → one-shot plan_id
  → one-shot run_id
```

这个 `call_id` 是 API 层的 `call_task` 聚合 ID，封装请求、收件人、幂等、Webhook 和结果投影。它当前走旧 One-Shot Call 的 Plan/Run 链路，不等于 Agentic Goal，也不等于 Calling Provider 的 call_id。

此外，模型 SDK 中还有 `tool_call_id`，它只是一次模型工具调用的关联 ID，与电话记录无关。

## 2. 谁决策，谁执行

完整链路中有五类行动主体：

| 主体 | 主要职责 |
|---|---|
| API Runtime | 接收请求、驱动 turn、发布 Session Event 和 SSE |
| MainAgent | 与用户交互、理解意图、形成 GoalBrief、提交或通知 Goal |
| GoalAgent | 长期推进 Goal，决定方案、外呼、重试、结束和报告 |
| CALL-E Runtime | 确定性执行层，包括 tools、stores、dispatch、lease 和后台任务 |
| Voice Runtime / Provider | 创建 Voice Agent、拨号、监听通话、保存结果 |

最重要的原则是：

> **Agent 负责语义判断，Runtime 负责确定性执行、权限校验、幂等和持久化。**

例如：

```text
GoalAgent：“应该拨打这个电话。”
Runtime：校验参数、创建 Run、写事件并启动后台任务。

GoalAgent：“这个 Goal 已经完成。”
Runtime：校验 GoalIterationResult、更新 Goal、推进 cursor 并释放 lease。

GoalAgent：“这个结果应该告诉用户。”
Runtime：发布 context.delivery。
MainAgent：把结构化结果组织成用户可读的回复。
```

## 3. 带行动主体的完整外呼链路

下面从一条用户消息开始，追踪到最终回复。

### 3.1 用户消息进入 MainAgent

```text
[用户 / CALL-E Web]
发送用户消息

→ [API Runtime / AgentSession / TurnPump]
接收消息，创建 turn，恢复 Chat Session，启动 MainAgent loop

→ [MainAgent]
执行 intake：理解用户意图、判断 goal_type、识别缺失信息

→ [MainAgent / outbound-planner skill]
形成 GoalBrief：objective、facts、constraints、success criteria、resolved target
```

这一步中，API Runtime 只负责承载一次前台 turn。真正判断“用户想做什么、信息是否完整”的是 MainAgent 和它调用的 planner skill。

### 3.2 提交 Goal

```text
[MainAgent]
判断 Goal 已具备提交条件，调用 commit_goal

→ [CALL-E Runtime / commit_goal tool + CalleGoalStore]
创建 calle_goals
写入 GoalBrief
追加 goal_committed Goal Event
设置 calle_goal_dispatches.needs_dispatch = true
将 goal_id 记录到 pending_dispatch_goal_ids
```

MainAgent 做的是“提交 Goal”的语义决定；真正创建数据库记录的是 Runtime 内的 `commit_goal` tool 和 GoalStore。

`commit_goal` 是异步派发边界。它不会在工具调用内部直接执行 GoalAgent。

### 3.3 Runtime 调度 GoalAgent Iteration

```text
[CALL-E Runtime / CallEAgent]
MainAgent 当前 turn 完成后，读取 pending_dispatch_goal_ids
创建后台 goal dispatch task

→ [CALL-E Runtime / GoalIterationRunner]
检查 Goal Event backlog
claim iteration lease
加载尚未消费的 Goal Events
恢复 GoalAgent Session
根据 goal_type 创建 OutboundGoalAgent

→ [GoalAgent / OutboundGoalAgent]
读取 GoalBrief 和新 Goal Events
判断应该生成方案、等待确认、提交外呼、重试、结束或生成报告
```

这里的 Runtime 负责调度、lease、cursor、事务和恢复；GoalAgent 负责业务推进决策。

### 3.4 生成话术并创建 RunSpec

```text
[GoalAgent / sandbox filesystem]
生成语音话术 artifact，例如：
goals/{goal_id}/run_specs/{slug}/voice_instruction.yaml

→ [GoalAgent]
调用 create_run_spec

→ [CALL-E Runtime / create_run_spec tool + CalleRunSpecStore]
读取并校验 workspace artifact
计算 instruction checksum
创建或复用 calle_run_specs
维护 lineage、version 和 active 状态
返回 run_spec_id
```

GoalAgent 决定话术内容并写入 Workspace；Runtime 读取 artifact、校验路径和 checksum，然后创建持久化 RunSpec。

### 3.5 用户确认或预授权

不是所有外呼都必须再单独询问一次。当前规则允许普通的单联系人、立即执行请求被视为已经预授权；批量、定时、存在歧义或高风险的执行通常需要显式确认。

如果需要确认：

```text
[GoalAgent]
调用 complete_goal_iteration，提交：
confirmation_request
projection
context_delivery(delivery_mode="wake_with_context")

→ [CALL-E Runtime / iteration finalizer]
更新 Goal 状态为 waiting_user_input
追加 Goal Events
推进 event cursor
释放 iteration lease
发布 context.delivery

→ [MainAgent]
被 context.delivery 唤醒
读取确认请求并向用户提问

→ [用户]
返回确认或拒绝

→ [API Runtime]
启动新的 MainAgent turn

→ [MainAgent]
调用 notify_goal(confirm/stop)

→ [CALL-E Runtime / notify_goal tool + GoalStore]
追加 confirmed / stopped Goal Event
设置 needs_dispatch = true
再次调度 GoalAgent iteration
```

GoalAgent 不直接与用户对话。它把结构化确认请求交给 Runtime，Runtime 唤醒 MainAgent，再由 MainAgent 面向用户表达问题。

### 3.6 创建 RunGroup 和 queued Run

获得确认或已具备预授权后：

```text
[GoalAgent]
收到 confirmed 事件或确认已有预授权
决定执行外呼
调用 submit_voice_run

→ [CALL-E Runtime / submit_voice_run tool]
校验 Goal、RunSpec、目标号码、region、locale、runtime profile、SIP line 和授权范围

→ [CALL-E Runtime / CalleRunRegistry]
创建或复用 RunGroup：singleton 或 multi_item

→ [CALL-E Runtime / CalleRunRegistry]
创建 queued Run
保存 RunSpec 快照、target snapshot 和 runtime config snapshot

→ [CALL-E Runtime / CalleRunRegistry]
追加 run_queued 和 voice_run_requested Run Events
将 VoiceRunRequestedEvent 放入 GoalAgent context queue
```

GoalAgent 只负责选择参数并调用工具。RunGroup、Run 和事件均由 Runtime 确定性创建。

### 3.7 GoalAgent 结束当前 Iteration

```text
[GoalAgent]
调用 complete_goal_iteration：
iteration_status = waiting_event
related_run_ids = [...]
然后结束本轮，不等待电话完成

→ [CALL-E Runtime / GoalIterationEventBridge]
从 context queue 收集 VoiceRunRequestedEvent
把 run_id 写入 GoalIterationRunResult

→ [CALL-E Runtime / GoalIterationRunner]
应用 Goal 状态和事件
推进 Goal Event cursor
释放 iteration lease
```

GoalAgent 不应该在一次模型调用中一直等待电话结束。真实通话是一个独立的异步生命周期。

### 3.8 Voice Runtime 启动真实外呼

```text
[CALL-E Runtime / CallEAgent]
Goal iteration 完成后，为 run_id 创建后台 Voice Run lifecycle task

→ [Voice Runtime / VoiceRunExecutor]
加载 queued Run 和 RunSpec
claim Run，将状态从 queued 更新为 running

→ [Voice Runtime / BotlabVoiceEngineProvider]
根据 RunSpec instruction 创建或复用 Botlab Voice Agent / Version

→ [Voice Runtime / CallingVoiceDialerProvider]
向 Calling 创建拨号 task

→ [Calling Provider]
返回 task_id

→ [Voice Runtime / CalleRunRegistry]
写入：
external_provider = calling
external_run_id = Calling task_id
external_status = created
status = running
并追加 Provider/Run Events
```

这一阶段的业务触发来自 GoalAgent，但创建 Voice Agent、调用 Calling 和更新 Run 都属于 Voice Runtime。

### 3.9 实时事件、Transcript 和终态

```text
[Calling + DM Realtime]
执行真实电话
产生状态、实时通话事件、ASR 和最终 CallDetail

→ [Voice Runtime / BotlabCallingVoiceRunExecutor]
监听 DM realtime event
轮询或 refresh Calling task detail
完成状态归一化和结果判断

→ [Voice Runtime / CalleRunRegistry]
把结果写入 Run：
transcript_snapshot
result_payload
evidence_refs
provider diagnostics
Calling call_id
terminal status
ended_at
同时追加 Run Events

→ [Voice Runtime / CalleGoalStore]
根据 Run 终态追加 Goal Event：
run_completed 或 run_failed
并 request_dispatch(goal_id)
```

需要注意，Run 进入终态并不等于 Goal 自动完成。一次电话未接通可能触发重试，一次电话成功也可能只是批量任务中的一个 item。

### 3.10 GoalAgent 根据结果决定下一步

```text
[CALL-E Runtime / CallEAgent]
发现 terminal_goal_event_id
再次调用 GoalIterationRunner

→ [CALL-E Runtime / GoalIterationRunner]
claim 新 iteration
加载 run_completed / run_failed Goal Event
恢复同一个 GoalAgent Session

→ [GoalAgent]
评估 Run 结果和 evidence，决定：
完成 Goal
重试同一个 RunSpec
创建新版本 RunSpec 后重试
执行 fallback
继续批量下一个 item
或者生成最终 Report
```

重试是 GoalAgent 的业务决定，但新 RunSpec 和新 Run 仍然通过 Runtime tools 创建。

### 3.11 Report 与 Goal 完成

如果 Goal 已达到终态：

```text
[GoalAgent]
组织报告内容并调用 commit_report

→ [CALL-E Runtime / commit_report tool + ReportStore]
持久化 Report record 和 workspace content
返回 report_id 与 artifact ref

→ [GoalAgent]
调用 complete_goal_iteration，提交：
goal_state_patch(current_status=completed/failed)
events_to_emit
artifact_refs
projection
context_delivery(
  kind=report_ready/result,
  delivery_mode=wake_with_context
)

→ [CALL-E Runtime / iteration finalizer]
应用 Goal 状态更新
追加 Goal Events
推进 dispatch cursor
释放 iteration lease
构造 ContextDelivery
```

GoalAgent 的普通 assistant text 不能直接作为最终业务结果。它必须通过 `complete_goal_iteration` 提交结构化状态和交付请求，由 Runtime 应用。

### 3.12 Runtime 唤醒 MainAgent 并输出最终消息

```text
[CALL-E Runtime / CallEAgent]
将 ContextDelivery 发布成 Session Event：
type = context.delivery

→ [CALL-E Agent Result Wrapper / TurnPump]
识别 delivery_mode = wake_with_context
设置 trigger_next_turn = true
把 Runtime Context Delivery 转成 MainAgent 输入

→ [MainAgent]
读取结果摘要以及 Report、Run、Evidence 引用
生成真正面向用户的自然语言回复

→ [API Runtime / SSE]
持久化并推送 assistant message 给 CALL-E Web

→ [用户]
看到最终结果
```

因此，GoalAgent 负责产出结果事实和交付意图，MainAgent 负责最终的用户表达。

## 4. 职责边界速查

| 动作 | 谁做业务决定 | 谁真正执行 |
|---|---|---|
| 理解用户目标 | MainAgent | MainAgent loop |
| 形成 GoalBrief | MainAgent + planner skill | MainAgent |
| 创建 Goal | MainAgent | `commit_goal` tool + GoalStore |
| 启动 GoalAgent | Runtime | CallEAgent + GoalIterationRunner |
| 生成话术 | GoalAgent | GoalAgent + sandbox filesystem |
| 创建 RunSpec | GoalAgent | `create_run_spec` tool + RunSpecStore |
| 请求用户确认 | GoalAgent | Runtime 投递给 MainAgent，MainAgent 提问 |
| 记录用户确认 | 用户决定，MainAgent 转发 | `notify_goal` tool + GoalStore |
| 发起外呼 | GoalAgent | `submit_voice_run` tool |
| 创建 RunGroup / Run | GoalAgent 提供参数 | CalleRunRegistry |
| 启动后台语音任务 | Runtime | CallEAgent background task |
| 创建 Voice Agent | Voice Runtime | Botlab Provider |
| 创建拨号任务 | Voice Runtime | Calling Provider |
| 监听电话结果 | Voice Runtime | Realtime stream + Calling refresh |
| 写 Transcript / Result | Voice Runtime | CalleRunRegistry |
| 判断重试或完成 | GoalAgent | 下一次 Goal Iteration |
| 更新最终 Goal 状态 | GoalAgent 提交 patch | Runtime finalizer + GoalStore |
| 生成报告 | GoalAgent 组织内容 | `commit_report` tool + ReportStore |
| 唤醒 MainAgent | GoalAgent 声明 delivery | Runtime 发布 context.delivery |
| 输出用户回复 | MainAgent | API Runtime 持久化并推送 |

## 5. 用批量餐厅外呼理解

假设用户说：

> 帮我打电话给三家餐厅，问今晚有没有六人桌，并把结果整理给我。

系统可以形成：

```text
Chat Session
└── Goal
    objective = 找到今晚可用的六人桌

    RunGroup(kind=multi_item)
    ├── item: restaurant-A
    │   ├── RunSpec: 给 A 的话术
    │   └── Run: 实际拨打 A
    │       └── Calling task_id / call_id
    │
    ├── item: restaurant-B
    │   ├── RunSpec: 给 B 的话术
    │   └── Run: 实际拨打 B
    │       └── Calling task_id / call_id
    │
    └── item: restaurant-C
        ├── RunSpec: 给 C 的话术
        └── Run: 实际拨打 C
            └── Calling task_id / call_id

    Report
      三家结果比较、证据和推荐下一步
```

如果 A 无人接听，只表示 A 对应的 Run 进入某个失败或未接通终态。GoalAgent 仍然可以继续 B、C，并根据 Goal 的约束判断是否重试 A。只有当 GoalAgent 综合所有 Run、成功标准和证据后，Goal 才会进入最终状态。

## 6. 当前 Runtime 在代码中的落点

逻辑上的 `CALL-E Runtime` 目前不是一个独立的外部服务，它主要由以下部分共同组成：

```text
CallEAgent
  前台 MainAgent 包装、后台 Goal Dispatch、Voice lifecycle 调度

GoalIterationRunner
  lease、cursor、GoalAgent Session、iteration 输入和 finalization

Goal/Run/Report Tools
  Agent 可调用的确定性边界

GoalStore / RunSpecStore / CalleRunRegistry / ReportStore
  数据持久化和并发控制

VoiceRunExecutor
  Voice Runtime 路由、Provider 调用、结果采集和状态落库

SessionEventPublisher / TurnPump
  Session Event、Context Delivery、MainAgent 唤醒和用户输出
```

当前 Goal Dispatch 和 Voice lifecycle 主要由进程内 `asyncio` 后台任务承载。从概念边界看，它们属于 Runtime；从部署形态看，目前还不是独立的持久化 Worker 队列。

## 7. 最终心智模型

最后可以用下面这组定义快速定位任何日志、表或代码：

```text
Session
  用户交互和 MainAgent 上下文的容器

Goal
  WHAT：长期任务及其产品状态

GoalBrief
  intake 完成后稳定的目标合同

Goal Event
  Goal 层事实、输入和业务审计日志

Goal Iteration
  GoalAgent 被 Runtime 唤醒后的一轮推进

RunSpec
  HOW：可复用、可版本化的执行方案

RunGroup
  一组相关 Run 的组织和确认范围

Run
  一次真实执行或尝试

Run Event
  一次执行内部的状态与 Provider 事件

Call
  voice 类型 Run 在外部 Provider 中的具体拨号与通话记录

Artifact
  话术、原始 Provider 数据、录音引用等大块内容

Report
  面向用户的结果产物

Context Delivery
  GoalAgent 经 Runtime 向 MainAgent 交付结果或请求的结构化信封
```

这套结构的本质不是多引入几个名词，而是把模型判断和现实世界副作用分开：Agent 可以负责理解、规划和评估，但每一次状态变化、外呼、回调、重试和结果交付，都必须经过可验证、可恢复的 Runtime 边界。
