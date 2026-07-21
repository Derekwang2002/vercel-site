---
title: "CALL-E Agentic Goal 架构从零理解：从聊天目标到真实电话执行"
date: 2026-07-20
summary: "面向新手拆解 CALL-E Agentic Goal 系统，讲清 MainAgent、GoalBrief、GoalAgent、Iteration、RunSpec、Run、Event、Report 与持久化运行时如何协作。"
tags: [ai-agent, architecture, voice-ai, domain-modeling]
selected: false
draft: false
---

很多 AI 产品看起来只是一个聊天框，但当它需要真正替用户完成现实世界任务时，问题会迅速变复杂：用户关闭网页后任务是否继续？一次电话没打通是否应该重试？谁负责判断任务是否完成？模型说“完成了”能不能直接当成系统事实？

CALL-E 的 Goal 系统就是为这些问题设计的。它不把用户的一句话简单地交给一个大模型执行，而是把自然语言目标转换成一张可持久化、可恢复、可审计的长期工单，再由不同角色分阶段推进。

本文主要关注：

- `services/seleven-mcp/src/calle/agentic/`
- `services/seleven-mcp/src/calle/voice_runtime/`
- `services/seleven-mcp/src/calle/apps/api/`

如果只记住一句话，可以记住：

> **GoalBrief 描述做什么，RunSpec 描述怎么做，Run 表示真正做一次，Report 说明最后发生了什么。**

## 系列导航

这是一组从直觉逐步深入源码的文章。每篇只增加一层复杂度，避免一开始就被实现细节淹没。

- **第 0 篇（本文）**：建立完整心智模型，并把每个概念定位到源码。
- **[第 1 篇：追踪 `commit_goal`](/zh/blog/calle-agentic-goal/commit-goal)**：理解 Goal、Event 和 Dispatch 如何写入数据库。
- **[第 2 篇：追踪 `GoalIterationRunner`](/zh/blog/calle-agentic-goal/goal-iteration-runner)**：理解 Lease、Cursor、事务与恢复。
- **[第 3 篇：追踪 `RunSpec → Run → VoiceRunExecutor`](/zh/blog/calle-agentic-goal/voice-run-execution)**：理解真实电话的异步提交、状态机与证据链。
- **第 4 篇（计划中）**：追踪 `Report → Context Delivery → MainAgent` 的结果回传链路。

如果还不清楚 CALL-E 与桌面 Agent、Bridge、浏览器能力之间的关系，可以先看[《Agentic 系统全景》](/zh/blog/agentic-system-overview)。

## 1. 先用一个生活例子理解

假设用户对 CALL-E 说：

> 帮我打电话问一下某餐厅，周五晚上 7 点两个人有没有位置。

一个最简单的实现，可能会直接把这句话变成 Prompt，然后让电话机器人拨号。但这会留下很多问题：

- 餐厅电话是多少？
- 电话号码属于哪个地区？
- 应该使用什么语言？
- “有位置”就算完成，还是还要自动预订？
- 如果无人接听，是任务失败还是应该重试？
- 电话执行到一半服务重启怎么办？
- 用户刷新网页后，如何恢复进度？

CALL-E 会把这项工作拆成下面的流程：

```text
用户提出目标
  ↓
MainAgent 理解需求并补齐阻塞信息
  ↓
创建 Goal 和 GoalBrief
  ↓
GoalAgent 生成 RunSpec
  ↓
创建 Run，真正拨打一次电话
  ↓
保存状态、Transcript 和执行结果
  ↓
GoalAgent 判断是否成功、失败或需要重试
  ↓
提交 Report
  ↓
MainAgent 用自然语言把结果告诉用户
```

一次电话没有接通，只代表一个 `Run` 没有达到目标，并不必然意味着整个 `Goal` 已经失败。GoalAgent 可以根据约束和证据决定等待、重试、调整方案或者停止。

## 2. 核心概念总览

| 概念 | 新手类比 | 实际作用 |
|---|---|---|
| User Chat Session | 一个微信聊天窗口 | 保存用户与 MainAgent 的长期对话 |
| Foreground Turn | 一轮问答 | 用户发一条消息，MainAgent 处理一次 |
| Goal | 一张长期工单 | 表示用户真正希望完成的事情 |
| GoalBrief | 工单需求说明 | 固定目标、事实、限制和成功标准 |
| GoalAgent Session | 工单负责人的工作笔记 | 保存 GoalAgent 对一个 Goal 的连续理解 |
| Goal Event | 工单操作日志 | 记录创建、更新、确认和执行结果等事实 |
| Goal Iteration | 工单负责人工作一次 | 处理一批新 Event，然后重新等待 |
| RunSpec | 执行方案或 SOP | 描述电话应该如何执行 |
| Run | 一次真实尝试 | 一次真实外呼或其他执行 |
| RunGroup | 一组执行 | 批量外呼时组织多个 Run |
| Report | 结果报告 | 汇总执行结果和相关证据 |
| Workspace | 工单文件夹 | 保存 YAML、Markdown 和原始结果等大文件 |

这些词里，最容易混淆的是 Session、Goal、GoalAgent、Iteration 和 Run。

### 2.1 Session 不等于 Goal

`User Chat Session` 是用户看得见的聊天容器；`Goal` 是在聊天中产生的一项具体任务。

例如，同一个聊天窗口里，用户先让 CALL-E 询问餐厅，任务结束后又让它联系酒店。它们可以成为两个历史 Goal，但架构希望同一时刻最多只有一个 Active Goal，以免用户说“停止”“继续”时系统不知道指的是哪项任务。

### 2.2 Goal 不等于 GoalAgent

- Goal 是数据库里的业务对象。
- GoalAgent 是负责推进 Goal 的 AI 角色。
- GoalAgent 进程停止，不代表 Goal 消失。
- 服务恢复后，新的 GoalAgent 可以根据 Goal 状态和 Event 继续处理。

因此，Goal 不是一段 Prompt，也不是一次模型调用。

### 2.3 Iteration 不等于 Run

- `Iteration` 是 GoalAgent 思考、决策和调用工具的一轮。
- `Run` 是系统对现实世界真正执行的一次尝试。

GoalAgent 可能经过多次 Iteration 才创建一个 Run；批量任务中，也可能在一次 Iteration 里创建多个 Run。

## 3. 总体架构

CALL-E Goal 主链路可以画成下面这样：

```text
┌────────┐
│  用户   │
└───┬────┘
    │ 自然语言目标
    ▼
┌─────────────────────┐
│ MainAgent            │
│ 理解、澄清、提交目标   │
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
│ 游标、租约、派发、事务、恢复   │
└──────────┬───────────────────┘
           │ 根据 goal_type
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
                   用户
```

这里最重要的架构接缝是：

> MainAgent 和 GoalAgent 不直接互相调用，也不在同一个模型循环里进行 SDK handoff。

它们通过数据库状态、Goal Event 和 Runtime 派发进行通信。MainAgent 把信息写进 Goal 的事件流，GoalAgent 被 Runtime 异步唤醒；GoalAgent 完成一轮工作后，再通过结构化 Context Delivery 把结果交给 MainAgent。

这种设计把任务执行与浏览器连接分开。用户关闭页面、SSE 断开或者刷新浏览器，不会自动取消已经接受的 Goal。网页只是观察任务，不拥有任务。

## 4. MainAgent：面向用户的前台

MainAgent 是用户直接交谈的角色。它的核心规则位于：

```text
services/seleven-mcp/src/calle/agentic/instructions/root_orchestrator.md
```

MainAgent 主要负责：

1. 判断用户提出的是哪一种电话目标。
2. 只询问真正阻塞执行的问题。
3. 校验电话号码、地区、时区和通话语言。
4. 生成稳定的 `GoalBrief`。
5. 调用 `commit_goal` 创建 Goal。
6. 将用户后续的更新、确认和停止请求通过 `notify_goal` 投递给 Goal。
7. 接收 GoalAgent 的结果，再用自然语言告诉用户。

MainAgent 不负责：

- 编写电话 Prompt；
- 创建 RunSpec；
- 真正拨号；
- 分析 Transcript；
- 编写最终报告。

这是一种职责隔离。MainAgent 面向“用户正在表达什么”，GoalAgent 面向“已经接受的任务接下来怎么推进”。

## 5. GoalBrief：固定 WHAT，不决定 HOW

`GoalBrief` 是 MainAgent 在 Goal 创建时提交的稳定需求合同，定义位于：

```text
services/seleven-mcp/src/calle/schemas/agentic/goal.py
```

它包含：

| 字段 | 含义 |
|---|---|
| `objective` | 最终要达到的结果 |
| `facts` | 电话、时间、人数、语言等已知事实 |
| `constraints` | 隐私、安全、精确措辞和禁止事项 |
| `success_criteria` | 哪些可观察结果代表任务完成 |
| `narrative` | 任务背景和上下文摘要 |
| `source_refs` | 用户上传文件或其他材料引用 |

例如餐厅询价 Goal 的 GoalBrief 可以概念性地表示为：

```yaml
objective: 确认餐厅周五晚上 7 点是否有两人桌
facts:
  phone_number: "+1..."
  region: US
  call_language: English
  date: Friday
  time: 7 PM
  party_size: 2
constraints:
  - 只询问是否有位置，不要自动预订
success_criteria:
  - 获得明确的有位或无位答复
  - 如果无法确认，记录具体原因
```

GoalBrief 只回答“做什么”。电话如何开场、如何处理语音信箱、如何结束对话等执行细节属于 RunSpec。

## 6. commit_goal 与 notify_goal：命令不是直接调用

MainAgent 通过两个主要工具驱动 Goal 生命周期：

```text
commit_goal
notify_goal
```

实现位于：

```text
services/seleven-mcp/src/calle/agentic/tools/goals/lifecycle.py
```

### 6.1 commit_goal

`commit_goal` 会：

1. 创建 Goal；
2. 保存 GoalBrief；
3. 写入 `goal_created` 和 `goal_committed` Event；
4. 将 Goal 标记为需要派发；
5. 返回稳定的 `goal_id`。

它的名字刻意不是 `run_goal` 或 `execute_goal`。后两种名字容易让人误以为 MainAgent 会同步调用 GoalAgent，并一直等待结果。

真实语义是：

```text
提交 Goal → 写入事件 → 请求异步派发 → MainAgent 当前轮次可以结束
```

### 6.2 notify_goal

用户后续说“改成周六”“继续”“停止”或者批准一个方案时，MainAgent 调用 `notify_goal`，写入明确的 Event：

```text
user_update
nudge_requested
confirmed
declined
stop_requested
```

GoalAgent 下一次 Iteration 只需要读取这些新 Event，不需要重新分析整个用户聊天历史。

## 7. Goal 的三类持久化数据

Goal 主要由三张表支撑。

### 7.1 calle_goals：当前快照

`calle_goals` 保存快速读取所需的当前状态：

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

它类似工单系统中的“工单详情页”。

### 7.2 calle_goal_events：不可变历史

`calle_goal_events` 保存追加式审计日志，例如：

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

它类似银行流水：当前余额可以变化，但历史交易不能因为页面刷新而消失。

### 7.3 calle_goal_dispatches：消费者状态

`calle_goal_dispatches` 保存 GoalAgent 的运行控制信息：

```text
last_processed_goal_event_id
active_iteration_id
lease_until
iteration_status
next_wakeup_at
needs_dispatch
```

可以用“收件箱”理解这组关系：

```text
Goal Events     = 收到的邮件
Dispatch Cursor = 已经读到第几封
Iteration Lease = 当前由哪位处理人接管
needs_dispatch  = 是否还有邮件待处理
```

## 8. GoalIterationRunner：Runtime 的核心模块

一次 GoalAgent Iteration 由下面的模块驱动：

```text
services/seleven-mcp/src/calle/agentic/runtime/goal_iteration_runner.py
```

外部只需要调用：

```python
run_goal_iteration(goal_id=...)
```

内部则隐藏了大量复杂行为：

1. 读取 Goal 和 Dispatch 状态；
2. 检查是否有未处理 Event；
3. 申请带有效期的 Iteration Lease；
4. 从上次游标之后读取新 Event；
5. 创建或恢复 Goal 专属的 GoalAgent Session；
6. 根据 `goal_type` 选择 GoalAgent；
7. 组装本轮模型输入；
8. 执行模型和工具；
9. 验证结构化完成结果；
10. 更新 Goal、追加 Event、推进游标；
11. 释放 Lease；
12. 将需要展示的结果写入 User Chat Session。

租约用于避免两个 Worker 同时修改同一个 Goal。游标用于确保 GoalAgent 知道哪些 Event 已经处理，哪些是刚刚到达的新信息。

## 9. GoalAgent Session：重要，但不是业务真相

每个 Goal 都有一个独立、可持久化的 GoalAgent Session，其 ID 由 `goal_id` 稳定派生。

它保存 GoalAgent 的模型上下文，因此同一个 Goal 被多次唤醒时，Agent 不必每次从零理解任务。这对长任务质量很重要。

但它不是业务真相的唯一来源：

- Goal 当前状态在 `calle_goals`；
- 历史事实在 `calle_goal_events`；
- 执行结果在 Run 和 Run Event；
- 大型证据在 Workspace；
- 报告元数据在 Report 记录。

因此，GoalAgent Session 可以理解为“负责人的工作笔记”，而数据库状态和 Event 才是“正式工单档案”。

## 10. OutboundGoalAgent 与 InboundGoalAgent

Runtime 会根据 `goal_type` 选择不同的 GoalAgent 适配器。

### 10.1 OutboundGoalAgent

负责主动外呼：

```text
one_shot_outbound
batch_outbound
progressive_outbound
```

它拥有的主要工具包括：

```text
read_current_goal
list_supported_voice_targets
create_run_spec
submit_voice_run
commit_report
complete_goal_iteration
```

它的目标通常是把一项有限任务推进到可验证终态。

### 10.2 InboundGoalAgent

当前实现中的 Goal Type 是：

```text
inbound
```

它负责热线知识准备、RunSpec 生成、模拟测试、热线绑定和周期报告。

InboundGoalAgent 不亲自承担每通来电中的低延迟实时对话。实时通话仍由 Voice Agent 执行，InboundGoalAgent 负责通话前准备和通话后整理。

## 11. RunSpec：可版本化的 HOW

RunSpec 描述执行方案，而不是一次真实执行。

例如，一个餐厅询价 RunSpec 可能是：

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

同一个 Goal 可以拥有多个 RunSpec 版本：

```text
RunSpec v1：只询问室内座位
RunSpec v2：室内无位时也询问室外座位
RunSpec v3：用户把时间改成周六
```

RunSpec 的创建入口位于：

```text
services/seleven-mcp/src/calle/agentic/tools/goals/voice_run.py
```

GoalAgent 先在 Workspace 中写入 YAML，再调用 `create_run_spec` 注册。工具会保存路径、校验和、版本、Lineage 和 Runtime Profile，而不是把整份 Prompt 重复塞进每个工具参数。

## 12. Run：一次真实执行

`Run` 表示一次真实外呼尝试。

```text
Goal：确认餐厅是否有位置

Run 1
  使用 RunSpec v1
  结果：无人接听

Run 2
  使用 RunSpec v1
  结果：接通，有位置
```

Run 会记录：

- 使用的 RunSpec 版本和校验和；
- 目标电话号码快照；
- Runtime Profile 快照；
- 当前状态；
- Provider Task ID；
- Transcript 快照；
- 结构化结果；
- 证据引用；
- 开始和结束时间。

`submit_voice_run` 只创建 `queued` 状态的 Run 并立即返回。GoalAgent 不会等待电话打完。

```text
GoalAgent
  → submit_voice_run
  → Run: queued
  → 当前 Iteration 结束并等待事件

VoiceRunExecutor
  → 认领 Run
  → 调用 Botlab / Calling
  → 更新 running / completed / failed
  → 写入 Run Event 和 Goal Event
  → 再次唤醒 GoalAgent
```

批量任务使用 RunGroup 组织多个 Run。不同接收人的话术不同，就应该使用不同 RunSpec，而不是把多个人的差异硬塞进同一份 Prompt。

## 13. complete_goal_iteration：结构化结束一轮工作

GoalAgent 不能仅仅输出一句“已经完成”作为系统事实。每一轮都必须调用：

```text
complete_goal_iteration
```

其参数对应 `GoalIterationResult`，主要包括：

| 字段 | 作用 |
|---|---|
| `summary` | 本轮内部摘要 |
| `goal_state_patch` | 建议更新的 Goal 状态 |
| `events_to_emit` | 希望追加的 Goal Event |
| `iteration_status` | 本轮结束后空闲还是等待事件 |
| `resume_after_minutes` | 建议多久后重新唤醒 |
| `projection` | 给 MainAgent 或 UI 的小型状态视图 |
| `artifact_refs` | Run、Report、Evidence 等引用 |
| `context_deliveries` | 需要交给 MainAgent 的明确消息 |
| `related_run_ids` | 本轮涉及的 Run |

GoalAgent 负责判断，Runtime 负责验证和安全落库。Runtime 不会从普通 Assistant 文本中解析 Goal 状态，也不会因为模型写了一句“已完成”就直接修改数据库。

## 14. Context Delivery：GoalAgent 不直接对用户说话

GoalAgent 需要用户确认、补充信息或查看结果时，会创建 Context Delivery：

```text
status
result
user_input_required
confirmation_request
```

例如：

```yaml
kind: confirmation_request
summary: 电话执行方案已经准备好，需要确认是否拨打
ref:
  kind: run_spec
  id: run_spec_xxx
delivery_mode: wake_with_context
```

Runtime 将它持久化为 User Chat Session Event，再唤醒 MainAgent。MainAgent 根据用户的语言和当前对话生成自然回复。

这样可以避免：

- GoalAgent 内部 JSON 直接出现在聊天界面；
- GoalAgent 绕过 MainAgent 向用户说话；
- 确认请求因为浏览器断线而丢失；
- MainAgent 根据模糊文本猜测 GoalAgent 的业务语义。

## 15. Report：结果文件不等于完成状态

GoalAgent 可以根据 Run、Transcript 和 Evidence 生成 Markdown 或 JSON 报告，但写出一个文件不代表系统已经正式接受这份报告。

正式流程是：

```text
GoalAgent 在 Workspace 写报告
  ↓
commit_report 验证路径、格式和 JSON Schema
  ↓
保存 Report 元数据、版本和校验和
  ↓
写入 report_committed Goal Event
  ↓
通过 Context Delivery 告诉 MainAgent
```

`commit_report` 位于：

```text
services/seleven-mcp/src/calle/agentic/tools/goals/report.py
```

它不会自动撰写报告，也不会直接通知用户，更不会执行报告里的建议。它只负责把已经存在的报告 Artifact 注册为可追踪的正式结果。

## 16. 数据库与 Workspace 的职责

数据库保存权威、可查询的产品状态：

```text
Goal 当前状态
Goal Event
RunSpec 版本和状态
Run 状态与结构化结果
Transcript 快照
Report 元数据
Dispatch 游标和租约
```

Workspace 保存较大的 Artifact：

```text
RunSpec YAML
Markdown 报告
原始 Provider JSON
录音引用
调试 Trace
证据文件
```

因此，Runtime 不能通过“文件夹里有没有 `report.md`”判断 Goal 是否完成。文件可以存在但尚未提交，也可能是草稿、旧版本或失败尝试留下的 Artifact。

## 17. 三个重要可靠性设计

### 17.1 Lease：保证单写者

GoalIterationRunner 在调用模型前先申请 Lease。Lease 未过期时，其他 Worker 不能同时推进同一个 Goal，避免重复外呼或状态互相覆盖。

### 17.2 Cursor：只处理新增 Event

Dispatch 记录 `last_processed_goal_event_id`。第一次 Iteration 接收 Goal Bootstrap 和全部初始 Event；后续 Iteration 只读取游标之后的新 Event。

### 17.3 Idempotency Key：处理重复提交

HTTP 重试、消息重复投递或者进程异常都可能让同一个命令到达多次。Goal Event、Run 和 Report 使用 Idempotency Key 避免重复创建现实世界副作用。

此外，Goal 还区分：

- `goal_version`：目标本身发生变化时递增；
- `state_revision`：任何状态更新时递增。

这让系统可以区分“用户改变了目标”和“同一目标只是继续推进”。

## 18. 一条完整 Outbound Goal 时序

把前面的概念串起来，一次完整外呼大致是：

```text
1. 用户：帮我问餐厅周五 7 点有没有两人桌

2. MainAgent
   - 判断 one_shot_outbound
   - 运行电话号码与语言 Preflight
   - 生成 GoalBrief
   - commit_goal

3. Goal Store
   - 创建 Goal
   - 追加 goal_created / goal_committed
   - needs_dispatch = true

4. GoalIterationRunner
   - 获取 Lease
   - 读取新 Event
   - 恢复 GoalAgent Session
   - 选择 OutboundGoalAgent

5. OutboundGoalAgent
   - 加载 voice-agent-run-strategy
   - 写 RunSpec YAML
   - create_run_spec

6. 如果需要用户确认
   - complete_goal_iteration
   - context_delivery: confirmation_request
   - MainAgent 向用户提问
   - 用户批准后 notify_goal: confirmed

7. 下一轮 Goal Iteration
   - 读取 confirmed Event
   - submit_voice_run
   - 创建 queued Run
   - 结束 Iteration，等待结果

8. VoiceRunExecutor
   - 通过 Botlab / Calling 执行真实电话
   - 更新 Run 状态
   - 保存 Transcript 和结果
   - 写入 run_completed 或 run_failed

9. GoalAgent 再次被唤醒
   - 评估结果和成功条件
   - 决定完成、失败、重试或请求用户输入
   - 生成并 commit Report
   - 更新 Goal 状态

10. Context Delivery
    - 把 result 或 report_ready 交给 MainAgent
    - MainAgent 用用户语言返回最终结果
```

## 19. 当前代码中的演进痕迹

这套架构仍在快速演进，阅读源码时会遇到一些历史设计与当前实现不完全一致的地方。

### 19.1 多 Goal 迁移尚未完全收口

已接受的 ADR 允许一个 User Chat Session 保存多个历史 Goal，并规定同一时刻最多一个 Active Goal。GoalStore 也已经可以创建多个 Goal。

但当前自动派发路径仍使用旧的 `get_v1_goal_by_session_id()`。当一个 Session 里已经存在多个 Goal 时，这条旧路径仍可能触发 one-goal-per-session 错误。

相关位置：

```text
services/seleven-mcp/src/calle/agentic/goals/store.py
services/seleven-mcp/src/calle/agentic/agents/calle.py
```

### 19.2 Goal 状态词汇尚未完全统一

`current_status` 当前仍是字符串，而不是严格状态枚举。代码和测试中可以看到：

```text
planning
onboarding
needs_confirmation
awaiting_confirmation
calling
active
live
```

这表示状态机的语义仍需要继续收敛。

### 19.3 Inbound Goal Type 名称发生过变化

较早规格使用 `inbound_hotline`，当前代码实际使用 `inbound`。阅读历史文档时，应以当前运行时代码和 Active Spec 为准。

### 19.4 当前热路径仍包含进程内后台任务

Goal Dispatch 已经拥有持久化游标和 Lease，但当前 MainAgent 完成后主要通过进程内 `asyncio` 后台任务启动 Goal Iteration。完整的跨进程调度、定时唤醒和崩溃恢复仍是持续演进方向。

## 20. 推荐源码阅读顺序

如果准备自己读代码，推荐按下面顺序：

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

## 21. 最终心智模型

最后把所有概念压缩成一条主线：

```text
用户对话
  → MainAgent 整理 GoalBrief
  → commit_goal
  → Runtime 派发 GoalAgent
  → GoalAgent 生成 RunSpec
  → 创建真实 Run
  → 外部电话执行
  → Run Event 重新唤醒 GoalAgent
  → GoalAgent 判断结果并生成 Report
  → Context Delivery 唤醒 MainAgent
  → MainAgent 告诉用户
```

从架构角度看，CALL-E Goal 系统真正解决的不是“如何让模型打一次电话”，而是：

> 如何让一个自然语言目标在断线、重试、多人协作、异步执行和多次现实世界尝试中，仍然拥有清晰、可恢复、可审计的生命周期。
