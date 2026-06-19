import { describe, expect, it } from "vitest";

import { collectSessionTurns, extractContentText } from "../extensions/pi-forge/session.js";
import type { ForgeReadonlySessionManager } from "../extensions/pi-forge/types.js";

describe("session normalization", () => {
  it("extracts text from Pi-style content arrays", () => {
    expect(
      extractContentText([
        { type: "text", text: "hello" },
        { type: "image", data: "ignored" },
        { content: "world" },
      ]),
    ).toBe("hello\nworld");
  });

  it("normalizes branch entries and filters since labels", () => {
    const sessionManager: ForgeReadonlySessionManager = {
      getBranch: () => [
        {
          type: "message",
          id: "one",
          parentId: null,
          message: {
            role: "user",
            content: [{ type: "text", text: "before" }],
          },
        },
        {
          type: "message",
          id: "two",
          parentId: "one",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "after" }],
          },
        },
      ],
      getLabel: (id) => (id === "one" ? "checkpoint" : undefined),
    };

    const turns = collectSessionTurns(sessionManager, {
      since: "checkpoint",
    });

    expect(turns).toHaveLength(1);
    expect(turns[0]?.id).toBe("two");
    expect(turns[0]?.text).toBe("after");
  });
});
