#!/usr/bin/env node
/**
 * Embed lore from a raw .txt file into JSON vectors using local Transformers.js (no Python).
 * Usage (from repo root):
 *   node server/tools/embed_lore.js path\to\newLore.txt
 * Writes to: server/src/rag/lore.json
 */
const fs = require('fs');
const path = require('path');

const { embedTexts } = require('../src/rag/embeddings_local');

function chunkText(text, chunkWords = 600) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkWords) {
    chunks.push(words.slice(i, i + chunkWords).join(' '));
  }
  return chunks.filter(c => c.trim());
}

async function main() {
  const src = process.argv[2];
  if (!src) {
    console.error('Usage: node server/tools/embed_lore.js <lore_text_file>');
    process.exit(1);
  }
  const absSrc = path.resolve(process.cwd(), src);
  if (!fs.existsSync(absSrc)) {
    console.error(`File not found: ${absSrc}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(absSrc, 'utf8');
  const chunks = chunkText(raw, 600);
  console.log(`[embed-js] chunks: ${chunks.length}`);

  const vectors = await embedTexts(chunks);
  if (!vectors || !Array.isArray(vectors) || vectors.length !== chunks.length) {
    console.error('[embed-js] Failed to generate embeddings');
    process.exit(2);
  }

  const out = chunks.map((txt, i) => ({
    id: `chunk_${i}`,
    text: txt,
    embedding: vectors[i].map((x) => Number(x))
  }));

  const outDir = path.resolve(__dirname, '..', 'src', 'rag');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'lore.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 0), 'utf8');
  console.log(`[embed-js] wrote ${outPath}`);
}

main().catch((e) => {
  console.error('[embed-js] Error:', e?.message || e);
  process.exit(3);
});
