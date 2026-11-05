#!/usr/bin/env node
/**
 * Embed lore from a raw .txt file into JSON vectors using local Transformers.js (no Python).
 * Usage (from repo root):
 *   node server/tools/embed_lore.js path\to\newLore.txt
 * Writes to: server/src/rag/lore.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { embedTexts } from '../src/rag/embeddings_local.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Canon entities recognized for metadata tagging
const CANON_NPCS = [
  { name: 'Tharos the Bartender', patterns: [/\btharos\b/i, /\btavernkeeper\b/i, /\bkeeper of the embered flagon\b/i, /\bbartender\b/i] },
  { name: 'Veyrath', patterns: [/\bveyrath\b/i, /\bfirst flame\b/i] },
  { name: 'Aeltharion', patterns: [/\baeltharion\b/i, /\bforge flame\b/i] },
  { name: 'Serenya', patterns: [/\bseren[ya]a?\b/i, /\bhearth flame\b/i] },
  { name: 'Seran Blackforge', patterns: [/\bseran\b/i, /\bblackforge\b/i] },
  { name: 'Lira of the Emberwood', patterns: [/\blira\b/i] },
  { name: 'The Magus Ardent', patterns: [/\bardent\b/i, /\bmagus ardent\b/i] },
  { name: 'Zhyranda', patterns: [/\bzhyranda\b/i, /\bgilded maw\b/i] },
  { name: 'Korvhal', patterns: [/\bkorvhal\b/i, /\bstormfeathered\b/i] },
  { name: 'Myravelle', patterns: [/\bmyravelle\b/i, /\bashen veil\b/i] },
  { name: 'Thurnok', patterns: [/\bthurnok\b/i, /\bironhide\b/i] },
  { name: 'Elarion', patterns: [/\belarion\b/i, /\bdreamflame\b/i] },
  { name: 'Vaelra', patterns: [/\bvaelra\b/i, /\bkindled\b/i] },
  { name: 'Sir Durvak', patterns: [/\bdurvak\b/i, /\bcursed knight\b/i] },
  { name: 'Sister Serra', patterns: [/\bserra\b/i] },
  { name: 'Kaelen', patterns: [/\bkaelen\b/i] },
  { name: 'Grog Ironbreaker', patterns: [/\bgrog\b/i, /\bgoblin warlord\b/i] },
  { name: 'Vareth the Pale', patterns: [/\bvareth\b/i] },
  { name: 'Old Eldon', patterns: [/\beldon\b/i] },
  { name: 'Captain Elena', patterns: [/\belena\b/i] }
];

const CANON_LOCATIONS = [
  { name: 'Cavern of Embers', patterns: [/\bcavern of embers\b/i] },
  { name: 'Brackenford Village', patterns: [/\bbrackenford\b/i] },
  { name: 'The Embered Flagon', patterns: [/\bembered flagon\b/i, /\bsecret cellar\b/i, /\bthe tavern\b/i] },
  { name: 'Emberwood Forest', patterns: [/\bemberwood\b/i] },
  { name: 'The Forgotten Isles', patterns: [/\bforgotten isles\b/i] },
  { name: 'The Ashen Wastes', patterns: [/\bashen wastes\b/i] },
  { name: 'Stonehollow Mountains', patterns: [/\bstonehollow\b/i, /\bstonehold\b/i] },
  { name: 'Sky Pyre', patterns: [/\bsky pyre\b/i] },
  { name: 'Blackspire Mountains', patterns: [/\bblackspire\b/i] },
  { name: 'The Veiled Glades', patterns: [/\bveiled glades\b/i, /\bveilroot\b/i] }
];

function cleanHeading(str) {
  return String(str || '')
    .replace(/^#+\s*/, '')
    .replace(/[\*\_~`]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferTopic(part, heading) {
  const p = `${part} ${heading}`.toLowerCase();
  if (/cosmology|creation/i.test(p)) return 'Cosmology';
  if (/timeline|first age|second age|third age|dawn of flame|age of shadows/i.test(p)) return 'Timeline';
  if (/artifact|sword of aeltharion|relic|weapon/i.test(p)) return 'Artifacts';
  if (/faction|order of the shattered flame|ashen cult|goblin|dwarf|dwarves/i.test(p)) return 'Factions';
  if (/region|brackenford|emberwood|cavern|forgotten isles|ashen wastes/i.test(p)) return 'Regions';
  if (/quest|adventure|side story|deed/i.test(p)) return 'Quests';
  if (/myth|legend|prophecy|omen/i.test(p)) return 'Myths & Prophecies';
  if (/beast|monster|creature|dragon|wyvern|undead/i.test(p)) return 'Bestiary';
  if (/ritual|spell|magic|practice/i.test(p)) return 'Magic & Rituals';
  if (/conflict|war|cataclysm|chronicle|history/i.test(p)) return 'History & Conflicts';
  if (/conclusion|reflection|essence/i.test(p)) return 'Reflections';
  return 'Lore';
}

function extractTags(heading, text, part) {
  const fullContent = `${heading}\n${text}`;
  const matchedNpcs = [];
  for (const npc of CANON_NPCS) {
    if (npc.patterns.some(pat => pat.test(fullContent))) {
      matchedNpcs.push(npc.name);
    }
  }

  let matchedLocation = null;
  for (const loc of CANON_LOCATIONS) {
    if (loc.patterns.some(pat => pat.test(fullContent))) {
      matchedLocation = loc.name;
      break;
    }
  }

  const topic = inferTopic(part, heading);

  const tags = {};
  if (matchedNpcs.length > 0) tags.npcs = matchedNpcs;
  if (matchedLocation) tags.location = matchedLocation;
  if (topic) tags.topic = topic;
  return tags;
}

/**
 * Re-chunk text by heading (~150 words per chunk, 30-word overlap for long sections)
 * and generate tags {id, heading, text, npcs?, location?, topic?}
 */
function chunkLoreByHeading(text, targetWords = 150, overlapWords = 30, maxAccum = 175) {
  const lines = String(text || '').split(/\r?\n/);
  let currentPart = '';
  let currentHeading = '';
  let currentLines = [];
  const blocks = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);
    const h4Match = line.match(/^####\s+(.+)$/);

    if (h2Match || h3Match || h4Match) {
      const blockText = currentLines.join('\n').trim();
      const words = blockText.split(/\s+/).filter(Boolean);
      if (blockText && words.length >= 10 && currentHeading) {
        blocks.push({
          part: currentPart || 'Cosmology & Creation Myths',
          heading: currentHeading,
          text: blockText,
          words
        });
      }
      currentLines = [];
      if (h2Match) {
        currentPart = cleanHeading(h2Match[1]);
        currentHeading = currentPart;
      } else if (h3Match) {
        const h3 = cleanHeading(h3Match[1]);
        currentHeading = currentPart ? `${currentPart} - ${h3}` : h3;
      } else if (h4Match) {
        const h4 = cleanHeading(h4Match[1]);
        currentHeading = currentPart ? `${currentPart} - ${h4}` : h4;
      }
    } else {
      currentLines.push(line);
    }
  }
  const blockText = currentLines.join('\n').trim();
  const words = blockText.split(/\s+/).filter(Boolean);
  if (blockText && words.length >= 10 && currentHeading) {
    blocks.push({
      part: currentPart || 'Reflections',
      heading: currentHeading,
      text: blockText,
      words
    });
  }

  const chunks = [];
  let pending = null;

  function flushPending() {
    if (!pending) return;
    const tags = extractTags(pending.heading, pending.text, pending.part);
    chunks.push({
      id: `chunk_${chunks.length}`,
      heading: pending.heading,
      text: pending.text,
      ...tags
    });
    pending = null;
  }

  for (const block of blocks) {
    if (block.words.length > maxAccum) {
      flushPending();
      // Split large sections with 30-word overlap
      let start = 0;
      let partIdx = 1;
      while (start < block.words.length) {
        const end = Math.min(start + targetWords, block.words.length);
        const chunkWords = block.words.slice(start, end);
        const textSlice = chunkWords.join(' ');
        const headingSlice = `${block.heading} (Part ${partIdx++})`;
        const tags = extractTags(headingSlice, textSlice, block.part);
        chunks.push({
          id: `chunk_${chunks.length}`,
          heading: headingSlice,
          text: textSlice,
          ...tags
        });
        if (end >= block.words.length) break;
        start += (targetWords - overlapWords);
      }
    } else {
      if (!pending) {
        pending = {
          heading: block.heading,
          part: block.part,
          text: block.text,
          words: [...block.words]
        };
      } else {
        const combinedLen = pending.words.length + block.words.length;
        if (combinedLen <= maxAccum && pending.part === block.part) {
          pending.text += `\n\n${block.text}`;
          pending.words.push(...block.words);
          const blockSuffix = block.heading.split(' - ').slice(-1)[0];
          if (!pending.heading.includes(blockSuffix)) {
            pending.heading += ` / ${blockSuffix}`;
          }
        } else {
          flushPending();
          pending = {
            heading: block.heading,
            part: block.part,
            text: block.text,
            words: [...block.words]
          };
        }
      }
    }
  }
  flushPending();

  return chunks;
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
  const chunks = chunkLoreByHeading(raw, 150, 30, 175);
  console.log(`[embed-js] chunks: ${chunks.length}`);

  const textsToEmbed = chunks.map((c) => c.text);
  const vectors = await embedTexts(textsToEmbed);
  if (!vectors || !Array.isArray(vectors) || vectors.length !== chunks.length) {
    console.error('[embed-js] Failed to generate embeddings');
    process.exit(2);
  }

  const out = chunks.map((chunk, i) => ({
    id: chunk.id,
    heading: chunk.heading,
    text: chunk.text,
    ...(chunk.npcs ? { npcs: chunk.npcs } : {}),
    ...(chunk.location ? { location: chunk.location } : {}),
    ...(chunk.topic ? { topic: chunk.topic } : {}),
    embedding: vectors[i].map((x) => Number(x))
  }));

  const outDir = path.resolve(__dirname, '..', 'src', 'rag');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'lore.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`[embed-js] wrote ${outPath} (${out.length} chunks)`);
}

main().catch((e) => {
  console.error('[embed-js] Error:', e?.message || e);
  process.exit(3);
});

export { chunkLoreByHeading, extractTags, cleanHeading };
