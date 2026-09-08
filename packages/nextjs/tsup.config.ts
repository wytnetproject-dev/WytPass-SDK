import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  treeshake: true,
  external: ['next', 'next/headers', 'next/server', 'react', 'react-dom', '@wytpass/core'],
  target: 'es2022'
});
