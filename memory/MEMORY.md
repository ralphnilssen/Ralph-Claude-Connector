---
name: MEMORY
type: agent-memory-root
owner: Ralph Nilssen
updated: 2026-05-01
---

# Agent memory — Ralph Nilssen

## Boot rule

Before doing any work for Ralph, read `C:\Users\RalphNilssen\Obsidian\Claude\instructions.md`. On macOS, the equivalent path is `/Users/ralph/Documents/Claude/instructions.md`. That file is the authoritative system prompt — identity, context, rules, workflow pipeline, framework references, and skill references. Follow it.

## File operation rule

Work out of the Obsidian vault at `C:\Users\RalphNilssen\Obsidian\Claude` (Mac: `/Users/ralph/Documents/Claude`). Save deliverables to `outputs/` or the relevant `Projects/<name>/outputs/`. Do not use the ephemeral session temp folder unless explicitly asked. The vault is kept in sync across machines via Obsidian Sync.

## Sync discipline

Repo lives on both PC (`C:\Users\RalphNilssen\GitHub\Ralph-Claude-Connector`) and Mac (`/Users/ralph/Documents/GitHub/Ralph-Claude-Connector`). Always `git pull` before starting work on either machine. If a git client prompts to force push or shows the working tree wildly diverged from origin, stop and reconcile — do not let it auto-resolve. On 2026-05-01 a misaligned merge produced commit 58012e6 ("Huge commit") that deleted 250+ files across all skills; recovered via revert e70b33e.

## Plugin distribution

This repo is a Claude Code plugin marketplace, public on GitHub at `ralphnilssen/Ralph-Claude-Connector`. Cowork installs the plugin via the marketplace URL and pulls fresh skills on each session.

Canonical structure (do not flatten):
- `/.claude-plugin/marketplace.json` — marketplace manifest, source field points to `./plugins/ralph-claude-connector`
- `/plugins/ralph-claude-connector/.claude-plugin/plugin.json` — plugin manifest
- `/plugins/ralph-claude-connector/skills/<name>/SKILL.md` — each skill in its own folder
- `/memory/` — this folder, agent memory (not part of the plugin)

To install on a new machine: open Cowork → Customize → Personal plugins → + → Create plugin → Add marketplace → enter `https://github.com/ralphnilssen/Ralph-Claude-Connector` → Sync. Then install `ralph-claude-connector` from the marketplace and delete any duplicate Personal skills.

To add or change a skill: edit the SKILL.md or scripts in the repo, commit, push. Cowork picks up the change on next session start.

## Notes

This memory folder is git-synced to GitHub (`Ralph-Claude-Connector/memory`) so agent memory persists across PC and Mac.
