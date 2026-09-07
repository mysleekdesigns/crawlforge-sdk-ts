import {
  AuthenticationError,
  CrawlForgeError,
  InsufficientCreditsError,
  RateLimitError,
  ToolError,
  ValidationError,
  type BlockedInfo,
} from './errors.js';
import type { components } from './generated/schema.js';
import { ToolMethods } from './generated/tools.js';
import type { RequestOptions, ToolResult } from './types.js';
import { VERSION } from './version.js';

export type ToolSuccess = components['schemas']['ToolSuccess'];
export type ErrorResponse = components['schemas']['ErrorResponse'];
/** A tool's self-description, as `GET /tools/<tool>` returns it. */
export type ToolInfo = components['schemas']['ToolInfo'];

/** The subset of `fetch` the client uses; `globalThis.fetch` satisfies it. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface CrawlForgeOptions {
  /** Falls back to the CRAWLFORGE_API_KEY environment variable when one exists. */
  apiKey?: string;
  /** Default `https://www.crawlforge.dev/api/v1`. */
  baseUrl?: string;
  /** Retries after a 429, default 2 (up to three requests). */
  maxRetries?: number;
  /** Per-attempt timeout, default 60000 ms. */
  timeoutMs?: number;
  /** Replaces the global `fetch`; tests inject a fixture server here. */
  fetch?: FetchLike;
}

export const DEFAULT_BASE_URL = 'https://www.crawlforge.dev/api/v1';
export const USER_AGENT = `crawlforge-sdk-ts/${VERSION}`;

const MAX_WAIT_MS = 60_000;

interface RawResponse {
  status: number;
  headers: Headers;
  text: string;
}

function envApiKey(): string | undefined {
  if (typeof process === 'undefined') return undefined;
  return process.env?.CRAWLFORGE_API_KEY;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `Retry-After` as seconds: integer form, or an HTTP date relative to now. Null when absent or unreadable. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  // An HTTP date always names a weekday and a month; without a letter, Date.parse guesses.
  if (!/[a-z]/i.test(trimmed)) return null;
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** 1 s, 2 s, 4 s ... with ±20 % jitter, capped at 60 s. */
function backoffMs(attempt: number): number {
  const base = 1000 * 2 ** attempt;
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.min(base + jitter, MAX_WAIT_MS);
}

function abortReason(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) return signal.reason;
  return typeof DOMException === 'function'
    ? new DOMException('This operation was aborted', 'AbortError')
    : Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal as AbortSignal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class CrawlForge extends ToolMethods {
  readonly baseUrl: string;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  // Private fields: the key never appears on the instance, in JSON.stringify or in console.log.
  readonly #apiKey: string;
  readonly #fetch: FetchLike;

  constructor(options: CrawlForgeOptions = {}) {
    super();
    const apiKey = options.apiKey ?? envApiKey();
    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new CrawlForgeError(
        'Missing API key: pass { apiKey } to new CrawlForge() or set CRAWLFORGE_API_KEY. Keys: https://www.crawlforge.dev/dashboard/keys',
        { status: 0, code: 'MISSING_API_KEY' },
      );
    }
    const fetchImpl =
      options.fetch ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
    if (fetchImpl === undefined) {
      throw new CrawlForgeError('No global fetch in this runtime: pass { fetch } to new CrawlForge().', {
        status: 0,
        code: 'NO_FETCH',
      });
    }
    this.#apiKey = apiKey;
    this.#fetch = fetchImpl;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.maxRetries = options.maxRetries ?? 2;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  /** Runs a tool by name. The generated methods (`scrape`, `fetchUrl`, ...) are typed wrappers around this. */
  async call<T = Record<string, unknown>>(tool: string, params: object, options: RequestOptions = {}): Promise<ToolResult<T>> {
    const res = await this.#request('POST', this.#toolUrl(tool), params, options, true);
    const body = this.#parseJson(res);
    if (res.status >= 200 && res.status < 300) {
      if (isRecord(body) && body.success === true && isRecord(body.data)) {
        const envelope = body as unknown as ToolSuccess;
        return {
          data: envelope.data as T,
          creditsUsed: envelope.credits_used,
          creditsRemaining: envelope.credits_remaining,
          processingTime: envelope.processing_time,
          warnings: Array.isArray(envelope.warnings) ? envelope.warnings : [],
        };
      }
      throw this.#unexpected(res);
    }
    throw this.#mapError(res, body);
  }

  /** The tool's self-description (price, request schema, example). GET, no API key. */
  async describe(tool: string, options: RequestOptions = {}): Promise<ToolInfo> {
    const res = await this.#request('GET', this.#toolUrl(tool), undefined, options, false);
    const body = this.#parseJson(res);
    if (res.status >= 200 && res.status < 300) {
      if (isRecord(body) && typeof body.tool === 'string') return body as unknown as ToolInfo;
      throw this.#unexpected(res);
    }
    throw this.#mapError(res, body);
  }

  #toolUrl(tool: string): string {
    return `${this.baseUrl}/tools/${encodeURIComponent(tool)}`;
  }

  /** One request with the retry loop: only a 429 is retried, waiting Retry-After (capped) or a backoff. */
  async #request(
    method: 'GET' | 'POST',
    url: string,
    body: object | undefined,
    options: RequestOptions,
    withKey: boolean,
  ): Promise<RawResponse> {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': USER_AGENT };
    if (withKey) headers['X-API-Key'] = this.#apiKey;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);

    for (let attempt = 0; ; attempt++) {
      const res = await this.#fetchOnce(url, init, timeoutMs, options.signal);
      if (res.status !== 429 || attempt >= maxRetries) return res;
      const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
      const waitMs = retryAfter === null ? backoffMs(attempt) : Math.min(retryAfter * 1000, MAX_WAIT_MS);
      await sleep(waitMs, options.signal);
    }
  }

  /** One attempt, timed across the body read. A caller's abort is rethrown as is; a timeout or transport failure becomes a CrawlForgeError. */
  async #fetchOnce(url: string, init: RequestInit, timeoutMs: number, signal: AbortSignal | undefined): Promise<RawResponse> {
    if (signal?.aborted) throw abortReason(signal);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort(abortReason(signal as AbortSignal));
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await this.#fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { status: res.status, headers: res.headers, text };
    } catch (err) {
      if (signal?.aborted) throw err;
      if (timedOut) {
        throw new CrawlForgeError(`Request timed out after ${timeoutMs} ms`, { status: 0, code: 'TIMEOUT' });
      }
      const reason = err instanceof Error ? err.message : String(err);
      throw new CrawlForgeError(`Network error: ${reason}`, { status: 0, code: 'NETWORK_ERROR', details: reason });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  /** The parsed body, or undefined when it is not JSON (the caller then reports UNEXPECTED_RESPONSE). */
  #parseJson(res: RawResponse): unknown {
    try {
      return JSON.parse(res.text) as unknown;
    } catch {
      return undefined;
    }
  }

  #requestId(res: RawResponse): string | undefined {
    return res.headers.get('x-request-id') ?? res.headers.get('x-vercel-id') ?? undefined;
  }

  #unexpected(res: RawResponse): CrawlForgeError {
    return new CrawlForgeError(`Unexpected response (HTTP ${res.status})`, {
      status: res.status,
      code: 'UNEXPECTED_RESPONSE',
      details: res.text,
      requestId: this.#requestId(res),
    });
  }

  #mapError(res: RawResponse, body: unknown): CrawlForgeError {
    if (!isRecord(body) || !isRecord(body.error)) return this.#unexpected(res);
    const error = body.error;
    const code = error.code;
    if (typeof code !== 'string') return this.#unexpected(res);
    const message = typeof error.message === 'string' ? error.message : `HTTP ${res.status}`;
    const base = { status: res.status, code, details: error.details, requestId: this.#requestId(res) };
    switch (res.status) {
      case 400:
        return new ValidationError(message, base);
      case 401:
        return new AuthenticationError(message, base);
      case 402:
        return new InsufficientCreditsError(message, {
          ...base,
          autoRechargeTriggered: res.headers.get('x-auto-recharge-triggered') === 'true',
        });
      case 429:
        return new RateLimitError(message, { ...base, retryAfter: parseRetryAfter(res.headers.get('retry-after')) });
      default: {
        const blocked = body.blocked;
        return new ToolError(message, {
          ...base,
          blocked:
            isRecord(blocked) && typeof blocked.vendor === 'string' && typeof blocked.evidence === 'string'
              ? (blocked as unknown as BlockedInfo)
              : null,
          escalated: body.escalated === true,
        });
      }
    }
  }
}
