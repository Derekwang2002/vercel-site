# Agent Eval Introduction

`agent-eval` is a helper skill for reviewing Agent Skills and local git diffs. It packages common workflows—reviewing changes, assessing Skill quality, and automatically fixing a Skill from review feedback—into reusable commands. It is useful for pre-commit quality checks and for bounded review/fix loops on a specific Skill.

Repository: <https://github.com/Derekwang2002/skills>

## Use cases

Use `agent-eval` when you need to:

- Review the staged or unstaged local changes in a repository.
- Review one Skill directory without modifying files.
- Run a reviewer/fixer loop on a Skill, allowing the tool to review and attempt repairs within a fixed number of cycles.

Prefer the read-only review commands by default. Use the automatic repair loop only when you explicitly want the tool to modify a Skill.

## Common commands

Review uncommitted local repository changes:

```bash
agent-eval review-diff /path/to/repo
```

Review a Skill without changing files:

```bash
agent-eval review-skill /path/to/skill
```

Run the automatic reviewer/fixer loop:

```bash
agent-eval fix-loop /path/to/skill --max-cycles 2
```

## How it works

`review-diff` collects git status, staged and unstaged diffs, repository-root instruction files such as `AGENTS.md`, and bounded snapshots of changed text files. It performs review only and never invokes the fixer.

`review-skill` treats the provided directory as the Skill root and reviews its `SKILL.md` by default.

`fix-loop` repeats “review → fix” until the reviewer approves the Skill or the configured maximum cycle count is reached.

## Configuration

An optional `config.json` controls the backend command, prompt transport, context include/exclude globs, timeout, output path, and loop count.

The backend command can receive its prompt through stdin, `{prompt_file}`, or `{prompt}`. For large prompts, prefer stdin or `{prompt_file}` so the complete prompt is not exposed in command arguments.

Exclude generated files, virtual environments, caches, runtime output, and sensitive information from configured context.

## Source files

- Skill definition: `agent-eval/SKILL.md`
- Workflow guide: `agent-eval/references/workflows.md`
- Configuration guide: `agent-eval/references/configuration.md`
