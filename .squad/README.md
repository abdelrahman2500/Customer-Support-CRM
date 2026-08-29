# squad-kit workspace

> **Note:** the manual, human-in-the-loop workflow below describes how to
> use the `squad` CLI directly. It is not the only path in this repository.
> The root **`CLAUDE.md`** is the authoritative instruction set for
> Claude Code sessions here and defines a continuous, autonomous Story loop
> that plans and implements Stories without per-Story human confirmation,
> writing into this same `.squad/plans/**`/`.squad/stories/**` structure.
> Where the two read as contradictory (for example, a generated plan's own
> "STOP HERE" closing line), `CLAUDE.md` wins.

This folder is managed by [squad-kit](https://github.com/AzmSquad/squad-kit).

- **Project:** Customer Support CRM
- **Language:** typescript
- **Tracker:** github

## Workflow

1. **Intake** — `squad new-story <feature-slug>` scaffolds `stories/<feature>/<id>/intake.md`. Paste the tracker title, description, and acceptance criteria.
2. **Plan** — Run `/squad-plan <intake-path>` in your agent (or `squad new-plan <intake-path>` to get the composed prompt on stdout).
3. **Implement** — Open a new, scoped agent session and attach **only** the generated `NN-story-*.md` file. Let a cheap model execute it.

Plan meta-prompts (`generate-plan.md`, `story-skeleton.md`) ship inside the squad-kit package — they are not copied here. Upgrade squad-kit to update them.
