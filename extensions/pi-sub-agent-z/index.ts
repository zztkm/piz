import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const ROLE_NAMES = ["explore", "review", "plan"] as const;
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
const READ_ONLY_TOOLS = "read,grep,find,ls";
const DEFAULT_TIMEOUT_SECONDS = 300;
const MAX_TIMEOUT_SECONDS = 1800;

type RoleName = (typeof ROLE_NAMES)[number];

type SubAgentParams = {
  role: RoleName;
  prompt: string;
  description: string;
  model?: string;
  thinking?: (typeof THINKING_LEVELS)[number];
  timeoutSeconds?: number;
};

type ProcessResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
};

const rolePrompts: Record<RoleName, string> = {
  explore: [
    "You are a read-only exploration sub agent.",
    "Find the relevant files, symbols, data flow, and existing patterns for the task.",
    "Do not propose edits unless asked. Do not claim to have changed files.",
    "Return a concise report with: summary, relevant files, important details, and open questions.",
  ].join("\n"),
  review: [
    "You are a read-only review sub agent.",
    "Prioritize bugs, behavioral regressions, security risks, design risks, and missing tests.",
    "Do not implement fixes. Do not claim to have changed files.",
    "Return findings first, ordered by severity, with concrete file references when possible.",
  ].join("\n"),
  plan: [
    "You are a read-only planning sub agent.",
    "Create a practical implementation plan based on the repository's existing structure.",
    "Do not implement the plan. Do not claim to have changed files.",
    "Return a concise plan with likely files, steps, validation, and notable risks.",
  ].join("\n"),
};

export default function (pi: ExtensionAPI) {
  registerSubAgentCommand(pi, "sub-agent");
  registerSubAgentCommand(pi, "subagent");

  pi.registerTool({
    name: "sub_agent",
    label: "Sub Agent",
    description:
      "Run a focused read-only Pi sub agent for exploration, review, or planning. The sub agent cannot edit files or run shell commands.",
    promptSnippet:
      "Delegate focused read-only exploration, review, or planning to a separate sub agent.",
    promptGuidelines: [
      "Use sub_agent before reading many files yourself when a focused exploration, review, or plan can reduce main context usage.",
      "Use sub_agent only for bounded tasks. Do not use sub_agent for implementation, shell commands, or simple questions you can answer directly.",
      "When command output is needed, run the command in the main agent and pass the relevant output to sub_agent for analysis.",
    ],
    parameters: Type.Object({
      role: Type.Union([Type.Literal("explore"), Type.Literal("review"), Type.Literal("plan")], {
        description: "Preset that controls the sub agent's behavior and fixed read-only tools.",
      }),
      prompt: Type.String({
        description:
          "Specific task for the sub agent. Include only the context it needs and ask for a concise result.",
      }),
      description: Type.String({
        description: "Short 3-5 word description of the delegated task.",
      }),
      model: Type.Optional(
        Type.String({
          description: "Optional Pi model pattern or provider/model id for the sub agent.",
        }),
      ),
      thinking: Type.Optional(
        Type.Union(
          [
            Type.Literal("off"),
            Type.Literal("minimal"),
            Type.Literal("low"),
            Type.Literal("medium"),
            Type.Literal("high"),
            Type.Literal("xhigh"),
          ],
          {
            description: "Optional Pi thinking level for the sub agent.",
          },
        ),
      ),
      timeoutSeconds: Type.Optional(
        Type.Number({
          minimum: 1,
          maximum: MAX_TIMEOUT_SECONDS,
          description: `Optional timeout in seconds. Defaults to ${DEFAULT_TIMEOUT_SECONDS}.`,
        }),
      ),
    }),
    async execute(_toolCallId, params: SubAgentParams, signal, onUpdate, ctx) {
      const rolePrompt = rolePrompts[params.role];
      const timeoutSeconds = clampTimeout(params.timeoutSeconds);

      onUpdate?.({
        content: [
          {
            type: "text",
            text: `Starting ${params.role} sub agent: ${params.description}`,
          },
        ],
        details: {
          role: params.role,
          description: params.description,
          tools: READ_ONLY_TOOLS,
          timeoutSeconds,
        },
      });

      const result = await runPiSubAgent({
        cwd: ctx.cwd,
        role: params.role,
        prompt: params.prompt,
        rolePrompt,
        model: params.model,
        thinking: params.thinking,
        timeoutSeconds,
        signal,
      });

      const output = result.stdout.trim();
      const stderr = result.stderr.trim();

      if (result.timedOut) {
        return {
          content: [
            {
              type: "text",
              text: `Sub agent timed out after ${timeoutSeconds}s.${stderr ? `\n\nstderr:\n${stderr}` : ""}`,
            },
          ],
          details: { ...result, role: params.role },
          isError: true,
        };
      }

      if (result.code !== 0) {
        return {
          content: [
            {
              type: "text",
              text: [
                `Sub agent failed with exit code ${result.code ?? "unknown"}.`,
                stderr ? `stderr:\n${stderr}` : "",
                output ? `stdout:\n${output}` : "",
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
          ],
          details: { ...result, role: params.role },
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: output || "Sub agent completed without output.",
          },
        ],
        details: {
          role: params.role,
          description: params.description,
          tools: READ_ONLY_TOOLS,
          stderr,
        },
      };
    },
  });
}

function registerSubAgentCommand(pi: ExtensionAPI, name: string) {
  pi.registerCommand(name, {
    description: "Run a read-only sub agent explicitly: /sub-agent <role> <task>",
    handler: async (args, ctx) => {
      const parsed = parseCommandArgs(args);
      if (!parsed) {
        ctx.ui.notify("Usage: /sub-agent <explore|review|plan> <task>", "error");
        return;
      }

      const timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;
      ctx.ui.notify(`Starting ${parsed.role} sub agent...`, "info");

      try {
        const result = await runPiSubAgent({
          cwd: ctx.cwd,
          role: parsed.role,
          prompt: parsed.prompt,
          rolePrompt: rolePrompts[parsed.role],
          timeoutSeconds,
        });

        const message = formatCommandMessage({
          role: parsed.role,
          prompt: parsed.prompt,
          result,
          timeoutSeconds,
        });

        pi.sendMessage({
          customType: "sub-agent",
          content: message.content,
          display: true,
          details: {
            role: parsed.role,
            tools: READ_ONLY_TOOLS,
            prompt: parsed.prompt,
            result,
          },
        });

        ctx.ui.notify(
          message.isError
            ? `${parsed.role} sub agent failed`
            : `${parsed.role} sub agent completed`,
          message.isError ? "error" : "info",
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pi.sendMessage({
          customType: "sub-agent",
          content: `Sub agent failed to start.\n\n${message}`,
          display: true,
          details: {
            role: parsed.role,
            tools: READ_ONLY_TOOLS,
            prompt: parsed.prompt,
            error: message,
          },
        });
        ctx.ui.notify("Sub agent failed to start", "error");
      }
    },
  });
}

function parseCommandArgs(args: string): { role: RoleName; prompt: string } | null {
  const trimmed = args.trim();
  const firstSpace = trimmed.search(/\s/);
  if (firstSpace === -1) return null;

  const role = trimmed.slice(0, firstSpace);
  if (!isRoleName(role)) return null;

  const prompt = trimmed.slice(firstSpace).trim();
  if (!prompt) return null;

  return { role, prompt };
}

function isRoleName(value: string): value is RoleName {
  return ROLE_NAMES.includes(value as RoleName);
}

function formatCommandMessage(options: {
  role: RoleName;
  prompt: string;
  result: ProcessResult;
  timeoutSeconds: number;
}): { content: string; isError: boolean } {
  const output = options.result.stdout.trim();
  const stderr = options.result.stderr.trim();
  const header = `Sub agent (${options.role}) result`;

  if (options.result.timedOut) {
    return {
      content: [
        `${header}: timed out after ${options.timeoutSeconds}s.`,
        stderr ? `stderr:\n${stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      isError: true,
    };
  }

  if (options.result.code !== 0) {
    return {
      content: [
        `${header}: failed with exit code ${options.result.code ?? "unknown"}.`,
        stderr ? `stderr:\n${stderr}` : "",
        output ? `stdout:\n${output}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      isError: true,
    };
  }

  return {
    content: [header, "", output || "Sub agent completed without output."].join("\n"),
    isError: false,
  };
}

function clampTimeout(timeoutSeconds: number | undefined): number {
  if (timeoutSeconds === undefined) return DEFAULT_TIMEOUT_SECONDS;
  if (!Number.isFinite(timeoutSeconds)) return DEFAULT_TIMEOUT_SECONDS;
  return Math.min(Math.max(Math.floor(timeoutSeconds), 1), MAX_TIMEOUT_SECONDS);
}

async function runPiSubAgent(options: {
  cwd: string;
  role: RoleName;
  prompt: string;
  rolePrompt: string;
  model?: string;
  thinking?: (typeof THINKING_LEVELS)[number];
  timeoutSeconds: number;
  signal?: AbortSignal;
}): Promise<ProcessResult> {
  const args = [
    "--print",
    "--no-extensions",
    "--tools",
    READ_ONLY_TOOLS,
    "--append-system-prompt",
    options.rolePrompt,
    "--name",
    `sub-agent:${options.role}`,
  ];

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.thinking) {
    args.push("--thinking", options.thinking);
  }

  args.push("Complete the sub-agent task from stdin and return only the final report.");

  return new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn("pi", args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutSeconds * 1000);

    const abort = () => {
      child.kill("SIGTERM");
    };

    options.signal?.addEventListener("abort", abort, { once: true });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
      reject(error);
    });

    child.on("close", (code, closeSignal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
      resolve({
        stdout,
        stderr,
        code,
        signal: closeSignal,
        timedOut,
      });
    });

    child.stdin.end(
      [
        `Role: ${options.role}`,
        "",
        "Task:",
        options.prompt,
        "",
        "Constraints:",
        "- You are read-only.",
        "- Do not run shell commands.",
        "- Do not edit files.",
        "- Keep the final report concise and useful to the main agent.",
      ].join("\n"),
    );
  });
}
