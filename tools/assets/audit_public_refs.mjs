#!/usr/bin/env node
/**
 * PUB-1: report whether each file under client/public/ (except assets/, audio/, maps/)
 * is referenced by a text search of the repo. Conservative: a file is unused only
 * when no searched text could build its path.
 *
 * Usage: node tools/assets/audit_public_refs.mjs [--md docs/public-audit-2026-11-17.md]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PUBLIC = path.join(ROOT, 'client', 'public')
const SKIP_TOP = new Set(['assets', 'audio', 'maps'])
const TEXT_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.txt',
  '.html', '.css', '.tsj', '.tmj', '.yml', '.yaml', '.py',
])

const SEARCH_ROOTS = [
  path.join(ROOT, 'client', 'src'),
  path.join(ROOT, 'client', 'index.html'),
  path.join(ROOT, 'server', 'src'),
  path.join(ROOT, 'tests'),
  path.join(ROOT, 'tools'),
  path.join(ROOT, 'docs'),
  path.join(ROOT, 'art-source'),
]

function viteConfigs() {
  const dir = path.join(ROOT, 'client')
  return fs.readdirSync(dir)
    .filter((n) => n.startsWith('vite.config.'))
    .map((n) => path.join(dir, n))
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  const st = fs.statSync(dir)
  if (st.isFile()) {
    out.push(dir)
    return out
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'test-results' || ent.name === '__screenshots__') continue
    walkFiles(path.join(dir, ent.name), out)
  }
  return out
}

function isExcludedDoc(abs) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/')
  if (rel === 'tools/assets/audit_public_refs.mjs') return true
  if (rel.startsWith('docs/plans/')) return true
  if (/^docs\/public-audit-.*\.md$/.test(rel)) return true
  return false
}

function publicFiles() {
  const out = []
  for (const ent of fs.readdirSync(PUBLIC, { withFileTypes: true })) {
    if (SKIP_TOP.has(ent.name)) continue
    walkFiles(path.join(PUBLIC, ent.name), out)
  }
  return out.sort()
}

function encodeSpaced(name) {
  return name.replace(/ /g, '%20')
}

/** Collect searchable text blobs: { rel, text } */
function corpus() {
  const files = []
  for (const root of [...SEARCH_ROOTS, ...viteConfigs()]) {
    for (const abs of walkFiles(root)) {
      if (isExcludedDoc(abs)) continue
      const ext = path.extname(abs).toLowerCase()
      if (!TEXT_EXT.has(ext)) continue
      const rel = path.relative(ROOT, abs).split(path.sep).join('/')
      if (rel.startsWith('art-source/') && (rel.includes('/frames/') || rel.includes('/render_hi/'))) continue
      let text
      try {
        text = fs.readFileSync(abs, 'utf8')
      } catch {
        continue
      }
      if (text.includes('\0')) continue
      files.push({ rel, text, inClientOrServer: rel.startsWith('client/src/') || rel.startsWith('server/src/') })
    }
  }
  return files
}

function firstHit(blobs, needle) {
  if (!needle) return null
  for (const b of blobs) {
    const i = b.text.indexOf(needle)
    if (i === -1) continue
    const line = b.text.slice(0, i).split('\n').length
    return `${b.rel}:${line}`
  }
  return null
}

function quotedStemHit(blobs, stem) {
  const a = `'${stem}'`
  const bq = `"${stem}"`
  for (const b of blobs) {
    if (!b.inClientOrServer) continue
    const ia = b.text.indexOf(a)
    const ib = b.text.indexOf(bq)
    const i = ia === -1 ? ib : ib === -1 ? ia : Math.min(ia, ib)
    if (i === -1) continue
    const line = b.text.slice(0, i).split('\n').length
    return `${b.rel}:${line} (quoted id '${stem}')`
  }
  return null
}

function classify(abs, blobs) {
  const relPublic = path.relative(PUBLIC, abs).split(path.sep).join('/')
  const base = path.basename(abs)
  const stem = base.replace(/\.[^.]+$/, '')
  const ext = path.extname(abs).toLowerCase()
  const dir = path.posix.dirname(relPublic)
  const size = fs.statSync(abs).size
  const tool = ext === '.aseprite' || ext === '.py' || base === 'README.md' || ext === '.md'

  const needles = [
    relPublic,
    `/${relPublic}`,
    base,
    encodeSpaced(base),
    encodeSpaced(relPublic),
  ]
  if (base.includes(' ')) needles.push(encodeURI(base))

  // Subdirectory prefix that could build children, e.g. images/animatedSword/ or animatedSword/.
  // Do not treat the top-level images/ folder itself as a hit: nearly every path mentions it.
  if (dir && dir !== '.' && dir !== 'images') {
    needles.push(`${dir}/`)
    const leaf = dir.split('/').pop()
    if (leaf && leaf !== 'images') needles.push(`${leaf}/`)
  }

  let hit = null
  for (const n of needles) {
    hit = firstHit(blobs, n)
    if (hit) break
  }

  // Root-level images/<stem>.png loaded via DEFAULT_ITEM_ICON(id) when id is a quoted string.
  if (!hit && dir === 'images' && ext === '.png') {
    hit = quotedStemHit(blobs, stem)
  }

  const action = tool ? 'MOVE (tool)' : hit ? 'KEEP' : 'MOVE'
  return { relPublic, size, referencedBy: hit || 'none', action }
}

function fmtSize(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

function toMarkdown(rows) {
  const lines = [
    '# Public image audit 2026-11-17',
    '',
    'Scope: every file under `client/public/` except `assets/`, `audio/`, and `maps/`.',
    'A file is KEEP when its public path, basename, `%20` form, parent directory prefix, or (for a root `images/<stem>.png`) a quoted `\'<stem>\'` / `"<stem>"` in `client/src` or `server/src` appears in searched text.',
    'Search roots: `client/src`, `client/index.html`, `client/vite.config.*`, `server/src`, `tests/`, `tools/`, `docs/`, text under `art-source/`.',
    'Excluded from search: `docs/public-audit-*.md`, `docs/plans/**`, `tools/assets/audit_public_refs.mjs`, `node_modules/`, `test-results/`, screenshot baselines, and non-text files.',
    'Tool files (`.aseprite`, `.py`, stray README) are MOVE even if a doc mentions them.',
    '',
    '| path | size | referenced-by | action |',
    '|---|---:|---|---|',
  ]
  for (const r of rows) {
    const ref = r.referencedBy.replace(/\|/g, '\\|')
    lines.push(`| \`${r.relPublic}\` | ${fmtSize(r.size)} | ${ref} | ${r.action} |`)
  }
  const move = rows.filter((r) => r.action.startsWith('MOVE'))
  const keep = rows.length - move.length
  const moveBytes = move.reduce((s, r) => s + r.size, 0)
  lines.push('')
  lines.push(`Files: ${rows.length}. KEEP ${keep}. MOVE ${move.length} (${fmtSize(moveBytes)}).`)
  return lines.join('\n') + '\n'
}

const blobs = corpus()
const rows = publicFiles().map((abs) => classify(abs, blobs))
const md = toMarkdown(rows)
const outIdx = process.argv.indexOf('--md')
if (outIdx !== -1 && process.argv[outIdx + 1]) {
  const dest = path.resolve(ROOT, process.argv[outIdx + 1])
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, md)
  console.log(`wrote ${path.relative(ROOT, dest)}`)
} else {
  process.stdout.write(md)
}

const gems = ['images/ruby.png', 'images/sapphire.png', 'images/emerald.png', 'images/bossFightEmptyRoom.png']
for (const g of gems) {
  const row = rows.find((r) => r.relPublic === g)
  if (!row) {
    console.error(`SELF-CHECK MISSING ${g}`)
    process.exitCode = 1
  } else {
    console.error(`SELF-CHECK ${g} -> ${row.action} (${row.referencedBy})`)
  }
}
