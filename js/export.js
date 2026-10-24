/* Mezzanine — export formats: song to MIDI notes, Standard MIDI File writer, 16-bit WAV encoding.
   Pure: no DOM and no Web Audio, so it runs in Node tests. */
(function () {
  const M = (window.M = window.M || {});

  const PPQ = 480; // ticks per quarter note; a sixteenth is 120

  // General MIDI programs (0-based) for each voice, so a DAW opens with sensible sounds.
  M.GM_PROGRAM = {
    velvet: 89, glass: 88, choir: 91, strings: 50, organ: 16,
    epiano: 4, vibes: 11, bell: 14, glassbell: 9, marimba: 12, kalimba: 108, harp: 46, pluck: 25,
    flute: 73, softlead: 80, upright: 32, round: 33, sub: 38,
    grand: 0, rhodes: 4, vibraphone: 11, marimba_s: 12, kalimba_s: 108, celesta: 8, harp_s: 46, nylon: 24,
    flute_s: 73, sax: 65, strings_s: 48, choir_s: 52, acbass: 32, fretless: 35,
  };
  // Drum rows (Kick, Brush, Rim, Hat, Shaker) on the GM percussion map.
  M.GM_DRUMS = [36, 38, 37, 42, 82];
  const CHANNEL = { pad: 0, keys: 1, bass: 2, arp: 3, melody: 4, drums: 9 };

  // Tick of step n: swing pushes every odd sixteenth late, as Engine.stepDur does.
  function stepTick(n, swing) {
    const sw = Math.min(0.35, swing);
    return Math.floor(n / 2) * 240 + (n % 2 ? Math.round(120 * (1 + sw)) : 0);
  }
  function audible(song, id) {
    const p = song.parts[id];
    const anySolo = Object.values(song.parts).some((x) => x.solo);
    return p.on && (!anySolo || p.solo);
  }

  // Notes for `bars` bars of the song. M.partStep decides every note, as it does for the
  // engine, so pad ties, the pad/keys register split, instrument ranges and drum fills match
  // what plays live. Without `rand` the written pattern comes out exactly; with one, Vary adds
  // the same drops, ghost hats and neighbour notes the live engine plays.
  M.songNotes = function (song, { bars = 32, rand = null } = {}) {
    const chords = M.buildChords(song);
    // octave shifts come from theme and bridge chords together, as the engine works them out
    const pool = chords.concat(M.buildChords(song, song.progB || song.prog));
    const voice = (p) => (M.VOICES && M.VOICES[p.voice]) || {};
    const tracks = {};
    for (const meta of M.PARTS) {
      if (!meta.len || !audible(song, meta.id)) continue;
      const p = song.parts[meta.id], drums = meta.id === 'drums';
      tracks[meta.id] = {
        id: meta.id, name: meta.name + (drums ? '' : ' · ' + (voice(p).label || p.voice)),
        channel: CHANNEL[meta.id], program: drums ? null : M.GM_PROGRAM[p.voice] || 0,
        volume: Math.round(Math.min(1, p.vol) * 127), notes: [],
        bright: p.bright == null ? null : Math.round(M.brightOf(p) * 127), // CC74, only once the listener set one
        range: voice(p).range, shift: drums ? 0 : M.partShift(song, pool, meta.id, voice(p).range),
      };
    }
    const split = !!(tracks.pad && tracks.keys);
    const total = bars * 16;
    const end = stepTick(total, song.swing);
    const tick = (n) => stepTick(n, song.swing);
    const strum = Math.round(0.006 * song.tempo * PPQ / 60); // keys roll by about 6 ms per note
    let held = null; // the pad chord sounding: { until (step), voicing }
    const ringing = (n) => (voicing) => held && held.until > n && held.voicing === voicing;
    for (let n = 0; n < total; n++) {
      const t = tick(n), bar = Math.floor(n / 16);
      for (const id of Object.keys(tracks)) {
        const part = song.parts[id], tr = tracks[id];
        const hits = M.partStep(song, chords, id, n, {
          rand, split, ringing: ringing(n), shift: tr.shift, range: tr.range,
          grid: id === 'drums' ? M.drumGridAt(song, part, bar) : null,
        });
        for (const { row, v, notes, steps, voicing } of hits) {
          const vel = Math.max(1, Math.min(127, Math.round(v * 127)));
          if (id === 'drums') { tr.notes.push({ tick: t, dur: 60, midi: M.GM_DRUMS[row], vel }); continue; }
          const whole = Math.max(1, Math.ceil(steps));
          const dur = Math.max(1, Math.round((tick(n + whole) - t) * (steps / whole)));
          if (id === 'pad') held = { until: n + whole, voicing };
          notes.forEach((m, i) => {
            const at = id === 'keys' ? t + i * strum : t;
            tr.notes.push({ tick: at, dur: Math.max(1, Math.min(dur, end - at)), midi: m, vel });
          });
        }
      }
    }
    const out = Object.values(tracks).map(({ range, shift, ...tr }) => tr);
    return { ppq: PPQ, tempo: song.tempo, key: song.key, mode: song.mode, title: song.title, bars, end, tracks: out };
  };

  // Key signature for FF 59: sharps (+) or flats (−) of the tonic's major or minor key.
  const MAJOR_SF = [0, -5, 2, -3, 4, -1, -6, 1, -4, 3, -2, 5];
  M.keySignature = function (key, mode) {
    const minor = mode === 'aeolian' || mode === 'dorian';
    return { sf: MAJOR_SF[M.mod(key + (minor ? 3 : 0), 12)], minor };
  };

  function vlq(n) {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  }
  const ascii = (s) => Array.from(unescape(encodeURIComponent(s)), (c) => c.charCodeAt(0));
  function chunk(type, bytes) {
    const n = bytes.length;
    return [...ascii(type), (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].concat(bytes);
  }
  // Timed events -> track bytes with delta times and an end-of-track marker.
  function trackBytes(events, endTick) {
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const out = [];
    let last = 0;
    for (const e of events) { out.push(...vlq(e.tick - last), ...e.bytes); last = e.tick; }
    out.push(...vlq(Math.max(0, endTick - last)), 0xff, 0x2f, 0x00);
    return out;
  }
  const meta = (type, data) => [0xff, type, ...vlq(data.length), ...data];

  // Standard MIDI File, type 1: a conductor track (tempo, metre, key) then one track per part.
  M.writeMidi = function (score) {
    let bytes = chunk('MThd', [0, 1, 0, score.tracks.length + 1, (score.ppq >> 8) & 255, score.ppq & 255]);
    const usq = Math.round(60000000 / score.tempo);
    const ks = M.keySignature(score.key, score.mode);
    const cond = [
      { tick: 0, order: 0, bytes: meta(0x03, ascii(score.title || 'Mezzanine')) },
      { tick: 0, order: 0, bytes: meta(0x51, [(usq >> 16) & 255, (usq >> 8) & 255, usq & 255]) },
      { tick: 0, order: 0, bytes: meta(0x58, [4, 2, 24, 8]) },
      { tick: 0, order: 0, bytes: meta(0x59, [ks.sf & 255, ks.minor ? 1 : 0]) },
    ];
    bytes = bytes.concat(chunk('MTrk', trackBytes(cond, score.end)));
    for (const tr of score.tracks) {
      const ch = tr.channel;
      const ev = [{ tick: 0, order: 0, bytes: meta(0x03, ascii(tr.name)) }];
      if (tr.program != null) ev.push({ tick: 0, order: 1, bytes: [0xc0 | ch, tr.program] });
      ev.push({ tick: 0, order: 1, bytes: [0xb0 | ch, 7, tr.volume] });
      if (tr.bright != null) ev.push({ tick: 0, order: 1, bytes: [0xb0 | ch, 74, tr.bright] });
      for (const n of tr.notes) {
        ev.push({ tick: n.tick, order: 3, bytes: [0x90 | ch, n.midi, n.vel] });
        ev.push({ tick: n.tick + n.dur, order: 2, bytes: [0x80 | ch, n.midi, 64] }); // offs before ons on a shared tick
      }
      bytes = bytes.concat(chunk('MTrk', trackBytes(ev, score.end)));
    }
    return new Uint8Array(bytes);
  };

  /* ---------- WAV ---------- */
  M.wavHeader = function (frames, sampleRate, channels = 2) {
    const b = new DataView(new ArrayBuffer(44)), data = frames * channels * 2;
    const str = (o, s) => { for (let i = 0; i < 4; i++) b.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); b.setUint32(4, 36 + data, true); str(8, 'WAVE');
    str(12, 'fmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, channels, true);
    b.setUint32(24, sampleRate, true); b.setUint32(28, sampleRate * channels * 2, true);
    b.setUint16(32, channels * 2, true); b.setUint16(34, 16, true);
    str(36, 'data'); b.setUint32(40, data, true);
    return new Uint8Array(b.buffer);
  };
  // Interleaved 16-bit samples for frames [from, to) of float channels, scaled by `gain`.
  M.pcm16 = function (channels, from, to, gain = 1) {
    const nc = channels.length, out = new Int16Array((to - from) * nc);
    for (let i = from, j = 0; i < to; i++) {
      for (let c = 0; c < nc; c++, j++) {
        const x = Math.max(-1, Math.min(1, channels[c][i] * gain || 0));
        out[j] = Math.round(x < 0 ? x * 32768 : x * 32767);
      }
    }
    return out;
  };
  M.peak = function (channels) {
    let p = 0;
    for (const d of channels) for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; }
    return p;
  };
  // Whole file in one go (tests and short clips; the renderer writes in slices).
  M.wavFile = function (channels, sampleRate, gain = 1) {
    const frames = channels[0].length, head = M.wavHeader(frames, sampleRate, channels.length);
    const out = new Uint8Array(44 + frames * channels.length * 2);
    out.set(head, 0);
    out.set(new Uint8Array(M.pcm16(channels, 0, frames, gain).buffer), 44);
    return out;
  };

  M.fileSlug = (title) => (title || 'mezzanine').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mezzanine';
})();
