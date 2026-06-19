export type ForgeMode = "all" | "agents" | "skills";
export type ForgeRole = "user" | "assistant" | "toolResult" | "custom";

export interface ForgeSessionTurn {
  id: string;
  parentId?: string | null;
  role: ForgeRole;
  timestamp?: number | string;
  text: string;
  toolName?: string;
  isError?: boolean;
  label?: string;
}

export interface ForgeRunResult {
  turnCount: number;
  redactionCount: number;
  prompt: string;
}

export interface ForgeOptions {
  mode?: ForgeMode;
  includeSession?: boolean;
  since?: string;
  cwd?: string;
}

export interface ResolvedForgeOptions {
  mode: ForgeMode;
  includeSession: boolean;
  cwd: string;
  since?: string;
}

export interface ForgeCommandContext {
  cwd?: string;
  sessionManager: ForgeReadonlySessionManager;
  ui?: {
    notify?: (message: string, level?: "info" | "warn" | "error") => void;
  };
}

export interface ForgeReadonlySessionManager {
  getBranch?: () => unknown[];
  getSessionFile?: () => string | undefined;
  getLabel?: (entryId: string) => string | undefined;
}

export interface ForgeExtensionApi {
  sendUserMessage: (
    content: string,
    options?: { deliverAs?: "steer" | "followUp" | "nextTurn" },
  ) => Promise<void> | void;
  registerCommand: (
    name: string,
    options: {
      description: string;
      getArgumentCompletions?: (
        prefix: string,
      ) => Array<{ value: string; label: string; description?: string }> | null;
      handler: (args: string, ctx: ForgeCommandContext) => Promise<void> | void;
    },
  ) => void;
}
