// Draws the home-screen icons (a brass elevator call button) into icons/*.png.
// No dependencies: shapes are sampled 4x4 per pixel and written with a tiny PNG encoder.
// Usage: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const BG = hex('#0c1416'), RAISED = hex('#182428'), BRASS = hex('#d3aa5f'), BRASS_HI = hex('#f1d08e'), INK = hex('#1c1509');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v) => Math.max(0, Math.min(1, v));

function inTri(x, y, [ax, ay], [bx, by], [cx, cy]) {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

// Colour (RGBA, 0..1) at unit coordinates. `rounded` cuts the square to an app-icon shape.
function shade(x, y, rounded) {
  if (rounded) {
    const r = 0.22, qx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0), qy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
    if (Math.hypot(qx, qy) > r) return [0, 0, 0, 0];
  }
  const d = Math.hypot(x - 0.5, y - 0.5);
  let c = mix(BG, RAISED, clamp(1 - Math.hypot(x - 0.35, y - 0.3) / 0.8));
  c = mix(c, BRASS, 0.3 * clamp(1 - Math.abs(d - 0.33) / 0.07)); // soft glow ring
  if (d < 0.3) {
    c = mix(BRASS, BRASS_HI, clamp(1 - Math.hypot(x - 0.4, y - 0.36) / 0.35));
    const up = inTri(x, y, [0.5, 0.345], [0.405, 0.465], [0.595, 0.465]);
    const down = inTri(x, y, [0.5, 0.655], [0.405, 0.535], [0.595, 0.535]);
    if (up || down) c = INK;
  }
  return [...c, 1];
}

function render(size, rounded) {
  const px = Buffer.alloc(size * size * 4), N = 4;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const acc = [0, 0, 0, 0];
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const c = shade((i + (sx + 0.5) / N) / size, (j + (sy + 0.5) / N) / size, rounded);
      acc[0] += c[0] * c[3]; acc[1] += c[1] * c[3]; acc[2] += c[2] * c[3]; acc[3] += c[3];
    }
    const a = acc[3] / (N * N), o = (j * size + i) * 4;
    for (let k = 0; k < 3; k++) px[o + k] = Math.round(a ? (acc[k] / acc[3]) * 255 : 0);
    px[o + 3] = Math.round(a * 255);
  }
  return png(size, px);
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let j = 0; j < size; j++) px.copy(raw, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('icons', { recursive: true });
const out = { 'icon-192.png': [192, true], 'icon-512.png': [512, true], 'maskable-512.png': [512, false], 'apple-touch-icon.png': [180, false] };
for (const [name, [size, rounded]] of Object.entries(out)) {
  writeFileSync('icons/' + name, render(size, rounded));
  console.log('wrote icons/' + name);
}
