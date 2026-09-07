import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { CrawlForge, DEFAULT_BASE_URL, TOOLS, USER_AGENT } from '../src/index.js';
import type { ExtractTextRequest, FetchUrlRequest, ScrapeTemplateRequest, SearchWebRequest, ToolResult } from '../src/index.js';
import { fixtureServer } from './fixture-server.js';

const apiKey = 'cf_test_fixture_key_0123456789';

interface Spec {
  paths: Record<string, { post: { 'x-credits': number; 'x-credits-note'?: string; 'x-docs-url': string; requestBody: { content: { 'application/json': { schema: { $ref: string } } } } } }>;
  components: { schemas: Record<string, unknown> };
}
const spec = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as Spec;

/** The method names fixed by the SDK contract shared with the Python SDK. */
const CONTRACT_METHODS: Record<string, string> = {
  fetch_url: 'fetchUrl',
  extract_text: 'extractText',
  extract_links: 'extractLinks',
  extract_metadata: 'extractMetadata',
  scrape_template: 'scrapeTemplate',
  list_ollama_models: 'listOllamaModels',
  get_batch_results: 'getBatchResults',
  read_result: 'readResult',
  scrape: 'scrape',
  scrape_structured: 'scrapeStructured',
  extract_content: 'extractContent',
  map_site: 'mapSite',
  process_document: 'processDocument',
  localization: 'localization',
  extract_embedded_state: 'extractEmbeddedState',
  track_changes: 'trackChanges',
  analyze_content: 'analyzeContent',
  extract_structured: 'extractStructured',
  extract_with_llm: 'extractWithLlm',
  summarize_content: 'summarizeContent',
  crawl_deep: 'crawlDeep',
  stealth_mode: 'stealthMode',
  scrape_with_actions: 'scrapeWithActions',
  batch_scrape: 'batchScrape',
  search_web: 'searchWeb',
  reddit_search: 'redditSearch',
  serp_rank: 'serpRank',
  generate_llms_txt: 'generateLlmsTxt',
  agent: 'agent',
  deep_research: 'deepResearch',
};

describe('TOOLS table', () => {
  it('has exactly one entry per /tools/<tool> path in openapi.json, in path order', () => {
    const paths = Object.keys(spec.paths).map((p) => p.replace(/^\/tools\//, ''));
    expect(paths).toHaveLength(30);
    expect(TOOLS.map((t) => t.name)).toEqual(paths);
  });

  it('takes credits and docs urls from the spec', () => {
    for (const tool of TOOLS) {
      const op = spec.paths[`/tools/${tool.name}`]?.post;
      expect(op, tool.name).toBeDefined();
      expect(tool.credits).toBe(op?.['x-credits']);
      expect(tool.creditsNote).toBe(op?.['x-credits-note'] ?? null);
      expect(tool.docsUrl).toBe(op?.['x-docs-url']);
    }
  });

  it('uses the contract method names, all distinct', () => {
    expect(Object.fromEntries(TOOLS.map((t) => [t.name, t.method]))).toEqual(CONTRACT_METHODS);
    expect(new Set(TOOLS.map((t) => t.method)).size).toBe(TOOLS.length);
  });
});

describe('generated methods', () => {
  it.each(TOOLS.map((t) => [t.method, t.name] as const))('%s() posts to /tools/%s with the standard headers', async (method, name) => {
    const server = fixtureServer(['fetch_url']);
    const client = new CrawlForge({ apiKey, fetch: server.fetch });
    const fn = (client as unknown as Record<string, (params: object) => Promise<ToolResult>>)[method];
    expect(typeof fn).toBe('function');
    const params = { url: 'https://example.com', marker: method };
    const result = await fn?.call(client, params);
    expect(result?.creditsRemaining).toBeTypeOf('number');
    const req = server.requests[0];
    expect(req?.method).toBe('POST');
    expect(req?.url).toBe(`${DEFAULT_BASE_URL}/tools/${name}`);
    expect(req?.headers['x-api-key']).toBe(apiKey);
    expect(req?.headers['content-type']).toBe('application/json');
    expect(req?.headers['user-agent']).toBe(USER_AGENT);
    expect(req?.body).toEqual(params);
  });

  it('are real prototype methods, not instance properties', () => {
    for (const tool of TOOLS) {
      expect(Object.getOwnPropertyNames(CrawlForge.prototype)).not.toContain(tool.method);
      expect(typeof (CrawlForge.prototype as unknown as Record<string, unknown>)[tool.method]).toBe('function');
    }
  });
});

describe('request types', () => {
  it('exist for every <Tool>Request schema and stay usable object types', () => {
    const schemas = Object.keys(spec.components.schemas).filter((n) => n.endsWith('Request'));
    expect(schemas).toHaveLength(30);
    const index = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    for (const name of schemas) expect(index, name).toMatch(new RegExp(`\\b${name},`));

    expectTypeOf<FetchUrlRequest>().toHaveProperty('url');
    expectTypeOf<FetchUrlRequest['url']>().toEqualTypeOf<string>();
    expectTypeOf<FetchUrlRequest['timeout']>().toEqualTypeOf<number | undefined>();
    // anyOf / oneOf / allOf schemas keep their properties instead of collapsing to unknown
    expectTypeOf<ExtractTextRequest>().not.toBeUnknown();
    expectTypeOf<ExtractTextRequest>().toHaveProperty('html');
    expectTypeOf<SearchWebRequest['query']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<SearchWebRequest['queries']>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<ScrapeTemplateRequest['template']>().toEqualTypeOf<string>();
  });
});
