/**
 * Token speed engine - ds4 の gen_tps と同じロジック: tps = count / elapsed.
 *
 *   ds4 (ds4_agent.c): w->status.gen_tps = dt > 0.0 ? (double)(i + 1) / dt : 0.0;
 *
 *   Pi ストリーミングの各チャンクで partial.usage.output(cumulative token count) を利用し、
 *   Ollama等が usage を送らない場合は delta テキスト長から推定する。
 */

export class TokenSpeedEngine {
  private startMs = 0;
  private active = false;
  // Anthropic の streaming 毎に incremental に token 数を送ってくるので
  // tokensAtStart は最初の streaming チャンクの output で初期化
  private tokensAtStart = 0;
  // 最新の cumulative token 数（provider が送る値）
  private latestTokens = 0;
  // fallback: Ollama / OpenAI は streaming チャンクに usage を含まないため
  // delta テキスト長からトークン数を推定してカウント
  private deltaTokenCount = 0;

  start(): void {
    this.startMs = Date.now();
    this.active = true;
    this.tokensAtStart = 0;
    this.latestTokens = 0;
    this.deltaTokenCount = 0;
  }

  get elapsedSec(): number {
    if (!this.active) {
      return 0;
    }
    return (Date.now() - this.startMs) / 1000;
  }

  // ds4 style: tokensSinceStart / elapsed
  get tps(): number {
    if (!this.active) {
      return 0;
    }
    const elapsed = this.elapsedSec;
    if (elapsed <= 0) {
      return 0;
    }
    // latestTokens - tokensAtStart = streaming 中に provider が計上した token
    const outputSinceStart = Math.max(0, this.latestTokens - this.tokensAtStart);
    const totalTokens = outputSinceStart + this.deltaTokenCount;
    return totalTokens / elapsed;
  }

  get finalTps(): number {
    // stream 終了時の値（active フラグ解除前に計算済み）
    return this._finalTps;
  }

  /** provider が streaming チャンク毎に token 数を送ってくる場合（Anthropic など） */
  record(outputTokens: number): void {
    if (!this.active || outputTokens <= 0) {
      return;
    }
    // 初回観測値を記録（Anthropic は最初の streaming チャンクで ~1 を送る）
    if (this.tokensAtStart === 0) {
      this.tokensAtStart = outputTokens;
    }
    // cumulative なので max で clamp
    if (outputTokens > this.latestTokens) {
      this.latestTokens = outputTokens;
    }
  }

  // Ollama / OpenAI は streaming チャンクに usage を含まないため delta から推定
  recordDelta(deltaCharCount: number): void {
    if (!this.active || deltaCharCount <= 0) {
      return;
    }
    // ~4 chars = 1 token の簡易推定
    this.deltaTokenCount += Math.max(Math.floor(deltaCharCount / 4), 1);
  }

  // stream を終了し、最終トークン数で accuracy を合わせる（ds4 style: w->status.gen_tps）
  stop(): number {
    if (!this.active) {
      return 0;
    }
    this._finalTps = this.tps; // streaming フラグを解除する前に最終値を保存
    this.active = false;
    return this._finalTps;
  }

  // message_end で provider が送った最終 token 数を使う場合（accuracy 合わせ用）
  recordFinal(outputTokens: number): void {
    if (!this.active || outputTokens <= 0) {
      return;
    }
    this.latestTokens = Math.max(this.latestTokens, outputTokens);
  }

  // フルリセット（session shutdown のためなど）
  reset(): void {
    this.startMs = 0;
    this.active = false;
    this.tokensAtStart = 0;
    this.latestTokens = 0;
    this.deltaTokenCount = 0;
    this._finalTps = 0;
  }

  get isStreaming(): boolean {
    return this.active;
  }

  // フッター用のフォーマット文字列を生成する
  static format(tps: number): string {
    if (tps >= 0.1) {
      return tps >= 100 ? `${Math.round(tps)} tok/s` : `${tps.toFixed(1)} tok/s`;
    }
    return "waiting...";
  }

  private _finalTps = 0;
}
