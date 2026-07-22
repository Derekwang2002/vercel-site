---
title: "Matt Pocock Skills Workflow"
summary: "A complete software development workflow for coding Agents such as Codex and Claude Code, covering requirements clarification, specification design, Ticket decomposition, TDD implementation, code review, and Bug diagnosis."
---

This workflow is intended for Codex, Claude Code, and other coding Agents that support Skills. The document focuses on a general team development process while also covering a simplified path for solo development and committing directly to `main`.

---

## 1. Background

### 1.1 About This Document

This document is based on Matt Pocock's [`mattpocock/skills`](https://github.com/mattpocock/skills) repository. The repository provides a composable set of AI Agent Skills that turn requirements clarification, specification writing, task decomposition, test-driven implementation, code review, and fault diagnosis into a repeatable software development workflow.

These Skills are not a heavyweight development framework that must be copied in full, nor do they replace product judgment, technical design, or human review. They are better understood as a set of composable “development operating procedures”: each Skill owns a clearly defined stage, while developers still decide the requirements, priorities, architectural tradeoffs, and whether the code should ultimately be merged.

### 1.2 Why This Workflow Is Needed

Giving a coding Agent one large and broad Prompt such as “implement this feature and test it” commonly leads to the following problems:

- **Misunderstood requirements**: The Agent starts coding before key business rules have been confirmed.
- **Uncontrolled scope**: The implementation introduces features, abstractions, or refactors that the Spec never requested.
- **Tasks that are too large**: Requirements, design, code, and tests all compete for a single context, creating inconsistencies from beginning to end.
- **Late testing**: Tests are added only after the feature is complete, making them likely to conform to the existing implementation instead of validating the actual requirements.
- **Brittle tests**: Tests target private functions, call counts, or internal structure, so ordinary refactoring causes widespread failures.
- **Blind Bug fixing**: Changes are attempted repeatedly without a stable reproduction, potentially hiding symptoms or introducing new problems.
- **Review without a baseline**: Review checks only whether “the tests pass” rather than whether the code actually satisfies the original requirements.

This workflow reduces those risks through staged control: first establish a shared understanding, then produce a Spec; decompose large work into verifiable vertical Tickets; use TDD during implementation to create a fast feedback loop; and finally review requirements compliance and code quality separately.

### 1.3 Problems Solved at Each Stage

| Stage | Primary question | Primary output |
|---|---|---|
| `grill` | Do we truly understand the problem we are trying to solve? | Confirmed rules, boundaries, terminology, and decisions |
| `spec` | How do we turn the discussion into a stable, reviewable implementation baseline? | Spec / PRD, acceptance criteria, and test seams |
| `tickets` | How do we decompose a large requirement into independently deliverable work? | Vertically sliced Tickets and dependency relationships |
| `implement + TDD` | How do we implement correctly with continuous feedback? | Code, behavioral tests, and validation results |
| `review` | Does the implementation satisfy the requirements and meet code-quality standards? | Standards and Spec review results |
| `diagnosing-bugs` | How do we locate complex faults without guessing blindly? | Stable reproduction, root cause, regression test, and minimal fix |
| `improve-codebase-architecture` | What should we do when the feature works but the code structure is deteriorating? | Architecture issue report and candidate improvements |

### 1.4 Applicable Scenarios

This workflow applies to:

- New feature development.
- Extensions to existing features.
- Bug fixes and performance-regression investigations.
- Changes spanning multiple modules or both front end and back end.
- Projects with heavy AI Agent involvement that require explicit scope control.
- Team-based development as well as independently maintained solo projects.

For copy changes, simple configuration updates, or obvious one- or two-line fixes, there is no need to follow the full workflow mechanically. Depending on risk and scale, it can be shortened to:

```text
spec → implement/TDD → review
```

Or, when both the problem and the change are completely clear:

```text
implement → targeted tests → review
```

### 1.5 Relationship Between Team and Solo Development

This document uses team development as the default path: create a feature branch from the main branch, then merge it after a PR, CI, and human Review.

Solo development is not a separate methodology; it is a Git-workflow branch within the same process. A solo developer can commit directly to `main`, but should still record the Commit before starting the feature so that `/code-review` has a clear comparison point. Requirements clarification, Spec, Ticket, TDD, Review, and Bug-diagnosis steps remain unchanged.

---

## 2. Overall Workflow

```text
Requirement
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
PR / merge / release

When a Bug appears: diagnosing-bugs
When the code structure needs improvement: improve-codebase-architecture
```

Corresponding Skills:

```text
/grill-with-docs
/to-spec
/to-tickets
/implement + /tdd
/code-review
/diagnosing-bugs
/improve-codebase-architecture
```

Core principles:

- Clarify requirements, boundaries, and acceptance criteria before writing code.
- Identify test seams before implementing the feature.
- Decompose medium and large requirements into independently verifiable vertical Tickets.
- Complete one observable behavior at a time during implementation.
- After implementation, check both “does it satisfy the Spec?” and “is the code quality acceptable?”
- When the cause of a Bug is unclear, do not modify code blindly; establish a stable reproduction first.

---

## 3. Choosing a Development Mode

### 3.1 Team Development: Feature Branch + PR Recommended

Usually, create a feature branch from the latest main branch:

```bash
git switch main
git pull
git switch -c feature/order-cancellation
```

After development is complete, use:

```text
/code-review main
```

It reviews the current feature branch's changes since its merge base with `main`.

Recommended flow:

```text
main
  ↓ create a feature branch
feature/...
  ↓ implement and test
code-review main
  ↓ fix issues
push
  ↓
create PR
  ↓ CI + human Review
merge into main
```

### 3.2 Solo Development: Commit Directly to main

A solo project does not always require a feature branch. When developing directly on `main`, record the current Commit before starting a new feature:

```bash
git rev-parse HEAD
```

For example, it may return:

```text
a1b2c3d
```

After the feature is complete, use:

```text
/code-review a1b2c3d
```

You can also create a local tag:

```bash
git tag review/order-cancel-start
```

After development is complete:

```text
/code-review review/order-cancel-start
```

Delete the tag after the review if desired:

```bash
git tag -d review/order-cancel-start
```

The only major difference between solo and team development is the Git workflow; the primary `grill → spec → tickets → implement/TDD → review` process remains unchanged.

---

## 4. Grill: Clarify Requirements

### Objective

Use an interview to clarify:

- User problems and expected behavior
- Business rules
- Permission rules
- Edge cases
- Error handling
- Data and interface impact
- Technical constraints
- Acceptance criteria
- Test boundaries
- Out of Scope

### Prompt

```text
/grill-with-docs

Please clarify the following requirement:

<insert requirement>

Focus on confirming:
- User scenarios and expected behavior
- Business rules and edge cases
- Permissions and error handling
- Technical constraints
- Acceptance criteria
- Test seams
- Out of Scope

At this stage, only clarify requirements and make necessary updates to project documentation; do not modify business code.
After confirmation is complete, output a summary and stop. Wait for me to run /to-spec.
```

### Completion Criteria

Before moving to the next stage, clarify:

- Under which conditions the operation succeeds and under which conditions it fails.
- What result the user can ultimately observe.
- How errors are expressed and handled.
- Which behaviors must be verified through automated tests.
- Which items are explicitly outside the scope of this work.

---

## 5. Spec: Produce a Formal Specification

### Objective

Turn the confirmed discussion into a shared baseline for subsequent development, testing, and Review.

### Prompt

```text
/to-spec

Generate a formal Spec based on the requirements we just confirmed.

It must include:
- Problem Statement
- Solution
- User Stories
- Business Rules
- Implementation Decisions
- Testing Decisions
- Acceptance Criteria
- Out of Scope
- Known risks

Define the test seams explicitly. Test only public behavior, not private implementation.
At this stage, only create or update the Spec; do not modify business code.
Stop when finished and wait for my review.
```

### Minimum Spec Structure

```markdown
## Problem Statement
The problem the user currently faces.

## Solution
The user experience and system behavior after the feature is complete.

## User Stories
1. As a ...
2. As a ...

## Business Rules
- Rule one
- Rule two

## Implementation Decisions
- Module and interface decisions
- State transitions
- API, Schema, or permission handling

## Testing Decisions
- Test seams
- Normal scenarios
- Error scenarios
- Edge cases

## Acceptance Criteria
- [ ] Criterion one
- [ ] Criterion two

## Out of Scope
- Items not included in this work
```

### Whether Tickets Are Required

- Small change: `spec → implement/TDD → review`
- Medium or large feature: `spec → tickets → implement/TDD → review`

---

## 6. Tickets: Decompose into Vertical Tasks

### When They Are Needed

- The feature involves multiple modules.
- A single Agent context cannot reasonably complete the work.
- There are multiple behaviors that can be accepted independently.
- Multiple developers or Agents need to work in parallel.
- The tasks have explicit dependencies.

### Prompt

```text
/to-tickets <Spec path, Issue, or URL>

Decompose the Spec into vertical slices that can be implemented and verified independently.

Requirements:
- Each Ticket delivers one complete user behavior
- Each Ticket can be completed in a fresh context
- Each Ticket includes acceptance criteria
- Mark Blocked by relationships
- Do not divide work horizontally into database, back end, front end, and tests
- Keep tests in the same Ticket as the corresponding functionality

Show the proposed decomposition first and publish only after confirmation.
Stop after publishing; do not start implementation automatically.
```

### Horizontal Decomposition Is Not Recommended

```text
Ticket 1: Modify the database
Ticket 2: Implement the back end
Ticket 3: Implement the front end
Ticket 4: Add tests
```

### Recommended Vertical Decomposition

```text
Ticket 1: The user can complete the core operation
Ticket 2: Permissions and invalid states are handled correctly
Ticket 3: The operation supports idempotency or concurrency protection
Ticket 4: The front end provides a complete entry point and result feedback
```

Each Ticket should include the code, tests, and necessary documentation required to implement that behavior.

### Notes for Parallel Team Development

- Only Tickets with no unfinished Blockers may begin.
- Minimize multiple Tickets changing the same file at the same time.
- Define shared cross-module interfaces through a Spec or ADR first.
- Using a separate branch and PR for each Ticket makes Review easier.
- When multiple parallel Tickets depend on the same foundational change, create a foundation or prefactoring Ticket first.

---

## 7. Implement + TDD: Implement One Ticket at a Time

### Prompt

```text
/implement <Ticket URL, number, or path>

Implement only the current Ticket.

Requirements:
- Read the Ticket, parent Spec, CONTEXT.md, and relevant ADRs
- Use the test seams confirmed in the Spec
- Use TDD: red → green
- Implement only one observable behavior at a time
- Do not test private functions or internal call counts
- Do not add functionality outside the Ticket
- Run targeted tests and typecheck regularly

When implementation is complete, run:
1. Targeted tests for the current Ticket
2. Related tests
3. The complete test suite
4. typecheck
5. lint
6. build

Then run /code-review and report the results.
```

### TDD Loop

```text
Choose one behavior
  ↓
Write a failing test first
  ↓
Confirm that the test fails for the correct reason
  ↓
Write the minimum implementation
  ↓
Test passes
  ↓
Move to the next behavior
```

Example:

```text
Test 1: An authorized user can perform the operation
Write the minimum code
Test turns green

Test 2: An unauthorized user is rejected
Add the permission check
Test turns green

Test 3: An invalid state is rejected
Add the state rule
Test turns green

Test 4: Repeated operations remain idempotent
Add idempotency protection
Test turns green
```

### Testing Principles

Prefer testing public behavior:

```text
Calling the API returns the correct result
The user completes the operation through the UI
System state changes correctly through the real public flow
An invalid request returns the correct error
```

Avoid testing implementation details:

```text
Whether a private function was called
Whether a Repository method was called once
The order of internal function calls
The intermediate state of a private field
```

### Completion Criteria

- All acceptance criteria for the current Ticket are satisfied.
- Tests failed first, then passed.
- Targeted and related tests pass.
- The complete test suite passes.
- typecheck, lint, and build pass.
- No debug logs, temporary code, or unrelated changes remain.

---

## 8. Review: Check Again

### Objective

Review the implemented code from two perspectives:

1. **Spec Review**: Whether it implements the requirements correctly and completely.
2. **Standards Review**: Whether the code follows project conventions and sound design principles.

### Team Development Prompt

```text
/code-review main

Review all changes on the current feature branch relative to main.

Focus on:
- Whether the implementation fully satisfies the Spec
- Whether edge cases were missed
- Whether there is Scope Creep
- Whether tests verify real external behavior
- Whether duplicated code exists
- Whether there is excessive abstraction
- Whether module boundaries are reasonable
- Whether there are obvious code smells

Report issues first; do not modify the code immediately.
```

### Prompt for Solo Development Directly on main

```text
/code-review <Commit SHA or Tag from before the feature started>

Review all changes from that fixed point through the current HEAD.

Focus on:
- Whether the implementation fully satisfies the Spec
- Whether edge cases were missed
- Whether there is Scope Creep
- Whether tests verify real external behavior
- Whether there is duplicated code or excessive abstraction
- Whether module boundaries are reasonable

Report issues first; do not modify the code immediately.
```

### Handling Review Results

```text
Fix the confirmed valid issues from code-review.

After fixing them, rerun:
- Targeted tests
- Related tests
- The complete test suite
- typecheck
- lint
- build

Then run /code-review <original fixed point> again.
```

### Final Gate for Team Development

Before merging the PR, confirm:

```text
[ ] Spec Review has no blocking issues
[ ] Standards Review has no blocking issues
[ ] Automated tests pass
[ ] typecheck passes
[ ] lint passes
[ ] build passes
[ ] CI passes
[ ] Human Review is complete
[ ] The PR description matches the actual changes
[ ] No unresolved Review Comments remain
```

---

## 9. Bug Path: Diagnosing Bugs

### When to Use It

- Feature behavior is incorrect.
- A test fails but the cause is unclear.
- CI fails while the same test passes locally.
- A Bug occurs intermittently.
- There is a concurrency or timing problem.
- Performance declines significantly.
- Fixing one location causes a regression elsewhere.
- The Agent begins guessing repeatedly and making arbitrary changes.

### Prompt

```text
/diagnosing-bugs

Problem description:
<specific symptom>

Reproduction steps or failing command:
<command, error message, or interaction path>

First establish a stable, minimal failure feedback loop. Do not guess at the cause directly.

Then:
1. Reproduce consistently
2. Minimize the reproduction
3. Form falsifiable hypotheses
4. Test them one at a time
5. Add a regression test at the correct seam
6. Apply the minimal fix
7. Rerun the original reproduction and the complete test suite
```

### Diagnostic Process

```text
Establish a stable failure signal
  ↓
Minimize the reproduction
  ↓
Form 3–5 hypotheses
  ↓
Test them with logs, a debugger, or experiments
  ↓
Write a regression test first
  ↓
Apply the minimal fix
  ↓
Run the original reproduction
  ↓
Run the complete test suite
  ↓
code-review
```

### Prohibited Practices

- Modifying code before establishing a stable reproduction.
- Changing multiple variables at once.
- Resolving a failure by deleting a test.
- Resolving a failure by skipping a test or weakening its assertions.
- Confirming only that “there is no error” without verifying the user's actual symptom.
- Failing to add a regression test after the fix.

---

## 10. Further Improvement of Implemented Features

### Comprehensive Feature and Code Review

```text
/code-review <main, starting Commit, or Tag>
```

Suitable for:

- Checking whether the requirement was fully implemented.
- Checking whether edge cases were missed.
- Checking test coverage and code quality.
- Checking whether the scope drifted.

### A Clear Bug or Test Failure

```text
/diagnosing-bugs
```

Suitable for:

- Locating a specific error.
- Fixing intermittent or complex Bugs.
- Adding a reliable regression test.

### Code Runs but Its Structure Is Disorganized

```text
/improve-codebase-architecture
```

Prompt:

```text
/improve-codebase-architecture

Review the code structure related to <feature or module name>.

Focus on finding:
- Unclear module boundaries
- Scattered business logic
- Excessive coupling
- Expanding change scope
- Designs that are difficult to test
- Opportunities to create a deep module

First produce an analysis and candidate improvements. Do not immediately perform a large-scale refactor.
```

For a selected architecture improvement, the recommended path is:

```text
spec → tickets → implement/TDD → review
```

Do not perform a large-scale refactor without a Spec, acceptance criteria, and regression tests.

---

## 11. Common Workflow Combinations

### Small Change

```text
grill
  ↓
spec
  ↓
implement + TDD
  ↓
review
```

### Medium or Large Feature

```text
grill
  ↓
spec
  ↓
tickets
  ↓
implement + TDD one by one
  ↓
review
  ↓
PR / merge
```

### Parallel Development by Multiple People

```text
grill
  ↓
spec
  ↓
tickets + blocking edges
  ↓
parallel implement + TDD on multiple feature branches
  ↓
code-review for each branch
  ↓
independent PRs + CI
  ↓
merge in dependency order
```

### When a Bug Appears

```text
diagnosing-bugs
  ↓
regression test
  ↓
minimal fix
  ↓
complete test suite
  ↓
review
```

### Structural Improvement of an Existing Feature

```text
code-review
  ↓
improve-codebase-architecture
  ↓
select one improvement
  ↓
spec
  ↓
tickets
  ↓
implement + TDD
  ↓
review
```

### Solo Development Directly on main

```text
Record the starting Commit
  ↓
grill
  ↓
spec
  ↓
tickets (optional)
  ↓
implement + TDD
  ↓
Create small Commits
  ↓
code-review <starting Commit>
  ↓
Fix and revalidate
```

---

## 12. Final Checklist

```text
[ ] Requirements have been clarified through Grill
[ ] A clear Spec exists
[ ] Acceptance criteria are observable and testable
[ ] Medium and large features have been decomposed into vertical Tickets
[ ] Dependencies between Tickets are clear
[ ] Each behavior was implemented through TDD
[ ] No private implementation details are tested
[ ] Targeted tests pass
[ ] Related tests pass
[ ] The complete test suite passes
[ ] typecheck passes
[ ] lint passes
[ ] build passes
[ ] code-review has been run
[ ] Valid issues from Review have been addressed
[ ] Bug fixes include regression tests
[ ] No debug logs or temporary code remain
[ ] The team project's PR, CI, and human Review are complete
```

---

## 13. One-Sentence Reminder

```text
Clarify first, then write the specification;
decompose the specification into tasks, and implement each task with TDD;
Review when finished, and diagnose before fixing a Bug.
```
