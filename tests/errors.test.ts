import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthenticationError,
  CrawlForge,
  CrawlForgeError,
  InsufficientCreditsError,
  RateLimitError,
  ToolError,
  ValidationError,
} from '../src/index.js';
import { fixtureServer, loadFixture } from './fixture-server.js';

const apiKey = 'cf_test_fixture_key_0123456789';

async function failWith(fixtureName: string, options: { maxRetries?: number } = {}): Promise<{ error: CrawlForgeError; requests: number }> {
  const server = fixtureServer([fixtureName]);
  const client = new CrawlForge({ apiKey, fetch: server.fetch, maxRetries: options.maxRetries ?? 0 });
  const fixture = loadFixture(fixtureName);
  try {
    await client.call('fetch_url', fixture.request as object);
  } catch (err) {
    expect(err).toBeInstanceOf(CrawlForgeError);
    return { error: err as CrawlForgeError, requests: server.requests.length };
  }
  throw new Error(`${fixtureName} did not throw`);
}

describe('error classes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('400 -> ValidationError with the issue list and the request id', async () => {
    const { error } = await failWith('error-400-validation');
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.name).toBe('ValidationError');
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid input parameters');
    expect(error.details).toMatchObject([{ path: ['url'] }, { path: ['timeout'] }]);
    expect(error.requestId).toBe('iad1::abc12-1757246400000-0123456789ab');
  });

  it('401 -> AuthenticationError', async () => {
    const { error } = await failWith('error-401-invalid-key');
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.status).toBe(401);
    expect(error.code).toBe('INVALID_API_KEY');
    expect(error.requestId).toBeUndefined();
  });

  it('402 -> InsufficientCreditsError reading X-Auto-Recharge-Triggered', async () => {
    const { error } = await failWith('error-402-insufficient-credits');
    expect(error).toBeInstanceOf(InsufficientCreditsError);
    expect(error.status).toBe(402);
    expect(error.code).toBe('INSUFFICIENT_CREDITS');
    expect((error as InsufficientCreditsError).autoRechargeTriggered).toBe(true);
    expect(error.details).toMatchObject({ required: 1, tool: 'fetch_url' });
  });

  it('402 without the header -> autoRechargeTriggered false', async () => {
    const fixture = loadFixture('error-402-insufficient-credits');
    const server = fixtureServer([{ response: { ...fixture.response, headers: { 'content-type': 'application/json' } } }]);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    await expect(client.fetchUrl({ url: 'https://example.com' })).rejects.toMatchObject({ autoRechargeTriggered: false });
  });

  it('429 -> RateLimitError with retryAfter in seconds once retries are spent', async () => {
    const { error, requests } = await failWith('error-429-retry-after-seconds');
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.status).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect((error as RateLimitError).retryAfter).toBe(2);
    expect(error.details).toEqual({ plan: 'free', limit: 1 });
    expect(requests).toBe(1);
  });

  it('429 with an HTTP-date Retry-After -> retryAfter relative to now', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
    const { error } = await failWith('error-429-retry-after-date');
    expect((error as RateLimitError).retryAfter).toBe(3);
  });

  it('429 without Retry-After -> retryAfter null (HOST_BACKOFF)', async () => {
    const { error } = await failWith('error-429-no-header');
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.code).toBe('HOST_BACKOFF');
    expect((error as RateLimitError).retryAfter).toBeNull();
  });

  it('502 BLOCKED -> ToolError with blocked and escalated, not retried', async () => {
    const { error, requests } = await failWith('error-502-blocked', { maxRetries: 3 });
    expect(error).toBeInstanceOf(ToolError);
    expect(error.status).toBe(502);
    expect(error.code).toBe('BLOCKED');
    expect((error as ToolError).blocked).toEqual({ vendor: 'cloudflare', evidence: 'a Cloudflare challenge script' });
    expect((error as ToolError).escalated).toBe(true);
    expect(requests).toBe(1);
  });

  it('500 -> ToolError with blocked null and escalated false, not retried', async () => {
    const { error, requests } = await failWith('error-500-tool-error', { maxRetries: 3 });
    expect(error).toBeInstanceOf(ToolError);
    expect(error.status).toBe(500);
    expect(error.code).toBe('TOOL_ERROR');
    expect((error as ToolError).blocked).toBeNull();
    expect((error as ToolError).escalated).toBe(false);
    expect(requests).toBe(1);
  });

  it('non-JSON 502 -> CrawlForgeError UNEXPECTED_RESPONSE with the raw body in details', async () => {
    const { error } = await failWith('error-502-html');
    expect(error.constructor).toBe(CrawlForgeError);
    expect(error.code).toBe('UNEXPECTED_RESPONSE');
    expect(error.status).toBe(502);
    expect(error.details).toContain('<title>502 Bad Gateway</title>');
  });

  it('network failure -> CrawlForgeError NETWORK_ERROR with status 0', async () => {
    const { error } = await failWith('error-network');
    expect(error.constructor).toBe(CrawlForgeError);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.status).toBe(0);
    expect(error.message).toContain('fetch failed');
    expect(error.details).toBe('fetch failed');
  });

  it.each([
    'error-400-validation',
    'error-401-invalid-key',
    'error-402-insufficient-credits',
    'error-429-retry-after-seconds',
    'error-502-blocked',
    'error-502-html',
    'error-network',
  ])('%s never carries the API key', async (name) => {
    const { error } = await failWith(name);
    expect(error.message).not.toContain(apiKey);
    expect(String(error)).not.toContain(apiKey);
    expect(JSON.stringify(error)).not.toContain(apiKey);
    expect(JSON.stringify(error.details ?? null)).not.toContain(apiKey);
    expect(error instanceof Error).toBe(true);
  });
});
