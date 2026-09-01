import { setTimeout } from 'timers/promises'

import { beforeAll, describe, expect, test } from 'vitest'

import { LiveExporter, toKebabCase } from '../src'

const username = process.env.INKDROP_USERNAME ?? ''
const password = process.env.INKDROP_PASSWORD ?? ''
const bookId = process.env.INKDROP_BOOK_ID ?? ''
const port = Number(process.env.INKDROP_PORT ?? 19840)
const watchMs = Number(process.env.INKDROP_WATCH_MS ?? 2000)

const credentials = Buffer.from(`${username}:${password}`).toString('base64')

const serverIsUsable =
  Boolean(username && password && bookId) &&
  (await fetch(`http://127.0.0.1:${port}/`, {
    headers: { Authorization: `Basic ${credentials}` }
  })
    .then(res => res.ok)
    .catch(() => false))

describe.skipIf(!serverIsUsable)('Inkdrop local server', () => {
  let liveExport: LiveExporter

  beforeAll(() => {
    liveExport = new LiveExporter({ username, password, port })
  })

  test('Check API reachability', async () => {
    const res = await liveExport.callApi('/')
    expect(typeof res).toBe('object')
    expect(res.ok).toBe(true)
  })

  test('Get latest sequence number', async () => {
    const res = await liveExport.getLatestSeq()
    expect(typeof res).toBe('number')
  })

  test('Get notes with bookId', async () => {
    const res = await liveExport.getNotes(bookId)
    expect(typeof res).toBe('object')
  })

  test(
    'Export notes',
    async () => {
      const sub = await liveExport.start({
        live: true,
        bookId,
        preProcessNote: ({ note, frontmatter, tags }) => {
          frontmatter.title = note.title
          frontmatter.slug = toKebabCase(note.title)
          frontmatter.tags = tags.map(t => t.name)
        },
        pathForNote: ({ /* note, */ frontmatter }) => {
          if (frontmatter.public) {
            return `./tmp/${frontmatter.slug}.md`
          } else return false
        },
        urlForNote: ({ frontmatter }) => {
          if (frontmatter.public) {
            return `/posts/${frontmatter.slug}`
          } else return false
        },
        pathForFile: ({ mdastNode, /* note, file, */ extension, frontmatter }) => {
          if (frontmatter.slug && mdastNode.alt) {
            const fn = `${frontmatter.slug}_${toKebabCase(mdastNode.alt)}${extension}`
            const res = {
              filePath: `./tmp/${fn}`,
              url: `./${fn}`
            }
            if (mdastNode.alt === 'thumbnail') {
              frontmatter.heroImage = res.filePath
            }
            return res
          } else return false
        },
        postProcessNote: ({ md }) => {
          const md2 = md.replace(/\!\[thumbnail\]\(.*\)\n/, '')
          return md2
        }
      })
      expect(typeof sub).toBe('object')
      expect(typeof sub.stop).toBe('function')

      await setTimeout(watchMs)
      sub.stop()
    },
    watchMs + 30000
  )
})
