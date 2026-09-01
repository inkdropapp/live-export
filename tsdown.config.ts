import { defineConfig } from 'tsdown'

/**
 * unified and the remark/unist packages are pure ESM: they set `"type":
 * "module"` and expose no `require` export condition, so a CJS consumer cannot
 * `require()` them at all. Bundle them into the CJS artifact instead of leaving
 * them external, otherwise `require('@inkdropapp/live-export')` throws.
 * The ESM artifact imports them normally.
 */
const esmOnlyDeps = [
  'unified',
  'remark-parse',
  'remark-frontmatter',
  'remark-stringify',
  'unist-util-visit'
]

const shared = {
  entry: './src/index.ts',
  outDir: 'lib',
  platform: 'node' as const,
  dts: true,
  sourcemap: true,
  // Keep `lib/index.js` (ESM) + `lib/index.cjs` (CJS) as package.json declares;
  // tsdown would otherwise emit `.mjs` on the node platform.
  fixedExtension: false,
  hash: false
}

export default defineConfig([
  { ...shared, format: ['es'], clean: true },
  { ...shared, format: ['cjs'], clean: false, noExternal: esmOnlyDeps }
])
