// Unit tests for the music theory, generator and song codes. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

globalThis.window = globalThis;
const require = createRequire(import.meta.url);
require('../js/core.js');
require('../js/audio.js');
const M = globalThis.M;

const SEEDS = Array.from({ length: 60 }, (_, i) => 'seed' + i);

test('every floor generates well-formed songs', () => {
  for (const mood of M.MOODS) {
    for (const seed of SEEDS) {
      const s = M.generateSong(seed, mood.id);
      assert.ok(s.tempo >= mood.tempo[0] && s.tempo <= mood.tempo[1], `${mood.id} tempo`);
      assert.ok(s.prog.length >= 2 && s.prog.length <= 8, `${mood.id} progression length`);
      for (const c of s.prog) {
        assert.ok(!M.isDim(s.mode, c.d), `${mood.id}/${seed} has a diminished chord`);
        assert.ok(M.EXTS.includes(c.e), `unknown extension ${c.e}`);
      }
      for (const meta of M.PARTS) {
        const p = s.parts[meta.id];
        assert.ok(meta.voices.includes(p.voice), `${mood.id} ${meta.id} voice ${p.voice} not offered`);
        if (!meta.rows) continue;
        assert.equal(p.grid.length, meta.rows, `${meta.id} rows`);
        for (const row of p.grid) assert.equal(row.length, meta.len, `${meta.id} length`);
        if (meta.mono) {
          for (let st = 0; st < meta.len; st++) {
            assert.ok(p.grid.filter((r) => r[st]).length <= 1, `${meta.id} has two notes on step ${st}`);
          }
        }
      }
      const melNotes = s.parts.melody.grid.flat().filter(Boolean).length;
      assert.ok(melNotes >= 2, `${mood.id}/${seed} melody too sparse`);
    }
  }
});

test('songs are deterministic for a seed and floor', () => {
  assert.deepEqual(M.generateSong('abc12', 'lobby'), M.generateSong('abc12', 'lobby'));
  assert.notDeepEqual(M.generateSong('abc12', 'lobby').prog, M.generateSong('abc13', 'lobby').prog);
});

test('chord voicings stay in range and lead smoothly', () => {
  for (const mood of M.MOODS) {
    for (const seed of SEEDS.slice(0, 20)) {
      const s = M.generateSong(seed, mood.id);
      for (const c of M.buildChords(s)) {
        for (const n of c.pad) assert.ok(n >= 50 && n <= 74, `pad note ${n}`);
        for (const n of c.keys) assert.ok(n >= 56 && n <= 77, `keys note ${n}`);
        assert.ok(c.pad[c.pad.length - 1] - c.pad[0] <= 19, 'pad voicing too wide');
        assert.ok(c.bass[0] >= 33 && c.bass[0] <= 45, `bass root ${c.bass[0]}`);
        assert.equal(c.arp.length, 8);
        for (let k = 1; k < 8; k++) assert.ok(c.arp[k] > c.arp[k - 1], 'arp tones ascend');
        for (const n of [...c.pad, ...c.keys, ...c.bass, ...c.arp]) assert.ok(Number.isFinite(n));
      }
    }
  }
});

test('chord names and spelling', () => {
  assert.equal(M.chordName(0, 'ionian', 0, '7'), 'Cmaj7');
  assert.equal(M.chordName(0, 'ionian', 1, '9'), 'Dm9');
  assert.equal(M.chordName(0, 'ionian', 4, '7'), 'G7');
  assert.equal(M.chordName(0, 'ionian', 6, 'triad'), 'B°');
  assert.equal(M.chordName(4, 'lydian', 5, '7'), 'C♯m7');
  assert.equal(M.chordName(5, 'ionian', 3, 'triad'), 'B♭');
  assert.equal(M.roman('aeolian', 0), 'i');
  assert.equal(M.roman('ionian', 4), 'V');
});

test('melody notes respect range and the pentatonic filter', () => {
  for (const mood of M.MOODS) {
    const s = M.generateSong('mel', mood.id);
    s.penta = true;
    const set = M.MODES[s.mode].penta.map((d) => M.mod(s.key + M.MODES[s.mode].steps[d], 12));
    for (const c of M.buildChords(s)) {
      for (let row = 0; row < 12; row++) {
        const m = M.melodyMidi(s, c, row);
        assert.ok(m >= 50 && m <= 100, `melody note ${m}`);
        assert.ok(set.includes(M.mod(m, 12)), `${M.midiName(m)} is outside the pentatonic scale`);
      }
    }
  }
});

test('song codes round-trip', () => {
  const s = M.generateSong('xyz98', 'rain');
  assert.equal(M.encodeSong(s), 'rain.xyz98');
  assert.deepEqual(M.decodeSong('rain.xyz98').prog, s.prog);

  s.edited = true;
  s.tempo = 77;
  s.parts.melody.grid[5][3] = 0.8;
  s.parts.keys.voice = 'grand';
  const back = M.decodeSong(M.encodeSong(s));
  assert.equal(back.tempo, 77);
  assert.equal(back.parts.keys.voice, 'grand');
  assert.ok(back.parts.melody.grid[5][3] > 0.7);
  assert.deepEqual(back.prog, s.prog);
});

test('bad song codes explain themselves', () => {
  assert.throws(() => M.decodeSong('hello'), /Song codes start with/);
});

test('evolution keeps grids well-formed', () => {
  const s = M.generateSong('evo', 'lobby');
  for (let i = 0; i < 200; i++) {
    M.varyMelody(s);
    assert.equal(s.parts.melody.grid.length, 12);
    for (const row of s.parts.melody.grid) assert.equal(row.length, 32);
  }
  M.regenProgression(s);
  assert.ok(s.prog.every((c) => !M.isDim(s.mode, c.d)));
});

test('instrument family switch maps both ways', () => {
  const s = M.generateSong('fam', 'lobby');
  M.setInstrumentFamily(s, false);
  for (const p of Object.values(s.parts)) assert.notEqual(M.VOICES[p.voice].kind, 'sample');
  M.setInstrumentFamily(s, true);
  assert.equal(M.VOICES[s.parts.keys.voice].kind, 'sample');
});

test('every offered voice is defined, and sampled voices have a synth fallback', () => {
  for (const meta of M.PARTS) {
    for (const v of meta.voices) {
      const def = M.VOICES[v];
      assert.ok(def, `voice ${v} is not defined`);
      if (def.kind === 'sample') assert.ok(M.VOICES[def.fb] && M.VOICES[def.fb].kind, `${v} needs a synth fallback`);
    }
  }
});
