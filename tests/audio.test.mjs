// Tests for the pure parts of the audio engine: loudness metering and the master chain's curves. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

globalThis.window = globalThis;
const require = createRequire(import.meta.url);
require('../js/core.js');
require('../js/audio.js');
const M = globalThis.M;

const sine = (f, sec, sr, amp = 1) => Float32Array.from({ length: Math.round(sec * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / sr));
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('K-weighting matches the BS.1770 coefficients at 48 kHz', () => {
  const [shelf, hp] = M.kWeights(48000);
  [1.53512485958697, -2.69169618940638, 1.19839281085285].forEach((b, i) => close(shelf.b[i], b, 1e-8, 'shelf b' + i));
  [-1.69065929318241, 0.73248077421585].forEach((a, i) => close(shelf.a[i], a, 1e-8, 'shelf a' + (i + 1)));
  assert.deepEqual(hp.b, [1, -2, 1]);
  [-1.99004745483398, 0.99007225036621].forEach((a, i) => close(hp.a[i], a, 1e-8, 'high-pass a' + (i + 1)));
});

test('a full-scale 1 kHz sine reads 0 LUFS in stereo and -3 LUFS in one channel', () => {
  for (const sr of [44100, 48000]) {
    const x = sine(1000, 3, sr), silent = new Float32Array(x.length);
    close(M.loudness([x, x], sr), 0, 0.05, 'stereo at ' + sr);
    close(M.loudness([x, silent], sr), -3.01, 0.05, 'left only at ' + sr);
  }
});

test('loudness follows level and gates out silence', () => {
  const sr = 48000, loud = sine(1000, 4, sr, 0.5), quiet = sine(1000, 4, sr, 0.25);
  close(M.loudness([quiet, quiet], sr) - M.loudness([loud, loud], sr), -6.02, 0.02, 'half the amplitude');
  // Half the time silent: plain RMS drops 3 dB, gated loudness only by the blocks that straddle the edges.
  const gapped = new Float32Array(sr * 8);
  gapped.set(loud, sr * 2);
  close(M.loudness([gapped, gapped], sr), M.loudness([loud, loud], sr), 0.4, 'silence is gated');
  assert.equal(M.loudness([new Float32Array(sr), new Float32Array(sr)], sr), -Infinity);
});

test('K-weighting counts highs more and deep lows less than plain RMS', () => {
  const sr = 48000, at = (f) => { const x = sine(f, 3, sr, 0.5); return M.loudness([x, x], sr); };
  const mid = at(1000);
  assert.ok(at(30) < mid - 1, 'deep bass counts less');
  const hi = at(8000) - mid;
  assert.ok(hi > 2.5 && hi < 4, 'highs count about 3 dB more: ' + hi);
});

/* ---------- Master chain ---------- */
// A WaveShaper curve maps inputs -1..1 onto its points; `range` stretches that over -range..range.
const shape = (curve, range, x) => {
  const p = ((x / range + 1) / 2) * (curve.length - 1), i = Math.min(curve.length - 2, Math.floor(p));
  return curve[i] + (curve[i + 1] - curve[i]) * (p - i);
};

test('the output ceiling passes the mix untouched below its knee and never exceeds the ceiling', () => {
  const { knee, ceil, range } = M.LIMIT, c = M.ceilingCurve(knee, ceil, range);
  assert.ok(ceil < Math.pow(10, -1 / 20) + 1e-6, 'ceiling at or below -1 dBFS');
  for (const x of [0, 0.001, -0.02, 0.3, -0.6, knee * 0.999]) close(shape(c, range, x), x, 1e-6, 'unity at ' + x);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1], 'monotonic');
  for (let i = 0; i < c.length; i++) {
    assert.ok(Math.abs(c[i]) <= ceil, 'never above the ceiling');
    close(c[i], -c[c.length - 1 - i], 1e-7, 'odd symmetric');
  }
  assert.ok(shape(c, range, range) > ceil - 0.01, 'loud overs bend all the way to the ceiling');
  assert.ok(shape(c, range, 1) > knee && shape(c, range, 1) < ceil, 'a full-scale peak bends softly');
});

test('tape saturation is unity for quiet signals and rounds off peaks', () => {
  const { drive, range } = M.TAPE, c = M.tapeCurve(drive, range);
  close(shape(c, range, 0.001), 0.001, 1e-5, 'unity slope near zero');
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1], 'monotonic');
  for (let i = 0; i < c.length; i++) close(c[i], -c[c.length - 1 - i], 1e-7, 'odd symmetric');
  const y = shape(c, range, 0.5);
  assert.ok(y < 0.5 && y > 0.3, 'a loud peak is rounded, not clipped: ' + y);
});

test('every floor has a loudness trim, and tape only on the lo-fi floors', () => {
  for (const mood of M.MOODS) {
    const mix = M.mixFor(M.generateSong('trim', mood.id));
    assert.ok(Number.isFinite(mix.trim) && Math.abs(mix.trim) <= 8, `${mood.id} trim ${mix.trim}`);
    assert.ok(M.FLOOR_MIX[mood.id] && Number.isFinite(M.FLOOR_MIX[mood.id].trim), `${mood.id} has a FLOOR_MIX entry`);
    assert.equal(mix.tape > 0, ['night', 'rain'].includes(mood.id), `${mood.id} tape ${mix.tape}`);
    assert.ok(mix.tape >= 0 && mix.tape <= 1);
  }
  assert.deepEqual(M.mixFor({ mood: 'nowhere', fx: {} }), { trim: 0, tape: 0 });
});

test('a song can set its own tape amount, and old song codes keep their floor\'s', () => {
  const song = M.generateSong('tape', 'night');
  const floor = M.mixFor(song).tape;
  song.edited = true;
  const back = M.decodeSong(M.encodeSong(song));
  assert.equal(back.fx.tape, undefined, 'codes saved before tape existed have no fx.tape');
  assert.equal(M.mixFor(back).tape, floor);
  assert.equal(M.mixFor({ ...song, fx: { ...song.fx, tape: 0 } }).tape, 0);
  assert.equal(M.mixFor({ ...song, fx: { ...song.fx, tape: 3 } }).tape, 1, 'clamped');
  assert.equal(M.mixFor({ ...song, fx: { ...song.fx, tape: 'x' } }).tape, floor, 'ignores junk');
  assert.equal(M.mixFor({ ...song, mood: 'lobby', fx: { ...song.fx, tape: 0.4 } }).tape, 0.4);
});

test('brightness is untouched in the middle, darker to the left and airier to the right', () => {
  for (const sr of [44100, 48000]) {
    assert.deepEqual(M.brightness(0.5, sr), { cutoff: sr / 2, shelf: 0 }, 'the middle changes nothing');
    assert.deepEqual(M.brightness(0, sr), { cutoff: 700, shelf: 0 });
    assert.deepEqual(M.brightness(1, sr), { cutoff: sr / 2, shelf: 6 });
    let cutoff = 0, shelf = 0;
    for (let k = 0; k <= 10; k++) { const c = M.brightness(k / 20, sr).cutoff; assert.ok(c > cutoff, 'darker to the left'); cutoff = c; }
    for (let k = 11; k <= 20; k++) { const g = M.brightness(k / 20, sr).shelf; assert.ok(g > shelf, 'airier to the right'); shelf = g; }
  }
});
