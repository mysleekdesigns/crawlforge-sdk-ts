/** What every tool call resolves to: the envelope's fields in camelCase. */
export interface ToolResult<T = Record<string, unknown>> {
  /** The tool's result. Tool-specific; see the tool's docs page. */
  data: T;
  /** Credits charged for this call. */
  creditsUsed: number;
  /** The account's balance after this call. */
  creditsRemaining: number;
  /** Server-side processing time in milliseconds. */
  processingTime: number;
  /** Non-fatal notes from the server; `[]` when the envelope carried none. */
  warnings: string[];
}

/** Per-call overrides. Each falls back to the client's constructor option. */
export interface RequestOptions {
  /** Aborts the request, and any retry wait, when triggered. */
  signal?: AbortSignal;
  /** Per-attempt timeout in milliseconds. */
  timeoutMs?: number;
  /** Retries after a 429 (not attempts): 2 means up to three requests. */
  maxRetries?: number;
}
