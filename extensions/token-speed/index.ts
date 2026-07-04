/**
 * pi-token-speed - フッターにストリーミング生成速度 (tok/s) を表示する。
 * ds4 の gen_tps と同じロジック: tps = count / elapsed.
 */

import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TokenSpeedEngine } from "./src/engine.js";

const STATUS_KEY: string = "tokenSpeed";
const DISPLAY_TIMEOUT_MS: number = 2000;

export default function _register(pi: ExtensionAPI): void {
  const engine: TokenSpeedEngine = new TokenSpeedEngine();

  // message_start (assistant) - streaming 開始 → タイマー start
  pi.on("message_start", (event, ctx) => {
    if (event.message.role === "assistant") {
      engine.start();
    }
  });

  // message_update - streaming チャンク毎に t/s を計算・表示
  pi.on("message_update", (event, ctx) => {
    if (event.message.role !== "assistant" || !ctx.ui?.setStatus) return;

    // partial.usage.output に cumulative token 数があるか？
    // - Anthropic: streaming チャンク毎に incremental な値を送る → accuracy high
    // - Ollama / OpenAI: 中間チャンクには usage を含まない → fallback delta カウント
    const outputFromPartial = (event.assistantMessageEvent as any).partial?.usage?.output;

    if (outputFromPartial !== undefined && outputFromPartial > 0) {
      // provider が streaming チャンク毎に token 数を送ってくる場合（Anthropic）
      engine.record(outputFromPartial);
    } else {
      // fallback: Ollama / OpenAI は delta から推定
      const deltaStr = (event.assistantMessageEvent as any)?.delta ?? "";
      if (deltaStr.length > 0) {
        engine.recordDelta(deltaStr.length);
      }
    }

    const tps = engine.tps;
    ctx.ui.setStatus(STATUS_KEY, TokenSpeedEngine.format(tps));
  });

  // message_end - 最終結果を確定・表示 & 後片付け
  pi.on("message_end", (event, ctx) => {
    if (event.message.role !== "assistant" || !ctx.ui?.setStatus) return;

    // provider が送った最終 token 数で accuracy を合わせる ← ds4 style
    const outputTokens = event.message.usage.output || 0;
    engine.recordFinal(outputTokens); // トークン数を正確に更新

    const tps = engine.stop(); // streaming フラグ解除 + finalTps 計算
    ctx.ui.setStatus(STATUS_KEY, TokenSpeedEngine.format(tps)); // 最終速度表示（ds4 style: "27.5 tok/s"）

    // 次の message_start で自動的にクリアされるが、明示的に後片付けも行う
    setTimeout(() => {
      if (!engine.isStreaming) {
        ctx.ui?.setStatus(STATUS_KEY, undefined);
      }
    }, DISPLAY_TIMEOUT_MS);
  });

  // session 切り替え時に明示的にクリア
  pi.on("session_shutdown", (_event, ctx) => {
    engine.reset();
    ctx.ui?.setStatus(STATUS_KEY, undefined);
  });
}
