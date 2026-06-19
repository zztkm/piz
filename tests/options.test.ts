import { describe, expect, it } from "vitest";

import { parseForgeArgs, resolveForgeOptions } from "../extensions/pi-forge/options.js";

describe("forge options", () => {
  it("parses mode and flags", () => {
    expect(parseForgeArgs("skills --include-session --since checkpoint")).toEqual({
      mode: "skills",
      includeSession: true,
      since: "checkpoint",
    });
  });

  it("resolves defaults", () => {
    const options = resolveForgeOptions({
      cwd: "/tmp/project",
    });

    expect(options.mode).toBe("all");
    expect(options.includeSession).toBe(false);
    expect(options.cwd).toBe("/tmp/project");
  });

  it("includes session implicitly when --since is used", () => {
    const options = resolveForgeOptions(parseForgeArgs("--since checkpoint"));

    expect(options.includeSession).toBe(true);
    expect(options.since).toBe("checkpoint");
  });

  it("rejects removed file output options", () => {
    expect(() => parseForgeArgs("--scope all")).toThrow(
      "Unknown /forge argument: --scope",
    );
    expect(() => parseForgeArgs("--out .pi/forge")).toThrow(
      "Unknown /forge argument: --out",
    );
    expect(() => parseForgeArgs("--format json")).toThrow(
      "Unknown /forge argument: --format",
    );
  });
});
