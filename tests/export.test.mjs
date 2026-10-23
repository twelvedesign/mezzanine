// Tests for MIDI and WAV export and for the evolve module. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

globalThis.window = globalThis;
const require = createRequire(import.meta.url);
require('../js/core.js');
require('../js/audio.js');
require('../js/evolve.js');
require('../js/export.js');
const M = globalThis.M;

/* ---------- A small Standard MIDI File reader ---------- */
function readMidi(bytes) {
  let p = 0;
  const u8 = () => bytes[p++];
  const u16 = () => (bytes[p++] << 8) | bytes[p++];
  const u32 = () => ((bytes[p++] << 24) | (bytes[p++] << 16) | (bytes[p++] << 8) | bytes[p++]) >>> 0;
  const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[p++]); return s; };
  const vlq = () => { let n = 0, b; do { b = u8(); n = (n << 7) | (b & 0x7f); } while (b & 0x80); return n; };
  assert.equal(str(4), 'MThd');
  assert.equal(u32(), 6);
  const head = { format: u16(), ntracks: u16(), ppq: u16() };
  const tracks = [];
  for (let k = 0; k < head.ntracks; k++) {
    assert.equal(str(4), 'MTrk', 'track chunk id');
    const len = u32(), stop = p + len;
    const tr = { events: [], end: null };
    let tick = 0, status = 0;
    while (p < stop) {
      tick += vlq();
      let b = u8();
      if (b === 0xff) {
        const type = u8(), n = vlq(), data = Array.from(bytes.slice(p, p + n)); p += n;
        tr.events.push({ tick, meta: type, data });
        if (type === 0x2f) { tr.end = tick; break; }
        continue;
      }
      if (b & 0x80) status = b; else p--; // running status
      const hi = status & 0xf0, ch = status & 0x0f;
      const a = u8(), c = hi === 0xc0 || hi === 0xd0 ? null : u8();
      tr.events.push({ tick, type: hi, ch, a, b: c });
    }
    assert.equal(p, stop, 'track length matches its chunk header');
    tracks.push(tr);
  }
  assert.equal(p, bytes.length, 'no trailing bytes');
  return { ...head, tracks };
}
const noteOns = (tr) => tr.events.filter((e) => e.type === 0x90 && e.b > 0);
const noteOffs = (tr) => tr.events.filter((e) => e.type === 0x80 || (e.type === 0x90 && e.b === 0));

/* ---------- MIDI ---------- */
test('MIDI file has a type 1 header, a conductor track and one track per audible part', () => {
  const s = M.generateSong('midi1', 'lobby');
  for (const id of ['pad', 'keys', 'bass', 'arp', 'melody', 'drums']) s.parts[id].on = true;
  const score = M.songNotes(s, { bars: 8 });
  const bytes = M.writeMidi(score);
  assert.deepEqual(Array.from(bytes.slice(0, 14)), [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 7, 0x01, 0xe0]);
  const mid = readMidi(bytes);
  assert.equal(mid.format, 1);
  assert.equal(mid.ppq, 480);
  assert.equal(mid.tracks.length, 7);

  const cond = mid.tracks[0];
  const tempo = cond.events.find((e) => e.meta === 0x51).data;
  assert.equal((tempo[0] << 16) | (tempo[1] << 8) | tempo[2], Math.round(60000000 / s.tempo));
  assert.deepEqual(cond.events.find((e) => e.meta === 0x58).data, [4, 2, 24, 8]);
  const ks = cond.events.find((e) => e.meta === 0x59).data;
  const want = M.keySignature(s.key, s.mode);
  assert.equal((ks[0] << 24) >> 24, want.sf);
  assert.equal(ks[1], want.minor ? 1 : 0);

  const end = 8 * 4 * 480;
  for (const tr of mid.tracks) assert.equal(tr.end, end, 'every track ends at the last bar line');
  const drums = mid.tracks.find((t) => t.events.some((e) => e.type === 0x90 && e.ch === 9));
  assert.ok(drums, 'drums play on channel 10');
  assert.ok(noteOns(drums).every((e) => M.GM_DRUMS.includes(e.a)));
});

test('MIDI note counts match the grids and every note is closed', () => {
  const s = M.generateSong('midi2', 'cafe');
  for (const id of ['pad', 'keys', 'bass', 'arp', 'melody', 'drums']) s.parts[id].on = true;
  s.parts.melody.breathe = false;
  const bars = 4, chords = M.buildChords(s);
  const score = M.songNotes(s, { bars });
  const mid = readMidi(M.writeMidi(score));
  const hits = (id) => s.parts[id].grid.flat().filter(Boolean).length;
  const count = {};
  score.tracks.forEach((tr, i) => { count[tr.id] = noteOns(mid.tracks[i + 1]).length; });
  assert.equal(count.bass, hits('bass') * bars);
  assert.equal(count.arp, hits('arp') * bars);
  assert.equal(count.drums, hits('drums') * bars);
  assert.equal(count.melody, hits('melody') * (bars / 2));
  let padNotes = 0;
  for (let b = 0; b < bars; b++) padNotes += chords[Math.floor(b / s.hr) % chords.length].pad.length * hits('pad');
  assert.equal(count.pad, padNotes);
  for (const tr of mid.tracks.slice(1)) {
    assert.equal(noteOns(tr).length, noteOffs(tr).length, 'one note-off per note-on');
    const open = new Map();
    for (const e of tr.events) {
      if (e.type === 0x90) { assert.ok(!open.get(e.a), `note ${e.a} restarted while still sounding`); open.set(e.a, true); }
      if (e.type === 0x80) open.set(e.a, false);
    }
  }
});

test('MIDI timing follows swing and Breathe', () => {
  const s = M.generateSong('midi3', 'lobby');
  s.parts.drums.on = true;
  s.parts.drums.grid.forEach((r) => r.fill(0));
  s.parts.drums.grid[3].fill(0.8); // a hat on every sixteenth
  s.swing = 0.2;
  const hat = M.songNotes(s, { bars: 1 }).tracks.find((t) => t.id === 'drums').notes.map((n) => n.tick);
  assert.deepEqual(hat.slice(0, 4), [0, 144, 240, 384]);
  s.swing = 0;
  const straight = M.songNotes(s, { bars: 1 }).tracks.find((t) => t.id === 'drums').notes.map((n) => n.tick);
  assert.deepEqual(straight.slice(0, 4), [0, 120, 240, 360]);

  s.parts.melody.on = true; s.parts.melody.breathe = true;
  const mel = M.songNotes(s, { bars: 4 }).tracks.find((t) => t.id === 'melody').notes;
  assert.ok(mel.every((n) => Math.floor(n.tick / 3840) % 2 === 0), 'Breathe rests every other two bars');
});

test('MIDI skips muted parts, and Vary only changes things when a random source is given', () => {
  const s = M.generateSong('midi4', 'library');
  s.parts.drums.on = false;
  assert.ok(!M.songNotes(s, { bars: 2 }).tracks.some((t) => t.id === 'drums'));
  assert.deepEqual(M.songNotes(s, { bars: 4 }), M.songNotes(s, { bars: 4 }));
  const rr = M.rng('vary');
  const varied = M.songNotes(s, { bars: 4, rand: () => rr.next() });
  for (const tr of varied.tracks) for (const n of tr.notes) {
    assert.ok(n.vel >= 1 && n.vel <= 127 && n.dur >= 1 && n.midi >= 0 && n.midi <= 127);
  }
});

test('key signatures', () => {
  assert.deepEqual(M.keySignature(0, 'ionian'), { sf: 0, minor: false });
  assert.deepEqual(M.keySignature(9, 'aeolian'), { sf: 0, minor: true });
  assert.deepEqual(M.keySignature(2, 'dorian'), { sf: -1, minor: true });
  assert.deepEqual(M.keySignature(7, 'mixolydian'), { sf: 1, minor: false });
  assert.deepEqual(M.keySignature(3, 'ionian'), { sf: -3, minor: false });
});

/* ---------- WAV ---------- */
test('WAV header and 16-bit samples', () => {
  const L = new Float32Array([0, 0.5, -1, 2]), R = new Float32Array([1, -0.5, NaN, -3]);
  const wav = M.wavFile([L, R], 44100);
  const v = new DataView(wav.buffer);
  const tag = (o) => String.fromCharCode(...wav.slice(o, o + 4));
  assert.equal(tag(0), 'RIFF'); assert.equal(tag(8), 'WAVE'); assert.equal(tag(12), 'fmt '); assert.equal(tag(36), 'data');
  assert.equal(v.getUint32(4, true), wav.length - 8);
  assert.equal(v.getUint16(20, true), 1);
  assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint32(24, true), 44100);
  assert.equal(v.getUint32(28, true), 44100 * 4);
  assert.equal(v.getUint16(32, true), 4);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), 4 * 4);
  const pcm = Array.from({ length: 8 }, (_, i) => v.getInt16(44 + i * 2, true));
  assert.deepEqual(pcm, [0, 32767, 16384, -16384, -32768, 0, 32767, -32768]);
  assert.equal(M.peak([L, new Float32Array([0.25])]), 2);
  assert.deepEqual(Array.from(M.pcm16([L], 1, 2, 0.5)), [8192]);
});

test('file names', () => {
  assert.equal(M.fileSlug('Velvet Elevator No. 5'), 'velvet-elevator-no-5');
  assert.equal(M.fileSlug('“Café”'), 'caf');
  assert.equal(M.fileSlug(''), 'mezzanine');
});

/* ---------- Evolve and auto-arrange ---------- */
function stubEngine(song) {
  const e = { song, rebuilds: 0, arr: null, listeners: {} };
  e.rebuild = () => e.rebuilds++;
  e.setArrangement = (a) => (e.arr = a);
  e.on = (ev, fn) => (e.listeners[ev] = fn);
  return e;
}
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('evolve changes the progression or key on 32-bar lines', () => {
  const s = M.generateSong('evo1', 'lobby');
  const eng = stubEngine(s);
  const res = M.Evolve.evolve(s, eng, 32, seq(0.1, 0.1));
  assert.equal(res.msg, 'new chord progression');
  assert.ok(res.chords);
  assert.equal(eng.rebuilds, 1);

  const key = s.key;
  const mod = M.Evolve.evolve(s, eng, 64, seq(0.1, 0.9, 0.3)); // shift index 1: up a fifth
  assert.ok(mod.key && mod.chords);
  assert.equal(s.key, M.mod(key + 7, 12));
  assert.match(mod.msg, /^modulated to /);
});

test('evolve rewrites one playing part, or lets the bar pass', () => {
  const s = M.generateSong('evo2', 'lobby');
  const eng = stubEngine(s);
  assert.equal(M.Evolve.evolve(s, eng, 8, seq(0.2)), null);
  for (const id of ['melody', 'arp', 'keys', 'bass']) s.parts[id].on = false;
  s.parts.drums.on = true;
  const before = JSON.stringify(s.parts.drums.grid);
  let res;
  for (let i = 0; i < 10 && (!res || JSON.stringify(s.parts.drums.grid) === before); i++) res = M.Evolve.evolve(s, eng, 8, seq(0.9, 0.5));
  assert.deepEqual(res, { msg: 'new drums pattern', lane: 'drums' });
  s.parts.drums.on = false;
  assert.equal(M.Evolve.evolve(s, eng, 8, seq(0.9)), null, 'nothing to change when every part is muted');
  assert.equal(eng.rebuilds, 0);
});

test('arrange keeps energy between 1 and 3 and pad and texture always play', () => {
  const r = M.rng('arr');
  let energy = 3;
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const res = M.Evolve.arrange(energy, () => r.next());
    assert.ok(Math.abs(res.energy - energy) <= 1);
    energy = res.energy;
    seen.add(energy);
    assert.equal(res.arr.pad, 1); assert.equal(res.arr.texture, 1);
    for (const p of M.PARTS) {
      if (!M.Evolve.LAYERS[energy].includes(p.id) && p.id !== 'melody') assert.equal(res.arr[p.id], 0, `${p.id} plays at energy ${energy}`);
    }
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
  assert.deepEqual(M.Evolve.arrange(3, seq(0.9)).arr, Object.fromEntries(M.PARTS.map((p) => [p.id, 1])));
});

test('conductor acts every 8 bars and follows its switches', () => {
  const s = M.generateSong('evo3', 'lobby');
  const eng = stubEngine(s);
  const changes = [];
  let ev = true, ar = true;
  const c = new M.Evolve.Conductor(eng, { evolve: () => ev, arrange: () => ar, rand: seq(0.9, 0.95, 0.5), onChange: (x) => changes.push(x) });
  for (const bar of [0, 1, 7, 9]) eng.listeners.bar({ bar });
  assert.equal(changes.length, 0);
  eng.listeners.bar({ bar: 8 });
  assert.ok(changes.some((x) => x.lane), 'evolved a part');
  assert.ok(changes.some((x) => x.arr), 'arranged');
  assert.ok(eng.arr);
  ev = false; ar = false; changes.length = 0;
  eng.listeners.bar({ bar: 16 });
  assert.equal(changes.length, 0);
  c.reset();
  assert.equal(c.energy, 3);
  assert.deepEqual(eng.arr, {});
});
