// Common English abbreviations that shouldn't trigger a sentence split
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'st',
  'sr',
  'jr',
  'capt',
  'col',
  'gen',
  'lt',
  'rev',
  'etc',
  'vs',
  'eg',
  'ie',
  'no',
  'vol',
]);

/**
 * Checks if a period at index `dotIdx` in `text` is part of an abbreviation.
 */
function isAbbreviation(text, dotIdx) {
  let start = dotIdx - 1;
  while (start >= 0 && /[a-zA-Z]/.test(text[start])) {
    start--;
  }
  const word = text.slice(start + 1, dotIdx).toLowerCase();
  return ABBREVIATIONS.has(word);
}

/**
 * Checks if a period at index `dotIdx` in `text` is part of a decimal number (e.g. 3.14).
 */
function isDecimalNumber(text, dotIdx) {
  const prev = text[dotIdx - 1];
  const next = text[dotIdx + 1];
  return /\d/.test(prev) && /\d/.test(next);
}

/**
 * Splits a full text into clean sentences, preserving proper boundaries
 * and ignoring abbreviations like Mr. and St.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];
  const raw = text.trim();
  if (!raw) return [];

  const sentences = [];
  let currentStart = 0;
  let i = 0;

  while (i < raw.length) {
    const char = raw[i];

    if (char === '.' || char === '!' || char === '?') {
      // Check decimal number
      if (char === '.' && isDecimalNumber(raw, i)) {
        i++;
        continue;
      }

      // Check abbreviation
      if (char === '.' && isAbbreviation(raw, i)) {
        i++;
        continue;
      }

      // If ellipsis ("..." or more dots)
      let isDots = false;
      if (char === '.' && i + 1 < raw.length && raw[i + 1] === '.') {
        isDots = true;
        while (i + 1 < raw.length && raw[i + 1] === '.') {
          i++;
        }
      }

      // Handle repeated punctuation like "!!!" or "?!"
      while (i + 1 < raw.length && /[!?.]/.test(raw[i + 1])) {
        i++;
      }

      // Include closing quote or bracket right after punctuation if present
      while (i + 1 < raw.length && /["'’”)]/.test(raw[i + 1])) {
        i++;
      }

      // Check if followed by whitespace or end of string
      if (i + 1 >= raw.length) {
        // End of string - this is a sentence boundary
        const sentence = raw.slice(currentStart, i + 1).trim();
        if (sentence) {
          sentences.push(sentence);
        }
        currentStart = i + 1;
      } else if (/\s/.test(raw[i + 1])) {
        // If it was an ellipsis, check if next non-space character is uppercase or quote
        let nextCharIdx = i + 1;
        while (nextCharIdx < raw.length && /\s/.test(raw[nextCharIdx])) {
          nextCharIdx++;
        }
        const nextChar = raw[nextCharIdx];
        if (isDots && nextChar && !/[A-Z"“'(]/.test(nextChar)) {
          // Mid-sentence ellipsis trailing off (e.g. "wait... what was that?")
          i++;
          continue;
        }

        const sentence = raw.slice(currentStart, i + 1).trim();
        if (sentence) {
          sentences.push(sentence);
        }
        currentStart = nextCharIdx;
        i = nextCharIdx - 1; // loop increment will advance to nextCharIdx
      }
    }
    i++;
  }

  // Any remaining text that wasn't bounded by terminal punctuation
  if (currentStart < raw.length) {
    const trailing = raw.slice(currentStart).trim();
    if (trailing) {
      sentences.push(trailing);
    }
  }

  return sentences;
}

/**
 * Checks if a string ends with sentence-terminal punctuation (not an abbreviation) followed by whitespace.
 */
function endsWithSentencePunctuationAndSpace(str) {
  const match = /([a-zA-Z0-9]*)([.!?])(["'’”)]*)(\s+)$/.exec(str);
  if (!match) return false;
  const word = match[1].toLowerCase();
  const punct = match[2];
  if (punct === '.' && ABBREVIATIONS.has(word)) {
    return false;
  }
  return true;
}

/**
 * Incremental sentence splitter for streaming LLM tokens.
 */
export class SentenceSplitter {
  /**
   * @param {{ onSentence?: (sentence: string) => void }} options
   */
  constructor({ onSentence } = {}) {
    this.buffer = '';
    this.onSentence = onSentence;
    this.emittedSentences = [];
  }

  /**
   * Feed a new text chunk / token into the splitter.
   * Emits any completed sentences found so far.
   *
   * @param {string} chunk
   * @returns {string[]} Newly emitted sentences
   */
  feed(chunk) {
    if (!chunk || typeof chunk !== 'string') return [];
    this.buffer += chunk;

    const parts = splitSentences(this.buffer);
    if (parts.length === 0) return [];

    const newlyEmitted = [];

    // Check if the current buffer ends with confirmed terminal punctuation + space
    const endsWithTerminal = endsWithSentencePunctuationAndSpace(this.buffer);

    // If buffer ends with terminal + space, all split parts are finished sentences!
    // Otherwise, the last part is still in-progress (growing), so keep it.
    const completeParts = endsWithTerminal ? parts : parts.slice(0, -1);

    for (const part of completeParts) {
      // Don't emit if it ends with an abbreviation
      const lastWordMatch = /([a-zA-Z]+)\.$/.exec(part);
      if (lastWordMatch && ABBREVIATIONS.has(lastWordMatch[1].toLowerCase())) {
        continue;
      }

      newlyEmitted.push(part);
      this.emittedSentences.push(part);
      if (typeof this.onSentence === 'function') {
        this.onSentence(part);
      }
    }

    if (endsWithTerminal) {
      this.buffer = '';
    } else if (completeParts.length > 0) {
      // Keep only what hasn't been emitted yet
      const lastEmitted = completeParts[completeParts.length - 1];
      const emittedIdx = this.buffer.indexOf(lastEmitted);
      if (emittedIdx >= 0) {
        this.buffer = this.buffer.slice(emittedIdx + lastEmitted.length).replace(/^\s+/, '');
      }
    }

    return newlyEmitted;
  }

  /**
   * Flush any remaining text in the buffer as the final sentence.
   *
   * @returns {string|null} The final flushed sentence or null if buffer was empty.
   */
  flush() {
    const remainder = this.buffer.trim();
    this.buffer = '';
    if (!remainder) return null;

    this.emittedSentences.push(remainder);
    if (typeof this.onSentence === 'function') {
      this.onSentence(remainder);
    }
    return remainder;
  }

  /**
   * Get all sentences emitted so far.
   */
  getSentences() {
    return [...this.emittedSentences];
  }
}
