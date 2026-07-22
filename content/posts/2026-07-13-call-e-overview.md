---
title: "CALL-E 全景"
date: 2026-07-13
summary: "从系统级视角认识 CALL-E、桌面 Agent 与浏览器接管的产品边界、分层架构、技术栈，以及多代 Agent runtime 的演进关系。"
tags: [architecture, call-e]
selected: false
draft: false
---

> 本文是 `CALL-E` 的仓库级全景地图，帮助读者理解各应用和服务之间的关系。
> 如果希望从零学习 CALL-E Agentic Goal 架构，请从[《CALL-E Agentic Goal 架构从零理解：从聊天目标到真实电话执行》](/zh/blog/calle-agentic-goal-architecture)开始。

很多 AI 应用都能“聊”，但 `CALL-E` 关心的是聊天框之外的工作：系统怎样拨打一通真实电话，怎样操作浏览器，怎样把一个长任务交给后台继续运行，又怎样让用户看到可信的过程和结果。

这不是一个单体应用，而是一个仍在演进的 monorepo。仓库中至少有两条相对独立的产品主线：围绕电话目标工作的 **CALL-E**，以及能够使用浏览器和本机工具的 **桌面通用 Agent**。两条主线共享 Agent、工具、事件流和可观测性等思想，但并不运行在同一套 runtime 上。

本文基于仓库提交 `aa7af64` 阅读源码。它解决三个问题：

1. 顶层目录分别属于哪条产品线；
2. 一次用户请求会经过哪些应用、服务和外部系统；
3. 想深入源码时，应该从哪里开始读。

如果只记住一句话，可以记住：

> `CALL-E` 不是“一个 Agent”，而是一组把模型决策接入电话、浏览器和操作系统的产品与基础设施。

## 1. 先看全局：两条 Agent 产品线

### 1.1 CALL-E：围绕电话目标工作

CALL-E 让用户用自然语言交代电话任务，由系统澄清目标、生成执行方案、发起电话、跟踪结果，并把证据整理成报告。

| 模块 | 作用 |
|---|---|
| `apps/calle-web` | 账户、计费、对话、任务进度与结果界面 |
| `services/seleven-mcp` | CALL-E API、Agent runtime、电话执行、持久化与 MCP 工具 |
| `services/seleven-mcp/src/calle/agentic` | Goal 驱动的领域模型和后台循环 |
| `services/seleven-mcp/src/calle/voice_runtime` | 单通电话的提示词、供应商接入与执行生命周期 |
| `apps/seleven-mcp-console-web` | 服务运维和调试控制台 |

先把内部细节压缩成一条链路：

```text
用户对话
  → MainAgent 理解需求并提交 Goal
  → GoalAgent 制定 RunSpec
  → VoiceRunExecutor 发起电话
  → 通话状态与结果回流
  → GoalAgent 决定继续、停止或提交 Report
  → Web 端通过 SSE 展示过程与结果
```

这里有两个不同的时间尺度：前台对话通常以秒为单位，真实电话和目标生命周期可能持续数分钟乃至更久。CALL-E 因而不能只依赖一次 HTTP 请求或一次模型响应。

### 1.2 桌面通用 Agent：操作浏览器和本机工具

另一条主线更像桌面 AI 工作台。用户在 Electron 客户端中交代任务，Python Agent 可以读取本机信息、调用工具、创建子 Agent，并把浏览器任务交给专门的浏览器能力。

| 模块 | 作用 |
|---|---|
| `apps/electron` | Electron 桌面端、对话 UI 与本地进程管理 |
| `services/seleven-bridge` | Electron 与 Python Agent 之间的 FastAPI 桥接层 |
| `services/seleven-agents` | 通用 Agent、工具、子 Agent、浏览器自动化与 LiveLens |
| `apps/devtools-host` / `apps/devtools-frontend` | 浏览器调试、页面观察和操作能力 |
| `apps/chrome-extension*` | 页面连接、音频采集和本地桥接 |

主链路是：

```text
Electron UI
  → seleven-bridge
  → SelevenAgent
  → 本机工具 / 浏览器 Agent / 动态子 Agent / LiveLens
  → NDJSON 事件流
  → Electron 把过程渲染成时间线
```

### 1.3 为什么不能把它们当成同一个 Agent

两条产品线都会出现“Agent”“Tool”“Session”“Event”这些词，但同名不等于同一个实现：

- CALL-E 的核心是电话领域中的 Goal、RunSpec、Run 和 Report；
- 桌面 Agent 的核心是对话 runtime、动态工具与计算机操作；
- 旧版 CALL-E one-shot 链路又是一套以单次电话为中心的实现；
- 各条链路的事件协议、持久化方式和进程模型也不同。

阅读 monorepo 时，第一步不是寻找一个“总 Agent”，而是先确认自己正在跟踪哪条产品链路。

## 2. 仓库目录地图

下面只保留理解架构所需的主干，省略普通配置、测试夹具和构建产物：

```text
CALL-E/
├── apps/                              # 面向用户或开发者的应用
│   ├── calle-web/                     # CALL-E Web 产品
│   ├── seleven-mcp-console-web/       # CALL-E / MCP 运维控制台
│   ├── electron/                      # 桌面 Agent 客户端
│   ├── chrome-extension/              # 第一代浏览器扩展
│   ├── chrome-extension-v2/           # 新版浏览器扩展
│   ├── devtools-host/                 # DevTools 本地宿主
│   ├── devtools-frontend/             # DevTools 可视化前端
│   └── ios/                           # iOS 客户端方向
│
├── services/                          # Python 服务与 Agent runtime
│   ├── seleven-mcp/                   # CALL-E、MCP 与电话运行时
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
├── mocks/                             # 本地演练使用的模拟站点
├── playground/                        # CUA、录制等技术实验
└── scripts/                           # 开发环境和仓库级脚本
```

沿业务链路阅读时，可以进一步简化成：

```text
电话 Agent：apps/calle-web
              └─→ services/seleven-mcp

桌面 Agent：apps/electron
              └─→ services/seleven-bridge
                    └─→ services/seleven-agents
                          └─→ 浏览器 / 本机 / 音频能力
```

## 3. 共同的分层方法

虽然 runtime 不统一，但两条产品线都能用四层结构理解。

| 层级 | 负责什么 | 代表模块 |
|---|---|---|
| 表现层 | 收集用户输入，展示流式过程和结果 | CALL-E Web、Electron、控制台、浏览器扩展 |
| 应用与编排层 | 接收请求，组装 Agent，调度后台工作，转换事件 | API session、Goal runner、bridge use case |
| 领域层 | 定义任务对象、状态、规则和业务动作 | CALL-E `agentic`、bridge domain |
| 基础设施层 | 接入数据库、队列、模型、电话、浏览器和操作系统 | PostgreSQL、Redis、RabbitMQ、供应商适配器、CDP |

```text
┌──────────────────────────────────────────────────────────┐
│ 表现层：CALL-E Web / Electron / Console / Browser Extension │
└───────────────────────┬──────────────────────────────────┘
                        │ HTTP + SSE / NDJSON / IPC
┌───────────────────────▼──────────────────────────────────┐
│ 应用编排：Session、Goal Runner、Bridge Use Case             │
└───────────────────────┬──────────────────────────────────┘
                        │ 命令、事件和领域对象
┌───────────────────────▼──────────────────────────────────┐
│ 领域层：Goal / Run / Report，或桌面任务与工具协议            │
└───────────────────────┬──────────────────────────────────┘
                        │ Ports / Providers
┌───────────────────────▼──────────────────────────────────┐
│ 基础设施：DB、队列、LLM、电话平台、浏览器、OS、可观测性       │
└──────────────────────────────────────────────────────────┘
```

这个分层带来一个重要边界：**模型提出判断和动作意图，确定性代码保存事实并控制副作用。** 模型可以建议拨号或点击按钮，但号码校验、权限、租户隔离、状态转换和幂等不能只靠 Prompt 保证。

## 4. CALL-E 主链路的仓库级视角

CALL-E 的 Web 端先创建会话、提交消息，再通过 SSE 订阅事件。API 可以快速返回 `202 Accepted`，后台继续运行 Agent 和电话任务；持久事件和游标让页面刷新或短暂断线后能够恢复进度。

服务端内部大致分成三块：

```text
services/seleven-mcp/src/calle/
├── apps/api/          # HTTP、SSE、会话接入与产品事件
├── agentic/           # Goal、RunSpec、Run、Report 与迭代 runtime
└── voice_runtime/     # 一通电话的供应商和执行生命周期
```

它们各自回答不同问题：

- API 层回答“用户怎样发起任务、怎样看到变化”；
- Agentic 层回答“目标是什么、下一步做什么、任务是否结束”；
- Voice runtime 回答“一通电话具体怎样创建、启动、监控和收尾”。

最关键的领域对象可以先用四句话记住：

| 对象 | 回答的问题 |
|---|---|
| Goal | 用户最终想得到什么 |
| RunSpec | 这一次准备怎样执行 |
| Run | 现实中实际发生了哪次尝试 |
| Report | 系统最终怎样交付结果和证据 |

这四个对象只是仓库地图上的坐标。它们的状态机、事件、租约、游标、Workspace 与源码调用关系，请继续阅读本系列第 0 篇：[《CALL-E Agentic Goal 架构从零理解》](/zh/blog/calle-agentic-goal-architecture)。本文不再重复展开。

## 5. 为什么旧版 one-shot 电话链路还在

`services/seleven-mcp` 中还保留着一套成熟度较高的单次电话工具：

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

它以一次 CallRun 为中心，适合“规划一通电话，然后执行并查询结果”。Goal-driven 链路则以长期结果为中心，允许一次 Goal 包含多次尝试，并在新证据出现后继续推进。

| 维度 | one-shot 链路 | Goal-driven 链路 |
|---|---|---|
| 核心对象 | 一次 CallRun | 一个长期 Goal |
| 规划 | 为单通电话生成计划 | 为目标生成版本化 RunSpec |
| 失败后 | 调用方决定是否再试 | GoalAgent 可以根据结果继续 |
| 结果 | 单次通话结果与总结 | 可以汇总多个 Run 的 Report |
| 后台执行 | Taskiq worker | 持久状态、事件与 Goal iteration |

旧链路不是“没有 Agent”，新链路也不只是多套了一层命名。两者真正的差异是状态模型和生命周期。旧链路同时保留了提示词、guardrail、Widget 和 E2E eval 等积累，因此在迁移期继续存在是合理的。

## 6. 桌面 Agent：Electron 为什么还需要 Bridge

桌面链路的入口在 `apps/electron`。Electron 擅长窗口、系统托盘、IPC、权限和更新，但核心 Agent 代码运行在 Python 服务中。因此中间需要 `services/seleven-bridge`：

```text
Renderer（React）
  → Electron Main Process
  → 本地启动和管理 seleven-bridge
  → POST /agent_chat
  → Python SelevenAgent
  → NDJSON 流式事件
  → Renderer 时间线
```

Bridge 不只是一个反向代理。它还承担进程边界上的职责：

- 校验桌面端请求；
- 组装一次 Agent use case；
- 把 Python runtime 事件转成稳定的 NDJSON 协议；
- 隔离 Electron 与具体模型或 Agent SDK；
- 为取消、错误和生命周期管理提供统一边界。

这种拆分允许 TypeScript 客户端和 Python Agent 独立演进。代价是跨进程协议必须被认真维护，日志、错误和取消语义也要贯穿两端。

## 7. 浏览器接管：不是一个 `click()` 工具

浏览器能力横跨多个目录，因为“让 Agent 操作网页”实际上包含连接、观察、推理、执行和人工接管。

```text
桌面 Agent
  → 浏览器专用 Agent / Tool
  → DevTools host 或浏览器扩展
  → Chrome DevTools Protocol / Playwright
  → 页面截图、DOM、网络与交互结果
  → Agent 继续决策
```

仓库中的相关组件大致分工如下：

| 组件 | 主要职责 |
|---|---|
| Chrome Extension | 建立页面侧连接，采集页面或音频信息 |
| DevTools Host | 管理本地浏览器调试连接和命令入口 |
| DevTools Frontend | 把观察和操作过程可视化 |
| Browser Agent / Tools | 把高层任务拆成浏览器动作 |
| Human Takeover | 在登录、验证码或高风险步骤把控制权交给人 |

人工接管不是自动化失败后的补丁，而是现实产品边界的一部分。账号登录、验证码、支付确认等步骤，本来就可能要求用户亲自操作。好的架构需要明确“何时暂停、怎样交还控制、完成后怎样继续”。

## 8. LiveLens：让桌面 Agent 获得实时上下文

`services/seleven-agents` 中的 LiveLens 方向让 Agent 能够处理实时音频或会议上下文。它与普通聊天的区别在于输入不是一条完整消息，而是持续到来的时间序列。

这会带来新的工程问题：

- 音频怎样采集和分片；
- 转写结果怎样按时间关联；
- 哪些内容进入短期上下文，哪些需要长期保存；
- Agent 何时主动提示，何时保持安静；
- 用户怎样知道系统正在监听和处理什么。

因此 LiveLens 更像一条实时感知管线，而不是给现有 Agent 再增加一个普通工具。

## 9. 技术栈一览

### 9.1 CALL-E Web

| 类别 | 技术 |
|---|---|
| Web 框架 | Next.js、React、TypeScript |
| UI | Tailwind CSS 与仓库内组件 |
| 数据与认证 | Supabase / PostgreSQL 相关能力 |
| 流式更新 | HTTP + Server-Sent Events |
| 支付与产品服务 | Stripe 等外部集成 |

### 9.2 CALL-E 服务端

| 类别 | 技术 |
|---|---|
| API | Python、FastAPI、Pydantic |
| Agent | OpenAI Agents SDK 与领域工具层 |
| 持久化 | SQLAlchemy、PostgreSQL |
| 缓存与消息 | Redis、RabbitMQ、Taskiq |
| 电话执行 | Botlab、Calling、SIP / WebRTC 相关能力 |
| 可观测性 | Langfuse、OpenInference、OpenTelemetry 等 |

### 9.3 桌面与浏览器

| 类别 | 技术 |
|---|---|
| 桌面端 | Electron、React、TypeScript |
| 桥接服务 | FastAPI、NDJSON streaming |
| 通用 Agent | Python Agent runtime、动态工具和子 Agent |
| 浏览器 | Manifest V3 扩展、CDP、DevTools、Playwright |
| 观测 | OpenTelemetry、SigNoz、LangSmith、OpenReplay |

技术栈表只能告诉我们“用了什么”。真正值得追踪的是跨边界契约：HTTP 请求如何变成领域命令，模型工具如何产生持久记录，供应商回调如何变成事件，事件又如何回到 UI。

## 10. 这套仓库设计的几个亮点

### 10.1 把模型的不确定性包在确定性系统里

自然语言理解和计划允许模型发挥；号码格式、权限、租户边界、状态转换、幂等和结果 Schema 则由代码约束。这比试图写出一段“永不犯错”的超级 Prompt 更可靠。

### 10.2 长任务与前台连接解耦

SSE 重放、持久事件和后台生命周期，使几分钟的电话任务不必伪装成一次超长聊天请求。桌面端的 NDJSON 流也让过程可以被结构化呈现，而不只是输出文本 token。

### 10.3 外部供应商藏在适配层后面

电话、模型、浏览器和可观测性都有明确接入边界。业务 Agent 不需要在每个决策点理解 OAuth、SIP、CDP 或 tracing exporter 的细节。

### 10.4 代码开始形成领域动词

`commit_goal`、`create_run_spec`、`submit_voice_run`、`commit_report` 比通用的 `execute_tool` 更能表达业务含义，也更容易加入权限、审计和测试。

## 11. 当前边界与演进痕迹

### 11.1 多代 runtime 并存

仓库同时存在旧版 one-shot 电话 Agent、新版 Goal-driven CALL-E，以及桌面通用 Agent。它们解决不同问题，也来自不同阶段。阅读源码时必须先标记所属链路，不能把一种 runtime 的结论直接套到另一种上。

### 11.2 Goal 方向的基础结构先于全部产品闭环

批量、渐进式目标、未来唤醒等数据结构和规范已经出现，但部分能力仍在阶段性建设中。“架构已预留”不等于“产品已完整交付”。

### 11.3 进程内任务与持久 worker 尚未完全统一

旧版 one-shot 使用 Taskiq worker；新 Goal 热路径仍能看到进程内异步任务，同时依靠数据库状态、租约和事件提供恢复基础。要获得更强的跨进程恢复确定性，调度体系仍有继续统一的空间。

### 11.4 跨语言、跨进程契约带来维护成本

Electron、Bridge、Python Agent、浏览器扩展和 DevTools 之间存在多层协议。分层提升了独立演进能力，也要求团队持续维护事件名称、错误语义、取消机制和版本兼容。

这些边界不是在否定架构，而是帮助读者区分：哪些是当前热路径，哪些是迁移中的实现，哪些是面向下一阶段的设计。

## 12. 按兴趣选择源码阅读路径

### 路径 A：理解整个 monorepo

1. 根目录 README 与 `docs/monorepo-map.md`；
2. `apps/`、`services/`、`packages/` 的顶层 README；
3. 两条主链路的启动脚本和本地开发说明；
4. `contracts/` 中的跨边界数据结构。

### 路径 B：深入 CALL-E Goal

先读[《CALL-E Agentic Goal 架构从零理解》](/zh/blog/calle-agentic-goal-architecture)，再按文章中的源码顺序进入 `services/seleven-mcp/src/calle/agentic/`。这样能先建立 Goal、Iteration、RunSpec、Run、Event 和 Report 的心智模型，再看具体函数。

### 路径 C：追一通电话

1. 从 `apps/calle-web` 的 chat transport 开始；
2. 追到 `/v1/sessions/.../messages` 和 `/events`；
3. 查看 CALL-E API session 与事件转换；
4. 从 Agentic 工具进入 `voice_runtime`；
5. 最后查看供应商回调、状态落库和 Report。

### 路径 D：追一个桌面浏览器任务

1. 从 Electron 的 Agent chat 客户端开始；
2. 查看 Main Process 怎样管理 Bridge；
3. 追踪 `/agent_chat` 到 Python use case；
4. 查看 `SelevenAgent` 如何选择工具或子 Agent；
5. 沿浏览器工具进入扩展、DevTools Host 和 CDP。

无论选择哪条路径，都可以持续追问四件事：

- 谁拥有权威状态？
- 哪个动作会产生真实副作用？
- 进程在这里崩溃后，系统从哪里继续？
- 模型说“完成了”时，代码凭什么相信它？

## 13. 总结

`CALL-E` 的价值不在于把所有能力塞进一个万能 Agent，而在于把不同问题放进合适的产品边界：

1. CALL-E 用领域模型和后台循环管理长期电话目标；
2. Voice runtime 负责一通真实电话的执行细节；
3. 桌面 Agent 通过 Bridge 连接 Electron 与 Python 能力；
4. 浏览器扩展、DevTools 和专用 Agent 共同完成浏览器操作；
5. LiveLens 把输入从离散消息扩展到实时感知；
6. 数据库、事件、队列、协议和可观测性负责让这些能力可恢复、可解释。

当你能先画出产品边界和进程边界，再进入某个 Agent 的 Prompt 或工具代码时，这个仓库就不再是一大片互不相关的目录，而会变成几条可以逐段追踪的执行链路。
