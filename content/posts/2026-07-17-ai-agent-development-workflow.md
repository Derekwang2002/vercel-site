---
title: "Matt Pocock Skills AI-coding 工作流"
date: 2026-07-17
summary: "一套适用于 AI-coding 的完整软件开发流程，覆盖需求澄清、规格设计、Ticket 拆分、TDD 实现、代码审查与 Bug 诊断。"
tags: [ai-agent, software-engineering, tdd]
selected: false
draft: false
---

适用于支持 Skills 的编程 Agent。文档以通用团队开发流程为主，同时包含单人开发、直接在 `main` 提交的简化分支。

---

## 1. 背景信息

### 1.1 文档背景

本文档基于 Matt Pocock 的 [`mattpocock/skills`](https://github.com/mattpocock/skills) 仓库整理。该仓库提供一组可组合的 AI Agent Skills，用于把软件开发中的需求澄清、规格整理、任务拆分、测试驱动实现、代码审查和故障诊断固化成可重复执行的工作流。

这些 Skills 不是一个必须完整照搬的重型开发框架，也不会替代产品判断、技术设计和人工审查。它们更像是一组可按需组合的“开发操作规程”：每个 Skill 负责一个明确阶段，开发者仍然决定需求、优先级、架构取舍和最终是否合并代码。

### 1.2 为什么需要这套流程

直接向编程 Agent 输入一条大而宽泛的 Prompt，例如“实现这个功能并测试”，常见的问题包括：

- **需求理解偏差**：Agent 在关键业务规则尚未确认时开始编码。
- **范围失控**：实现过程中加入 Spec 未要求的功能、抽象或重构。
- **任务过大**：单次上下文同时容纳需求、设计、代码和测试，导致前后不一致。
- **测试滞后**：功能完成后才补测试，测试容易贴合现有实现，而不是验证真实需求。
- **测试脆弱**：测试私有函数、调用次数或内部结构，正常重构也会造成大量失败。
- **盲目修 Bug**：没有稳定复现就反复尝试修改，可能掩盖症状或引入新问题。
- **审查缺少基准**：只看“测试是否通过”，没有检查代码是否真正符合原始需求。

这套流程通过阶段化控制降低上述风险：先达成共同理解，再形成 Spec；把大型工作拆成可验证的垂直 Ticket；实现阶段使用 TDD 建立快速反馈；最后分别检查需求符合度和代码质量。

### 1.3 各阶段解决的问题

| 阶段 | 主要问题 | 主要产物 |
|---|---|---|
| `grill` | 我们是否真正理解要解决的问题？ | 已确认的规则、边界、术语和决策 |
| `spec` | 如何把讨论变成稳定、可审查的实现依据？ | Spec / PRD、验收标准、测试接缝 |
| `tickets` | 如何把大型需求拆成可独立交付的工作？ | 垂直切片 Ticket 和依赖关系 |
| `implement + TDD` | 如何以持续反馈的方式正确实现？ | 代码、行为测试和验证结果 |
| `review` | 实现是否符合需求并达到代码质量要求？ | Standards 与 Spec 两类审查结果 |
| `diagnosing-bugs` | 如何在不盲猜的情况下定位复杂故障？ | 稳定复现、根因、回归测试和最小修复 |
| `improve-codebase-architecture` | 功能可用但代码结构开始恶化时怎么办？ | 架构问题报告和候选改进项 |

### 1.4 适用场景

这套流程适用于：

- 新功能开发。
- 现有功能扩展。
- Bug 修复和性能回退调查。
- 多模块或跨前后端改动。
- AI Agent 参与度较高、需要明确控制范围的项目。
- 团队协作开发，以及个人维护的独立项目。

对于文案修改、简单配置更新、明确的一两行修复，不必机械地执行完整流程。可根据风险和规模缩短为：

```text
spec → implement/TDD → review
```

或者在问题和修改都非常明确时：

```text
implement → targeted tests → review
```

### 1.5 团队与单人开发的关系

本文以团队开发作为默认主线：从主分支创建功能分支，通过 PR、CI 和人工 Review 后合并。

单人开发不是另一套方法，而是同一流程下的 Git 工作流分支。单人可以直接在 `main` 提交，但仍应记录功能开始前的 Commit，以便 `/code-review` 有清晰的比较起点。需求澄清、Spec、Ticket、TDD、Review 和 Bug 诊断等步骤不变。

---

## 2. 总体流程

```text
需求
  ↓
grill
  ↓
spec
  ↓
tickets
  ↓
implement + TDD
  ↓
review
  ↓
PR / 合并 / 发布

出现 Bug 时：diagnosing-bugs
代码结构需要优化时：improve-codebase-architecture
```

对应 Skills：

```text
/grill-with-docs
/to-spec
/to-tickets
/implement + /tdd
/code-review
/diagnosing-bugs
/improve-codebase-architecture
```

核心原则：

- 先明确需求、边界和验收标准，再写代码。
- 先确定测试接缝，再实现功能。
- 中大型需求拆成可独立验证的垂直 Ticket。
- 实现阶段一次完成一个可观察行为。
- 完成后同时检查“是否符合 Spec”和“代码质量是否合格”。
- 出现原因不明确的 Bug 时，不盲目修改，先建立稳定复现。

---

## 3. 开发模式选择

### 3.1 团队开发：推荐功能分支 + PR

通常从最新主分支创建功能分支：

```bash
git switch main
git pull
git switch -c feature/order-cancellation
```

开发完成后使用：

```text
/code-review main
```

它会审查当前功能分支相对于 `main` 合并基点之后的改动。

推荐流程：

```text
main
  ↓ 创建功能分支
feature/...
  ↓ 实现与测试
code-review main
  ↓ 修复问题
push
  ↓
创建 PR
  ↓ CI + 人工 Review
合并 main
```

### 3.2 单人开发分支：直接在 main 提交

单人项目不一定必须使用功能分支。若直接在 `main` 开发，应在开始新功能前记录当前 Commit：

```bash
git rev-parse HEAD
```

例如得到：

```text
a1b2c3d
```

功能完成后使用：

```text
/code-review a1b2c3d
```

也可以创建本地标签：

```bash
git tag review/order-cancel-start
```

开发完成后：

```text
/code-review review/order-cancel-start
```

审查结束后可删除标签：

```bash
git tag -d review/order-cancel-start
```

单人开发和团队开发的主要区别只在 Git 工作流；`grill → spec → tickets → implement/TDD → review` 主流程不变。

---

## 4. Grill：澄清需求

### 目标

通过访谈明确：

- 用户问题和期望行为
- 业务规则
- 权限规则
- 边界情况
- 错误处理
- 数据和接口影响
- 技术限制
- 验收标准
- 测试边界
- Out of Scope

### Prompt

```text
/grill-with-docs

请围绕以下需求进行澄清：

<填写需求>

重点确认：
- 用户场景和期望行为
- 业务规则与边界情况
- 权限和错误处理
- 技术限制
- 验收标准
- 测试接缝
- Out of Scope

本阶段只做需求澄清和必要的项目文档更新，不修改业务代码。
确认完成后输出总结并停止，等待我运行 /to-spec。
```

### 完成标准

进入下一阶段前，应明确：

- 什么情况下成功，什么情况下失败。
- 用户最终能够观察到什么结果。
- 错误如何表达和处理。
- 哪些行为必须通过自动化测试验证。
- 哪些内容明确不在本次范围内。

---

## 5. Spec：形成正式规格

### 目标

把已经确认的讨论整理成后续开发、测试和 Review 的统一依据。

### Prompt

```text
/to-spec

基于刚才确认的需求生成正式 Spec。

需要包含：
- Problem Statement
- Solution
- User Stories
- Business Rules
- Implementation Decisions
- Testing Decisions
- Acceptance Criteria
- Out of Scope
- 已知风险

明确测试接缝，只测试公共行为，不测试私有实现。
本阶段只生成或更新 Spec，不修改业务代码。
完成后停止，等待我审阅。
```

### Spec 最小结构

```markdown
## Problem Statement
用户当前遇到的问题。

## Solution
功能完成后的用户体验和系统行为。

## User Stories
1. As a ...
2. As a ...

## Business Rules
- 规则一
- 规则二

## Implementation Decisions
- 模块和接口决策
- 状态转换
- API、Schema 或权限处理

## Testing Decisions
- 测试接缝
- 正常场景
- 异常场景
- 边界场景

## Acceptance Criteria
- [ ] 条件一
- [ ] 条件二

## Out of Scope
- 本次不做的内容
```

### 是否必须拆 Tickets

- 小型修改：`spec → implement/TDD → review`
- 中大型功能：`spec → tickets → implement/TDD → review`

---

## 6. Tickets：拆成垂直任务

### 什么时候需要

- 功能涉及多个模块。
- 单次 Agent 上下文难以完成。
- 存在多个可独立验收的行为。
- 多名开发者或多个 Agent 需要并行处理。
- 任务之间存在明确依赖。

### Prompt

```text
/to-tickets <Spec 路径、Issue 或 URL>

把 Spec 拆成可独立实现和验证的垂直切片。

要求：
- 每个 Ticket 交付一个完整用户行为
- 每个 Ticket 能在一个新上下文中完成
- 每个 Ticket 包含验收标准
- 标明 Blocked by
- 不要按数据库、后端、前端、测试水平拆分
- 测试与对应功能放在同一个 Ticket 中

先展示拆分结果，确认后再发布。
发布完成后停止，不要自动实现。
```

### 不推荐的水平拆分

```text
Ticket 1：修改数据库
Ticket 2：实现后端
Ticket 3：实现前端
Ticket 4：补测试
```

### 推荐的垂直拆分

```text
Ticket 1：用户可以完成核心操作
Ticket 2：权限和非法状态得到正确处理
Ticket 3：操作支持幂等或并发保护
Ticket 4：前端提供完整入口和结果反馈
```

每个 Ticket 都应包含实现该行为所需的代码、测试和必要文档。

### 团队并行开发注意事项

- 只有没有未完成 Blocker 的 Ticket 才可以开始。
- 尽量减少多个 Ticket 同时修改相同文件。
- 跨模块公共接口应先通过 Spec 或 ADR 确定。
- 每个 Ticket 使用独立分支和 PR 更容易 Review。
- 多个并行 Ticket 依赖同一基础改动时，应先创建基础或 prefactoring Ticket。

---

## 7. Implement + TDD：逐个实现

### Prompt

```text
/implement <Ticket URL、编号或路径>

只实现当前 Ticket。

要求：
- 阅读 Ticket、父 Spec、CONTEXT.md 和相关 ADR
- 使用 Spec 中确认的测试接缝
- 使用 TDD：red → green
- 一次只实现一个可观察行为
- 不测试私有函数和内部调用次数
- 不添加 Ticket 之外的功能
- 定期运行目标测试和 typecheck

完成后运行：
1. 当前 Ticket 的目标测试
2. 相关测试
3. 完整测试套件
4. typecheck
5. lint
6. build

然后运行 /code-review，并汇报结果。
```

### TDD 循环

```text
选择一个行为
  ↓
先写失败测试
  ↓
确认测试因正确原因失败
  ↓
写最少实现
  ↓
测试通过
  ↓
进入下一个行为
```

示例：

```text
测试 1：合法用户可以执行操作
实现最少代码
测试变绿

测试 2：无权限用户被拒绝
增加权限判断
测试变绿

测试 3：非法状态被拒绝
增加状态规则
测试变绿

测试 4：重复操作保持幂等
增加幂等保护
测试变绿
```

### 测试原则

优先测试公共行为：

```text
调用 API 后返回正确结果
用户通过 UI 完成操作
系统状态通过真实公共流程正确变化
非法请求返回正确错误
```

避免测试实现细节：

```text
某个私有函数是否被调用
某个 Repository 方法是否调用一次
内部函数调用顺序
私有字段中间状态
```

### 完成标准

- 当前 Ticket 验收标准全部满足。
- 测试先失败过，再通过。
- 目标测试和相关测试通过。
- 完整测试套件通过。
- typecheck、lint、build 通过。
- 没有残留调试日志、临时代码或无关修改。

---

## 8. Review：再次检查

### 目标

从两个维度检查已经实现的代码：

1. **Spec Review**：是否正确、完整地实现需求。
2. **Standards Review**：代码是否符合项目规范和合理设计原则。

### 团队开发 Prompt

```text
/code-review main

检查当前功能分支相对于 main 的全部改动。

重点检查：
- 是否完整符合 Spec
- 是否遗漏边界情况
- 是否有 Scope Creep
- 测试是否验证真实外部行为
- 是否存在重复代码
- 是否存在过度抽象
- 模块边界是否合理
- 是否存在明显代码异味

先报告问题，不要立即修改。
```

### 单人直接在 main 开发 Prompt

```text
/code-review <功能开始前的 Commit SHA 或 Tag>

检查从该固定点到当前 HEAD 的全部改动。

重点检查：
- 是否完整符合 Spec
- 是否遗漏边界情况
- 是否有 Scope Creep
- 测试是否验证真实外部行为
- 是否存在重复代码或过度抽象
- 模块边界是否合理

先报告问题，不要立即修改。
```

### Review 后处理

```text
修复 code-review 中确认有效的问题。

修复后重新运行：
- 目标测试
- 相关测试
- 完整测试套件
- typecheck
- lint
- build

然后再次执行 /code-review <原固定点>。
```

### 团队开发的最终关卡

在合并 PR 前确认：

```text
[ ] Spec Review 无阻塞问题
[ ] Standards Review 无阻塞问题
[ ] 自动化测试通过
[ ] typecheck 通过
[ ] lint 通过
[ ] build 通过
[ ] CI 通过
[ ] 人工 Review 完成
[ ] PR 描述与实际改动一致
[ ] 没有未解决的 Review Comment
```

---

## 9. Bug 分支：Diagnosing Bugs

### 什么时候使用

- 功能行为错误。
- 测试失败但原因不明确。
- CI 中失败，本地正常。
- Bug 偶发出现。
- 并发或时序问题。
- 性能明显下降。
- 修复一个位置后另一个位置出现回归。
- Agent 开始反复猜测并随意修改。

### Prompt

```text
/diagnosing-bugs

问题描述：
<具体症状>

复现步骤或失败命令：
<命令、错误信息、操作路径>

请先建立稳定且最小的失败反馈循环，不要直接猜原因。

然后：
1. 稳定复现
2. 最小化复现
3. 提出可证伪假设
4. 逐个验证
5. 在正确接缝增加回归测试
6. 应用最小修复
7. 重新运行原始复现和完整测试
```

### 诊断流程

```text
建立稳定失败信号
  ↓
最小化复现
  ↓
提出 3–5 个假设
  ↓
通过日志、调试器或实验验证
  ↓
先写回归测试
  ↓
应用最小修复
  ↓
运行原始复现
  ↓
运行完整测试
  ↓
code-review
```

### 禁止做法

- 没有稳定复现就直接改代码。
- 一次修改多个变量。
- 通过删除测试解决失败。
- 通过跳过测试或放宽断言解决失败。
- 只确认“没有报错”，却没有验证用户实际症状。
- 修复后不增加回归测试。

---

## 10. 已实现功能的再次优化

### 功能和代码全面检查

```text
/code-review <main、起始 Commit 或 Tag>
```

适合：

- 检查需求是否完整实现。
- 检查边界场景是否遗漏。
- 检查测试覆盖和代码质量。
- 检查是否发生范围偏移。

### 明确 Bug 或测试失败

```text
/diagnosing-bugs
```

适合：

- 定位具体错误。
- 修复偶发或复杂 Bug。
- 增加可靠回归测试。

### 代码能运行但结构混乱

```text
/improve-codebase-architecture
```

Prompt：

```text
/improve-codebase-architecture

检查与 <功能名称或模块> 相关的代码结构。

重点寻找：
- 模块边界不清
- 业务逻辑分散
- 过度耦合
- 修改范围扩散
- 难以测试的设计
- 可以形成 deep module 的机会

先生成分析和候选改进项，不要直接进行大规模重构。
```

对选中的架构优化项，建议重新走：

```text
spec → tickets → implement/TDD → review
```

不要直接进行没有 Spec、验收标准和回归测试的大规模重构。

---

## 11. 常见流程组合

### 小型修改

```text
grill
  ↓
spec
  ↓
implement + TDD
  ↓
review
```

### 中大型功能

```text
grill
  ↓
spec
  ↓
tickets
  ↓
逐个 implement + TDD
  ↓
review
  ↓
PR / 合并
```

### 多人并行开发

```text
grill
  ↓
spec
  ↓
tickets + blocking edges
  ↓
多个功能分支并行 implement + TDD
  ↓
每个分支 code-review
  ↓
独立 PR + CI
  ↓
按依赖顺序合并
```

### 出现 Bug

```text
diagnosing-bugs
  ↓
回归测试
  ↓
最小修复
  ↓
完整测试
  ↓
review
```

### 已有功能结构优化

```text
code-review
  ↓
improve-codebase-architecture
  ↓
选择一个优化项
  ↓
spec
  ↓
tickets
  ↓
implement + TDD
  ↓
review
```

### 单人直接在 main 开发

```text
记录起始 Commit
  ↓
grill
  ↓
spec
  ↓
tickets（可选）
  ↓
implement + TDD
  ↓
提交小 Commit
  ↓
code-review <起始 Commit>
  ↓
修复并重新验证
```

---

## 12. 最终检查清单

```text
[ ] 需求已经经过 Grill 澄清
[ ] 有明确 Spec
[ ] 验收标准可观察、可测试
[ ] 中大型功能已拆成垂直 Tickets
[ ] Ticket 之间依赖关系明确
[ ] 每个行为通过 TDD 实现
[ ] 没有测试私有实现细节
[ ] 目标测试通过
[ ] 相关测试通过
[ ] 完整测试套件通过
[ ] typecheck 通过
[ ] lint 通过
[ ] build 通过
[ ] 已执行 code-review
[ ] Review 中的有效问题已经处理
[ ] Bug 修复包含回归测试
[ ] 没有残留调试日志或临时代码
[ ] 团队项目的 PR、CI 和人工 Review 已完成
```

---

## 13. 一句话记忆

```text
先问清楚，再写规格；
规格拆任务，任务按 TDD 实现；
完成后做 Review，出 Bug 先诊断。
```
