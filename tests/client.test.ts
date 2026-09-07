import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrawlForge, CrawlForgeError, DEFAULT_BASE_URL, USER_AGENT } from '../src/index.js';
import { fixtureServer, loadFixture } from './fixture-server.js';

const apiKey = 'cf_test_fixture_key_0123456789';

describe('constructor', () => {
  const env = process.env.CRAWLFORGE_API_KEY;
  afterEach(() => {
    if (env === undefined) delete process.env.CRAWLFORGE_API_KEY;
    else process.env.CRAWLFORGE_API_KEY = env;
  });

  it('throws synchronously when no key is given and the env var is unset', () => {
    delete process.env.CRAWLFORGE_API_KEY;
    expect(() => new CrawlForge({ fetch: fixtureServer([]).fetch })).toThrowError(CrawlForgeError);
    try {
      new CrawlForge({ fetch: fixtureServer([]).fetch });
    } catch (err) {
      expect(err).toBeInstanceOf(CrawlForgeError);
      expect((err as CrawlForgeError).code).toBe('MISSING_API_KEY');
      expect((err as CrawlForgeError).message).toContain('https://www.crawlforge.dev/dashboard/keys');
    }
  });

  it('treats an empty key as missing', () => {
    expect(() => new CrawlForge({ apiKey: '   ', fetch: fixtureServer([]).fetch })).toThrowError(CrawlForgeError);
  });

  it('falls back to CRAWLFORGE_API_KEY', async () => {
    process.env.CRAWLFORGE_API_KEY = apiKey;
    const server = fixtureServer(['fetch_url']);
    const client = new CrawlForge({ fetch: server.fetch });
    await client.fetchUrl({ url: 'https://example.com' });
    expect(server.requests[0]?.headers['x-api-key']).toBe(apiKey);
  });

  it('never exposes the key on the instance', () => {
    const client = new CrawlForge({ apiKey, fetch: fixtureServer([]).fetch });
    expect(JSON.stringify(client)).not.toContain(apiKey);
    expect(Object.keys(client)).not.toContain('apiKey');
    expect(Object.values(client)).not.toContain(apiKey);
  });

  it('applies defaults and strips a trailing slash from baseUrl', () => {
    const client = new CrawlForge({ apiKey, fetch: fixtureServer([]).fetch });
    expect(client.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(client.maxRetries).toBe(2);
    expect(client.timeoutMs).toBe(60_000);
    const custom = new CrawlForge({ apiKey, baseUrl: 'http://localhost:3000/api/v1/', fetch: fixtureServer([]).fetch });
    expect(custom.baseUrl).toBe('http://localhost:3000/api/v1');
  });
});

describe('call', () => {
  it('sends POST /tools/<tool> with the key, JSON content type, Accept and the SDK User-Agent', async () => {
    const server = fixtureServer(['fetch_url']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const params = loadFixture('fetch_url').request as { url: string };
    await client.fetchUrl(params);
    const req = server.requests[0];
    expect(req?.url).toBe(`${DEFAULT_BASE_URL}/tools/fetch_url`);
    expect(req?.method).toBe('POST');
    expect(req?.headers['x-api-key']).toBe(apiKey);
    expect(req?.headers['content-type']).toBe('application/json');
    expect(req?.headers['accept']).toBe('application/json');
    expect(req?.headers['user-agent']).toBe(USER_AGENT);
    expect(req?.body).toEqual(params);
  });

  it.each(['fetch_url', 'scrape', 'search_web', 'extract_text', 'batch_scrape', 'read_result', 'extract_links', 'map_site'])(
    'maps the %s envelope to a ToolResult',
    async (name) => {
      const fixture = loadFixture(name);
      const body = fixture.response.body as {
        data: Record<string, unknown>;
        credits_used: number;
        credits_remaining: number;
        processing_time: number;
        warnings?: string[];
      };
      const server = fixtureServer([fixture]);
      const client = new CrawlForge({ apiKey, fetch: server.fetch });
      const result = await client.call(name, fixture.request as object);
      expect(result.data).toEqual(body.data);
      expect(result.creditsUsed).toBe(body.credits_used);
      expect(result.creditsRemaining).toBe(body.credits_remaining);
      expect(result.processingTime).toBe(body.processing_time);
      expect(result.warnings).toEqual(body.warnings ?? []);
    },
  );

  it('keeps warnings when the envelope carries them', async () => {
    const fixture = loadFixture('fetch_url');
    const body = { ...(fixture.response.body as object), warnings: ['robots.txt override recorded'] };
    const server = fixtureServer([{ response: { ...fixture.response, body } }]);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const result = await client.fetchUrl({ url: 'https://example.com' });
    expect(result.warnings).toEqual(['robots.txt override recorded']);
  });

  it('types data through the generic parameter of call()', async () => {
    const server = fixtureServer(['fetch_url']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const result = await client.call<{ status: number }>('fetch_url', { url: 'https://example.com' });
    expect(result.data.status).toBe(200);
  });

  it('reports UNEXPECTED_RESPONSE for a 200 that is not the success envelope', async () => {
    const server = fixtureServer([{ response: { status: 200, body: { hello: 'world' } } }]);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    await expect(client.fetchUrl({ url: 'https://example.com' })).rejects.toMatchObject({
      code: 'UNEXPECTED_RESPONSE',
      status: 200,
    });
  });

  it('reports UNEXPECTED_RESPONSE for an error status without an error envelope', async () => {
    const server = fixtureServer([{ response: { status: 404, body: { message: 'not found' } } }]);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    await expect(client.call('no_such_tool', {})).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE', status: 404 });
  });
});

describe('describe', () => {
  it('uses GET /tools/<tool> with no API key and returns the ToolInfo', async () => {
    const info = { tool: 'fetch_url', description: 'Fetch', credits_cost: 1, parameters: { type: 'object' }, example: { url: 'https://example.com' } };
    const server = fixtureServer([{ response: { status: 200, body: info } }]);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const result = await client.describe('fetch_url');
    expect(result).toEqual(info);
    const req = server.requests[0];
    expect(req?.method).toBe('GET');
    expect(req?.url).toBe(`${DEFAULT_BASE_URL}/tools/fetch_url`);
    expect(req?.headers['x-api-key']).toBeUndefined();
    expect(req?.headers['content-type']).toBeUndefined();
    expect(req?.headers['accept']).toBe('application/json');
    expect(req?.headers['user-agent']).toBe(USER_AGENT);
    expect(req?.body).toBeUndefined();
  });
});

describe('abort and timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with the abort reason when the signal fires mid-request', async () => {
    const server = fixtureServer(['hang']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const controller = new AbortController();
    const pending = client.fetchUrl({ url: 'https://example.com' }, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(server.requests).toHaveLength(1);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const server = fixtureServer(['fetch_url']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const controller = new AbortController();
    controller.abort();
    await expect(client.fetchUrl({ url: 'https://example.com' }, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(server.requests).toHaveLength(0);
  });

  it('throws TIMEOUT when timeoutMs elapses', async () => {
    vi.useFakeTimers();
    const server = fixtureServer(['hang']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch, timeoutMs: 50 });
    const pending = client.fetchUrl({ url: 'https://example.com' });
    const settled = pending.catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(50);
    const err = await settled;
    expect(err).toBeInstanceOf(CrawlForgeError);
    expect(err).toMatchObject({ code: 'TIMEOUT', status: 0 });
  });
});
