// Packs a subset of notes (every minor third) from MIDI.js soundfont files into samples/<id>.js.
// Source files: https://gleitz.github.io/midi-js-soundfonts/MusyngKite/<instrument>-mp3.js
// Usage: node tools/pack-samples.mjs <folder with downloaded *-mp3.js or *.js files>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const INSTRUMENTS = {
  grand:    ['acoustic_grand_piano', 36, 96],
  rhodes:   ['electric_piano_1', 40, 96],
  vibraphone: ['vibraphone', 48, 96],
  marimba_s: ['marimba', 45, 96],
  kalimba_s: ['kalimba', 55, 99],
  celesta:  ['celesta', 55, 99],
  flute_s:  ['flute', 57, 96],
  nylon:    ['acoustic_guitar_nylon', 40, 84],
  acbass:   ['acoustic_bass', 26, 60],
  fretless: ['fretless_bass', 26, 60],
  strings_s: ['string_ensemble_1', 40, 84],
  choir_s:  ['choir_aahs', 45, 81],
  harp_s:   ['orchestral_harp', 36, 96],
  sax:      ['alto_sax', 45, 84],
};
const PC = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

const src = process.argv[2];
if (!src) { console.error('usage: node tools/pack-samples.mjs <source folder>'); process.exit(1); }
mkdirSync('samples', { recursive: true });
let total = 0;
for (const [id, [gm, lo, hi]] of Object.entries(INSTRUMENTS)) {
  const file = [join(src, gm + '-mp3.js'), join(src, gm + '.js')].find(existsSync);
  const text = readFileSync(file, 'utf8');
  const notes = {};
  for (const [, name, oct, b64] of text.matchAll(/"([A-G]b?)(-?\d)": "data:audio\/mp3;base64,([^"]+)"/g)) {
    const midi = 12 * (+oct + 1) + PC[name];
    if (midi % 3 === 0 && midi >= lo - 2 && midi <= hi + 2) notes[midi] = b64;
  }
  const out = `(window.MZ_SAMPLES = window.MZ_SAMPLES || {})[${JSON.stringify(id)}] = ${JSON.stringify(notes)};\nwindow.MZ_SAMPLE_READY && window.MZ_SAMPLE_READY(${JSON.stringify(id)});\n`;
  writeFileSync(`samples/${id}.js`, out);
  total += out.length;
  console.log(id.padEnd(11), Object.keys(notes).length, 'notes', (out.length / 1024).toFixed(0) + ' KB');
}
console.log('total', (total / 1024 / 1024).toFixed(2) + ' MB');
