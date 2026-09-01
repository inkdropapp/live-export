import fs from 'fs'
import os from 'os'
import path from 'path'

import type { Note } from 'inkdrop-model'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { extractDocIdFromUri, kebabCaseToPascalCase, LiveExporter, toKebabCase } from '../src'

let outDir: string

beforeEach(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-export-'))
})

afterEach(() => {
  fs.rmSync(outDir, { recursive: true, force: true })
})

const makeNote = (body: string, overrides: Partial<Note> = {}): Note =>
  ({
    _id: 'note:src',
    bookId: 'book:test',
    pathForFile: () => false,
    title: 'Source Note',
    body,
    tags: [],
    ...overrides
  }) as Note

/** A LiveExporter whose HTTP layer is replaced by a fixed document map. */
const makeExporter = (docs: Record<string, any> = {}) => {
  const exporter = new LiveExporter({
    username: 'u',
    password: 'p',
    port: 0
  })
  exporter.callApi = async (apiPath: string) => {
    const docId = apiPath.replace(/^\//, '')
    return docs[docId] ?? { ok: false, error: `no such doc: ${docId}` }
  }
  return exporter
}

test('extractDocIdFromUri pulls the doc id out of an inkdrop:// uri', () => {
  expect(extractDocIdFromUri('inkdrop://file:abc123')).toBe('file:abc123')
  expect(extractDocIdFromUri('https://example.com')).toBeUndefined()
})

test('toKebabCase and kebabCaseToPascalCase round-trip a name', () => {
  expect(toKebabCase('HelloWorldFoo')).toBe('hello-world-foo')
  expect(kebabCaseToPascalCase('hello-world-foo')).toBe('HelloWorldFoo')
})

test('parseNote reads YAML frontmatter', async () => {
  const exporter = makeExporter()
  const { yamlData, yamlNode } = await exporter.parseNote(
    makeNote('---\npublic: true\nslug: hello\n---\n\n# Hi\n'),
    { bookId: 'book:test', pathForFile: () => false, pathForNote: () => false }
  )

  expect(yamlNode?.type).toBe('yaml')
  expect(yamlData).toEqual({ public: true, slug: 'hello' })
})

test('parseNote yields empty frontmatter when the note has none', async () => {
  const exporter = makeExporter()
  const { yamlData, yamlNode } = await exporter.parseNote(makeNote('# No frontmatter here\n'), {
    bookId: 'book:test',
    pathForFile: () => false,
    pathForNote: () => false
  })

  expect(yamlNode).toBeUndefined()
  expect(yamlData).toEqual({})
})

test('exportNote writes the note and rewrites frontmatter mutated in preProcessNote', async () => {
  const exporter = makeExporter()
  const target = path.join(outDir, 'note.md')

  await exporter.exportNote(makeNote('---\nslug: hello\n---\n\n# Body\n'), {
    bookId: 'book:test',
    pathForFile: () => false,
    preProcessNote: ({ note, frontmatter }) => {
      frontmatter.title = note.title
    },
    pathForNote: () => target
  })

  const written = fs.readFileSync(target, 'utf8')
  expect(written).toContain('slug: hello')
  expect(written).toContain('title: Source Note')
  expect(written).toContain('# Body')
})

test('exportNote rewrites an internal note link that starts at offset 0', async () => {
  const exporter = makeExporter({
    'note:dest': makeNote('---\nslug: destination\n---\n', {
      _id: 'note:dest',
      title: 'Destination'
    })
  })
  const target = path.join(outDir, 'note.md')

  await exporter.exportNote(makeNote('[Dest](inkdrop://note/dest)\n'), {
    bookId: 'book:test',
    pathForFile: () => false,
    pathForNote: () => target,
    urlForNote: ({ frontmatter }) => `/posts/${frontmatter.slug}`
  })

  expect(fs.readFileSync(target, 'utf8')).toContain('[Dest](/posts/destination)')
})

test('exportNote writes a referenced image and rewrites its url', async () => {
  const png = Buffer.from('fake-png-bytes')
  const exporter = makeExporter({
    'file:img': {
      _id: 'file:img',
      contentType: 'image/png',
      _attachments: { index: { data: png.toString('base64') } }
    }
  })
  const target = path.join(outDir, 'note.md')

  await exporter.exportNote(makeNote('![thumbnail](inkdrop://file:img)\n'), {
    bookId: 'book:test',
    pathForNote: () => target,
    pathForFile: ({ extension }) => ({
      filePath: path.join(outDir, `thumb${extension}`),
      url: `./thumb${extension}`
    })
  })

  expect(fs.readFileSync(path.join(outDir, 'thumb.png'))).toEqual(png)
  expect(fs.readFileSync(target, 'utf8')).toContain('![thumbnail](./thumb.png)')
})

test('exportNote removes a previously exported note when pathForNote declines it', async () => {
  const exporter = makeExporter()
  const target = path.join(outDir, 'note.md')
  const note = makeNote('# Body\n')

  await exporter.exportNote(note, {
    bookId: 'book:test',
    pathForFile: () => false,
    pathForNote: () => target
  })
  expect(fs.existsSync(target)).toBe(true)

  await exporter.exportNote(note, {
    bookId: 'book:test',
    pathForFile: () => false,
    pathForNote: () => false
  })
  expect(fs.existsSync(target)).toBe(false)
})
