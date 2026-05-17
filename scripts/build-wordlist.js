#!/usr/bin/env node
/**
 * Builds the SEED_WORDS array for Blurt It!
 *
 * Strategy:
 *   - ENABLE wordlist  → validity filter (is it a real English word?)
 *   - Google 10k list  → frequency filter (is it an everyday word?)
 *   - Length filter     → 4–9 letters only (game constraint)
 *
 * Usage:
 *   node scripts/build-wordlist.js
 *
 * The script prints the SEED_WORDS const to stdout.
 * Redirect it to a file or copy-paste into index.html:
 *   node scripts/build-wordlist.js > wordlist-output.txt
 */

const https = require('https');

const ENABLE_URL =
  'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt';

// Google 10k most common English words, swear-free, frequency-ordered
const FREQ_URL =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt';

const MIN_LEN = 4;
const MAX_LEN = 9;

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function toWords(raw) {
  return raw
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0 && /^[a-z]+$/.test(w));
}

async function main() {
  process.stderr.write('Fetching ENABLE wordlist…\n');
  const enableWords = toWords(await get(ENABLE_URL));
  const enableSet = new Set(enableWords);
  process.stderr.write(`  ${enableSet.size.toLocaleString()} words loaded\n`);

  process.stderr.write('Fetching Google 10k frequency list…\n');
  const freqWords = toWords(await get(FREQ_URL));
  process.stderr.write(`  ${freqWords.length.toLocaleString()} words loaded\n`);

  // Keep words that pass all three filters.
  // freqWords is already frequency-ordered; preserve that order so the
  // most common words appear first (useful if you want to slice later).
  const filtered = freqWords.filter(
    w => w.length >= MIN_LEN && w.length <= MAX_LEN && enableSet.has(w)
  );

  process.stderr.write(`\nResult: ${filtered.length} everyday words (${MIN_LEN}–${MAX_LEN} letters)\n`);
  process.stderr.write('Breakdown by length:\n');
  for (let len = MIN_LEN; len <= MAX_LEN; len++) {
    const count = filtered.filter(w => w.length === len).length;
    process.stderr.write(`  ${len} letters: ${count}\n`);
  }

  // Format as a JS const — 10 words per line, sorted alphabetically within
  // each length group so diffs are readable when the list changes.
  const sorted = [...filtered].sort((a, b) => a.length - b.length || a.localeCompare(b));

  const lines = [];
  for (let i = 0; i < sorted.length; i += 10) {
    lines.push('  ' + sorted.slice(i, i + 10).map(w => `"${w}"`).join(','));
  }

  process.stdout.write('const SEED_WORDS = [\n');
  process.stdout.write(lines.join(',\n') + '\n');
  process.stdout.write('];\n');
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
