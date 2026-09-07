import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // No Node shims: the client uses only fetch, AbortController and timers.
  platform: 'neutral',
  treeshake: true,
});
