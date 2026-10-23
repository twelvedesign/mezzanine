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
