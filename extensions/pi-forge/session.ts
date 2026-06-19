import type {
  ForgeReadonlySessionManager,
  ForgeSessionTurn,
} from "./types.js";

export interface CollectSessionOptions {
  since?: string;
}

export function collectSessionTurns(
  sessionManager: ForgeReadonlySessionManager,
  options: CollectSessionOptions,
): ForgeSessionTurn[] {
  const entries = sessionManager.getBranch?.() ?? [];

  const turns = entries
    .map((entry) => normalizeEntry(entry, sessionManager))
    .filter((turn): turn is ForgeSessionTurn => turn !== undefined)
    .filter((turn) => turn.text.trim().length > 0);

  if (!options.since) {
    return turns;
  }

  const index = turns.findIndex(
    (turn) => turn.id === options.since || turn.label === options.since,
  );
  return index >= 0 ? turns.slice(index + 1) : turns;
}

export function normalizeEntry(
  entry: unknown,
  sessionManager?: ForgeReadonlySessionManager,
): ForgeSessionTurn | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }

  const id = stringValue(entry.id) ?? stableUnknownId(entry);
  const parentId = stringValue(entry.parentId);
  const label = sessionManager?.getLabel?.(id);
  const timestamp = numberOrStringValue(entry.timestamp);

  if (entry.type === "message" && isRecord(entry.message)) {
    const message = entry.message;
    const role = normalizeRole(message.role);
    if (!role) {
      return undefined;
    }

    return {
      id,
      parentId,
      role,
      timestamp: numberOrStringValue(message.timestamp) ?? timestamp,
      text: extractContentText(message.content),
      toolName: stringValue(message.toolName),
      isError:
        typeof message.isError === "boolean" ? message.isError : undefined,
      label,
    };
  }

  if (entry.type === "custom_message") {
    return {
      id,
      parentId,
      role: "custom",
      timestamp,
      text: extractContentText(entry.content),
      label,
    };
  }

  if (entry.type === "custom") {
    const customType = stringValue(entry.customType);
    if (customType === "pi-forge") {
      return undefined;
    }

    return {
      id,
      parentId,
      role: "custom",
      timestamp,
      text: stringifyData(entry.data),
      toolName: customType,
      label,
    };
  }

  if (entry.type === "compaction" || entry.type === "branch_summary") {
    return {
      id,
      parentId,
      role: "custom",
      timestamp,
      text: stringifyData(entry.summary ?? entry.data ?? entry.details),
      toolName: String(entry.type),
      label,
    };
  }

  return undefined;
}

function normalizeRole(role: unknown): ForgeSessionTurn["role"] | undefined {
  if (role === "user" || role === "assistant" || role === "toolResult") {
    return role;
  }
  if (role === "tool") {
    return "toolResult";
  }
  if (role === "custom") {
    return "custom";
  }
  return undefined;
}

export function extractContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (!isRecord(part)) {
          return "";
        }
        if (typeof part.text === "string") {
          return part.text;
        }
        if (typeof part.content === "string") {
          return part.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return stringifyData(content);
}

function stringifyData(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberOrStringValue(value: unknown): number | string | undefined {
  return typeof value === "number" || typeof value === "string"
    ? value
    : undefined;
}

function stableUnknownId(entry: Record<string, unknown>): string {
  return `unknown-${Math.abs(hashString(JSON.stringify(entry))).toString(36)}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
