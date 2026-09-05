/**
 * Duplicate detection for rule text. Isomorphic — the same scoring runs
 * on the server (to compute the "possible duplicates" list) and in the
 * browser (to warn while someone is typing).
 */

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","when","while","of","to","in","on",
  "at","for","with","about","into","over","after","before","is","are","was","were",
  "be","been","being","do","does","did","doing","have","has","had","she","he","they",
  "them","her","his","their","it","its","this","that","these","those","i","you","we",
  "us","my","your","our","any","some","every","each","new","take","takes","taking",
  "drink","drinks","drinking","sip","sips","sipped","shot","shots","one","two","up",
  "out","as","by","from","so","than","too","very","just","also","mentions","mention",
  "mentioned","mentioning","talks","talk","talked","talking","says","say","said",
  "brings","bring","brought","anytime","time","times","whenever","says","word","words",
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function contentTokens(text: string): string[] {
  const words = normalize(text).split(" ").filter(Boolean);
  const kept = words.filter((w) => w.length > 2 && !STOPWORDS.has(w)).map(stem);
  // If stripping stopwords empties the phrase, fall back to the raw words so
  // very short rules ("her dog") still compare against each other.
  return kept.length ? kept : words.map(stem);
}

/** Crude suffix stripping — enough to tie "dogs"/"dog", "visiting"/"visit". */
function stem(word: string): string {
  for (const suffix of ["ing", "ies", "es", "ed", "s"]) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      const base = word.slice(0, -suffix.length);
      return suffix === "ies" ? base + "y" : base;
    }
  }
  return word;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function trigrams(text: string): Set<string> {
  const padded = ` ${normalize(text)} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) out.add(padded.slice(i, i + 3));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

/** 0–1. Blends keyword overlap with character-level similarity so both
 *  "her dog" / "the dog" and "travelled"/"traveled" score high. */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const words = jaccard(new Set(contentTokens(a)), new Set(contentTokens(b)));
  const chars = dice(trigrams(a), trigrams(b));
  return Math.max(words, 0.62 * words + 0.38 * chars);
}

export const SIMILAR_THRESHOLD = 0.5;

export type Pair<T> = { a: T; b: T; score: number };

/** Every pair scoring at or above the threshold, strongest first. */
export function similarPairs<T extends { id: string; body: string }>(
  items: T[],
  threshold = SIMILAR_THRESHOLD,
): Pair<T>[] {
  const pairs: Pair<T>[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const score = similarity(items[i].body, items[j].body);
      if (score >= threshold) pairs.push({ a: items[i], b: items[j], score });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}
