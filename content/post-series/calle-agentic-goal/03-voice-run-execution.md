---
title: "追踪 RunSpec → Run → VoiceRunExecutor——真实电话如何被安全执行"
summary: "从 GoalAgent 的执行策略一路追到 Botlab 与 Calling，解释 RunSpec 版本、Run 快照、异步提交、状态机、证据和终态回传。"
---

本文基于 `prod-dive-in` 提交 `aa7af64`。上一篇停在 `GoalIterationRunner` 返回 `voice_run_ids` 的位置；这一篇继续向下，追踪一个语音执行策略怎样变成耐久 Run，最终触发 Botlab Voice Agent 与 Calling 拨号任务。

如果你刚开始读源码，先记住一句话：**RunSpec 是可复用、可版本化的执行说明；Run 是某个目标、配置与说明在某一刻冻结下来的一次真实尝试；VoiceRunExecutor 才负责跨越外部副作用边界。**

## 1. 这一篇解决什么问题

继续使用餐厅例子。GoalAgent 已经决定需要打电话询问明晚 7 点是否有两人位，但“决定要打”距离真正拨号仍有很长一段路：

- 电话 Agent 到底应该说什么，保存在哪里？
- 同一套策略修改后，旧 Run 怎样证明自己执行的是哪个版本？
- 用户重复点击或模型重试，会不会创建两通相同电话？
- `submit_voice_run` 返回时，电话已经打出去了吗？
- 谁把 `queued` Run 交给真正的语音执行器？
- 外部平台的 task ID、转写和原始响应保存在哪里？
- 电话结束后，GoalAgent 怎样知道该继续判断结果？

这些问题对应三层不同对象：

| 对象 | 核心问题 | 是否代表现实副作用 |
|---|---|---|
| RunSpec | 这类电话应该怎样执行？ | 否 |
| Run | 这一次要对谁、用哪一版配置执行？ | 还没有；初始只是 `queued` 记录 |
| VoiceRunExecutor | 怎样创建外部 Agent、提交拨号并收集终态？ | 是 |

这一篇只讨论 outbound 真实电话主链。Inbound hotline 与多目标 batch 会在相关位置点出差异，但不会抢走主线。

## 2. 先看完整调用链

把一次成功的单目标电话压缩成下面这张图：

```text
OutboundGoalAgent
  ├─ 用 voice-agent-run-strategy 形成电话策略
  ├─ 写 goals/{goal_id}/run_specs/.../voice_instruction.yaml
  ├─ create_run_spec(...)
  │    ├─ 校验 workspace 路径
  │    ├─ 计算 instruction checksum
  │    ├─ 创建 / 复用 CalleRunSpec
  │    └─ APPEND Goal Event: run_spec_created
  ├─ 等待确认，或判断请求已预授权
  └─ submit_voice_run(...)
       ├─ 解析目标、runtime profile 与 SIP line
       ├─ ensure RunGroup
       ├─ create Run(status=queued)
       ├─ APPEND Run Event: run_queued
       ├─ APPEND Run Event: voice_run_requested
       └─ 发出 VoiceRunRequestedEvent / pending_voice_run_ids

Goal iteration 产品事务提交
  ▼
CallEAgent._schedule_voice_run_lifecycles(...)
  ▼
VoiceRunExecutor.submit(run_id)
  ▼
BotlabCallingVoiceRunExecutor
  ├─ claim queued → running
  ├─ 校验冻结的 RunSpec checksum
  ├─ Botlab: create voice agent
  ├─ Calling: create dialer task
  ├─ 实时事件流 + Calling 结果轮询
  ├─ 保存 transcript / raw evidence / terminal status
  └─ APPEND Goal Event: run_completed 或 run_failed
                         request_dispatch=true
  ▼
再次进入 GoalIterationRunner
```

整条链最重要的分界线是：`submit_voice_run` **登记并请求一次异步执行**，它不等待电话结束；真正的外部调用由 post-commit 后台生命周期完成。

## 3. RunSpec、Run 和 Run Event 各自保存什么

第一次读这部分源码，最容易把三个名词当作同一张“电话任务表”。可以先用软件发布来类比：

```text
RunSpec ≈ 带版本的发布配置
Run     ≈ 某次部署实例
RunEvent≈ 这次部署过程中发生的时间线
```

映射回餐厅电话：

- RunSpec：开场白、要问的问题、不可越过的边界、结束条件；
- Run：使用 RunSpec v2，拨打 `+1...`，目标是 Northstar Bistro，runtime profile 是某个冻结版本；
- Run Event：已排队、开始运行、Voice Agent 已创建、拨号任务已创建、转写可用、电话结束。

`CalleRunRecord` 还把最终结果、证据引用、转写快照、外部 provider 和外部 task ID 聚合成当前快照。Event 提供历史，Run 提供快速读取的当前状态，两者不能互相替代。

## 4. GoalAgent 先写策略 Artifact，而不是把大段 Prompt 塞进工具参数

Outbound GoalAgent 的指令要求：准备好后加载 `voice-agent-run-strategy`，把 RunSpec YAML 写入：

```text
goals/{goal_id}/run_specs/{slug}/voice_instruction.yaml
```

然后只把 `instruction_path`、描述、可选标题等小字段传给 `create_run_spec`。概念上的 YAML 可以是：

```yaml
bot_name: RestaurantAvailability
task_base_prompt: |
  Call Northstar Bistro.
  Ask whether a table for two is available tomorrow at 7 PM.
  Record deposit or minimum-spend requirements.
  Do not make a reservation without additional authorization.
```

这样做把两类数据分开：

| 数据 | 放置位置 |
|---|---|
| 较长、可检查、可由 Agent 迭代的执行说明 | Goal workspace artifact |
| 需要进入数据库与 API 的身份、版本和引用 | RunSpec record |

工具不会接受任意文件路径。`_read_instruction_artifact()` 只允许当前 Goal scope 下的 `goals/` 根目录，拒绝绝对路径、`../` 逃逸和其他 Goal 的文件；空文件同样失败。

## 5. create_run_spec 怎样把文件变成耐久版本

`create_run_spec` 读取 artifact 后计算 SHA-256 checksum。对于 voice RunSpec，Store 写入：

- `spec_kind="voice_call"`；
- `executor_kind="voice_agent"`；
- `instruction_ref` 与 `instruction_checksum`；
- `lineage_id`、`version` 与 `status`；
- `runtime_profile_key`；
- `input_refs.workspace_refs`；
- `generated_by="OutboundGoalAgent"`；
- Goal Event `run_spec_created`。

这里的两个版本概念要分开：

```text
lineage_id：同一份策略长期演进的家族
version：这个家族中的第几版
```

当 `activate=true` 时，新版本会把同一 lineage 中原来的 active 版本设为 superseded，并记录 `supersedes_run_spec_id`。这让“当前可执行版本”明确，同时保留旧 Run 所引用的历史版本。

工具还会先按 `instruction_checksum + runtime_profile_key` 查找仍为 `draft` 或 `active` 的候选。相同 artifact 重试会返回已有 `run_spec_id` 和 `reused=true`，而不是无意义地生成新版本。

## 6. RunSpec 创建不等于已经获准拨号

RunSpec 只是可检查的执行提案，不是电话本身。Outbound 指令给出两条路径：

- 完整的单联系人即时请求通常可以视为预授权；
- 有歧义、安全或合规风险、未来调度、batch 或其他非显然不可逆动作时，需要确认。

需要确认时，GoalAgent 以 `run_spec_id` 作为不可变授权对象，请 MainAgent 展示给用户；只有该版本获批后才提交执行。如果 RunSpec 在确认后又被修改，新的 ID / version 不能借用旧确认。

当前源码边界也必须说准确：`submit_voice_run()` 会验证 scope、RunSpec 身份、目标和运行配置，但它本身没有查询一张“用户已批准”表。是否已经确认或预授权由调用它的 GoalAgent 按指令负责。也就是说：

```text
Agent policy 决定“现在可不可以调用”
Tool boundary 保证“调用时具体执行什么，并留下耐久记录”
```

不要把工具描述中的 calling-agent responsibility 误读成 runtime 已经实现了独立授权账本。

## 7. submit_voice_run 的第一层：拒绝模糊目标

`SubmitVoiceRunArgs` 至少包含 `goal_id`、`run_spec_id` 与 `RunTargetSnapshot`。目标快照可以保存显示名、电话号码、region、timezone、call locale，以及每个目标特有的 task/opening/question。

真正创建 Run 前，工具会：

1. 确认调用上下文只能操作当前 Goal；
2. 把电话号码规范到唯一 E.164；
3. 检查号码 region 与显式 region 是否冲突；
4. 要求 RunSpec 属于当前 Goal、处于 `active`，且确实是 voice spec；
5. 按目标 region / locale 解析 voice runtime profile；
6. 检查 profile 是否支持目标语言和地区；
7. 从显式参数或 OAuth 用户公司与线路配置解析 SIP line。

因此，像 `15517028333` 这样的裸号码不会在这里靠猜测直接拨出。它必须在前置目标准备阶段解析为唯一 E.164，例如 `+8615517028333`。

## 8. Runtime profile 为什么要先解析、再冻结

Voice runtime profile 描述实际执行基础设施，例如：

- engine kind 与 Botlab 语音配置；
- dialer kind、地区、时区和调度窗口；
- 支持的 locale；
- Calling line region；
- polling 与等待参数。

`submit_voice_run` 先解析当前有效 profile；随后 `CalleRunRegistry.create_run()` 把解析结果作为 `RunInputPayload.runtime_config.voice_runtime_profile` 快照写进 Run。

这解决了一个时间问题：如果管理员在电话排队以后修改了 profile，这个 Run 应该执行“提交时的配置”，而不是悄悄漂移到“启动时的最新配置”。快照里包含 config key、entry ID、version、scope、checksum 和 payload，因此之后选择 backend、语言和 dialer 参数都有可审计依据。

## 9. 为什么单通电话也有 RunGroup

`submit_voice_run` 会先确保 `RunGroup`。普通餐厅电话使用：

```text
kind = singleton
item_key = primary
lifecycle = finite
status = running
```

RunGroup 看起来对单次执行略显多余，但它为 batch 提供统一聚合边界：多个供应商电话可以共享一个 `multi_item` group，每个目标拥有稳定 `run_group_item_key`，最后只有全部 item 进入终态时才发出一次 `run_group_completed` Goal Event。

对于 batch，代码还保护一个容易忽略的语义：如果每个收件人的 task、opening、live message 或 question 不同，就不能假装它们共享同一个 RunSpec；应为不同措辞创建各自的 RunSpec。

## 10. create_run 冻结了哪些身份

`CalleRunRegistry.create_run()` 在 Goal 行锁内创建 `queued` Run，并把以下字段固定下来：

| 字段 | 意义 |
|---|---|
| `run_spec_id` | 选中的具体 RunSpec |
| `run_spec_lineage_id/version/checksum` | 当时的策略身份 |
| `target_snapshot` | 这次实际要联系的对象 |
| `runtime_config` snapshot | 这次实际使用的配置版本 |
| `run_group_id/item_key` | 聚合与 batch 身份 |
| `trigger_kind/ref` | 谁因为什么触发 |
| `status="queued"` | 已登记但尚未执行 |

同时追加 `run_queued` Run Event。注意 Run 保存的是快照：后续 RunSpec 变成 superseded、联系人资料更新或 runtime profile 改版，都不应改写已经排队的这次历史尝试。

## 11. 两层幂等分别保护什么

这条链有两种不同的去重：

### RunSpec 去重

相同 instruction checksum 与 runtime profile 会复用现有 draft/active RunSpec。

### Run 去重

单次 Run 的幂等键由这些稳定信息派生：

```text
goal_id + run_group_id + run_group_item_key + target_digest
```

`target_digest` 优先使用 `target_ref`，其次是 phone hash、电话号码或完整 target JSON。`create_run()` 锁定 Goal 后查询该键；重试时返回原 Run。

随后 `voice_run_requested:{run_id}` 作为 Run Event 幂等键，防止同一个 queued Run 被重复请求执行。返回值中的 `submit_requested` 会告诉调用者这次是否真的产生了新请求。

这保护的是 CALL-E 自己的耐久登记，不代表外部 provider 已经具备端到端 exactly-once。外部副作用的崩溃窗口会在后面单独讨论。

## 12. submit 返回 queued，而不是“电话已开始”

创建 Run 后，工具只做三件与调度有关的事：

```text
APPEND Run Event: voice_run_requested
AgentCTX.pending_voice_run_ids 加入 run_id
向 context queue 写 VoiceRunRequestedEvent(run_id)
```

然后立刻返回：

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

此时没有 Botlab Agent，也没有 Calling task。产品文案只能说“已排队 / 将开始”，不能说“已经接通”或“电话完成”。这是工具名中的 submit 与实际执行之间最重要的语义边界。

## 13. 为什么要等 Goal iteration 提交后再启动生命周期

第二篇看到，`GoalIterationRunner` 会从 context queue 与 `pending_voice_run_ids` 收集 Run ID，放进 `GoalIterationRunResult.voice_run_ids`。`CallEAgent` 在产品事务成功提交后才执行 `schedule_pending_work()`：

```text
Goal iteration COMMIT
  ↓
读取 result.voice_run_ids
  ├─ 如果为空，回查数据库中的 queued voice Run
  ↓
_schedule_voice_run_lifecycles(run_ids)
```

数据库 fallback 很重要：进程内 queue 是快速交接，不是唯一真相。如果工具事务已经创建 queued Run，但 iteration 在收集内存事件前失败，后续成功派发仍可以通过查询 queued Run 找回它。

这也解释了为什么不能在 `submit_voice_run()` 内直接拨号：工具事务可能尚未提交，外部电话却无法被数据库 rollback 撤销。先提交耐久 Run，再启动副作用，至少保证现实动作有一个可追踪的本地身份。

## 14. VoiceRunExecutor 是 backend 路由层

`VoiceRunExecutor` 本身很薄。它先读取 Run：

- terminal：直接返回当前状态；
- `running`：`submit()` 也直接返回，避免重新创建；
- `queued`：根据冻结 profile 选择 backend；
- 其他状态：拒绝。

Backend key 是：

```text
(voice_profile.engine.kind, voice_profile.dialer.kind)
```

当前默认注册的是 `("botlab", "calling") → BotlabCallingVoiceRunExecutor`。这让 Run 保存“要使用的能力组合”，Facade 决定交给哪一个真正实现，而 GoalAgent 不需要知道 provider SDK 细节。

## 15. queued → running：副作用前的本地 Claim

`BotlabCallingVoiceRunExecutor.submit()` 首先调用 `claim_queued_run()`。Store 锁定 Run 行，只允许：

```text
queued → running
```

如果已经是 `running` 或 terminal，返回 `claimed=false`；只有一个调用者能越过这道门。成功 Claim 会写 `started_at` 和 `run_status_updated` Event。

接着 Executor 重新读取 RunSpec instruction，并同时核对：

1. Run 冻结的 `run_spec_checksum`；
2. RunSpec record 当前保存的 checksum；
3. inline instruction 的实际 hash（如果存在）；
4. workspace artifact 的实际 hash（如果存在）。

任何不一致都在 provider 调用前失败。也就是说，即使磁盘上的 YAML 在排队后被改过，这个 Run 也不会静默执行新内容。

Executor 再追加 `voice_run_started`，并在调用 provider 之前 commit `running` 状态。外部系统因此不会收到一通完全没有本地运行记录的电话。

## 16. 真正跨越副作用边界的两个 Provider 调用

Botlab + Calling backend 分两步创建外部资源：

```text
engine_provider.create_agent(...)
  ├─ 读取 RunSpec base prompt
  ├─ 合并 voice runtime core / channel rules / output contract
  └─ Botlab 创建 Voice Agent 与 version

dialer_provider.create_task(...)
  ├─ 解析 Calling robot_id
  ├─ 使用 IAMS account timezone 计算调度窗口
  ├─ 绑定 SIP line 与目标 E.164
  └─ Calling 创建拨号 task
```

每一步之后都写 Run Event 并 commit：

- `voice_agent_created` 保存 provider、agent ID、version ID；
- `voice_dialer_task_created` 保存 Calling `task_id` 与 robot ID；
- Run 当前快照保存 `external_provider`、`external_run_id`、`external_status`。

这里还能看到 prompt 职责分层：RunSpec 只写本次餐厅任务；voice runtime 再统一注入 IVR、voicemail、screening、live-human、弱信号和输出契约。GoalAgent 不需要把共享传输规则复制进每个 RunSpec。

## 17. 终态为什么同时监听实时流和轮询接口

拨号 task 创建后，Executor 并行启动：

- DM realtime Event stream；
- Calling task detail polling。

实时流延迟低，能提供 ASR 与过程 Event；Calling 最终详情通常拥有更完整的 provider 状态、call ID、hangup 信息和 transcript。代码不会简单地“谁先回来就永远相信谁”，而是设置 race grace window，并在 realtime terminal 后尝试用 Calling final 进行 reconcile。

概念上是：

```text
               ┌─ DM realtime ── 过程事件 / 快速终态 ─┐
Calling task ──┤                                      ├─ 状态决策
               └─ Calling polling ─ 最终详情 / transcript ┘
```

如果 realtime 不可用，系统记录内部 `dm_realtime_unavailable`，然后继续依赖 Calling detail；实时通道是增强证据，不是唯一完成路径。

## 18. 终态不是一行 status，而是一组证据

`_apply_dialer_result()` 会把 provider 结果转换成内部 Run 状态，并持久化：

- 原始 provider JSON artifact；
- normalized transcript artifact；
- realtime raw/transcript artifact（如果存在）；
- `RunTranscriptSnapshot`；
- `RunEvidenceRefs`；
- `RunResultPayload`，包括 outcome、summary、reason bucket 与 provider diagnostics；
- `transcript_ready`、`voice_call_completed` 等 Run Event；
- 面向前端的 `voice_run.update` Session Event。

终态集合不仅有成功和失败，还包括 `COMPLETED`、`FAILED`、`NO ANSWER`、`DECLINED`、取消与 timeout 等。特别注意：provider 生命周期“结束”不等于用户目标“成功”。`NO ANSWER` 可以是 terminal Run，但 GoalAgent 仍可能决定重试；`COMPLETED` 也需要结合 transcript 判断餐厅是否真的给出了答案。

因此，Executor 负责结构化事实与证据，不负责替 GoalAgent完成最终业务判断。

## 19. 电话结束后怎样重新唤醒 GoalAgent

Run 进入 terminal 后，Executor 追加 Goal Event：

```text
失败类 terminal → run_failed
其他 terminal   → run_completed
```

Event payload 包含 `run_id`、status 与可用 evidence refs，并设置：

```text
request_dispatch = true
```

于是第一篇中的 `needs_dispatch` 再次变为 true，第二篇中的 `GoalIterationRunner` 从 Cursor 后读到这条终态 Event。完整闭环是：

```text
GoalAgent 决定执行
  → queued Run
  → VoiceRunExecutor
  → terminal Run + evidence
  → Goal Event(request_dispatch=true)
  → 下一轮 GoalAgent 判断重试、等待或完成
```

对于 singleton，单个 Run 终态就唤醒 Goal；对于 `multi_item` RunGroup，只有全部 item terminal 且 group 第一次完成时才追加 `run_group_completed`，避免每个 batch item 都触发一轮不完整总结。

`CallEAgent._run_voice_run_lifecycle()` 收到 `terminal_goal_event_id` 后，会立即调用 `_run_goal_dispatch(goal_id)`，把耐久唤醒信号变成下一次实际 iteration。

## 20. 失败恢复与 exactly-once 的真实边界

普通 provider 异常会被 backend 捕获，`_mark_failed()` 会：

```text
Run.status = FAILED
APPEND Run Event: run_failed
APPEND Goal Event: run_failed, request_dispatch=true
COMMIT
返回 terminal VoiceRunExecutionResult
```

这让配置错误、Botlab 创建失败或 Calling 调用失败都能回到 GoalAgent，而不是让 Run 永久停在未知状态。

但源码级理解必须继续问：进程如果正好在外部副作用之后崩溃呢？当前实现通过 Run 幂等键、`queued → running` Claim、阶段性 commit 与外部 ID 持久化缩小窗口，却不能宣称端到端 exactly-once：

- Botlab Agent 已创建、`voice_agent_created` 尚未提交时，可能留下外部孤儿；
- Calling task 已创建、`external_run_id` 尚未保存时，本地无法直接知道已有 task；
- Run 已 commit 为 `running`、但尚无 `external_run_id` 时，`refresh()` 也无法查询 provider task。

一旦 `external_run_id` 已耐久保存，`refresh()` 可以在不重建 Agent / task 的情况下恢复轮询。更早的崩溃窗口则需要 provider 侧幂等键、按 `run_id` 对账或运维恢复机制才能彻底闭合；当前提交没有展示完整的自动 reconcile。

准确的结论是：**CALL-E 已经建立了可靠的本地身份、状态机和证据链，但“外部副作用绝不重复”不能只靠数据库事务推导出来。**

## 21. 用测试和源码校验心智模型

建议先读这些行为测试：

| 测试 | 固定的契约 |
|---|---|
| `test_create_run_spec_tool_reads_goal_workspace_artifact_and_reuses_checksum` | Artifact scope、checksum 与 RunSpec 复用 |
| `test_submit_voice_run_queues_executor_request_for_selected_run_spec` | queued Run、RunGroup 与异步请求 |
| `test_submit_voice_run_rejects_invalid_run_spec_identity_without_side_effects` | 无效 spec 在写入前失败 |
| `test_create_run_snapshots_selected_run_spec_and_is_idempotent` | RunSpec 身份冻结与 Run 去重 |
| `test_create_run_freezes_runtime_profile_snapshot` | 配置快照不会随未来改动漂移 |
| `test_voice_run_executor_rejects_instruction_identity_before_provider_calls` | checksum 不一致时不触碰 provider |
| `test_voice_run_executor_commits_started_state_before_provider_calls` | 外部副作用前先提交 running |
| `test_voice_run_executor_writes_events_artifacts_and_terminal_goal_event` | 终态、证据与 Goal 唤醒闭环 |
| `test_voice_run_executor_refreshes_existing_running_task_without_recreating` | 已有 external task 时只 refresh |

源码建议按这个顺序阅读：

1. `agentic/instructions/domain/outbound.md` 与 `agentic/skills/voice-agent-run-strategy/SKILL.md`
2. `agentic/tools/goals/voice_run.py`
3. `agentic/runs/spec_store.py` 与 `agentic/runs/registry.py`
4. `schemas/agentic/run.py` 与 `db/models/run.py`
5. `agentic/agents/calle.py` 中的 post-commit 调度
6. `voice_runtime/executor/__init__.py`
7. `voice_runtime/executor/botlab_calling.py`
8. `voice_runtime/executor/providers.py`、`prompt.py` 与 `botlab.py`
9. `tests/test_calle_agentic_run_store.py` 与 `tests/test_calle_voice_runtime.py`

路径均相对于 `services/seleven-mcp/src/calle/`（测试除外）。源码会继续变化，所以符号与行为测试比瞬时行号更值得记忆。

最后把整篇压缩成六句话：

1. RunSpec 是有 lineage、version 与 checksum 的执行策略，不是一次电话。
2. `submit_voice_run` 校验目标与配置，创建带快照的 `queued` Run，但不等待现实执行。
3. RunSpec 复用、Run 幂等键与 `voice_run_requested` Event 分别阻止不同层级的重复登记。
4. Goal iteration 提交后，CallEAgent 才把 Run 交给 VoiceRunExecutor；Executor 再由冻结 profile 选择 backend。
5. Botlab 创建 Voice Agent，Calling 创建并执行拨号 task；实时流与轮询共同形成状态、转写和证据。
6. Terminal Run 追加 `run_completed` / `run_failed` Goal Event 并重新派发，GoalAgent 才在下一轮判断目标是否真的完成。

下一篇将从这条终态 Goal Event 开始，追踪 `Report → Context Delivery → MainAgent`，解释证据怎样变成可提交 Report，以及后台结果怎样可靠回到用户对话。
