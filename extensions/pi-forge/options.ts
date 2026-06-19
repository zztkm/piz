import type {
  ForgeMode,
  ForgeOptions,
  ResolvedForgeOptions,
} from "./types.js";

const MODES = new Set<ForgeMode>(["all", "agents", "skills"]);

export function parseForgeArgs(args: string): ForgeOptions {
  const tokens = tokenize(args);
  const options: ForgeOptions = {};

  let index = 0;
  if (tokens[index] && MODES.has(tokens[index] as ForgeMode)) {
    options.mode = tokens[index] as ForgeMode;
    index += 1;
  }

  while (index < tokens.length) {
    const token = tokens[index];
    if (token === "--include-session") {
      options.includeSession = true;
      index += 1;
      continue;
    }
    if (token === "--since") {
      options.since = readValue(tokens, index, token);
      index += 2;
      continue;
    }

    throw new Error(`Unknown /forge argument: ${token}`);
  }

  return options;
}

export function resolveForgeOptions(options: ForgeOptions): ResolvedForgeOptions {
  const cwd = options.cwd ?? process.cwd();

  return {
    mode: options.mode ?? "all",
    includeSession: options.includeSession ?? options.since !== undefined,
    cwd,
    since: options.since,
  };
}

function readValue(tokens: string[], index: number, flag: string): string {
  const value = tokens[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function tokenize(args: string): string[] {
  return args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(unquote) ?? [];
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

