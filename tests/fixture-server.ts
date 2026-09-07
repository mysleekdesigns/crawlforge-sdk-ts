/**
 * A fetch-compatible function backed by tests/fixtures/<name>.json. It records
 * every request it receives and answers from a queue, so a test can script
 * "429 then 200" by listing two fixtures. No sockets, no network.
 */
import { readFileSync } from 'node:fs';
import type { FetchLike } from '../src/index.js';

export interface FixtureResponse {
  status?: number;
  headers?: Record<string, string>;
  /** JSON body; serialised with JSON.stringify. */
  body?: unknown;
  /** Raw body, for non-JSON responses. Wins over `body`. */
  text?: string;
  /** Reject the fetch with a TypeError carrying this message. */
  networkError?: string;
  /** Never answer; reject only when the request's signal aborts. */
  hang?: boolean;
}

export interface Fixture {
  request?: unknown;
  response: FixtureResponse;
}

export interface RecordedRequest {
  url: string;
  method: string;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  /** The JSON-parsed body, or undefined for a bodiless request. */
  body: unknown;
}

export function loadFixture(name: string): Fixture {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as Fixture;
}

export interface FixtureServer {
  fetch: FetchLike;
  requests: RecordedRequest[];
}

export function fixtureServer(script: Array<Fixture | string>): FixtureServer {
  const queue = script.map((entry) => (typeof entry === 'string' ? loadFixture(entry) : entry));
  const requests: RecordedRequest[] = [];

  const fetch: FetchLike = async (url, init) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, name) => {
      headers[name] = value;
    });
    requests.push({
      url,
      method: init.method ?? 'GET',
      headers,
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    });

    const next = queue.shift();
    if (next === undefined) {
      throw new Error(`fixture server: nothing scripted for request #${requests.length} ${init.method} ${url}`);
    }
    const res = next.response;
    if (res.networkError !== undefined) throw new TypeError(res.networkError);
    if (res.hang) {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init.signal;
        if (!signal) return;
        if (signal.aborted) reject(signal.reason);
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    const text = res.text ?? JSON.stringify(res.body);
    return new Response(text, { status: res.status ?? 200, headers: res.headers ?? {} });
  };

  return { fetch, requests };
}
