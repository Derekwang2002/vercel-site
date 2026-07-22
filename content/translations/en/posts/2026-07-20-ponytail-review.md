---
title: "Ponytail Review: A Code Review Skill Dedicated to Removing Overengineering"
summary: "An introduction to how ponytail-review checks only the current diff for overengineering, using five categories of suggestions—delete, stdlib, native, yagni, and shrink—to add the deletion perspective that ordinary code review rarely covers."
---

Most code reviews look for “what is still missing”: Is error handling incomplete? Are there security issues? Are there enough tests? Are the requirements fully implemented?

[`ponytail-review`](https://github.com/DietrichGebert/ponytail/blob/16f29800fd2681bdf24f3eb4ccffe38be3baec6b/skills/ponytail-review/SKILL.md) turns that around and asks only one question:

> What in this diff does not need to exist at all?

It is an Agent Skill in the [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) project, dedicated to reviewing overengineering. It does not check correctness, security, or performance, does not modify code directly, and does not produce an exhaustive review report. It only lists code that can be deleted, inlined, or replaced with existing capabilities, and requires every suggestion to explain the replacement.

The protagonist of the Ponytail project is a “lazy senior engineer”: give him fifty lines of code and, rather than discussing grand architecture, he reduces it to the few lines actually needed. `ponytail-review` is the most restrained and practical version of this persona.

---

## It Addresses Another Kind of Error in AI-Generated Code

AI coding agents do not merely write incorrect code; they also readily write **correct but unnecessary code**.

For example, a date field might be implemented by:

- Adding a third-party date-component dependency.
- Wrapping it in a project component.
- Creating a new stylesheet.
- Adding time-zone configuration in advance.
- Abstracting a generic interface for a single caller.

This code may compile, and its tests may pass. A conventional review focused on functionality and risk may not even flag it. Yet the repository has now acquired the costs of dependency upgrades, style compatibility, understanding abstractions, and long-term maintenance.

`ponytail-review` makes “overengineering” a review dimension of its own. Rather than asking whether the code works, it keeps asking:

- Does the requirement actually call for this capability?
- Does the repository already contain an implementation?
- Does the standard library already provide it?
- Is it supported natively by the browser, database, or operating system?
- Does this abstraction really have a second implementation?
- Can the same logic be expressed more directly?

This review is particularly suitable for agent-generated diffs. Human developers may copy code under time pressure, while agents often generate scaffolding, extension points, and explanatory wrappers because they “want to appear complete.” The causes of redundancy differ, but maintainers pay for both in the end.

## Five Categories of Findings

`ponytail-review` constrains its output with five tags. The tags are not decoration; they force the reviewer to explain what kind of complexity this is and what will replace it after deletion.

| Tag | What it looks for | Common replacement |
|---|---|---|
| `delete` | Dead code, unused flexibility, speculative features | Nothing is needed |
| `stdlib` | Handwritten implementations of standard-library capabilities | A specific standard-library function or type |
| `native` | Dependencies or custom code that duplicate platform capabilities | Native browser, database, or operating-system functionality |
| `yagni` | Single-implementation interfaces, single-product factories, immutable configuration, single-caller layers | Inline directly; abstract when a real need appears |
| `shrink` | Unchanged logic that can be expressed much more briefly | A more direct equivalent implementation |

### `delete`: Remove Code with No Real Requirement

```text
L52-71: delete: Retry wrapper around an idempotent local call. No replacement needed.
```

This category does not demand removing all protective code. It looks for mechanisms unsupported by a failure model, branches that can never be reached, and features that “might be useful someday.”

### `stdlib`: Do Not Reimplement the Standard Library

```text
utils.py:L30-44: stdlib: Hand-written loop builds a dict from two sets of values. Use dict(zip(keys, values)).
```

Standard-library implementations are usually shorter and more broadly tested. The point is not to chase one-line code, but to avoid making the team own an implementation it never needed to build.

### `native`: Use Capabilities the Platform Already Provides First

```text
date-picker.tsx:L4: native: Component library imported for one date input. Use <input type="date">, removing a dependency.
```

`native` is Ponytail's most distinctive category. Browser controls, CSS, database constraints, and operating-system features are often cheaper than reimplementing them at the application layer.

Native capabilities must, of course, genuinely satisfy the product requirements. If a date picker needs interaction, formatting, or accessibility behavior that browsers do not support, it should not be forcibly replaced merely to save a few lines.

### `yagni`: Do Not Design for the Second Requirement Before It Appears

```text
repo.py:L88: yagni: AbstractRepository has one implementation. Inline until a second appears.
```

Interfaces and factories are not inherently bad; the question is whether they address variation that actually exists. With one implementation, one caller, and one parameter that will not vary, an abstraction layer only lengthens the reading path.

### `shrink`: Preserve the Logic, Reduce the Cost of Expressing It

```text
L30-44: shrink: Hand-written loop builds a dict. Replace with dict(zip(keys, values)).
```

This category is the easiest to misuse as code golf. A good `shrink` reduces both line count and cognitive load. If the shorter form makes readers stop and puzzle over it, it is not an effective simplification.

## Why the Output Is Deliberately Limited to One Line

`ponytail-review` requires every finding to use a fixed format:

```text
<file>:L<line>: <tag> <what to remove>. <what replaces it>.
```

For a multi-file diff, it includes the filename; for a single-file diff, a line number is enough. It ends with one line summarizing the theoretical reduction:

```text
net: -42 lines possible.
```

If nothing can be removed, it need not invent a problem to prove that it did work. It outputs only:

```text
Lean already. Ship.
```

This format solves several common problems with AI reviews.

First, it must point to specific code rather than vaguely saying “the structure seems somewhat complex.” Second, it must provide a replacement instead of merely expressing a personal preference. Third, the one-line limit compresses review noise so the author can quickly judge whether the suggestion is valid.

`net: -N lines possible.` works as a summary of deletion opportunities in this review, but should not become a team KPI. Fewer lines are an outcome, not the objective; sacrificing readability or necessary safeguards to produce a larger negative number betrays the Skill itself.

## What It Explicitly Does Not Do

Whether a narrow Skill is useful depends largely on whether it knows its boundaries. `ponytail-review` explicitly excludes:

- Correctness bugs.
- Security vulnerabilities.
- Performance issues.
- Automatically applying changes.

Those belong in a conventional code review. It also explicitly preserves minimal smoke tests and `assert`-based self-checks; it does not treat tests as bloat merely because they add lines.

Consequently, `ponytail-review` cannot serve as the only merge gate. A diff may receive `Lean already. Ship.` while still containing SQL injection, a race condition, or completely incorrect business logic. The statement means only “there is no obvious overengineering,” not that the code as a whole is ready to ship.

## Why It Is More Practical Than the Other Ponytail Skills

The Ponytail repository currently provides six Skills. They share one philosophy, but their costs of use differ.

### `ponytail`: Continuously Constrain the Entire Coding Process

The main Skill organizes YAGNI, reuse of existing code, standard-library-first, and platform-native-first into a decision ladder, with three intensity levels: `lite`, `full`, and `ultra`. The plugin can also continuously inject rules into every conversation turn and sub-agent through lifecycle Hooks.

This suits teams that want to enforce a uniform agent coding style, but it is not a lightweight mechanism: modes are stateful, environment variables and configuration files are involved, and installation and injection differ between agents. Many projects only need to put a few core principles in `AGENTS.md`; they do not necessarily need a plugin continuously changing every implementation decision.

`ponytail-review` does not have this problem. It is one-shot: run it when needed, and it ends after reading the diff without changing the mode of subsequent sessions.

### `ponytail-audit`: Extend Review to the Entire Repository

`ponytail-audit` scans the entire repository using the same tags and sorts findings by estimated deletion volume. It suits a dedicated legacy-code cleanup, but not a routine default action.

Repository-wide code lacks the requirement boundary of the current diff. An interface that appears to have one implementation may serve external plugins; configuration that appears never to change may be overridden by the deployment system. The broader the scope, the harder it is for the agent to recover the full history, increasing false positives and manual verification costs.

By contrast, the current diff usually has a clear requirement, author, and tests, making it much more reliable to judge whether a new abstraction is unnecessary.

### `ponytail-debt`: Create a Dedicated Ledger for Simplifications

`ponytail-debt` scans `ponytail:` comments in code and compiles deliberately chosen simplifications, capability limits, and upgrade conditions into a list. This convention can help some teams, but if a project already uses issues, TODOs, or technical-debt labels, another Ponytail-specific protocol is redundant.

`ponytail-review`, meanwhile, requires no new comments or governance process; it only consumes an existing diff.

### `ponytail-gain` and `ponytail-help`: Supporting Information Does Not Necessarily Need to Be a Skill

`ponytail-help` is a command cheat sheet, a role the README can already fulfill. `ponytail-gain` is a fixed benchmark card and does not analyze the current repository.

Moreover, the [`ponytail-gain` reviewed for this article](https://github.com/DietrichGebert/ponytail/blob/16f29800fd2681bdf24f3eb4ccffe38be3baec6b/skills/ponytail-gain/SKILL.md) still uses the early single-turn generation experiment's “80–94% less code” figures. The project's current [README](https://github.com/DietrichGebert/ponytail/blob/16f29800fd2681bdf24f3eb4ccffe38be3baec6b/README.md) acknowledges that the old baseline also counted model explanations and alternatives, inflating the gains. Updated real agent experiments report averages of about 54% fewer LOC, 20% lower cost, and 27% less time.

Benchmark reports are certainly worth reading, but baking changing data into a Skill costs more maintenance than the capability it provides.

That is the key difference between `ponytail-review` and the other files: it is not a persistent methodology, repository-governance protocol, global scanner, or promotional page, but a review tool with clear boundaries.

## Recommended Workflow: Put It in the Second Review Pass

The safest use is not to replace normal review with `ponytail-review`, but to perform two consecutive passes:

```text
Feature implementation complete
  ↓
Conventional review: requirements, correctness, security, error handling, performance, tests
  ↓
ponytail-review: look only for complexity that can be removed
  ↓
Human verifies suggestions and makes changes
  ↓
Run tests again
```

It is best suited to situations where:

- An agent-generated diff is clearly larger than the requirement suggested.
- A dependency, interface, factory, Provider, Wrapper, or configuration layer was added.
- A requirement that should use browser, database, or standard-library capabilities was implemented as a custom system.
- The PR is functionally correct and tests pass, yet maintainers still feel that “such a small requirement should not need this much code.”

You can specify the review scope when using it, for example:

```text
Use ponytail-review to inspect the current branch's diff against main.
Report only overengineering, do not check correctness, and do not modify code.
```

In Codex, after installing the full plugin, invoke `@ponytail-review`; other agents with Skill support generally use `/ponytail-review`. If this is the only capability needed, you can retain only the corresponding `SKILL.md`; there is no need to enable Ponytail's persistent modes, Hooks, and other supporting Skills as well.

## How to Decide Whether to Accept a Deletion Suggestion

After seeing `ponytail-review` output, quickly check it with four questions:

1. Does the replacement completely cover the current explicit requirements?
2. Does the removed code protect a security, data, or accessibility boundary?
3. Does this abstraction truly have only one implementation and one axis of change?
4. After the change, is the code not only shorter but also easier to understand and test?

Apply the suggestion when all four answers support simplification. If any answer depends on business context unknown to the agent, a human should decide rather than mechanically deleting code because the output says `delete`.

## Conclusion

The value of `ponytail-review` is not teaching an agent to write the shortest possible code, but adding a long-absent direction to code review.

A normal review asks: What else do we need to deliver this correctly and safely?

Ponytail Review asks: Once all of that is satisfied, what else can cease to exist?

It looks only at the current diff, searches only for overengineering, provides only actionable deletion suggestions, makes no automatic changes, and does not pretend to cover all aspects of code quality. This narrow scope makes it easier to adopt—and less likely to create new process complexity—than Ponytail's persistent mode, repository-wide Audit, debt ledger, and scorecard.

After conducting a normal review of AI-generated code, let `ponytail-review` take another pass. Even if the final line is only `Lean already. Ship.`, that is more reliable than accepting every abstraction an agent writes by default.
