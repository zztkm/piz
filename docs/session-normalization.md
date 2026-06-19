# Session Normalization

Pi Forge does not analyze raw Pi session entries directly.
When `--include-session` or `--since` is used, it first converts entries into `ForgeSessionTurn`, a stable internal shape that preserves evidence ids while dropping client-specific noise.

## Input Sources

- `ctx.sessionManager.getBranch()` for optional current-branch digest generation.
- `ctx.sessionManager.getLabel(entryId)` when labels are available.

## Internal Shape

```typescript
interface ForgeSessionTurn {
  id: string;
  parentId?: string | null;
  role: "user" | "assistant" | "toolResult" | "custom";
  timestamp?: number | string;
  text: string;
  toolName?: string;
  isError?: boolean;
  label?: string;
}
```

## Entry Handling

- `message` entries become user, assistant, or tool result turns.
- `custom_message` entries become custom turns because they may have participated in model context.
- `custom` entries become custom turns unless `customType` is `pi-forge`.
- `compaction` and `branch_summary` entries are treated as custom summary turns.
- Entries that cannot produce meaningful text are ignored.

## Since Filtering

`--since <label-or-entry-id>` searches normalized turns by `id` and `label`.
If a match is found, Pi Forge analyzes entries after that turn.
If no match is found, Pi Forge keeps the full current branch and records no error; this avoids surprising empty advice prompts when labels are stale.

## Digest Policy

The advice prompt keeps entry ids and roles so the agent can trace where session evidence came from.
The prompt should never include unredacted secret-like values from evidence turns.
