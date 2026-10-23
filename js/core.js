/* Mezzanine — core: seeded randomness, music theory, moods and the song generator. */
(function () {
  const M = (window.M = window.M || {});

  /* ---------- Seeded random ---------- */
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  M.rng = function (seed) {
    let a = xmur3(String(seed))();
    const r = {
      next() {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      float(lo = 0, hi = 1) { return lo + (hi - lo) * r.next(); },
      int(lo, hi) { return lo + Math.floor(r.next() * (hi - lo + 1)); },
      pick(arr) { return arr[Math.floor(r.next() * arr.length)]; },
      chance(p) { return r.next() < p; },
      weighted(obj) {
        const ks = Object.keys(obj);
        let tot = 0;
        for (const k of ks) tot += obj[k];
        let x = r.next() * tot;
        for (const k of ks) { x -= obj[k]; if (x <= 0) return k; }
        return ks[ks.length - 1];
      },
    };
    return r;
  };
  M.newSeed = () => Math.random().toString(36).slice(2, 7).padEnd(5, '0');

  /* ---------- Theory ---------- */
  const mod = (n, m) => ((n % m) + m) % m;
  M.mod = mod;
  M.NOTE = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  M.MODES = {
    ionian:     { name: 'Major',      steps: [0, 2, 4, 5, 7, 9, 11], penta: [0, 1, 2, 4, 5], color: 3 },
    lydian:     { name: 'Lydian',     steps: [0, 2, 4, 6, 7, 9, 11], penta: [0, 1, 2, 4, 5], color: 1 },
    mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], penta: [0, 1, 2, 4, 5], color: 6 },
    dorian:     { name: 'Dorian',     steps: [0, 2, 3, 5, 7, 9, 10], penta: [0, 2, 3, 4, 6], color: 3 },
    aeolian:    { name: 'Minor',      steps: [0, 2, 3, 5, 7, 8, 10], penta: [0, 2, 3, 4, 6], color: 5 },
  };
  M.MODE_ORDER = ['ionian', 'lydian', 'mixolydian', 'dorian', 'aeolian'];
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const MODE_OFF = { ionian: 0, dorian: 2, lydian: 5, mixolydian: 7, aeolian: 9 };
  // Spell notes with sharps or flats to match the key signature of the parent major scale.
  M.spell = (key, mode) => ([7, 2, 9, 4, 11].includes(mod(key - MODE_OFF[mode], 12)) ? SHARP : FLAT);

  M.degSemis = (mode, deg) => M.MODES[mode].steps[mod(deg, 7)] + 12 * Math.floor(deg / 7);
  M.degMidi = (key, mode, deg, oct) => 12 * (oct + 1) + key + M.degSemis(mode, deg);
  M.midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  M.midiName = (m) => M.NOTE[mod(m, 12)] + (Math.floor(m / 12) - 1);

  // Chord shapes expressed as scale-degree offsets stacked from the root.
  const SHAPES = {
    triad: [0, 2, 4], '7': [0, 2, 4, 6], '9': [0, 2, 4, 6, 8], add9: [0, 2, 4, 8],
    sus2: [0, 1, 4], sus4: [0, 3, 4], '6': [0, 2, 4, 5],
  };
  M.EXTS = Object.keys(SHAPES);
  M.EXT_LABEL = { triad: 'Triad', '7': '7th', '9': '9th', add9: 'add9', sus2: 'sus2', sus4: 'sus4', '6': '6th' };
  M.chordDegs = (root, ext) => SHAPES[ext].map((o) => root + o);
  M.isDim = (mode, root) => M.degSemis(mode, root + 4) - M.degSemis(mode, root) === 6;

  M.chordName = function (key, mode, root, ext) {
    const r = M.degSemis(mode, root);
    const third = M.degSemis(mode, root + 2) - r;
    const fifth = M.degSemis(mode, root + 4) - r;
    const sev = M.degSemis(mode, root + 6) - r;
    const n = M.spell(key, mode)[mod(key + r, 12)];
    const minor = third === 3, dim = fifth === 6;
    switch (ext) {
      case '7': return n + (dim ? 'm7♭5' : minor ? (sev === 10 ? 'm7' : 'm(maj7)') : sev === 11 ? 'maj7' : '7');
      case '9': return n + (dim ? 'm7♭5' : minor ? 'm9' : sev === 11 ? 'maj9' : '9');
      case 'add9': return n + (minor ? 'm' : '') + 'add9';
      case 'sus2': return n + 'sus2';
      case 'sus4': return n + 'sus4';
      case '6': return n + (minor ? 'm6' : '6');
      default: return n + (dim ? '°' : minor ? 'm' : '');
    }
  };
  M.roman = function (mode, root) {
    const R = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][mod(root, 7)];
    const r = M.degSemis(mode, root);
    const minor = M.degSemis(mode, root + 2) - r === 3;
    const dim = M.isDim(mode, root);
    return (minor ? R.toLowerCase() : R) + (dim ? '°' : '');
  };

  // Place pitch classes inside [lo,hi], choosing the arrangement closest to the previous voicing.
  // Options: span (widest voicing), open (root at the bottom, no seconds, a wide lowest
  // interval) and avoid (notes of another part to keep clear of).
  M.voiceChord = function (pcs, prev, lo, hi, o) {
    o = o || {};
    const span = o.span || 19;
    const opts = pcs.map((pc) => {
      const a = [];
      for (let m = lo; m <= hi; m++) if (mod(m, 12) === mod(pc, 12)) a.push(m);
      return a;
    });
    const center = (lo + hi) / 2;
    let best = null, bestScore = Infinity;
    const cur = [];
    (function rec(i) {
      if (i === opts.length) {
        const s = cur.slice().sort((a, b) => a - b);
        if (s[s.length - 1] - s[0] > span) return;
        if (o.open && mod(s[0] - pcs[0], 12)) return;
        let score = 0;
        for (let k = 1; k < s.length; k++) {
          if (s[k] === s[k - 1]) score += 100;
          if (s[k] - s[k - 1] <= 2 && s[k - 1] < 58) score += 4;
          if (o.open && s[k] - s[k - 1] <= 2) score += 8;
        }
        if (o.open && s[1] - s[0] < 7) score += 5;
        if (o.avoid) {
          for (const n of s) for (const a of o.avoid) { const d = Math.abs(n - a); if (d === 0) score += 3; else if (d <= 2) score += 5; }
        }
        if (prev && prev.length) {
          for (const n of s) {
            let d = Infinity;
            for (const p of prev) d = Math.min(d, Math.abs(n - p));
            score += d;
          }
        }
        score += Math.abs((s[0] + s[s.length - 1]) / 2 - center) * 0.35;
        if (score < bestScore) { bestScore = score; best = s; }
        return;
      }
      for (const m of opts[i]) { cur.push(m); rec(i + 1); cur.pop(); }
    })(0);
    return best || pcs.map((p) => lo + mod(p - lo, 12));
  };

  // Everything the engine needs to play one chord of the progression.
  M.buildChords = function (song) {
    const { key, mode, prog } = song;
    let prevPad = null, prevKeys = null, prevPadS = null, prevKeysS = null;
    const chords = prog.map((c) => ({ c }));
    // two passes so the first chord voice-leads from the last one (the loop is seamless)
    for (let pass = 0; pass < 2; pass++) {
      chords.forEach((ch, i) => {
        const { d, e } = ch.c;
        const degs = M.chordDegs(d, e);
        const pcs = degs.map((g) => key + M.degSemis(mode, g));
        const keyPcs = pcs.length >= 4 ? pcs.slice(1) : pcs; // rootless when it is rich enough
        ch.pad = M.voiceChord(pcs, prevPad, 50, 74);
        ch.keys = M.voiceChord(keyPcs, prevKeys, 56, 77);
        // When pad and keys play together they split the register: the pad drops to an open
        // root-fifth-tenth shell (plus the 7th) and the keys comp rootless above it.
        const shell = [0, 4, 2, 3, 1, 6].map((o) => degs.indexOf(d + o)).filter((i) => i >= 0).map((i) => pcs[i]);
        ch.padSplit = M.voiceChord(shell, prevPadS, 43, 67, { span: 24, open: true });
        ch.keysSplit = M.voiceChord(keyPcs, prevKeysS, 62, 81, { avoid: ch.padSplit });
        prevPad = ch.pad; prevKeys = ch.keys; prevPadS = ch.padSplit; prevKeysS = ch.keysSplit;
        ch.name = M.chordName(key, mode, d, e);
        ch.roman = M.roman(mode, d);
        ch.rootNorm = mod(d, 7) > 3 ? mod(d, 7) - 7 : mod(d, 7);
        let b = M.degMidi(key, mode, d, 2);
        while (b < 33) b += 12;
        while (b > 45) b -= 12;
        const bOff = b - M.degMidi(key, mode, d, 2);
        ch.bass = [0, 2, 4, 7].map((o) => M.degMidi(key, mode, d + o, 2) + bOff);
        // arp: chord tones stacked upward across octaves
        const n = degs.length;
        // sort so rows always rise in pitch (a 9th sits above the next octave's root otherwise)
        let arp = [];
        for (let k = 0; k < 16; k++) arp.push(M.degMidi(key, mode, degs[k % n] + 7 * Math.floor(k / n), 4));
        arp = [...new Set(arp)].sort((a, b) => a - b).slice(0, 8);
        while (arp[0] < 55) arp = arp.map((x) => x + 12);
        while (arp[0] > 66) arp = arp.map((x) => x - 12);
        ch.arp = arp;
      });
    }
    chords.forEach((ch, i) => {
      const next = chords[(i + 1) % chords.length];
      // approach tone: one scale step below the next chord's bass root
      let a = M.degMidi(key, mode, next.c.d - 1, 2);
      const target = next.bass[0];
      while (a > target) a -= 12;
      while (target - a > 6) a += 12;
      ch.bass[4] = a;
    });
    return chords;
  };

  // Instrument ranges. A part moves by whole octaves when most of what it can play sits
  // outside an instrument's range; single stray notes then fold back in by octaves.
  M.foldInto = function (m, range) {
    if (!range) return m;
    while (m > range[1]) m -= 12;
    while (m < range[0]) m += 12;
    return m > range[1] ? m - 12 : m; // a range narrower than an octave keeps the lower side
  };
  M.rangeShift = function (notes, range) {
    if (!range || !notes.length) return 0;
    const out = (k) => notes.filter((m) => m + k < range[0] || m + k > range[1]).length;
    let best = 0;
    for (const k of [-12, 12, -24, 24]) if (out(k) < out(best) - notes.length * 0.15) best = k;
    return best;
  };

  // Pad chords hold across bar lines. A hit on step 0 of a bar that does not bring new
  // harmony is a tie: the chord already sounding carries on. Every other hit retriggers.
  // Returns { tie, steps }: steps runs to the next harmony change or retriggering hit.
  M.padHold = function (grid, n, hr, chords) {
    const row = grid[0], len = row.length;
    const harmony = (bar) => { const { c } = chords[Math.floor(bar / hr) % chords.length]; return c.d + c.e; };
    const change = (bar) => bar % hr === 0 && (bar === 0 || harmony(bar) !== harmony(bar - 1));
    const tie = n % len === 0 && !change(Math.floor(n / len));
    const cap = len * hr * chords.length;
    let k = 1;
    for (; k < cap; k++) {
      const m = n + k, s = m % len;
      if (s === 0 && change(Math.floor(m / len))) break;
      if (row[s] && s !== 0) break;
    }
    return { tie, steps: k };
  };

  // Steps from `step` to the next onset in a grid, for note lengths.
  M.gridGap = function (grid, len, step, cap) {
    for (let k = 1; k <= cap; k++) {
      const s = (step + k) % len;
      for (const row of grid) if (row[s]) return k;
    }
    return cap;
  };

  // Octave shift that moves a part into an instrument's range, from every note it could play.
  M.partShift = function (song, chords, id, range) {
    const pool = [];
    for (const c of chords) {
      if (id === 'melody') for (let row = 0; row < 12; row++) pool.push(M.melodyMidi(song, c, row));
      else if (id === 'pad') pool.push(...c.pad, ...c.padSplit);
      else if (id === 'keys') pool.push(...c.keys, ...c.keysSplit);
      else pool.push(...c[id]);
    }
    return M.rangeShift(pool, range);
  };

  // The drum grid for a bar: the last bar of every 8 plays a fill (unless Vary is at zero,
  // which keeps the pattern exact). Seeded by song and bar, so every render agrees.
  M.drumGridAt = function (song, part, bar) {
    if (bar % 8 !== 7 || !part.vary) return part.grid;
    const style = (M.MOOD[song.mood] || M.MOODS[0]).styles.drums[0];
    return M.drumFill(part.grid, style, M.rng(song.seed + ':fill:' + bar));
  };

  // What one part plays on step n, shared by the engine and the MIDI export so they agree.
  // Returns hits { row, v, notes, steps, jitter, voicing }: `steps` is the note length in
  // steps, `notes` are already shifted and folded into the instrument's range.
  // Options: grid (drums: the bar's fill), split (pad and keys share the register), shift and
  // range (from M.partShift and the voice), ringing(voicing) (is that pad chord still
  // sounding, so a tie can let it carry on) and rand. With rand, Vary adds drops, ghost hats,
  // velocity spread, timing jitter and neighbour notes, drawing from rand in the same order
  // the engine always has; without it the written pattern comes out exactly.
  M.partStep = function (song, chords, id, n, o = {}) {
    const meta = M.PART[id], part = song.parts[id], hits = [];
    if (id === 'melody' && part.breathe && Math.floor(n / 32) % 2 === 1) return hits;
    const r = o.rand, vary = part.vary;
    const grid = o.grid || part.grid, step = n % meta.len;
    const chord = chords[Math.floor(Math.floor(n / 16) / song.hr) % chords.length];
    for (let row = 0; row < meta.rows; row++) {
      let v = grid[row][step];
      if (!v) {
        // Vary can add a ghost hat or shaker
        if (r && id === 'drums' && row >= 3 && step % 2 === 1 && r() < vary * 0.18) v = 0.18 + r() * 0.12;
        else continue;
      }
      if (r) {
        if (r() < vary * (id === 'pad' ? 0 : id === 'bass' ? 0.08 : 0.22) && step % 8 !== 0) continue;
        v = Math.max(0.1, Math.min(1, v * (0.9 + r() * 0.2)));
      }
      const jitter = r && id !== 'pad' ? (r() - 0.5) * 0.012 : 0;
      if (id === 'drums') { hits.push({ row, v, jitter }); continue; }
      let notes, steps, voicing;
      if (id === 'pad') {
        notes = o.split ? chord.padSplit : chord.pad;
        voicing = notes.join();
        const hold = M.padHold(part.grid, n, song.hr, chords);
        // a tie lets the sounding chord ring on, unless nothing (or a different voicing) is sounding
        if (hold.tie && o.ringing && o.ringing(voicing)) continue;
        steps = hold.steps;
      } else if (id === 'keys') {
        notes = o.split ? chord.keysSplit : chord.keys;
        steps = Math.min(8, M.gridGap(part.grid, 16, step, 16)) * 0.9;
      } else if (id === 'bass') {
        notes = [chord.bass[row]]; steps = M.gridGap(part.grid, 16, step, 16) * 0.92;
      } else if (id === 'arp') {
        let rr = row;
        if (r && r() < vary * 0.2) rr = Math.max(0, Math.min(7, row + (r() < 0.5 ? -1 : 1)));
        notes = [chord.arp[rr]]; steps = M.gridGap(part.grid, 16, step, 8);
      } else {
        let rr = row;
        if (r && step % 4 !== 0 && r() < vary * 0.2) rr = Math.max(0, Math.min(11, row + (r() < 0.5 ? -1 : 1)));
        notes = [M.melodyMidi(song, chord, rr)]; steps = Math.min(12, M.gridGap(part.grid, 32, step, 12)) * 0.95;
      }
      const sh = o.shift || 0;
      notes = notes.map((m) => M.foldInto(m + sh, o.range));
      hits.push({ row, v, notes, steps, jitter, voicing });
    }
    return hits;
  };

  M.melodyMidi = function (song, chord, row) {
    const off = row - 3;
    let deg = chord.rootNorm + off;
    if (song.penta) {
      const set = M.MODES[song.mode].penta;
      if (!set.includes(mod(deg, 7))) deg += off >= 0 ? 1 : -1;
      if (!set.includes(mod(deg, 7))) deg += off >= 0 ? 1 : -1;
    }
    // fold high keys down so the melody stays centred around E5 in every key
    return M.degMidi(song.key > 6 ? song.key - 12 : song.key, song.mode, deg, 5);
  };

  /* ---------- Parts ---------- */
  M.PARTS = [
    { id: 'pad',     name: 'Pad',     sub: 'chords',   rows: 1,  len: 16, mono: false, voices: ['strings_s', 'choir_s', 'velvet', 'glass', 'choir', 'strings', 'organ'] },
    { id: 'keys',    name: 'Keys',    sub: 'comping',  rows: 1,  len: 16, mono: false, voices: ['rhodes', 'grand', 'nylon', 'vibraphone', 'harp_s', 'marimba_s', 'epiano', 'vibes', 'harp', 'organ', 'pluck', 'marimba'] },
    { id: 'bass',    name: 'Bass',    sub: 'roots',    rows: 5,  len: 16, mono: true,  voices: ['acbass', 'fretless', 'upright', 'round', 'sub'] },
    { id: 'arp',     name: 'Arp',     sub: 'patterns', rows: 8,  len: 16, mono: true,  voices: ['vibraphone', 'celesta', 'grand', 'harp_s', 'marimba_s', 'kalimba_s', 'nylon', 'rhodes', 'bell', 'vibes', 'marimba', 'kalimba', 'glassbell', 'harp', 'pluck', 'epiano'] },
    { id: 'melody',  name: 'Melody',  sub: 'phrases',  rows: 12, len: 32, mono: true,  voices: ['flute_s', 'sax', 'grand', 'vibraphone', 'rhodes', 'celesta', 'kalimba_s', 'marimba_s', 'nylon', 'harp_s', 'strings_s', 'flute', 'softlead', 'vibes', 'kalimba', 'bell', 'glassbell', 'epiano', 'marimba', 'harp'] },
    { id: 'drums',   name: 'Drums',   sub: 'soft kit', rows: 5,  len: 16, mono: false, voices: ['kit'] },
    { id: 'texture', name: 'Texture', sub: 'ambience', rows: 0,  len: 0,  mono: false, voices: ['rain', 'vinyl', 'ocean', 'wind', 'crickets', 'none'] },
  ];
  // Swapping between recorded instruments and their synthesized counterparts.
  M.TO_SYNTH = { grand: 'epiano', rhodes: 'epiano', vibraphone: 'vibes', marimba_s: 'marimba', kalimba_s: 'kalimba', celesta: 'glassbell', harp_s: 'harp', nylon: 'pluck', flute_s: 'flute', sax: 'softlead', strings_s: 'strings', choir_s: 'choir', acbass: 'upright', fretless: 'round' };
  M.TO_REAL = { epiano: 'rhodes', vibes: 'vibraphone', marimba: 'marimba_s', kalimba: 'kalimba_s', glassbell: 'celesta', bell: 'celesta', harp: 'harp_s', pluck: 'nylon', flute: 'flute_s', softlead: 'flute_s', strings: 'strings_s', choir: 'choir_s', upright: 'acbass', round: 'fretless' };
  M.setInstrumentFamily = function (song, real) {
    const map = real ? M.TO_REAL : M.TO_SYNTH;
    for (const [id, p] of Object.entries(song.parts)) {
      const to = map[p.voice];
      if (to && M.PART[id].voices.includes(to)) p.voice = to;
    }
  };
  M.PART = Object.fromEntries(M.PARTS.map((p) => [p.id, p]));
  M.DRUM_ROWS = ['Kick', 'Brush', 'Rim', 'Hat', 'Shaker'];

  /* ---------- Moods ("floors") ---------- */
  M.MOODS = [
    { id: 'night', floor: 'B', name: 'Night Shift', blurb: 'Dim lamps, warm pads and lo-fi keys for late study.',
      tempo: [68, 78], swing: [0.08, 0.16], modes: { aeolian: 3, dorian: 3 }, ext: { '9': 3, '7': 3, add9: 1 },
      hr: { 1: 2, 2: 1 }, len: { 4: 3, 8: 1 }, penta: true, jazz: 0,
      voices: { pad: 'velvet', keys: ['rhodes', 'grand'], bass: ['fretless', 'acbass'], arp: ['harp_s', 'nylon', 'celesta'], melody: ['grand', 'rhodes', 'flute_s'], texture: 'vinyl' },
      styles: { keys: ['lofi', 'whole', 'charleston'], bass: ['lofi', 'rootfifth', 'sway'], arp: ['sparse', 'updown', 'broken'], drums: ['lofi'] },
      melody: 0.4, off: [], fx: { space: 0.5, echo: 0.35, warmth: 0.45 }, hue: [205, 250, 30] },
    { id: 'lobby', floor: 'L', name: 'Lobby', blurb: 'Velvet elevator lounge with bossa brushes and vibraphone.',
      tempo: [90, 104], swing: [0.06, 0.14], modes: { ionian: 4, lydian: 1, dorian: 1 }, ext: { '9': 3, '7': 3, '6': 1 },
      hr: { 1: 1 }, len: { 4: 3, 8: 1 }, penta: false, jazz: 0.65,
      voices: { pad: 'strings_s', keys: ['rhodes', 'nylon', 'grand'], bass: 'acbass', arp: ['vibraphone', 'celesta'], melody: ['flute_s', 'sax', 'vibraphone'], texture: 'none' },
      styles: { keys: ['bossa', 'charleston', 'half'], bass: ['bossa', 'walk'], arp: ['sparse', 'broken'], drums: ['bossa'] },
      melody: 0.6, off: [], fx: { space: 0.4, echo: 0.2, warmth: 0.6 }, hue: [38, 190, 330] },
    { id: 'cafe', floor: 'M', name: 'Mezzanine Café', blurb: 'Sunday-morning marimba, kalimba and a light shaker.',
      tempo: [84, 96], swing: [0, 0.08], modes: { ionian: 3, mixolydian: 2, lydian: 1 }, ext: { add9: 3, triad: 2, '7': 1, '6': 1 },
      hr: { 1: 2, 2: 1 }, len: { 4: 3, 8: 1 }, penta: true, jazz: 0.2,
      voices: { pad: ['glass', 'strings_s'], keys: ['nylon', 'grand'], bass: 'acbass', arp: ['marimba_s', 'harp_s'], melody: ['kalimba_s', 'celesta', 'flute_s'], texture: 'none' },
      styles: { keys: ['half', 'sway', 'whole'], bass: ['rootfifth', 'pulse', 'sway'], arp: ['up', 'broken', 'pendulum'], drums: ['soft'] },
      melody: 0.55, off: [], fx: { space: 0.4, echo: 0.25, warmth: 0.7 }, hue: [45, 150, 15] },
    { id: 'rain', floor: '2', name: 'Library Rain', blurb: 'Rhodes chords and soft drums under a rainy window.',
      tempo: [72, 84], swing: [0.1, 0.18], modes: { dorian: 3, aeolian: 2, ionian: 1 }, ext: { '9': 3, '7': 3 },
      hr: { 1: 2, 2: 1 }, len: { 4: 3, 8: 1 }, penta: true, jazz: 0.3,
      voices: { pad: 'velvet', keys: ['rhodes', 'grand'], bass: ['acbass', 'fretless'], arp: ['celesta', 'vibraphone', 'harp_s'], melody: ['grand', 'rhodes', 'flute_s'], texture: 'rain' },
      styles: { keys: ['lofi', 'charleston', 'half'], bass: ['lofi', 'sway'], arp: ['sparse', 'updown'], drums: ['lofi'] },
      melody: 0.45, off: [], fx: { space: 0.45, echo: 0.3, warmth: 0.5 }, hue: [215, 180, 260] },
    { id: 'focus', floor: '3', name: 'Deep Focus', blurb: 'Slow glass pads and sparse bells. Nothing to distract you.',
      tempo: [64, 74], swing: [0, 0.04], modes: { ionian: 2, lydian: 3 }, ext: { add9: 3, sus2: 2, '7': 1 },
      hr: { 2: 3, 1: 1 }, len: { 4: 3, 2: 1 }, penta: true, jazz: 0,
      voices: { pad: ['glass', 'strings_s'], keys: 'grand', bass: 'sub', arp: ['grand', 'celesta', 'harp_s'], melody: ['flute_s', 'grand'], texture: 'none' },
      styles: { keys: ['whole'], bass: ['drone'], arp: ['sparse', 'pendulum'], drums: ['soft'] },
      melody: 0.25, off: ['keys', 'drums'], fx: { space: 0.6, echo: 0.4, warmth: 0.55 }, hue: [175, 220, 140] },
    { id: 'tea', floor: '4', name: 'Tea Garden', blurb: 'Pentatonic kalimba and flute drifting on a breeze.',
      tempo: [66, 78], swing: [0, 0.06], modes: { ionian: 2, dorian: 2, aeolian: 1 }, ext: { add9: 2, sus2: 2, triad: 2 },
      hr: { 1: 1, 2: 2 }, len: { 4: 3, 2: 1 }, penta: true, jazz: 0,
      voices: { pad: 'choir_s', keys: 'harp_s', bass: 'fretless', arp: ['kalimba_s', 'harp_s'], melody: ['flute_s', 'kalimba_s'], texture: 'wind' },
      styles: { keys: ['whole', 'half'], bass: ['drone', 'sway'], arp: ['pendulum', 'sparse', 'up'], drums: ['soft'] },
      melody: 0.4, off: ['keys', 'drums'], fx: { space: 0.55, echo: 0.35, warmth: 0.65 }, hue: [95, 160, 40] },
    { id: 'cloud', floor: '5', name: 'Cloud Room', blurb: 'Weightless choir pads, long echoes and ocean air.',
      tempo: [56, 66], swing: [0, 0.03], modes: { lydian: 3, ionian: 2 }, ext: { add9: 3, '7': 2, sus2: 2 },
      hr: { 2: 1 }, len: { 4: 2, 2: 1 }, penta: true, jazz: 0,
      voices: { pad: ['choir_s', 'glass'], keys: 'rhodes', bass: 'sub', arp: ['celesta', 'vibraphone'], melody: ['vibraphone', 'grand', 'celesta'], texture: 'ocean' },
      styles: { keys: ['whole'], bass: ['drone'], arp: ['sparse', 'pendulum'], drums: ['soft'] },
      melody: 0.2, off: ['keys', 'drums'], fx: { space: 0.75, echo: 0.5, warmth: 0.5 }, hue: [195, 280, 210] },
    { id: 'roof', floor: 'R', name: 'Rooftop Stars', blurb: 'Lydian shimmer and crickets under a clear night sky.',
      tempo: [58, 68], swing: [0, 0.05], modes: { lydian: 4, mixolydian: 1 }, ext: { '7': 2, add9: 3, '9': 1 },
      hr: { 2: 2, 1: 1 }, len: { 4: 3, 2: 1 }, penta: false, jazz: 0,
      voices: { pad: 'strings_s', keys: 'vibraphone', bass: ['sub', 'fretless'], arp: ['harp_s', 'celesta'], melody: ['grand', 'flute_s'], texture: 'crickets' },
      styles: { keys: ['whole', 'half'], bass: ['drone', 'rootfifth'], arp: ['up', 'sparse', 'pendulum'], drums: ['soft'] },
      melody: 0.3, off: ['drums'], fx: { space: 0.65, echo: 0.45, warmth: 0.55 }, hue: [240, 290, 50] },
  ];
  M.MOOD = Object.fromEntries(M.MOODS.map((m) => [m.id, m]));

  /* ---------- Generators ---------- */
  const grid = (rows, len) => Array.from({ length: rows }, () => new Array(len).fill(0));
  const vel = (r, base) => Math.min(1, Math.max(0.2, base + r.float(-0.08, 0.08)));

  // Functional-harmony transition weights between scale degrees.
  const NEXT = {
    0: { 3: 4, 4: 3, 5: 3, 1: 2, 2: 1.5, 6: 0.8 },
    1: { 4: 5, 3: 1.5, 2: 1, 0: 0.6, 6: 0.5 },
    2: { 5: 4, 3: 3, 1: 1.5 },
    3: { 4: 3, 0: 3, 1: 2, 2: 1, 5: 1 },
    4: { 0: 5, 5: 3, 3: 1.5, 2: 0.6 },
    5: { 1: 3, 3: 4, 4: 2, 2: 1, 0: 0.6 },
    6: { 0: 4, 2: 2, 5: 1, 3: 1 },
  };
  const JAZZ = [[1, 4, 0, 0], [0, 5, 1, 4], [2, 5, 1, 4], [0, 3, 2, 5], [1, 4, 2, 5], [0, 1, 2, 3], [3, 2, 1, 4], [0, 5, 3, 4]];

  M.genProgression = function (r, mood, mode) {
    const lenOpts = mood.len;
    const L = +r.weighted(lenOpts);
    const color = M.MODES[mode].color;
    const ok = (d) => !M.isDim(mode, d);
    if (mode === 'ionian' && r.chance(mood.jazz) && L >= 4) {
      const base = r.pick(JAZZ).slice();
      const p = L === 8 ? base.concat(r.pick(JAZZ)) : base;
      if (p.every(ok)) return p;
    }
    let best = null, bestScore = -Infinity;
    for (let attempt = 0; attempt < 40; attempt++) {
      const p = [r.chance(0.8) ? 0 : r.pick([3, 5].filter(ok))];
      while (p.length < L) {
        const w = Object.assign({}, NEXT[p[p.length - 1]]);
        for (const k of Object.keys(w)) if (!ok(+k)) delete w[k];
        if (w[color] !== undefined) w[color] *= 1.8; else if (ok(color)) w[color] = 1.5;
        if (p[p.length - 1] === color && ok(0)) w[0] = (w[0] || 0) + 3;
        p.push(+r.weighted(w));
      }
      let s = r.next();
      const back = NEXT[p[L - 1]][p[0]] || 0;
      s += back;
      s += new Set(p).size * 0.8;
      for (let i = 1; i < L; i++) if (p[i] === p[i - 1]) s -= 2;
      if (p.includes(color)) s += 1;
      if (s > bestScore) { bestScore = s; best = p; }
    }
    return best;
  };

  M.pickExt = function (r, mood, mode, d) {
    let e = r.weighted(mood.ext);
    if (M.isDim(mode, d) && (e === '9' || e === '6')) e = '7';
    return e;
  };

  const KEYS = { whole: [0], half: [0, 8], charleston: [0, 6], bossa: [0, 3, 6, 10, 13], lofi: [0, 7, 10], sway: [2, 8], pulse: [0, 4, 8, 12] };
  const BASS = {
    drone: [[0, 0]], rootfifth: [[0, 0], [8, 2]], bossa: [[0, 0], [6, 2], [8, 2], [14, 0]],
    walk: [[0, 0], [4, 1], [8, 2], [12, 4]], lofi: [[0, 0], [7, 0], [10, 3], [14, 2]],
    pulse: [[0, 0], [8, 0]], sway: [[0, 0], [10, 2]],
  };
  const DRUMS = {
    bossa: ['7.....5.7.....5.', '....4.......4...', '6..6..6...6..6..', '................', '3.2.3.2.3.2.3.2.'],
    lofi:  ['8......6..7.....', '....7.......7...', '................', '4.3.4.3.4.3.4.3.', '................'],
    soft:  ['6.......5.......', '................', '............4...', '................', '2.2.3.2.2.2.3.2.'],
  };

  M.gen = {
    pad(r) {
      const g = grid(1, 16);
      g[0][0] = 0.8;
      return g;
    },
    keys(r, mood) {
      const g = grid(1, 16);
      const style = r.pick(mood.styles.keys);
      KEYS[style].forEach((s, i) => (g[0][s] = vel(r, i === 0 ? 0.75 : 0.6)));
      return g;
    },
    bass(r, mood) {
      const g = grid(5, 16);
      const style = r.pick(mood.styles.bass);
      BASS[style].forEach(([s, row], i) => (g[row][s] = vel(r, i === 0 ? 0.85 : 0.65)));
      return g;
    },
    arp(r, mood) {
      const g = grid(8, 16);
      const style = r.pick(mood.styles.arp);
      const used = r.int(4, 6);
      const seqs = {
        up: [...Array(used).keys()],
        updown: [...Array(used).keys()].concat([...Array(used - 2).keys()].map((k) => used - 2 - k)),
        broken: [0, 2, 1, 3, 2, 4, 3, 5],
        pendulum: [0, 3, 1, 4, 2, 5],
        sparse: null,
      };
      const rate = style === 'sparse' ? 2 : r.pick([2, 2, 4]);
      const base = r.int(0, 2);
      let k = 0;
      for (let s = 0; s < 16; s += rate) {
        let row;
        if (style === 'sparse') {
          if (!r.chance(s % 4 === 0 ? 0.45 : 0.22)) continue;
          row = r.int(1, 6);
        } else {
          row = seqs[style][k++ % seqs[style].length] + base;
          if (r.chance(0.08)) continue;
        }
        g[Math.min(7, row)][s] = vel(r, s % 4 === 0 ? 0.7 : 0.55);
      }
      return g;
    },
    // A 2-bar call and answer with an arch: it rises to one clear peak, falls back to land on a
    // chord tone, and the answer settles early so its last note rings. Rows are offsets from the
    // chord root (−3..+8), so the line follows the harmony.
    melody(r, mood) {
      const g = grid(12, 32);
      const dens = mood.melody;
      const cells = { q: 3, ee: 3 * dens, rest: 2.4 * (1 - dens) + 0.4, off: 1, dot: dens * 1.2, trip: dens * 0.35 };
      const CELL = { q: [0], ee: [0, 2], rest: [], off: [2], dot: [0, 3], trip: [0, 1, 2] };
      const barRhythm = (answer) => {
        const on = [];
        const last = answer ? (r.chance(0.35) ? 1 : 2) : 3; // the answer's final beat
        for (let b = 0; b <= last; b++) {
          let c = r.weighted(cells);
          if (answer && b === last) c = r.pick(['q', 'q', 'off']);
          CELL[c].forEach((o) => on.push(b * 4 + o));
        }
        if (!on.includes(0) && on.length < 2) on.push(0);
        if (on.length < 2) on.push(8);
        return [...new Set(on)].sort((a, b) => a - b);
      };
      // a breath before a strong beat: clear the notes just ahead of it
      const breathe = (on, beat) => {
        const keep = on.filter((s) => s < beat - 2 || s >= beat);
        return keep.length >= 2 && keep.length < on.length ? keep : on;
      };
      const CT = [-3, 0, 2, 4, 7];
      const nearestCT = (x) => CT.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
      const clamp = (x) => Math.max(-3, Math.min(8, x));
      // Pitches for a rhythm: follow a line from start up to the peak and down to the end.
      const contour = (steps, start, end) => {
        const N = steps.length;
        const peak = r.pick(CT.filter((x) => x >= Math.max(4, start + 2) && x > end));
        const mid = [];
        for (let i = 1; i < N - 1; i++) if (i >= N * 0.3 && i <= N * 0.75) mid.push(i);
        const strong = mid.filter((i) => steps[i] % 4 === 0);
        const pk = N < 3 ? N - 1 : r.pick(strong.length ? strong : mid.length ? mid : [1]);
        let cur = start;
        return steps.map((s, i) => {
          if (i === pk) return (cur = peak);
          if (i > 0) {
            const tgt = i < pk ? start + ((peak - start) * i) / pk : peak + ((end - peak) * (i - pk)) / (N - 1 - pk);
            let mv = Math.round(tgt - cur) + (r.chance(0.3) ? r.pick([-1, 1]) : 0);
            cur = clamp(cur + Math.max(-3, Math.min(3, mv)));
          }
          if (s % 4 === 0 && r.chance(0.8)) cur = nearestCT(cur);
          if (cur >= peak) cur = s % 4 === 0 ? CT[CT.indexOf(peak) - 1] : peak - 1;
          return cur;
        });
      };
      let rA = barRhythm(false);
      if (r.chance(0.45)) rA = breathe(rA, 16);
      else if (r.chance(0.3)) rA = breathe(rA, 8);
      const start = r.pick([0, 2, 4, 2]);
      const land = r.pick([0, 0, 2, 4]);
      let rB, pA, pB;
      if (r.chance(0.55)) {
        // sequence: bar B echoes bar A's opening a step or two lower, then resolves
        pA = contour(rA, start, r.pick([0, 2]));
        const shift = r.pick([-1, -2, -1]);
        rB = rA.filter((s) => s < 10);
        pB = pA.slice(0, rB.length).map((p, i) => (rB[i] === 0 ? nearestCT(p + shift) : clamp(p + shift)));
        if (!rB.length || rB[rB.length - 1] < 8) { rB.push(8); pB.push(0); }
      } else {
        rB = barRhythm(true);
        const all = contour(rA.concat(rB.map((s) => s + 16)), start, land);
        pA = all.slice(0, rA.length);
        pB = all.slice(rA.length);
      }
      const top = Math.max(...pA, ...pB.slice(0, -1));
      pB[pB.length - 1] = land < top ? land : 0; // land the phrase on a chord tone, below the peak
      rA.forEach((s, i) => (g[pA[i] + 3][s] = vel(r, (s % 4 === 0 ? 0.78 : 0.6) + (pA[i] === top ? 0.06 : 0))));
      rB.forEach((s, i) => (g[pB[i] + 3][16 + s] = vel(r, (s % 4 === 0 ? 0.74 : 0.56) - (i === rB.length - 1 ? 0.06 : 0))));
      return g;
    },
    drums(r, mood) {
      const style = r.pick(mood.styles.drums);
      const g = DRUMS[style].map((row) => row.split('').map((c) => (c === '.' ? 0 : +c / 9)));
      // a little seeded personality
      for (let s = 0; s < 16; s++) {
        if (s % 2 === 1 && r.chance(0.12)) g[4][s] = r.float(0.15, 0.25);
        if (g[3][s] && r.chance(0.15)) g[3][s] = 0;
      }
      if (r.chance(0.4)) g[2][r.pick([7, 11, 15])] = 0.35;
      return g;
    },
  };

  // A gentle fill for the last bar of each 8, built from the pattern in play. Only the second
  // half-bar changes: a brush swell, rim pickups into the downbeat, or the kick dropping out.
  const FILLS = {
    bossa: { swell: 2, pickup: 2, drop: 1 },
    lofi: { drop: 2, swell: 2, pickup: 1 },
    soft: { pickup: 2, swell: 1, drop: 1 },
  };
  M.drumFill = function (grid, style, r) {
    const g = grid.map((row) => row.slice());
    const level = (row, dflt) => { const hits = g[row].filter(Boolean); return hits.length ? Math.max(...hits) : dflt; };
    const kind = r.weighted(FILLS[style] || FILLS.soft);
    const drop = kind === 'drop' || r.chance(0.3);
    if (kind === 'swell') {
      const lv = level(1, 0.5);
      for (let s = 12; s < 16; s++) g[1][s] = Math.max(g[1][s], lv * (0.35 + 0.13 * (s - 12)));
      for (let s = 13; s < 16; s++) g[3][s] = 0;
    } else if (kind === 'pickup') {
      const lv = level(2, 0.55);
      g[2][r.pick([12, 13])] = 0;
      g[2][14] = lv * 0.5; g[2][15] = lv * 0.65;
    }
    if (drop) {
      for (let s = 8; s < 16; s++) g[0][s] = 0;
      for (const row of [3, 4]) for (const s of [14, 15]) g[row][s] *= 0.6;
    }
    return g;
  };

  /* ---------- Song ---------- */
  const ADJ = ['Velvet', 'Quiet', 'Amber', 'Slow', 'Paper', 'Silver', 'Linen', 'Hushed', 'Gentle', 'Golden', 'Misty', 'Soft', 'Hollow', 'Lantern', 'Cedar', 'Opal', 'Moss', 'Indigo', 'Pale', 'Distant', 'Warm', 'Still', 'Copper', 'Glass', 'Lunar', 'Patient', 'Sleepy', 'Woolen', 'Tidal', 'Faded'];
  const NOUN = ['Atrium', 'Elevator', 'Corridor', 'Reading Room', 'Harbor', 'Arcade', 'Greenhouse', 'Stairwell', 'Observatory', 'Courtyard', 'Archive', 'Terrace', 'Window', 'Afternoon', 'Tram', 'Ferry', 'Garden', 'Study', 'Landing', 'Gallery', 'Balcony', 'Conservatory', 'Hallway', 'Pavilion', 'Platform', 'Veranda', 'Library', 'Lounge', 'Skylight', 'Foyer'];

  M.titleFor = (seed) => {
    const r = M.rng('title:' + seed);
    return r.pick(ADJ) + ' ' + r.pick(NOUN);
  };

  M.generateSong = function (seed, moodId) {
    const mood = M.MOOD[moodId] || M.MOODS[0];
    const r = M.rng(seed + ':' + mood.id);
    const mode = r.weighted(mood.modes);
    const key = r.int(0, 11);
    const degs = M.genProgression(r, mood, mode);
    const song = {
      v: 1, seed, mood: mood.id, title: M.titleFor(seed), key, mode,
      tempo: r.int(mood.tempo[0], mood.tempo[1]),
      swing: +r.float(mood.swing[0], mood.swing[1]).toFixed(2),
      hr: +r.weighted(mood.hr),
      penta: mood.penta,
      prog: degs.map((d) => ({ d, e: M.pickExt(r, mood, mode, d) })),
      fx: Object.assign({}, mood.fx),
      parts: {},
      edited: false,
    };
    // 8-chord progressions run at one bar per chord so loops stay a sensible length
    if (song.prog.length > 4) song.hr = 1;
    const vr = M.rng(seed + ':' + mood.id + ':voices');
    for (const p of M.PARTS) {
      const mv = mood.voices[p.id];
      const part = { voice: (Array.isArray(mv) ? vr.pick(mv) : mv) || p.voices[0], on: !mood.off.includes(p.id), vol: 0.75, vary: 0.25, solo: false };
      if (p.id === 'texture') { part.vol = 0.5; part.on = mood.voices.texture !== 'none'; if (!part.on) part.voice = 'rain'; }
      if (p.id === 'drums') { part.vol = 0.6; part.voice = 'kit'; }
      if (p.id === 'melody') part.breathe = true;
      if (M.gen[p.id]) part.grid = M.gen[p.id](M.rng(seed + ':' + mood.id + ':' + p.id), mood);
      song.parts[p.id] = part;
    }
    // keep the melody's instrument distinct from the arp and keys
    const mv = mood.voices.melody;
    if (Array.isArray(mv) && [song.parts.arp.voice, song.parts.keys.voice].includes(song.parts.melody.voice)) {
      const alt = mv.find((v) => v !== song.parts.arp.voice && v !== song.parts.keys.voice);
      if (alt) song.parts.melody.voice = alt;
    }
    return song;
  };

  M.regenPart = function (song, id) {
    const mood = M.MOOD[song.mood];
    song.parts[id].grid = M.gen[id](M.rng(M.newSeed()), mood);
    song.edited = true;
  };

  M.regenProgression = function (song) {
    const mood = M.MOOD[song.mood];
    const r = M.rng(M.newSeed());
    const degs = M.genProgression(r, mood, song.mode);
    song.prog = degs.map((d) => ({ d, e: M.pickExt(r, mood, song.mode, d) }));
    song.edited = true;
  };

  // Gentle mutations used by Evolve so the music keeps changing without losing its identity.
  M.varyMelody = function (song) {
    const g = song.parts.melody.grid;
    const r = M.rng(M.newSeed());
    const kind = r.weighted({ repitch: 3, shiftBar: 2, rebar: 2, fresh: 1 });
    const notes = [];
    for (let s = 0; s < 32; s++) for (let row = 0; row < 12; row++) if (g[row][s]) notes.push([row, s]);
    if (kind === 'fresh' || notes.length < 3) {
      song.parts.melody.grid = M.gen.melody(r, M.MOOD[song.mood]);
      return 'new melody';
    }
    if (kind === 'repitch') {
      for (let k = 0; k < 3; k++) {
        const [row, s] = r.pick(notes);
        if (!g[row][s]) continue;
        const to = Math.max(0, Math.min(11, row + r.pick([-2, -1, 1, 2])));
        g[to][s] = g[row][s]; if (to !== row) g[row][s] = 0;
      }
      return 'melody reshaped';
    }
    if (kind === 'shiftBar') {
      const d = r.pick([-1, 1]);
      const startBar = r.pick([0, 16]);
      const moved = [];
      for (let s = startBar; s < startBar + 16; s++) for (let row = 0; row < 12; row++) if (g[row][s]) { moved.push([row, s, g[row][s]]); g[row][s] = 0; }
      moved.forEach(([row, s, v]) => (g[Math.max(0, Math.min(11, row + d))][s] = v));
      return 'melody sequenced ' + (d > 0 ? 'up' : 'down');
    }
    const fresh = M.gen.melody(r, M.MOOD[song.mood]);
    for (let row = 0; row < 12; row++) for (let s = 16; s < 32; s++) g[row][s] = fresh[row][s];
    return 'new answer phrase';
  };

  /* ---------- Song codes (copy/paste sharing) ---------- */
  M.encodeSong = function (song) {
    if (!song.edited) return song.mood + '.' + song.seed;
    const c = {
      v: 1, s: song.seed, m: song.mood, t: song.title, k: song.key, o: song.mode, b: song.tempo, w: song.swing, h: song.hr,
      pn: song.penta ? 1 : 0, p: song.prog.map((c) => c.d + ':' + c.e).join(','), f: song.fx, P: {},
    };
    for (const [id, p] of Object.entries(song.parts)) {
      c.P[id] = { v: p.voice, o: p.on ? 1 : 0, l: +p.vol.toFixed(2), y: +p.vary.toFixed(2), br: p.breathe ? 1 : 0,
        g: p.grid ? p.grid.map((row) => row.map((x) => (x ? Math.max(1, Math.round(x * 9)) : '.')).join('')) : undefined };
    }
    const json = JSON.stringify(c);
    return 'MZ1' + btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  M.decodeSong = function (code) {
    code = (code || '').trim();
    const short = code.match(/^([a-z]+)\.([a-z0-9]+)$/i);
    if (short && M.MOOD[short[1]]) return M.generateSong(short[2], short[1]);
    if (!code.startsWith('MZ1')) throw new Error('Song codes start with a floor name (like lobby.ab12c) or MZ1.');
    const b64 = code.slice(3).replace(/-/g, '+').replace(/_/g, '/');
    const c = JSON.parse(decodeURIComponent(escape(atob(b64))));
    const song = M.generateSong(c.s, c.m);
    Object.assign(song, { title: c.t, key: c.k, mode: c.o, tempo: c.b, swing: c.w, hr: c.h, penta: !!c.pn, fx: c.f, edited: true });
    song.prog = c.p.split(',').map((x) => { const [d, e] = x.split(':'); return { d: +d, e }; });
    for (const [id, p] of Object.entries(c.P)) {
      const part = song.parts[id];
      if (!part) continue;
      Object.assign(part, { voice: p.v, on: !!p.o, vol: p.l, vary: p.y, breathe: !!p.br });
      if (p.g) part.grid = p.g.map((row) => row.split('').map((ch) => (ch === '.' ? 0 : +ch / 9)));
    }
    return song;
  };

  /* ---------- Song links ---------- */
  // A link is the page's address with the song code as its #fragment. Codes are bare tokens
  // (letters, digits, '.', '-', '_'), the only fragments the Claude artifact viewer passes on.
  M.songLink = (base, song) => String(base).split('#')[0] + '#' + M.encodeSong(song);
  // Reads a song from a whole link, a #fragment or a bare code. Throws like decodeSong.
  M.songFromLink = function (text) {
    let code = String(text || '');
    if (code.includes('#')) code = code.slice(code.indexOf('#') + 1);
    try { code = decodeURIComponent(code); } catch (e) {}
    return M.decodeSong(code);
  };
})();
