import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { USER_AGENT, VERSION } from '../src/index.js';

describe('version', () => {
  it('matches package.json and the User-Agent', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string; dependencies?: unknown };
    expect(VERSION).toBe(pkg.version);
    expect(USER_AGENT).toBe(`crawlforge-sdk-ts/${pkg.version}`);
    expect(pkg.dependencies).toBeUndefined();
  });
});
