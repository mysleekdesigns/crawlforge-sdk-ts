import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = new URL('../src/', import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('src/ is edge-safe', () => {
  const files = walk(srcDir);

  it('imports no Node built-ins and uses no require()', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/from ['"]node:/);
      expect(text, file).not.toMatch(/import\(['"]node:/);
      expect(text, file).not.toMatch(/\brequire\(/);
    }
  });

  it('reads process.env only behind a typeof guard', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (!/\bprocess\.env\b|typeof process\b/.test(text)) continue;
      expect(file).toMatch(/client\.ts$/);
      expect(text).toContain("if (typeof process === 'undefined') return undefined;");
      expect(text.match(/process\.env/g)).toHaveLength(1);
    }
  });
});
