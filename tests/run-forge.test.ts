import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runForge } from "../extensions/pi-forge/index.js";
import type { ForgeCommandContext } from "../extensions/pi-forge/types.js";

describe("runForge", () => {
  it("sends an advice prompt to the agent", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "pi-forge-"));
    const sendUserMessage = vi.fn();
    const getBranch = vi.fn();
    const ctx: ForgeCommandContext = {
      cwd,
      sessionManager: {
        getBranch,
        getSessionFile: () => "/tmp/session.jsonl",
      },
    };

    const result = await runForge("", ctx, { sendUserMessage });

    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(getBranch).not.toHaveBeenCalled();
    expect(result.turnCount).toBe(0);
    expect(result.prompt).toContain("Please use the current conversation context already available to you");
    expect(result.prompt).toContain("AGENTS.md");
    expect(result.prompt).toContain(".agents/skills/");
    expect(result.prompt).toContain("Session digest included: no");
    expect(result.prompt).toContain("Session file: not inspected");
  });

  it("includes and redacts session digest when requested", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "pi-forge-"));
    const sendUserMessage = vi.fn();
    const ctx: ForgeCommandContext = {
      cwd,
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            id: "user-1",
            parentId: null,
            message: {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Always use postgres://admin:SecretPass123@prod.db.example.com:5432/app for migrations.",
                },
              ],
            },
          },
        ],
      },
    };

    const result = await runForge("agents --include-session", ctx, { sendUserMessage });

    expect(result.prompt).not.toContain("SecretPass123");
    expect(result.prompt).toContain("[REDACTED]");
    expect(result.prompt).toContain("Session digest included: yes");
    expect(result.prompt).toContain("user-1");
    expect(sendUserMessage).toHaveBeenCalledWith(result.prompt);
    expect(result.redactionCount).toBeGreaterThan(0);
  });

  it("includes current branch digest when --since is used", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "pi-forge-"));
    const sendUserMessage = vi.fn();
    const ctx: ForgeCommandContext = {
      cwd,
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            id: "branch-entry",
            parentId: null,
            message: {
              role: "user",
              content: [{ type: "text", text: "Always keep branch guidance." }],
            },
          },
        ],
      },
    };

    const result = await runForge("--since checkpoint", ctx, { sendUserMessage });

    expect(result.prompt).toContain("Session digest included: yes");
    expect(result.prompt).toContain("branch-entry");
    expect(result.prompt).toContain("Since: checkpoint");
  });

  it("targets skills-only advice when requested", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "pi-forge-"));
    const sendUserMessage = vi.fn();
    const ctx: ForgeCommandContext = {
      cwd,
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            id: "user-1",
            parentId: null,
            message: {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Always run npm test before release.",
                },
              ],
            },
          },
        ],
      },
    };

    const result = await runForge("skills", ctx, { sendUserMessage });

    expect(result.prompt).toContain("Target: Agent Skill maintenance advice only");
  });
});
