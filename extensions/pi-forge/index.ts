import { buildAdvicePrompt } from "./advice.js";
import { collectSessionTurns } from "./session.js";
import { parseForgeArgs, resolveForgeOptions } from "./options.js";
import { redactTurns } from "./redaction.js";
import type {
  ForgeCommandContext,
  ForgeExtensionApi,
  ForgeOptions,
  ForgeRunResult,
} from "./types.js";

export default function piForgeExtension(pi: ForgeExtensionApi): void {
  pi.registerCommand("forge", {
    description: "Ask the agent how to maintain AGENTS.md or Agent Skills from this session",
    getArgumentCompletions: (prefix) => {
      const items = [
        { value: "all", label: "all", description: "Advise on AGENTS.md and Skills" },
        { value: "agents", label: "agents", description: "Only advise on AGENTS.md" },
        { value: "skills", label: "skills", description: "Only advise on Agent Skills" },
        {
          value: "--include-session",
          label: "--include-session",
          description: "Include a redacted current-branch session digest",
        },
        { value: "--since", label: "--since", description: "Analyze after a label or entry id" },
      ];
      const filtered = items.filter((item) => item.value.startsWith(prefix));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      try {
        const result = await runForge(args, ctx, pi);
        const turnSummary = result.turnCount > 0 ? ` with ${result.turnCount} session turns` : "";
        ctx.ui?.notify?.(`Pi Forge sent a guidance advice request${turnSummary}.`, "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui?.notify?.(`Pi Forge failed: ${message}`, "error");
        throw error;
      }
    },
  });
}

export async function runForge(
  args: string,
  ctx: ForgeCommandContext,
  pi: Pick<ForgeExtensionApi, "sendUserMessage">,
  overrides: ForgeOptions = {},
): Promise<ForgeRunResult> {
  const parsed = parseForgeArgs(args);
  const options = resolveForgeOptions({
    ...parsed,
    ...overrides,
    cwd: overrides.cwd ?? ctx.cwd,
  });

  const turns = options.includeSession
    ? collectSessionTurns(ctx.sessionManager, { since: options.since })
    : [];
  const redacted = options.includeSession ? redactTurns(turns) : { turns, count: 0 };
  const prompt = buildAdvicePrompt({
    options,
    turns: redacted.turns,
    redactionCount: redacted.count,
    sessionFile: ctx.sessionManager.getSessionFile?.(),
  });

  await pi.sendUserMessage(prompt);

  return {
    turnCount: redacted.turns.length,
    redactionCount: redacted.count,
    prompt,
  };
}

export type { ForgeOptions, ForgeRunResult, ForgeSessionTurn } from "./types.js";
