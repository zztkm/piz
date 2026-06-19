# Implementation Plan

The MVP is implemented as a small TypeScript package with clear boundaries.

## Package Structure

- `extensions/pi-forge/index.ts`: Pi extension entry point and `/forge` command registration.
- `extensions/pi-forge/options.ts`: command argument parsing and default resolution.
- `extensions/pi-forge/session.ts`: Pi session entry normalization.
- `extensions/pi-forge/redaction.ts`: secret-like value redaction.
- `extensions/pi-forge/advice.ts`: agent advice prompt generation and optional session digest formatting.

The package manifest exposes `./extensions`, matching the conventional Pi package layout used by packages that bundle one or more extensions.

## Execution Order

1. Parse `/forge` arguments.
2. Resolve defaults from `ctx.cwd`.
3. If `--include-session` or `--since` is set, collect current-branch entries from `ctx.sessionManager`.
4. Normalize collected entries into `ForgeSessionTurn`.
5. Redact secret-like values from collected entries.
6. Build an optional compact session digest.
7. Build an AGENTS.md / Skill maintenance advice prompt.
8. Send the prompt to the Pi agent with `pi.sendUserMessage()`.
9. Notify the user that the advice request was sent.

## Test Focus

- Argument parsing defaults and overrides.
- Session normalization for message, tool result, custom, and branch filtering.
- Redaction patterns.
- Advice prompt content, optional digest behavior, and `sendUserMessage()` delivery.

## Future Extension Points

- Add an optional dry-run preview before `sendUserMessage()`.
- Store prior advice request metadata via `pi.appendEntry("pi-forge", ...)`.
- Add duplicate detection against existing `.agents/skills` and `.pi/skills`.
