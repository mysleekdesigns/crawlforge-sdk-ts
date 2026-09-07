/**
 * Typed errors. Subclassed by HTTP status first, then by code (see the
 * `code` field). None of them carries the API key or the request headers:
 * `message`, `details` and `requestId` come from the response alone.
 */

export interface CrawlForgeErrorOptions {
  /** HTTP status of the response; 0 when no response arrived. */
  status: number;
  /** The API's error code (VALIDATION_ERROR, INSUFFICIENT_CREDITS, ...) or a client code (NETWORK_ERROR, TIMEOUT, UNEXPECTED_RESPONSE). */
  code: string;
  /** `error.details` from the response, or the raw body when it was not JSON. */
  details?: unknown;
  /** `x-request-id` or `x-vercel-id` from the response, when present. */
  requestId?: string;
}

export class CrawlForgeError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(message: string, options: CrawlForgeErrorOptions) {
    super(message);
    this.name = 'CrawlForgeError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

/** 400: the body does not match the request schema. `details` is the issue list. */
export class ValidationError extends CrawlForgeError {
  constructor(message: string, options: CrawlForgeErrorOptions) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

/** 401: MISSING_API_KEY or INVALID_API_KEY. */
export class AuthenticationError extends CrawlForgeError {
  constructor(message: string, options: CrawlForgeErrorOptions) {
    super(message, options);
    this.name = 'AuthenticationError';
  }
}

/** 402: INSUFFICIENT_CREDITS or SPEND_CAP_REACHED. Nothing was charged. */
export class InsufficientCreditsError extends CrawlForgeError {
  /** `X-Auto-Recharge-Triggered: true` on the response: a recharge was started, retry once it lands. */
  readonly autoRechargeTriggered: boolean;

  constructor(message: string, options: CrawlForgeErrorOptions & { autoRechargeTriggered: boolean }) {
    super(message, options);
    this.name = 'InsufficientCreditsError';
    this.autoRechargeTriggered = options.autoRechargeTriggered;
  }
}

/**
 * 429: RATE_LIMIT_EXCEEDED (your plan's limit) or HOST_BACKOFF (the target
 * site asked CrawlForge to wait). Thrown only after the retries are spent.
 */
export class RateLimitError extends CrawlForgeError {
  /** Seconds from `Retry-After`; null when the header was absent or unreadable. */
  readonly retryAfter: number | null;

  constructor(message: string, options: CrawlForgeErrorOptions & { retryAfter: number | null }) {
    super(message, options);
    this.name = 'RateLimitError';
    this.retryAfter = options.retryAfter;
  }
}

/** The bot-defence vendor a `scrape` recognised, with the evidence. */
export interface BlockedInfo {
  vendor: string;
  evidence: string;
}

/** Any other error status (403, 404, 413, 422, 5xx, ...). Never retried; never charged. */
export class ToolError extends CrawlForgeError {
  /** Present with code BLOCKED: which bot defence answered. */
  readonly blocked: BlockedInfo | null;
  /** `scrape` with `escalate: true`: the stealth render ran and was blocked too. */
  readonly escalated: boolean;

  constructor(message: string, options: CrawlForgeErrorOptions & { blocked?: BlockedInfo | null; escalated?: boolean }) {
    super(message, options);
    this.name = 'ToolError';
    this.blocked = options.blocked ?? null;
    this.escalated = options.escalated ?? false;
  }
}
