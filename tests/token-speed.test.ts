import { describe, it, expect, vi } from "vitest";
import _register from "../extensions/token-speed/index.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

describe("token-speed extension", () => {
  function createMockPi() {
    const handlers = new Map<string, Array<(event: any, ctx: any) => void>>();
    
    const pi = {
      on: (event: string, handler: (event: any, ctx: any) => void) => {
        if (!handlers.has(event)) {
          handlers.set(event, []);
        }
        handlers.get(event)!.push(handler);
      },
    };

    const emit = (event: string, eventData: any, ctx: any) => {
      const registered = handlers.get(event) || [];
      registered.forEach(h => h({ ...eventData, type: event }, ctx));
    };

    return { pi, emit } as any;
  }

  it("should display tps when using partial usage (Anthropic style)", async () => {
    const { pi, emit } = createMockPi();
    const setStatus = vi.fn();
    const ctx = { ui: { setStatus } };

    _register(pi as ExtensionAPI);

    // 1. message_start (assistant)
    emit("message_start", { message: { role: "assistant" } }, ctx);
    expect(setStatus).not.toHaveBeenCalled();

    // 2. message_update: partial.usage.output = 10 tokens
    // Simulate a small delay to let time pass for TPS calculation
    await new Promise(r => setTimeout(r, 100));
    emit("message_update", { 
      message: { role: "assistant" }, 
      assistantMessageEvent: { partial: { usage: { output: 10 } } } 
    }, ctx);

    expect(setStatus).toHaveBeenCalledWith("tokenSpeed", expect.stringMatching(/[0-9.]+ tok\/s/));
  });

  it("should display tps when using delta text (Ollama/OpenAI style)", async () => {
    const { pi, emit } = createMockPi();
    const setStatus = vi.fn();
    const ctx = { ui: { setStatus } };

    _register(pi as ExtensionAPI);

    // 1. message_start (assistant)
    emit("message_start", { message: { role: "assistant" } }, ctx);

    // 2. message_update: delta text provided instead of usage
    await new Promise(r => setTimeout(r, 100));
    emit("message_update", { 
      message: { role: "assistant" }, 
      assistantMessageEvent: { delta: "Hello world! This is a test." } // ~30 chars -> ~7 tokens
    }, ctx);

    expect(setStatus).toHaveBeenCalledWith("tokenSpeed", expect.stringMatching(/[0-9.]+ tok\/s/));
  });

  it("should handle cases where assistantMessageEvent or usage are missing without crashing", async () => {
    const { pi, emit } = createMockPi();
    const setStatus = vi.fn();
    const ctx = { ui: { setStatus } };

    _register(pi as ExtensionAPI);

    // 1. message_start (assistant)
    emit("message_start", { message: { role: "assistant" } }, ctx);

    // 2. message_update where assistantMessageEvent is missing
    expect(() => {
      emit("message_update", { 
        message: { role: "assistant" }, 
        // assistantMessageEvent is undefined
      }, ctx);
    }).not.toThrow();

    // 3. message_end where usage is missing
    expect(() => {
      emit("message_end", { 
        message: { role: "assistant", usage: undefined } // usage is undefined
      }, ctx);
    }).not.toThrow();
  });

  it("should set final tps on message_end", async () => {
    const { pi, emit } = createMockPi();
    const setStatus = vi.fn();
    const ctx = { ui: { setStatus } };

    _register(pi as ExtensionAPI);

    emit("message_start", { message: { role: "assistant" } }, ctx);
    await new Promise(r => setTimeout(r, 100));
    emit("message_update", { 
      message: { role: "assistant" }, 
      assistantMessageEvent: { delta: "some text" } 
    }, ctx);

    // message_end with accurate total tokens
    emit("message_end", { 
      message: { role: "assistant", usage: { output: 100 } } 
    }, ctx);

    expect(setStatus).toHaveBeenCalledWith("tokenSpeed", expect.stringMatching(/[0-9.]+ tok\/s/));
  });
});
