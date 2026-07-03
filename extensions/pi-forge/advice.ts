import type { ForgeMode, ForgeSessionTurn, ResolvedForgeOptions } from "./types.js";

const MAX_TURNS = 40;
const MAX_TEXT_PER_TURN = 900;

export interface AdvicePromptInput {
  options: ResolvedForgeOptions;
  turns: ForgeSessionTurn[];
  redactionCount: number;
  sessionFile?: string;
}

export function buildAdvicePrompt(input: AdvicePromptInput): string {
  const target = targetDescription(input.options.mode);
  const digest = input.options.includeSession ? buildSessionDigest(input.turns) : "";

  return [
    "Pi Forge is asking for guidance-maintenance advice.",
    "",
    "Please use the current conversation context already available to you and advise how this project should maintain its agent guidance.",
    "",
    "Important instructions:",
    "- Do not edit files yet. First provide advice only.",
    "- Check the existing guidance before recommending changes.",
    "- Inspect `AGENTS.md` if it exists.",
    "- Inspect existing Skill directories if they exist: `.agents/skills/`, `.pi/skills/`, and `skills/`.",
    "- Classify recommendations as: update existing, create new, delete, merge, or no change.",
    "- Avoid session-specific notes, resolved debugging noise, and secrets.",
    "- If the collected evidence is too weak, say that no durable guidance should be added.",
    "",
    `Target: ${target}`,
    `Session digest included: ${input.options.includeSession ? "yes" : "no"}`,
    `Since: ${input.options.since ?? "not specified"}`,
    `Working directory: ${input.options.cwd}`,
    input.options.includeSession
      ? `Session file: ${input.sessionFile ?? "ephemeral"}`
      : "Session file: not inspected",
    `Redactions performed: ${input.redactionCount}`,
    "",
    input.options.includeSession
      ? "Session digest:"
      : "No session digest is included. Rely on the active conversation context instead.",
    "",
    input.options.includeSession
      ? digest.length > 0
        ? digest
        : "(No session content was available.)"
      : "",
    "",
    "Please respond with concise advice grouped under:",
    "",
    "1. AGENTS.md",
    "2. Skills",
    "3. Deletions or merges",
    "4. Open questions",
    "",
  ].join("\n");
}

export function buildSessionDigest(turns: ForgeSessionTurn[]): string {
  const selectedTurns = turns.slice(-MAX_TURNS);
  return selectedTurns
    .map((turn) => {
      const label = turn.label ? ` label=${turn.label}` : "";
      const toolName = turn.toolName ? ` tool=${turn.toolName}` : "";
      const error = turn.isError ? " error=true" : "";
      const text = truncate(turn.text.trim(), MAX_TEXT_PER_TURN);
      return [`### ${turn.id} role=${turn.role}${label}${toolName}${error}`, "", text].join("\n");
    })
    .join("\n\n");
}

function targetDescription(mode: ForgeMode): string {
  if (mode === "agents") {
    return "AGENTS.md maintenance advice only";
  }
  if (mode === "skills") {
    return "Agent Skill maintenance advice only";
  }
  return "AGENTS.md and Agent Skill maintenance advice";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 24).trimEnd()}\n[truncated by Pi Forge]`;
}
