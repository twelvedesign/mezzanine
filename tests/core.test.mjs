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
        // split voicings: an open pad shell below, rootless keys above, no interleaving
        const ps = c.padSplit, ks = c.keysSplit;
        assert.equal(M.mod(ps[0] - (s.key + M.degSemis(s.mode, c.c.d)), 12), 0, 'split pad has the root at the bottom');
        for (const n of ps) assert.ok(n >= 43 && n <= 67, `split pad note ${n}`);
        for (const n of ks) assert.ok(n >= 62 && n <= 81, `split keys note ${n}`);
        for (let k = 1; k < ps.length; k++) assert.ok(ps[k] - ps[k - 1] >= 2, 'split pad has no semitone clusters');
        assert.ok(ks[0] >= ps[ps.length - 1], 'split keys sit above the pad');
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

test('pad chords tie across bars until the harmony changes', () => {
  const chord = (d, e = '7') => ({ c: { d, e } });
  const one = [[0.8, ...new Array(15).fill(0)]];
  // two bars per chord: bar 1 is a tie and bar 0 holds for 32 steps
  const chords = [chord(0), chord(3), chord(4), chord(0, 'triad')];
  assert.deepEqual(M.padHold(one, 0, 2, chords), { tie: false, steps: 32 });
  assert.equal(M.padHold(one, 16, 2, chords).tie, true);
  assert.equal(M.padHold(one, 16, 2, chords).steps, 16);
  assert.equal(M.padHold(one, 32, 2, chords).tie, false);
  // one bar per chord: every bar is new harmony
  assert.deepEqual(M.padHold(one, 16, 1, chords), { tie: false, steps: 16 });
  // the same chord twice in a row is held through
  const twice = [chord(1), chord(4), chord(0), chord(0)];
  assert.equal(M.padHold(one, 48, 1, twice).tie, true);
  assert.equal(M.padHold(one, 32, 1, twice).steps, 32);
  // a hit drawn mid-bar retriggers, and cuts the held chord short
  const mid = [[0.8, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0]];
  assert.deepEqual(M.padHold(mid, 0, 4, chords), { tie: false, steps: 8 });
  assert.deepEqual(M.padHold(mid, 8, 4, chords), { tie: false, steps: 16 });
  assert.equal(M.padHold(mid, 16, 4, chords).tie, true);
  assert.equal(M.padHold(mid, 56, 4, chords).steps, 8, 'ends at the chord change');
  // the loop wraps: the last chord resolves into the first
  assert.equal(M.padHold(one, 7 * 16, 2, chords).steps, 16);
});

test('notes fold into instrument ranges', () => {
  assert.equal(M.foldInto(97, [49, 81]), 73);
  assert.equal(M.foldInto(30, [40, 84]), 42);
  assert.equal(M.foldInto(60, [40, 84]), 60);
  assert.equal(M.foldInto(60, undefined), 60);
  // a whole part moves an octave when much of it is out of range, not for one stray note
  assert.equal(M.rangeShift([70, 74, 79, 84, 86, 91], [49, 81]), -12);
  assert.equal(M.rangeShift([60, 64, 67, 72, 76, 79, 84], [40, 83]), 0);
  assert.equal(M.rangeShift([40, 43, 47], [45, 79]), 12);
  for (const [id, v] of Object.entries(M.VOICES)) {
    if (!v.kind) continue;
    assert.ok(v.range && v.range[1] - v.range[0] >= 24, `${id} needs a range of two octaves or more`);
  }
});

test('every melody note can be played in range by every melody voice', () => {
  for (const mood of M.MOODS) {
    for (const seed of SEEDS.slice(0, 10)) {
      const s = M.generateSong(seed, mood.id);
      const chords = M.buildChords(s);
      const pool = chords.flatMap((c) => Array.from({ length: 12 }, (_, row) => M.melodyMidi(s, c, row)));
      for (const voice of M.PART.melody.voices) {
        const range = M.VOICES[voice].range, sh = M.rangeShift(pool, range);
        for (const m of pool) {
          const out = M.foldInto(m + sh, range);
          assert.ok(out >= range[0] && out <= range[1], `${voice} plays ${out}`);
        }
      }
    }
  }
});

test('drum fills change only the second half of the bar, gently', () => {
  for (const mood of M.MOODS) {
    const style = mood.styles.drums[0];
    const kinds = new Set();
    for (const seed of SEEDS.slice(0, 20)) {
      const base = M.generateSong(seed, mood.id).parts.drums.grid;
      const before = JSON.stringify(base);
      const fill = M.drumFill(base, style, M.rng(seed));
      assert.equal(JSON.stringify(base), before, 'the pattern itself is left alone');
      assert.deepEqual(fill, M.drumFill(base, style, M.rng(seed)), 'fills are seeded');
      assert.equal(fill.length, 5);
      for (let row = 0; row < 5; row++) {
        assert.equal(fill[row].length, 16);
        for (let st = 0; st < 16; st++) {
          assert.ok(fill[row][st] >= 0 && fill[row][st] <= 1);
          if (st < 8) assert.equal(fill[row][st], base[row][st], 'first half unchanged');
        }
      }
      kinds.add(JSON.stringify(fill) !== before);
    }
    assert.ok(kinds.has(true), `${mood.id} fills differ from the plain pattern`);
  }
});

test('melody phrases arch to one peak and end on a long chord tone', () => {
  for (const mood of M.MOODS) {
    for (const seed of SEEDS) {
      const g = M.gen.melody(M.rng(seed), mood);
      const notes = [];
      for (let st = 0; st < 32; st++) { const row = g.findIndex((r) => r[st]); if (row >= 0) notes.push([st, row - 3]); }
      const top = Math.max(...notes.map((n) => n[1]));
      assert.equal(notes.filter((n) => n[1] === top).length, 1, `${mood.id}/${seed} has one peak`);
      assert.notEqual(notes[0][1], top, 'the phrase rises to its peak');
      const last = notes[notes.length - 1];
      assert.ok(last[0] >= 16, 'the answer bar has notes');
      assert.ok([0, 2, 4].includes(last[1]), 'the phrase lands on a chord tone');
      assert.ok(32 - last[0] >= 6, 'the last note has room to ring');
    }
  }
});
