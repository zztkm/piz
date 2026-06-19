# Advice Mode

Pi Forge advice mode keeps the extension small and avoids creating review artifacts.
The extension sends a short guidance-maintenance request to the Pi agent, using the active conversation context by default.
It gathers and redacts session context only when `--include-session` or `--since` is used.

## What `/forge` Sends

The generated user message includes:

- Target: `AGENTS.md`, Agent Skills, or both.
- A note that the active conversation context is the default evidence source.
- Whether a session digest was included.
- Optional `--since` label or entry id when a digest is included.
- Working directory and session file metadata.
- Redaction count.
- A compact session digest containing entry ids, roles, labels, tool names, and truncated text only when `--include-session` or `--since` is used.

## What The Agent Should Do

The prompt asks the agent to inspect existing guidance first:

- `AGENTS.md`
- `.agents/skills/`
- `.pi/skills/`
- `skills/`

Then the agent should reply with advice grouped as:

1. `AGENTS.md`
2. Skills
3. Deletions or merges
4. Open questions

The agent should classify each recommendation as update existing, create new, delete, merge, or no change.

## What `/forge` Does Not Do

- It does not create proposal files.
- It does not edit `AGENTS.md`.
- It does not create, install, delete, or merge Skill files.
- It does not preserve unredacted secret-like values in the prompt.
