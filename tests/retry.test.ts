import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlForge, RateLimitError, parseRetryAfter } from '../src/index.js';
import { fixtureServer } from './fixture-server.js';

const apiKey = 'cf_test_fixture_key_0123456789';
const params = { url: 'https://example.com' };

describe('retries on 429', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waits exactly Retry-After seconds, then succeeds', async () => {
    const server = fixtureServer(['error-429-retry-after-seconds', 'fetch_url']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const pending = client.fetchUrl(params);
    await vi.advanceTimersByTimeAsync(1999);
    expect(server.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.requests).toHaveLength(2);
    const result = await pending;
    expect(result.creditsUsed).toBe(1);
  });

  it('honours an HTTP-date Retry-After', async () => {
    const server = fixtureServer(['error-429-retry-after-date', 'fetch_url']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const pending = client.fetchUrl(params);
    await vi.advanceTimersByTimeAsync(2999);
    expect(server.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.requests).toHaveLength(2);
    await expect(pending).resolves.toMatchObject({ creditsUsed: 1 });
  });

  it('caps a long Retry-After at 60 s', async () => {
    const server = fixtureServer([
      { response: { status: 429, headers: { 'retry-after': '600' }, body: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'slow down' } } } },
      'fetch_url',
    ]);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const pending = client.fetchUrl(params);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(server.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.requests).toHaveLength(2);
    await expect(pending).resolves.toBeDefined();
  });

  it('backs off 1 s, 2 s without Retry-After (jitter pinned to 0)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const server = fixtureServer(['error-429-no-header', 'error-429-no-header', 'fetch_url']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const pending = client.fetchUrl(params);
    await vi.advanceTimersByTimeAsync(999);
    expect(server.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(server.requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.requests).toHaveLength(3);
    await expect(pending).resolves.toBeDefined();
  });

  it('jitter stays within ±20 % of the base delay', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1); // +20 %
    const server = fixtureServer(['error-429-no-header', 'fetch_url']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const pending = client.fetchUrl(params);
    await vi.advanceTimersByTimeAsync(1199);
    expect(server.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.requests).toHaveLength(2);
    await expect(pending).resolves.toBeDefined();
  });

  it('gives up after maxRetries retries and throws RateLimitError', async () => {
    const server = fixtureServer(['error-429-retry-after-seconds', 'error-429-retry-after-seconds', 'error-429-retry-after-seconds']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch, maxRetries: 2 });
    const pending = client.fetchUrl(params);
    const settled = pending.catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(4000);
    const err = await settled;
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBe(2);
    expect(server.requests).toHaveLength(3);
  });

  it('per-call maxRetries overrides the constructor', async () => {
    const server = fixtureServer(['error-429-retry-after-seconds', 'error-429-retry-after-seconds']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch, maxRetries: 5 });
    const pending = client.fetchUrl(params, { maxRetries: 0 });
    await expect(pending).rejects.toBeInstanceOf(RateLimitError);
    expect(server.requests).toHaveLength(1);
  });

  it('aborting during the wait rejects with the abort reason and sends nothing more', async () => {
    const server = fixtureServer(['error-429-retry-after-seconds', 'fetch_url']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const controller = new AbortController();
    const pending = client.fetchUrl(params, { signal: controller.signal });
    const settled = pending.catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    const err = await settled;
    expect(err).toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(server.requests).toHaveLength(1);
  });

  it('retries describe() too, without a key', async () => {
    const info = { tool: 'scrape', description: 'x', credits_cost: 2, parameters: {}, example: {} };
    const server = fixtureServer(['error-429-retry-after-seconds', { response: { status: 200, body: info } }]);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const pending = client.describe('scrape');
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toEqual(info);
    expect(server.requests.map((r) => r.headers['x-api-key'])).toEqual([undefined, undefined]);
  });
});

describe('parseRetryAfter', () => {
  it('reads integer seconds, HTTP dates and rejects garbage', () => {
    const now = Date.parse('2026-09-07T12:00:00Z');
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter('60', now)).toBe(60);
    expect(parseRetryAfter(' 5 ', now)).toBe(5);
    expect(parseRetryAfter('Mon, 07 Sep 2026 12:00:03 GMT', now)).toBe(3);
    expect(parseRetryAfter('Mon, 07 Sep 2026 11:00:00 GMT', now)).toBe(0);
    expect(parseRetryAfter('soon', now)).toBeNull();
    expect(parseRetryAfter('-1', now)).toBeNull();
    expect(parseRetryAfter('1757246403000', now)).toBe(1757246403000);
  });
});
