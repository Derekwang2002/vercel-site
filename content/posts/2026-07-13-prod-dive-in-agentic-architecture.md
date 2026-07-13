---
title: "prod-dive-in 技术全景：Agent 如何把一句话变成一通真实电话"
date: 2026-07-13
summary: "从 CALL-E、桌面 Agent 到浏览器接管，拆解 prod-dive-in 的主要链路、分层架构、技术栈，以及 Goal、RunSpec、Run、Report 背后的 Agentic 设计。"
tags: [agent, architecture, voice-ai, python]
selected: true
draft: false
---

很多 AI 应用都能“聊”，但真正困难的部分通常发生在聊天框之外：用户只说一句自然语言，系统如何确认目标、补齐信息、调用真实服务、跨越几分钟甚至几天持续执行，并在失败后继续推进？

`prod-dive-in` 正是在解决这类问题。它不是一个单体应用，而是一套正在演进的 Agent 产品与基础设施集合。其中最完整的一条业务主线是 **CALL-E**：让用户用自然语言交代电话任务，由系统规划、拨号、跟踪通话，再把结果整理成可追溯的报告。仓库里还包含一套桌面通用 Agent、浏览器自动化、人工接管和实时音频理解能力。

本文基于仓库提交 `14837ff` 阅读源码。为了避免把设计稿当成已经上线的功能，文中会明确区分：

- **已经进入当前代码主链路的实现**；
- **保留在规范或后续阶段设计中的能力**；
- **仍在并行运行的旧版链路**。

如果只记住一句话，可以记住这句：

> `prod-dive-in` 的核心不是“让一个大模型不断调用工具”，而是把自然语言目标变成有状态、可恢复、可审计的长期任务，再让不同 Agent 分工完成它。

## 1. 先看全局：这其实是两套 Agent 产品

仓库采用 monorepo 组织方式。顶层的 `apps/`、`services/` 和 `packages/` 不是简单的前后端拆分，而是承载了两套相对独立的产品链路。

### 1.1 CALL-E：围绕电话目标工作的 Agent

这一条链路的关键模块是：

| 模块 | 作用 |
|---|---|
| `apps/calle-web` | 用户账户、计费、电话 Agent 对话与任务结果界面 |
| `services/seleven-mcp` | CALL-E API、Agent 运行时、电话执行、MCP 工具与持久化 |
| `services/seleven-mcp/src/calle/agentic` | 新一代 Goal 驱动的 Agentic 核心 |
| `services/seleven-mcp/src/calle/voice_runtime` | 电话 Agent 的提示词拼装、供应商接入与执行生命周期 |
| `apps/seleven-mcp-console-web` | 服务运维与调试控制台 |

它的主链路可以先压缩成一行：

```text
用户对话
  → MainAgent 理解需求并提交 Goal
  → GoalAgent 制定 RunSpec
  → VoiceRunExecutor 发起真实电话
  → 通话记录与结果回流
  → GoalAgent 判断下一步并提交 Report
  → Web 端通过 SSE 收到进度和结果
```

### 1.2 桌面通用 Agent：操作浏览器和本机工具

另一条链路更像一个桌面 AI 工作台：

| 模块 | 作用 |
|---|---|
| `apps/electron` | Electron 桌面端、对话 UI、本地进程管理 |
| `services/seleven-bridge` | 桌面端与 Python Agent 之间的 FastAPI 桥接层 |
| `services/seleven-agents` | 通用 Agent、工具、子 Agent、浏览器自动化与 LiveLens |
| `apps/devtools-host` / `apps/devtools-frontend` | 浏览器调试和可视化操作能力 |
| 浏览器扩展 | 页面连接、音频采集和本地桥接 |

它的链路是：

```text
Electron UI
  → seleven-bridge
  → SelevenAgent
  → 本地工具 / 浏览器 Agent / 动态子 Agent / LiveLens
  → NDJSON 事件流
  → Electron 将过程渲染为可读时间线
```

这两套系统共享“模型、工具、事件流、可观测性”等思路，但**不是同一个统一运行时**。理解这一点很重要，否则很容易把 CALL-E 的 GoalAgent、桌面端的动态子 Agent，以及旧版 MCP 电话工具误认为同一层东西。

### 1.3 仓库总目录图

先把两条产品线放回同一棵目录树中。下面只保留理解架构所需的主干，省略构建产物、测试夹具和普通配置文件：

```text
prod-dive-in/
├── apps/                              # 面向用户或开发者的应用
│   ├── calle-web/                     # CALL-E Web 产品
│   ├── seleven-mcp-console-web/       # MCP / CALL-E 运维控制台
│   ├── electron/                      # 桌面 Agent 客户端
│   ├── chrome-extension/              # 第一代浏览器扩展
│   ├── chrome-extension-v2/           # 新版浏览器扩展
│   ├── devtools-host/                 # DevTools 本地宿主
│   ├── devtools-frontend/             # DevTools 可视化前端
│   └── ios/                           # iOS 客户端方向
│
├── services/                          # Python 服务与 Agent runtime
│   ├── seleven-mcp/                   # CALL-E、MCP、电话运行时
│   ├── seleven-bridge/                # Electron ↔ Agent 桥接服务
│   ├── seleven-agents/                # 桌面通用 Agent 能力
│   └── seleven-cloud/                 # 云端服务相关能力
│
├── packages/                          # 跨应用复用的软件包
│   ├── py/                            # Python 共享包
│   └── ts/                            # TypeScript 共享包
│
├── contracts/                         # 跨进程、跨语言的数据契约
├── specs/                             # 功能规范与阶段性设计
├── docs/                              # 架构、实验和内部说明
├── mocks/                             # 本地演练所需的模拟站点
├── playground/                        # CUA、录制等技术实验
└── scripts/                           # 开发环境和仓库级脚本
```

沿着业务链路阅读时，可以把它简化成两条“目录路径”：

```text
电话 Agent：apps/calle-web
              └─→ services/seleven-mcp

桌面 Agent：apps/electron
              └─→ services/seleven-bridge
                    └─→ services/seleven-agents
                          └─→ 浏览器 / 本机 / 音频能力
```

## 2. 整体分层：界面、编排、领域与基础设施

从架构层面看，仓库大致可以分成四层。

| 层级 | 负责什么 | 代表模块 |
|---|---|---|
| 表现层 | 收集用户输入、展示流式过程和结果 | CALL-E Web、Electron、控制台、浏览器扩展 |
| 应用与编排层 | 决定一次请求如何进入 Agent、何时运行工具、如何调度后台任务 | API session、turn pump、Goal iteration runner、bridge use case |
| 领域层 | 定义 Goal、RunSpec、Run、Report、Session、Message 等业务对象和规则 | `calle/agentic`、bridge domain |
| 基础设施层 | 数据库、消息队列、模型供应商、电话供应商、浏览器和本机能力 | PostgreSQL、Redis、RabbitMQ、Botlab、Calling、OpenAI、CDP |

用一个更直观的剖面图表示：

```text
┌──────────────────────────────────────────────────────────┐
│ 表现层：CALL-E Web / Electron / Console / Browser Extension │
└───────────────────────┬──────────────────────────────────┘
                        │ HTTP + SSE / NDJSON / IPC
┌───────────────────────▼──────────────────────────────────┐
│ 应用编排：Session、Turn Pump、Goal Runner、Bridge Use Case  │
└───────────────────────┬──────────────────────────────────┘
                        │ 领域命令与事件
┌───────────────────────▼──────────────────────────────────┐
│ 领域模型：Goal → RunSpec → Run → Report                   │
│          Session → Message → Event                       │
└───────────────────────┬──────────────────────────────────┘
                        │ Ports / Providers
┌───────────────────────▼──────────────────────────────────┐
│ 基础设施：DB、队列、LLM、电话平台、浏览器、操作系统、可观测性 │
└──────────────────────────────────────────────────────────┘
```

这里最值得注意的不是层数，而是**模型不直接拥有系统事实**。大模型负责理解和决策，数据库、事件、状态机和校验器才负责记录“事情究竟进行到了哪一步”。

## 3. CALL-E 主链路：从一句话到一份电话报告

### 3.1 CALL-E 核心目录图

CALL-E 的核心代码集中在 `services/seleven-mcp/src/calle`。下面这张图把目录与后文的运行链路一一对齐：

```text
services/seleven-mcp/src/calle/
├── apps/api/                          # HTTP 与 SSE 接入层
│   ├── v1/sessions/
│   │   ├── chat_routes.py             # 接收用户消息
│   │   └── routes.py                  # 会话增删改查
│   └── runtime/
│       ├── agent_session.py           # 一次 API Agent 会话
│       ├── turn_pump.py               # SDK 事件转产品事件
│       └── event_stream.py            # 持久事件 + 实时流
│
├── agentic/                           # Goal 驱动的核心领域
│   ├── agents/
│   │   ├── calle.py                   # CallEAgent 总入口
│   │   ├── orchestrator.py            # MainAgent 编排
│   │   ├── outbound.py                # 出站 GoalAgent
│   │   └── goal.py                    # Goal Agent 公共结构
│   ├── goals/                         # Goal 记录与存储
│   ├── runs/                          # RunSpec、Run 与状态
│   ├── reports/                       # Report 读取与持久化
│   ├── runtime/
│   │   └── goal_iteration_runner.py   # Goal 的迭代、租约、游标
│   ├── sessions/                      # 上下文、记忆与会话存储
│   ├── tools/
│   │   ├── builtins/                  # 预检、提问、计划工具
│   │   └── goals/                     # Goal / Run / Report 工具
│   ├── skills/                        # 按需加载的领域知识
│   └── events.py                      # Agentic 领域事件
│
├── voice_runtime/                     # 单通电话执行层
│   ├── executor/
│   │   ├── botlab.py                  # Botlab Voice Engine 适配
│   │   ├── botlab_calling.py          # Calling 拨号执行器
│   │   ├── prompt.py                  # 电话提示词拼装
│   │   └── providers.py               # 供应商端口与注册
│   └── instructions/                  # IVR、留言、转接等规则
│
├── db/models/                         # SQLAlchemy 持久化模型
├── schemas/                           # API 与领域 Schema
└── workspace/                         # Goal 产物的隔离工作区
```

按箭头追代码时，可以使用这条最短阅读路线：

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

假设用户说：

> 帮我给餐厅打电话，问问周五晚上七点四个人有没有位置；有的话订一个靠窗的。

下面按真实代码链路拆开看。

### 3.2 Web 端先创建会话，再发送消息

`apps/calle-web` 使用 React 构建对话界面。一次新对话大致包含三个动作：

1. `POST /v1/sessions` 创建会话；
2. `POST /v1/sessions/{id}/messages` 提交用户消息；
3. `GET /v1/sessions/{id}/events` 建立 SSE 连接，持续接收 Agent 事件。

这里的 SSE 不是只能看“此刻”的临时连接。前端会保存事件游标，重连时携带 `Last-Event-ID`。服务端先重放游标之后已经写入数据库的事件，再切换到实时流。因此刷新页面或短暂断网后，不必要求模型重跑一遍才能恢复界面。

服务端发回的也不只有文本 token，还包括：

- 消息快照与增量；
- 推理阶段状态；
- 工具调用与结果；
- 计划更新；
- Goal 调度状态；
- 电话 Run 状态；
- 需要用户确认的请求；
- 报告提交事件。

也就是说，前端呈现的是一个**任务过程**，不只是一个打字机效果。

### 3.3 API 接收消息，但不把 HTTP 请求挂到任务结束

`chat_routes.py` 会先完成鉴权、租户和会话归属检查，然后返回 `202 Accepted`。实际的 Agent turn 由 `ApiSessionRegistry` 管理，在后台任务中执行。

用户消息会先作为持久化的 `message.snapshot` 写入事件存储。随后 `turn_pump.py` 把 OpenAI Agents SDK 产生的模型文本、工具输出和推理事件，转换成 CALL-E 自己定义的事件信封，再交给 SSE 和数据库。

这样做解决了两个问题：

- HTTP 请求不用等待一通电话真正结束；
- 模型供应商的原始事件不会直接泄漏成前端协议，产品可以拥有稳定的事件语义。

### 3.4 MainAgent 像前台需求经理，只负责把需求说清楚

`CallEAgent` 内部首先运行的是 MainAgent。它的职责非常克制：

- 理解用户真正想完成的事情；
- 把电话号码规范化为 E.164；
- 推断或确认地区、时区、通话语言和主叫资料；
- 识别缺失信息，只在确实阻塞时提问；
- 判断任务是否违反安全规则；
- 把稳定的目标提交为 Goal。

MainAgent **不会亲自拨号，也不负责最后写报告**。它更像前台或需求经理：先把自然语言整理成一份不会随聊天措辞漂移的任务说明。

提交 Goal 时，系统会写入一个 `GoalBrief`。它强调的是 **WHAT**，也就是：

- 目标是什么；
- 已知事实有哪些；
- 有哪些约束；
- 什么算成功；
- 原始需求和来源引用是什么。

它不会过早规定具体怎么打、打几次、何时重试。那是 GoalAgent 的工作。

### 3.5 GoalAgent 像持续负责项目的项目经理

Goal 提交后，前台对话 turn 可以结束，但目标没有结束。`CallEAgent` 会发现处于待调度状态的 Goal，启动 `GoalIterationRunner`。

GoalAgent 与 MainAgent 有独立的持久上下文。它不是一次 SDK handoff，也不是被 MainAgent 当作普通工具调用一次，而是围绕同一个 Goal 多次醒来：

```text
Goal 创建
  ↓
GoalAgent 第 1 次迭代：制定计划并提交电话 Run
  ↓
等待外部电话执行
  ↓
收到 Run 成功、失败或新证据
  ↓
GoalAgent 第 2 次迭代：继续尝试、调整计划或生成报告
  ↓
Goal 达到终态
```

每次迭代时，Runner 会：

1. 读取持久化 Goal；
2. 检查 dispatch 状态和事件游标；
3. 领取数据库租约，避免同一个 Goal 被并发重复执行；
4. 只加载上次游标之后的新事件；
5. 复用确定性的 Goal 专属 Agent session；
6. 要求 GoalAgent 最终调用一次 `complete_goal_iteration`；
7. 原子地应用状态补丁、追加事件并推进游标；
8. 释放租约。

这个设计很像“项目经理每天只看昨天之后的新邮件”，而不是每次醒来都把全部历史聊天、通话录音和数据库内容塞进上下文。

### 3.6 RunSpec 把目标翻译成可执行工单

GoalAgent 读取 Goal 后，会创建 `RunSpec`。如果 Goal 是“订到周五晚餐的位置”，RunSpec 则说明这一轮实际怎么做。

它通常包含：

- 这次要联系谁；
- 电话号码与地区；
- 这通电话的具体目标；
- 必须确认的信息；
- 可以接受和不能接受的条件；
- 遇到 IVR、语音信箱、转接、等待时怎么处理；
- 最终需要返回哪些结构化字段。

电话 Agent 的指令会先写入 Goal 工作区中的 YAML 文件，再由 `create_run_spec` 校验路径、内容、版本和校验和，持久化成可追溯的 RunSpec。

这里多了一层看似麻烦的中间对象，但价值很大：Goal 不会因为一次执行策略变化而被覆盖；每次真实执行都能回答“当时究竟按照哪一版工单做的”。

### 3.7 提交 Run 前再做一次副作用校验

`submit_voice_run` 才是真正靠近外部副作用的工具。它会再次校验：

- 电话号码是否仍是合法 E.164；
- 地区与线路能力是否匹配；
- Voice runtime profile 是否可用；
- SIP 或 Calling 线路是否已经准备好；
- 幂等键是否已经对应一个既有 Run；
- 当前任务是否需要用户确认。

完整、单一收件人、立即执行且风险明确的电话，可以在策略允许时预授权。模糊任务、预约任务、批量任务，或存在不明显不可逆行为的任务，会先生成确认请求，经 MainAgent 回到用户对话中。

这体现了一个重要原则：**不要只在提示词里写“请谨慎”，而要把高风险动作收口到少数工具，并在工具入口实施硬校验。**

### 3.8 VoiceRunExecutor 把工单交给电话现场执行员

Run 创建后，`VoiceRunExecutor` 负责完整的电话生命周期。当前 calling 场景使用 Botlab 与 Calling 两类供应商适配器：

- Botlab 侧创建电话 Bot 及其版本；
- IAMS OAuth 负责服务身份与授权；
- Calling 侧解析线路、创建拨号任务并发起呼叫；
- Redis stream 可用于订阅电话过程中的 DM 事件；
- 通话结束后拉取 transcript 和 final result。

Voice Agent 的提示词不是一整段手写字符串，而是按层拼装：

```text
通用核心规则
  + 本次 RunSpec 的任务指令
  + IVR 处理规则
  + 语音信箱处理规则
  + 筛选、等待与转接规则
  + 真人对话规则
  + 弱信号与不确定信息处理
  + 结构化输出契约
```

这使“电话怎么说”和“系统怎么调度”保持分离。Voice Agent 是现场执行员，它只需要把这一通电话做好，不需要理解整个产品的会话、计费和任务恢复机制。

### 3.9 结果不是直接拼成一句话，而是重新进入 Goal 循环

电话到达成功、失败、取消等终态后，系统会写入 Run 事件、证据和产物，并再次唤醒 GoalAgent。

GoalAgent 根据目标判断：

- 信息是否已经足够；
- 是否需要换一个号码或再尝试；
- 是否需要用户补充条件；
- Goal 是否可以结束；
- 应该生成怎样的报告。

当目标可以结案时，它会使用报告 skill 生成不可变的 `report.md` 与 `report.json`。`commit_report` 再验证工作区边界、校验和与 Schema，记录报告版本，并通过 `context.delivery` 和 SSE 把结果送回 MainAgent 与 Web 界面。

因此，真正的闭环不是：

```text
用户 → LLM → 电话工具 → 一段回答
```

而是：

```text
用户 → 对话理解 → 持久 Goal → 版本化计划 → 外部 Run
     → 证据与事件 → 新一轮目标判断 → 版本化 Report → 用户
```

## 4. Agentic 能力究竟设计在哪里

“用了大模型”和“做成 Agent”不是一回事。这个仓库给出的 Agent 公式可以概括为：

```text
Model
+ Instructions
+ Tools
+ Context
+ State
+ Memory
+ Harness
+ Guardrails
+ Evals
```

模型只是其中一个部件。真正让系统可以自主推进目标的，是下面这些设计共同作用的结果。

### 4.1 三种角色，而不是一个万能 Agent

| 角色 | 通俗类比 | 主要职责 | 刻意不做什么 |
|---|---|---|---|
| MainAgent | 前台 / 需求经理 | 理解用户、补齐阻塞信息、提交目标、传递状态 | 不亲自拨号，不维护长期执行细节 |
| GoalAgent | 项目经理 | 围绕 Goal 多轮规划、提交 Run、吸收结果、判断是否继续、写报告 | 不处理 Web 协议，不直接操作电话供应商 |
| Voice Agent | 现场执行员 | 完成某一通电话并返回证据 | 不负责整个 Goal 的长期状态 |
| Runtime | 调度中心 + 账房 + 档案室 | 持久化、租约、游标、幂等、事件、恢复和交付 | 不替模型做语义判断 |

这种拆分控制了每个 Agent 的认知范围。一个万能 Agent 既要记住用户偏好，又要管理重试，还要应对 IVR 和供应商异常，提示词会越来越长，工具权限也会越来越大。分层以后，每个角色只拿完成本职工作所需的信息和能力。

### 4.2 Goal、RunSpec、Run、Report 是四个不同概念

这是 CALL-E Agentic 设计里最关键的领域模型。

| 对象 | 它回答的问题 | 餐厅订位示例 |
|---|---|---|
| Goal | 最终想得到什么 | 周五 19:00 为四个人订到合适的位置 |
| RunSpec | 这一次准备怎么做 | 给 A 餐厅打电话，询问余位、靠窗条件和保留时间 |
| Run | 实际发生了哪次尝试 | 13:05 发起电话，等待 32 秒，对方无人接听 |
| Report | 最终怎样向用户交付 | 已订到 B 餐厅，确认号、时间、取消规则如下 |

四者分开后，系统才有能力表达这些现实情况：

- 同一个 Goal 可以有多个 RunSpec 版本；
- 一个 RunSpec 可以产生一次或多次执行尝试；
- 某次 Run 失败，不代表 Goal 失败；
- Report 可以包含多个 Run 的证据；
- 用户修改约束时，可以保留原有执行历史。

这就是“以结果为中心”与“以一次工具调用为中心”的根本区别。

### 4.3 前台循环与后台循环彼此分开

CALL-E 同时维护两个节奏不同的循环：

```text
前台对话循环（秒级）
用户消息 → MainAgent → 解释 / 提问 / 提交 Goal → 返回用户

后台目标循环（分钟、小时，未来可以更长）
新事件 → GoalAgent → 计划 / 执行 / 等待 → 新事件 → GoalAgent
```

用户不需要一直保持浏览器连接，MainAgent 也不需要为了等电话接通而占住一次模型响应。两条循环通过持久事件和 `context.delivery` 交换信息，而不是共享一块随时可能丢失的内存对象。

### 4.4 Context、State、Memory 各司其职

这三个词经常被混用，在这里可以用“桌面、台账、档案库”来理解：

- **Context 是当前办公桌**：模型这一轮真正看得到的少量材料；
- **State 是业务台账**：Goal 当前状态、Run 状态、游标、确认状态等权威事实；
- **Memory 是档案库**：帮助跨轮次保持语义连续性，但不能取代数据库事实。

GoalAgent 每次只读取游标之后的新事件，并通过结构化工具读取当前 Goal。大文件、提示词和报告放进隔离工作区，用相对路径与校验和引用。OpenAI Responses 的 `previous_response_id` 和上下文压缩记录也会被保存，便于延续和审计。

这种设计能避免两种常见问题：

1. 把所有历史塞给模型，导致成本、延迟和注意力污染不断上升；
2. 把模型“记得的内容”当成业务真相，进程重启或上下文压缩后就无法恢复。

### 4.5 Skill 负责按需加载知识，Tool 负责受控执行动作

CALL-E 没有把全部规则都塞进常驻 system prompt。MainAgent 的基础指令保持较小，只有需要规划出站电话时才加载 `outbound-planner`。GoalAgent 也按需加载电话运行策略和一次性通话报告 skill。

可以这样区分：

- **Skill** 更像岗位手册，告诉 Agent 某类问题应如何思考；
- **Tool** 更像带权限和参数校验的业务按钮，真正读取状态或产生副作用；
- **Schema** 像表单，约束 Agent 必须用什么结构提交结果。

GoalAgent 能使用的工具被收缩为一组领域动作：

```text
read_current_goal
create_run_spec
submit_voice_run
commit_report
complete_goal_iteration
```

工具少并不是能力弱，而是让 Agent 的行动空间与业务状态机对齐。比如它不能绕过 `submit_voice_run` 直接调用供应商 API，也不能只说“我完成了”却不调用 `complete_goal_iteration`。

### 4.6 事件是系统之间的收据，不是调试日志

数据库中不仅有 Goal、Run 和 Report 的当前快照，还有按顺序追加的事件。会话事件拥有单调递增的 cursor，Goal dispatch 也维护消费游标。

事件在这里承担四个职责：

- 给 SSE 提供断线重放；
- 唤醒后台 Goal 循环；
- 让不同 Agent 交换上下文；
- 为审计、恢复和调试保留因果链。

一次工具调用是否成功，不能只看模型最后说了什么，而要看是否产生了对应的持久记录。事件就像银行流水：界面可以换，模型可以压缩上下文，但已经发生的业务动作仍有凭据。

### 4.7 幂等、租约和游标构成“可恢复”的底座

Agent 会遇到大量重复场景：SSE 重连、任务重试、进程重复消费、用户连点两次、供应商回调重复到达。如果没有工程约束，一个聪明的 Agent 也可能打出两通相同电话。

当前代码用几类机制降低风险：

- Goal 级租约防止并发执行同一迭代；
- dispatch cursor 只消费新增事件；
- RunSpec 版本和校验和避免静默覆盖；
- Run 与外部操作使用幂等键；
- 终态事件再次触发 GoalAgent，而不是依赖原协程永远存活；
- 报告使用版本化、不可变产物；
- 工作区按租户、会话和 Goal 隔离。

这类代码通常没有提示词抢眼，却决定了系统能否从 Demo 走到生产环境。

### 4.8 Human-in-the-loop 是协议的一部分

人工确认不是 Agent 卡住后临时弹一个对话框，而是正式的上下文交付类型。GoalAgent 可以产出 `confirmation_request`，MainAgent 把它翻译成用户能理解的问题；用户确认后，再由新的事件推动 Goal 继续。

仓库中的安全策略还明确拒绝或限制：

- 欺骗与冒充；
- 诈骗、骚扰和恶意批量呼叫；
- 索取 OTP、支付凭证等敏感信息；
- 把紧急情况交给普通电话 Agent 处理。

技术上的关键点是：软规则写进指令，硬边界放进工具、身份、线路能力和数据校验中。两者缺一不可。

### 4.9 Evals 与 tracing 也是 Agent 架构

仓库接入 Langfuse、OpenInference 等 tracing 能力，并把 session、run 和供应商执行关联起来。旧版 one-shot 电话链路还积累了较完整的评估体系：

- 硬规则检查；
- LLM judge；
- 端到端测试 harness；
- 用户与文本模拟器；
- 针对真实语音交互的 voice gym。

对 Agent 来说，普通单元测试只能证明函数在固定输入下工作。Evals 还要回答：模型是否正确理解目标、是否在该追问时追问、是否遵守约束、不同提示词版本是否退化。仓库文档强调得很直接：没有 trace 和 eval 的 Agent，还不能算生产就绪。

## 5. 旧版 one-shot 电话链路为什么还在

`services/seleven-mcp` 中还保留着一套成熟度较高的旧版一次性电话工具。它的基本流程是：

```text
plan_call
  → 必要时澄清
  → 生成确认 token
  → run_call
  → Taskiq worker
  → Botlab + Calling
  → 监控、转写、总结
  → get_call_run
```

这条链路以一次 call run 为中心，适合“计划一通电话，然后执行并查询结果”。它拥有提示词生成、计划修复、运行时提示词、总结 Agent、Widget、guardrail 和 E2E eval 等完整配套。

新旧两代的差别不是“旧版没有 AI，新版有 AI”，而是状态模型不同：

| 维度 | 旧版 one-shot | 新版 Goal-driven |
|---|---|---|
| 核心对象 | 一次 CallRun | 一个长期 Goal |
| 规划 | 为单次电话生成计划 | 为目标生成版本化 RunSpec |
| 失败后 | 调用方决定是否再来一次 | GoalAgent 可以吸收结果后继续推进 |
| 用户交互 | plan / confirm / run / get | 对话 + 后台目标循环 + context delivery |
| 结果 | 单次通话结果与总结 | 可汇总多个 Run 的版本化 Report |
| 后台执行 | Taskiq worker | 当前新链路以持久状态配合进程内异步任务为主 |

因此，仓库目前更像“新架构逐步吸收旧链路经验”的阶段，而不是已经把旧系统完全替换掉。

## 6. 桌面 Agent 链路：从对话扩展到浏览器与操作系统

CALL-E 是垂直领域 Agent，`services/seleven-agents` 则是一套更通用的桌面 Agent runtime。

### 6.1 桌面 Agent 核心目录图

桌面产品把 UI、桥接服务和 Agent runtime 分成三个独立工程。它们的目录关系与运行方向如下：

```text
prod-dive-in/
├── apps/electron/                     # 桌面表现层与本地进程管理
│   └── src/
│       ├── main/                      # Electron 主进程
│       ├── preload/                   # 受限 IPC 能力暴露
│       └── renderer/                  # React 对话与事件时间线
│
├── services/seleven-bridge/
│   └── src/seleven_bridge/
│       ├── interface/api/             # /agent_chat 等 HTTP 路由
│       ├── application/use_cases/     # AgentChatUseCase 等用例
│       ├── domain/
│       │   ├── entities/              # Session、Message、File
│       │   ├── repositories/          # 仓储端口
│       │   └── services/              # Agent 与并发锁端口
│       └── infrastructure/
│           ├── adapters/              # SelevenAgent 适配器
│           └── repositories/          # SQLite / 本地文件实现
│
└── services/seleven-agents/
    └── src/seleven_agents/
        ├── agents/
        │   ├── seleven_agent.py       # 通用 Agent 运行入口
        │   ├── agent_factory.py       # 按 YAML 组装 Agent
        │   ├── subagent/              # 动态子 Agent
        │   ├── browser/               # Browser Agent 与 CDP
        │   ├── computer_agent/        # 操作系统 / CUA 适配
        │   └── livelens/              # 实时语音理解管线
        ├── tools/
        │   ├── plan/ shell/ search/   # 计划、终端与搜索
        │   ├── sandbox/ file/         # Python 与文件处理
        │   └── takeover/ report/      # 人工接管与报告
        ├── integrations/
        │   ├── extension/             # 浏览器扩展音频桥
        │   └── speech/                # STT 供应商适配
        ├── schemas/                   # 流事件与工具 Schema
        └── scheduler/                 # 通用任务调度器
```

从目录可以直接看出依赖方向：Electron 只认识 Bridge 的协议，Bridge 通过 adapter 调用 Agent，Agent 再访问浏览器或本机工具。UI 不需要知道 `browser-use`、STT 或 Python sandbox 的实现细节。

### 6.2 Electron 不直接运行 Python Agent

Electron 渲染层发送 `/agent_chat?protocol=data` 请求，由 `services/seleven-bridge` 负责承接。Bridge 使用 FastAPI，并按六边形架构拆分：

- domain：Session、Message 和仓储接口；
- application：`AgentChatUseCase`；
- infrastructure：SQLite / 内存仓储、`SelevenAgentAdapter`；
- interface：HTTP API 路由。

Bridge 把“给模型的 messages”和“给界面看的 display events”分开保存。前者追求上下文简洁，后者要完整呈现工具过程、浏览器步骤和人工接管记录。这个分离与 CALL-E 的 Context / State 区分是一致的。

### 6.3 Agent Factory 负责组装，而不是写死一个 Agent

`SelevenAgent` 基于 OpenAI Agents SDK 的 streaming runner。`agent_factory` 根据 YAML 配置组合：

- 指令和 persona；
- 模型及推理参数；
- 允许使用的工具；
- 静态配置的子 Agent；
- 动态创建子 Agent 的能力。

配置中的子 Agent 会被包装为工具。动态 `spawn_subagent` 则先校验子 Agent 请求的工具是否属于父 Agent 的允许集合，再创建独立 Agent 运行，并通过队列把带来源标记的事件转发回父流程。

这里的“子 Agent”与 CALL-E GoalAgent 不同：

- 桌面子 Agent 是通用任务中的临时分工机制；
- CALL-E GoalAgent 是具有独立持久上下文和业务生命周期的领域角色。

两者都在分解复杂度，但一个偏运行时委派，一个偏持久领域编排。

### 6.4 工具覆盖本机、数据和浏览器

桌面 Agent 的工具集包括：

- 计划与任务工作区；
- 本地 shell；
- Firecrawl 搜索；
- Python sandbox 与数据处理；
- 文件和文档转换；
- 调度器；
- Computer Agent；
- 最终报告；
- 浏览器启动、关闭和 Browser Agent；
- Human Takeover；
- LiveLens。

Browser Agent 封装 `browser-use`，可连接 CDP，并把每一步浏览器操作转换成结构化 `browser.step` 事件。遇到验证码、登录授权或模型不适合处理的页面时，Human Takeover 会发出带 inspector URL 的事件，桌面端让用户接手；用户完成后，Agent 再继续执行。

### 6.5 LiveLens 给 Agent 增加“听”的能力

LiveLens 的链路大致是：

```text
浏览器扩展采集音频
  → 本地 audio bridge
  → TEN VAD 检测语音区间
  → OpenAI / Omni STT 转写
  → 可选 sherpa-onnx 说话人区分
  → 增量摘要与会后总结
  → transcript / summary 产物与实时事件
```

它不是简单把录音文件扔给一个模型，而是持续产生可消费的转写和摘要事件，让桌面 Agent 与 UI 能在会议或网页音频进行时就看到进度。

## 7. 仓库已经实现了哪些具体功能

按产品能力归纳，当前仓库覆盖以下几类功能。

| 能力面 | 具体功能 |
|---|---|
| CALL-E 对话 | 会话创建、消息发送、流式事件、历史重放、搜索、重命名、删除 |
| 目标管理 | Goal 提交、调度、状态投影、确认请求、上下文交付 |
| 电话执行 | 号码预检、线路能力判断、RunSpec、拨号、IVR/语音信箱/等待/转接处理 |
| 结果交付 | transcript、结构化 final result、证据产物、Markdown/JSON 报告 |
| 账户与商业化 | 登录、账户资料、余额、充值、用量和计费界面 |
| 电话号码 | 号码目录、购买、激活、计费和释放相关服务能力 |
| 旧版 MCP | `plan_call`、`run_call`、`get_call_run` 等一次性电话工具 |
| 桌面 Agent | 对话、规划、文件处理、shell、数据分析、报告和任务工作区 |
| 浏览器自动化 | Browser Agent、CDP 调试、步骤事件、人工接管 |
| 实时理解 | 音频采集、VAD、STT、说话人区分、增量与会后总结 |
| 运维与质量 | 控制台、tracing、日志、评估集、模拟器和 E2E harness |

仓库还提供隔离的模拟器和测试命名空间，用于在不污染真实生产数据的情况下演练电话与 Agent 流程。

## 8. 技术栈一览

这是一个明显的 TypeScript + Python 多运行时系统。

### 8.1 CALL-E Web

| 类别 | 技术 |
|---|---|
| UI | React 19、TypeScript 5.9、Vite 7 |
| 路由与数据 | React Router 7、TanStack Query 5、Zustand 5 |
| Agent UI | assistant-ui、AI SDK 6 |
| 样式与组件 | Tailwind CSS 4、shadcn/Radix |
| 表单与校验 | React Hook Form、Zod |
| 测试 | Vitest |

前端目录使用 `app / platform / design-system / shared-kernel / bounded-contexts` 的领域化组织。服务端数据由 TanStack Query 管理，本地 UI 状态主要交给 Zustand，HTTP 访问统一经过 platform client。

### 8.2 CALL-E 服务端

| 类别 | 技术 |
|---|---|
| 语言与 Web | Python 3.13、FastAPI、Uvicorn |
| Agent / MCP | OpenAI Agents SDK、FastMCP 3 |
| 数据模型 | Pydantic、Pydantic Settings、JSON Schema |
| 数据库 | SQLAlchemy 2 async、Alembic、PostgreSQL |
| 异步基础设施 | Redis、RabbitMQ、Taskiq、FastStream / Kafka |
| 网络与模板 | HTTPX、Jinja、YAML |
| 可观测性 | Langfuse、OpenInference |
| 外部集成 | Botlab、Calling、IAMS、号码供应服务 |

源码快照里，新 CALL-E 主 Agent 的默认配置是 `gpt-5.5`，并开启中等推理强度和详细摘要；同时设置上下文压缩阈值。这个配置属于运行时默认值，不是架构对某个模型的硬绑定。

### 8.3 桌面端与通用 Agent

| 模块 | 技术 |
|---|---|
| Electron UI | Electron 38、React 19、TypeScript、Vite、Redux Toolkit、Lexical、RxJS、Radix |
| Bridge | Python 3.13、FastAPI、SQLAlchemy、SQLite、croniter、OpenTelemetry |
| Agent runtime | Python 3.12+、OpenAI Agents SDK、browser-use、Firecrawl、LangChain sandbox |
| 数据与文档 | pandas、polars、matplotlib、openpyxl、PyMuPDF |
| 系统能力 | PyObjC、Computer Use / CUA 相关适配 |
| 音频 | TEN VAD、OpenAI/Omni STT、sherpa-onnx |
| 浏览器 | Manifest V3 扩展、CDP、DevTools host、Playwright |
| 观测 | OpenTelemetry、SigNoz、LangSmith、OpenReplay |

## 9. 这套架构做得好的地方

### 9.1 把 Agent 不确定性包在确定性系统里

自然语言理解和计划生成允许模型发挥，但号码格式、权限、租户边界、线路能力、状态转换、幂等和报告 Schema 都由代码约束。这比试图写出一段“永不犯错”的超级提示词可靠得多。

### 9.2 目标与执行解耦

Goal 不等于一通电话，使系统天然可以表达重试、多目标对象、条件变化和多次证据汇总。这为未来的批量外呼、渐进式目标和定时唤醒留下了正确的数据模型。

### 9.3 对话体验与后台生命周期解耦

202 响应、SSE 重放、持久事件与 context delivery，让几分钟的外部执行不必伪装成一次超长聊天请求。用户看到的是一个持续推进的任务，而不是一个容易超时的接口。

### 9.4 代码中已经形成“领域动词”

`commit_goal`、`create_run_spec`、`submit_voice_run`、`commit_report` 比通用的 `execute_tool` 更能表达业务含义，也更容易加入权限、审计和测试。

## 10. 当前边界与演进中的部分

这套架构的方向很完整，但阅读当前源码时也需要注意几个边界。

### 10.1 新 GoalAgent 当前重点支持出站任务

规范中已经讨论 inbound 等方向，MainAgent 也能识别更多目标类型，但当前 dispatcher 实际构建的是 outbound GoalAgent，覆盖 one-shot、batch 和 progressive outbound 类型。Inbound GoalAgent 仍应视为设计方向，而不是已经接入同一主链路的完成态能力。

### 10.2 批量与渐进任务的数据结构先于完整产品闭环

RunGroup、`multi_item`、每个收件人的 RunSpec 等结构已经存在，相关规范也较详细；不过部分批量和渐进式流程仍处在分阶段建设中。更准确的说法是“架构已经为它们铺路”，而不是“所有场景均已完整交付”。

### 10.3 当前唤醒主要由事件推动

Goal 上可以记录 `next_wakeup_at`，但当前阶段的实际闭环以新事件触发为主。面向任意未来时间的可靠 scheduler/self-wakeup 属于后续演进方向。

### 10.4 新旧后台执行方式尚未完全统一

旧版 one-shot 已使用 Taskiq worker。新的 Goal dispatch 和 voice lifecycle 在当前代码里主要通过进程内 `asyncio.create_task` 启动，同时依靠数据库状态、租约和事件提供恢复基础。若要进一步提高跨进程、崩溃后自动续跑的确定性，通常还需要把新的执行循环完整迁入可重放的 worker 调度体系。

### 10.5 多代 Agent runtime 并存会带来认知成本

仓库同时存在：

- 旧版 one-shot MCP 电话 Agent；
- 新版 CALL-E Goal-driven Agent；
- 桌面通用 Agent 与动态子 Agent。

它们解决的问题不同，也沉淀于不同阶段。短期并存有利于迁移，长期则需要更清晰的命名、边界文档和共享契约，避免 tracing、事件结构、工具抽象和供应商适配重复发展。

## 11. 推荐的源码阅读顺序

如果想继续深入，按下面顺序读比从目录树随机点开更容易建立心智模型：

1. 先读根目录 README 与 `docs/monorepo-map.md`，确认两条产品线；
2. 读 `services/seleven-mcp/docs/agent-design.md`，理解 Agent 设计原则；
3. 从 `apps/calle-web` 的 chat transport 追到 `/v1/sessions/.../events`；
4. 读 `chat_routes.py`、API session 和 `turn_pump.py`；
5. 读 `CallEAgent`、MainAgent 工具与 `commit_goal`；
6. 读 `GoalIterationRunner` 和 `OutboundGoalAgent`；
7. 顺着 `create_run_spec`、`submit_voice_run` 进入 `VoiceRunExecutor`；
8. 最后读 report、event store、workspace 和数据库 model；
9. 再对照旧版 `one_shot_call`，理解为什么新模型要引入 Goal；
10. 若关心桌面 Agent，再从 Electron 的 `/agent_chat` 客户端一路追到 bridge 和 `SelevenAgent`。

阅读 Agent 项目时，一个很实用的方法是始终追问四件事：

- 谁拥有权威状态？
- 哪个动作会产生真实副作用？
- 进程在这里崩溃后，系统从哪里继续？
- 模型说“完成了”时，代码凭什么相信它？

`prod-dive-in` 的大部分关键设计，正是在回答这四个问题。

## 12. 总结

`prod-dive-in` 展示了一条从“AI 功能”走向“Agent 系统”的清晰路径：

1. 用 MainAgent 把自然语言整理成稳定目标；
2. 用 GoalAgent 长期负责结果，而不是只负责一次工具调用；
3. 用 RunSpec、Run 和 Report 保存计划、事实与交付物；
4. 用 Voice Agent 完成边界清楚的现场任务；
5. 用事件、游标、租约、幂等和工作区把不确定的模型包进可恢复系统；
6. 用 Human-in-the-loop、guardrail、trace 和 eval 控制风险与质量；
7. 再通过桌面 Agent、浏览器接管和 LiveLens，把同样的思想扩展到更通用的计算机任务。

它最值得借鉴的并不是某个框架或某段提示词，而是一个朴素的工程判断：

> Agent 可以负责判断下一步做什么，但系统必须负责记住发生过什么、允许什么，以及失败后从哪里继续。
