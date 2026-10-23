// Tests for song form: sections, their line-ups and lengths, and the Conductor that walks them. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

globalThis.window = globalThis;
const require = createRequire(import.meta.url);
require('../js/core.js');
require('../js/audio.js');
require('../js/evolve.js');
const M = globalThis.M;
const E = M.Evolve;

// A stand-in engine: it records what the Conductor tells it and plays bar lines through it.
function stubEngine(song) {
  const e = { song, rebuilds: 0, arr: null, sec: undefined, sections: [], listeners: {} };
  e.rebuild = () => e.rebuilds++;
  e.setArrangement = (a) => (e.arr = a);
  e.setSection = (s) => { e.sec = s; if (s) e.sections.push(s); };
  e.on = (ev, fn) => (e.listeners[ev] = fn);
  e.play = (from, to) => { for (let bar = from; bar < to; bar++) e.listeners.bar({ bar }); };
  return e;
}
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const SEEDS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];

test('the first round opens with an intro and moves through theme, variation, bridge, breather and return', () => {
  for (const mood of M.MOODS) for (const seed of SEEDS) {
    const s = M.generateSong(seed, mood.id);
    const plan = E.planChapter(s, 0);
    assert.deepEqual(plan.map((x) => x.kind), ['intro', 'theme', 'variation', 'bridge', 'breather', 'return']);
    for (const x of plan) {
      assert.equal(x.harmony, x.kind === 'bridge' ? 'B' : 'A');
      assert.equal(x.label, E.SECTIONS[x.kind].label);
      assert.equal(x.arr.pad, 1); assert.equal(x.arr.texture, 1);
      assert.equal(x.bars, E.sectionBars(s, x.kind));
    }
    const by = Object.fromEntries(plan.map((x) => [x.kind, x]));
    for (const id of ['melody', 'drums', 'bass', 'keys']) assert.equal(by.intro.arr[id], 0, `the intro leaves out ${id}`);
    for (const id of ['drums', 'bass', 'keys']) assert.equal(by.breather.arr[id], 0, `the breather leaves out ${id}`);
    assert.equal(by.theme.arr.melody, 1); assert.equal(by.variation.arr.melody, 1); assert.equal(by.return.arr.melody, 1);
    assert.deepEqual(E.planChapter(s, 0), plan, 'seeded');
  }
});

test('later rounds start at the theme and may leave out the variation or the breather', () => {
  const seen = new Set();
  for (const mood of M.MOODS) for (const seed of SEEDS) for (let ch = 1; ch < 6; ch++) {
    const kinds = E.planChapter(M.generateSong(seed, mood.id), ch).map((x) => x.kind);
    assert.equal(kinds[0], 'theme'); assert.equal(kinds[kinds.length - 1], 'return');
    assert.ok(kinds.includes('bridge')); assert.ok(!kinds.includes('intro'));
    seen.add(kinds.join(' '));
  }
  assert.ok(seen.size >= 3, 'rounds differ');
});

test('sections last whole loops, paced by the floor', () => {
  const s = M.generateSong('len', 'lobby'); // pace 16
  s.prog = s.prog.slice(0, 4); s.hr = 1; // a 4-bar theme loop
  s.progB = s.progB.slice(0, 3); // a 3-bar bridge loop
  assert.deepEqual(['intro', 'theme', 'variation', 'bridge', 'breather', 'return'].map((k) => E.sectionBars(s, k)), [4, 16, 16, 18, 8, 16]);
  s.hr = 2; // an 8-bar theme loop, a 6-bar bridge loop
  assert.deepEqual(['intro', 'theme', 'bridge', 'breather'].map((k) => E.sectionBars(s, k)), [8, 16, 18, 8]);
  const f = M.generateSong('len', 'focus'); // pace 32
  f.prog = f.prog.slice(0, 2); f.hr = 1;
  assert.deepEqual(['intro', 'theme', 'breather'].map((k) => E.sectionBars(f, k)), [4, 32, 16]);
});

test('line-ups follow the energy, and pad and texture always play', () => {
  const r = M.rng('lineup');
  for (let i = 0; i < 300; i++) {
    const energy = 1 + (i % 3), melody = i % 2 === 0;
    const arr = E.lineup(energy, melody, r);
    assert.equal(arr.pad, 1); assert.equal(arr.texture, 1);
    assert.equal(arr.melody, melody ? 1 : 0);
    for (const p of M.PARTS) if (p.id !== 'melody' && !E.LAYERS[energy].includes(p.id)) assert.equal(arr[p.id], 0, `${p.id} at energy ${energy}`);
  }
});

test('a drum fill can be asked for on any bar, and still needs Vary', () => {
  const s = M.generateSong('fill', 'cafe');
  const d = s.parts.drums;
  d.vary = 0.4;
  assert.equal(M.drumGridAt(s, d, 5), d.grid, 'bar 6 of 8 plays the pattern');
  assert.notDeepEqual(M.drumGridAt(s, d, 5, true), d.grid, 'a section ending on bar 6 gets its fill');
  assert.notDeepEqual(M.drumGridAt(s, d, 7), d.grid);
  d.vary = 0;
  assert.equal(M.drumGridAt(s, d, 5, true), d.grid);
});

test('the conductor walks the sections at their bar lines', () => {
  const s = M.generateSong('walk', 'night');
  const eng = stubEngine(s);
  const changes = [];
  new E.Conductor(eng, { evolve: () => false, arrange: () => true, onChange: (x) => changes.push(x) });
  eng.play(0, 600);
  const secs = eng.sections;
  assert.deepEqual(secs.slice(0, 6).map((x) => x.kind), ['intro', 'theme', 'variation', 'bridge', 'breather', 'return']);
  assert.equal(secs[0].start, 0);
  for (let i = 1; i < secs.length; i++) assert.equal(secs[i].start, secs[i - 1].start + secs[i - 1].bars, 'each section starts where the last ended');
  assert.equal(secs[6].kind, 'theme'); assert.equal(secs[6].chapter, 1);
  assert.ok(secs.every((x) => x.harmony === (x.kind === 'bridge' ? 'B' : 'A')));
  assert.equal(changes.filter((x) => x.section).length, secs.length, 'one change per section start');
  assert.deepEqual(eng.arr, changes[changes.length - 1].arr);
});

test('bar 0 always starts from the intro, and joining a playing loop waits for its start', () => {
  const s = M.generateSong('join', 'lobby');
  s.prog = s.prog.slice(0, 4); s.hr = 1;
  const eng = stubEngine(s);
  let arrange = false;
  new E.Conductor(eng, { evolve: () => false, arrange: () => arrange });
  eng.play(0, 6);
  assert.equal(eng.sections.length, 0, 'no sections while Auto-arrange is off');
  arrange = true;
  eng.play(6, 8);
  assert.equal(eng.sections.length, 0, 'waits for the loop to come round');
  eng.play(8, 9);
  assert.equal(eng.sec.kind, 'theme'); assert.equal(eng.sec.start, 8);
  eng.play(9, 30);
  eng.listeners.bar({ bar: 0 }); // a new song, or Play again
  assert.equal(eng.sec.kind, 'intro'); assert.equal(eng.sec.start, 0);
  arrange = false;
  eng.listeners.bar({ bar: 1 });
  assert.equal(eng.sec, null, 'Auto-arrange off plays the plain loop');
  assert.deepEqual(eng.arr, {});
});

test('a new song switched in during the first round plays its own first round', () => {
  const a = M.generateSong('first', 'lobby'), b = M.generateSong('second', 'lobby');
  const eng = stubEngine(a);
  const seen = [];
  new E.Conductor(eng, { evolve: () => false, arrange: () => true, onChange: (x) => x.section && seen.push(x) });
  eng.play(0, 20); // the first song, part-way into its first round
  eng.song = b; seen.length = 0;
  eng.play(0, 40); // the engine starts again at bar 0 with the new song
  const fresh = E.planChapter(b, 0);
  assert.ok(seen.length >= 3);
  assert.deepEqual(seen.map((x) => [x.section.kind, x.arr]), fresh.slice(0, seen.length).map((x) => [x.kind, x.arr]));
});

test('a song plays the same journey every time', () => {
  for (const mood of ['lobby', 'focus']) {
    const run = () => {
      const s = M.generateSong('same', mood);
      const eng = stubEngine(s), log = [];
      new E.Conductor(eng, { evolve: () => true, arrange: () => true, onChange: (x) => log.push(JSON.stringify(x)) });
      eng.play(0, 400);
      return { log, song: JSON.stringify(s) };
    };
    const a = run(), b = run();
    assert.ok(a.log.length > 10);
    assert.deepEqual(a.log, b.log);
    assert.equal(a.song, b.song);
  }
});

test('with the form on, Evolve changes things only where sections start or on 16-bar lines inside them', () => {
  for (const mood of ['cafe', 'rain', 'tea']) {
    const s = M.generateSong('where', mood);
    const eng = stubEngine(s);
    const at = [];
    let bar = 0;
    new E.Conductor(eng, { evolve: () => true, arrange: () => true, onChange: (x) => { if (x.msg) at.push(bar); } });
    for (; bar < 500; bar++) eng.listeners.bar({ bar });
    assert.ok(at.length >= 4, `${mood}: Evolve made changes`);
    for (const b of at) {
      const sec = [...eng.sections].reverse().find((x) => x.start <= b);
      assert.equal((b - sec.start) % 16, 0, `${mood}: bar ${b} is a section start or a 16-bar line`);
    }
  }
});

test('the return brings back the theme the variation changed', () => {
  const s = M.generateSong('ret', 'lobby');
  const eng = stubEngine(s);
  const grid = {};
  new E.Conductor(eng, { evolve: () => true, arrange: () => true, onChange: (x) => {
    if (x.section && x.section.chapter === 0) grid[x.section.kind] = JSON.stringify(s.parts.melody.grid);
  } });
  eng.play(0, 200);
  assert.ok(grid.theme && grid.variation && grid.return);
  assert.notEqual(grid.variation, grid.theme, 'the variation changes the melody');
  assert.equal(grid.return, grid.theme, 'the return brings the theme back');
});

test('a melody drawn by hand during the variation is kept at the return', () => {
  const s = M.generateSong('ret', 'lobby');
  const eng = stubEngine(s);
  let drawn = null, back = null;
  new E.Conductor(eng, { evolve: () => true, arrange: () => true, onChange: (x) => {
    if (!x.section || x.section.chapter !== 0) return;
    if (x.section.kind === 'variation') { s.parts.melody.grid[0][5] = 0.8; drawn = JSON.stringify(s.parts.melody.grid); }
    if (x.section.kind === 'return') back = JSON.stringify(s.parts.melody.grid);
  } });
  eng.play(0, 200);
  assert.ok(drawn);
  assert.equal(back, drawn);
});

test('with Auto-arrange off, Evolve runs every 8 bars and no section is set', () => {
  const s = M.generateSong('legacy', 'lobby');
  const eng = stubEngine(s);
  const changes = [];
  new E.Conductor(eng, { evolve: () => true, arrange: () => false, rand: seq(0.9, 0.95, 0.5), onChange: (x) => changes.push(x) });
  eng.play(0, 8);
  assert.equal(changes.length, 0);
  eng.listeners.bar({ bar: 8 });
  assert.ok(changes.some((x) => x.lane), 'evolved a part');
  assert.equal(eng.sections.length, 0);
  assert.equal(eng.sec, null);
});
