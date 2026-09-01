/**
 * Loads the built artifacts and exercises the markdown/YAML pipeline through
 * them. `tsdown` exits 0 even when the emitted bundle cannot actually run — the
 * ESM-only `unified`/`remark` deps have broken the CJS artifact before — so the
 * build is not verified until both entry points have parsed a real note.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const note = {
  _id: 'note:smoke',
  title: 'Smoke',
  body: '---\nslug: smoke\n---\n\n# Body\n',
  tags: []
}

const entries = [
  ['ESM', await import('../lib/index.js')],
  ['CJS', require('../lib/index.cjs')]
]

for (const [label, mod] of entries) {
  const { LiveExporter, extractDocIdFromUri, toKebabCase } = mod
  assert.equal(typeof LiveExporter, 'function', `${label}: LiveExporter missing`)

  const exporter = new LiveExporter({ username: 'u', password: 'p', port: 0 })

  const parsed = await exporter.parseNote(note, {})
  assert.deepEqual(parsed.yamlData, { slug: 'smoke' }, `${label}: frontmatter did not round-trip`)

  // A note without frontmatter must not throw (js-yaml >= 5 rejects empty input).
  const bare = await exporter.parseNote({ ...note, body: '# No frontmatter\n' }, {})
  assert.deepEqual(bare.yamlData, {}, `${label}: bare note should yield {}`)

  assert.equal(toKebabCase('HelloWorld'), 'hello-world', `${label}: toKebabCase`)
  assert.equal(
    extractDocIdFromUri('inkdrop://file:abc'),
    'file:abc',
    `${label}: extractDocIdFromUri`
  )

  console.log(`${label} artifact OK`)
}
