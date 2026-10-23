/* Mezzanine — audio: synth voices, drum kit, ambience beds, effects and the step scheduler. */
(function () {
  const M = (window.M = window.M || {});

  /* ---------- Voice presets ---------- */
  M.VOICES = {
    // pads
    velvet:   { label: 'Velvet Pad',    kind: 'pad', oscs: [['sawtooth', -9, 0, 1], ['sawtooth', 9, 0, 1], ['triangle', 0, -12, 0.8]], cutoff: 1100, q: 0.7, a: 1.2, r: 2.8, gain: 0.05, range: [36, 84] },
    glass:    { label: 'Glass Pad',     kind: 'pad', oscs: [['triangle', -5, 0, 1], ['sine', 4, 12, 0.5], ['triangle', 0, -12, 0.6]], cutoff: 3200, q: 0.3, a: 1.6, r: 3.6, gain: 0.09, range: [36, 88] },
    choir:    { label: 'Synth Choir',     kind: 'pad', oscs: [['sawtooth', -6, 0, 1], ['sawtooth', 7, 0, 1]], formant: true, cutoff: 2400, q: 0.5, a: 1.8, r: 3.5, gain: 0.07, range: [40, 84] },
    strings:  { label: 'Synth Strings',  kind: 'pad', oscs: [['sawtooth', -12, 0, 1], ['sawtooth', 12, 0, 1], ['sawtooth', 3, 12, 0.35]], cutoff: 1900, q: 0.4, a: 0.7, r: 2.2, gain: 0.05, vib: 5, range: [36, 88] },
    // mallets, keys, plucks
    epiano:   { label: 'FM Electric Piano', kind: 'fm', ratio: 1, index: 1.6, idecay: 0.5, tine: 0.5, a: 0.004, d: 2.4, r: 0.45, gain: 0.16, trem: [3.8, 0.18], range: [33, 96] },
    vibes:    { label: 'FM Vibes',    kind: 'fm', ratio: 4, index: 0.55, idecay: 0.25, a: 0.002, d: 3.2, r: 0.8, ring: true, gain: 0.15, trem: [5.2, 0.35], range: [48, 92] },
    bell:     { label: 'FM Bell',          kind: 'fm', ratio: 3.5, index: 2.2, idecay: 1.1, a: 0.002, d: 4, r: 2, ring: true, gain: 0.12, range: [48, 96] },
    glassbell:{ label: 'Glass Bell',    kind: 'fm', ratio: 2.76, index: 1.1, idecay: 0.8, a: 0.003, d: 3.5, r: 2, ring: true, gain: 0.11, oct: 1, range: [48, 86] },
    marimba:  { label: 'Synth Marimba',       kind: 'fm', ratio: 4, index: 2.4, idecay: 0.035, a: 0.002, d: 0.6, r: 0.25, ring: true, gain: 0.22, range: [45, 96] },
    kalimba:  { label: 'Synth Kalimba',       kind: 'fm', ratio: 5.4, index: 1.4, idecay: 0.05, a: 0.002, d: 1.3, r: 0.4, ring: true, gain: 0.17, range: [55, 98] },
    harp:     { label: 'Synth Harp',          kind: 'pluck', wave: 'triangle', cutoff: 4200, fdecay: 0.45, d: 1.8, gain: 0.2, range: [36, 96] },
    pluck:    { label: 'Soft Pluck',    kind: 'pluck', wave: 'sawtooth', cutoff: 2300, fdecay: 0.14, d: 1.0, gain: 0.09, range: [40, 88] },
    organ:    { label: 'Lounge Organ',  kind: 'organ', bars: [1, 0.5, 0.32, 0.14], a: 0.03, r: 0.25, gain: 0.045, range: [36, 91] },
    // leads
    flute:    { label: 'Synth Flute',         kind: 'lead', wave: 'sine', breath: 0.05, vib: [5, 11, 0.25], a: 0.07, r: 0.35, cutoff: 3200, gain: 0.2, range: [58, 96] },
    softlead: { label: 'Soft Lead',     kind: 'lead', wave: 'triangle', vib: [4.4, 8, 0.3], a: 0.04, r: 0.45, cutoff: 1700, gain: 0.21, range: [48, 88] },
    // basses
    upright:  { label: 'Synth Upright',       kind: 'bass', wave: 'triangle', sub: 0.7, cutoff: 700, fenv: 900, fdecay: 0.1, a: 0.006, d: 1.1, s: 0.18, r: 0.12, gain: 0.21, range: [26, 60] },
    round:    { label: 'Round Bass',    kind: 'bass', wave: 'triangle', sub: 0.4, cutoff: 600, fenv: 300, fdecay: 0.3, a: 0.02, d: 1.6, s: 0.45, r: 0.3, gain: 0.19, range: [26, 62] },
    sub:      { label: 'Sub Bass',      kind: 'bass', wave: 'sine', sub: 0, cutoff: 420, fenv: 0, fdecay: 0.3, a: 0.08, d: 3, s: 0.75, r: 0.6, gain: 0.2, range: [24, 55] },
    // recorded instruments (Musyng Kite soundfont); `fb` plays while samples load
    grand:     { label: 'Grand Piano',     kind: 'sample', inst: 'grand', fb: 'epiano', r: 0.4, gain: 5.5, range: [33, 98] },
    rhodes:    { label: 'Rhodes',          kind: 'sample', inst: 'rhodes', fb: 'epiano', r: 0.35, gain: 2.2, trem: [3.6, 0.16], range: [38, 94] },
    vibraphone:{ label: 'Vibraphone',      kind: 'sample', inst: 'vibraphone', fb: 'vibes', ring: true, gain: 2.9, trem: [5, 0.22], range: [48, 92] },
    marimba_s: { label: 'Marimba',         kind: 'sample', inst: 'marimba_s', fb: 'marimba', ring: true, gain: 1.6, range: [45, 96] },
    kalimba_s: { label: 'Kalimba',         kind: 'sample', inst: 'kalimba_s', fb: 'kalimba', ring: true, gain: 5.4, range: [55, 98] },
    celesta:   { label: 'Celesta',         kind: 'sample', inst: 'celesta', fb: 'glassbell', ring: true, gain: 2.9, range: [55, 98] },
    harp_s:    { label: 'Concert Harp',    kind: 'sample', inst: 'harp_s', fb: 'harp', ring: true, gain: 3.8, range: [36, 96] },
    nylon:     { label: 'Nylon Guitar',    kind: 'sample', inst: 'nylon', fb: 'harp', r: 0.5, gain: 5.2, range: [40, 83] },
    flute_s:   { label: 'Flute',           kind: 'sample', inst: 'flute_s', fb: 'flute', sustain: true, a: 0.03, r: 0.3, gain: 6, range: [60, 93] },
    sax:       { label: 'Alto Sax',        kind: 'sample', inst: 'sax', fb: 'softlead', sustain: true, a: 0.03, r: 0.25, gain: 3.5, range: [49, 81] },
    strings_s: { label: 'String Section',  kind: 'sample', inst: 'strings_s', fb: 'strings', sustain: true, a: 0.5, r: 1.8, gain: 0.8, range: [40, 84] },
    choir_s:   { label: 'Choir',           kind: 'sample', inst: 'choir_s', fb: 'choir', sustain: true, a: 0.7, r: 2.2, gain: 1.6, range: [45, 79] },
    acbass:    { label: 'Upright Bass',    kind: 'sample', inst: 'acbass', fb: 'upright', r: 0.12, gain: 4, range: [28, 60] },
    fretless:  { label: 'Fretless Bass',   kind: 'sample', inst: 'fretless', fb: 'round', r: 0.2, gain: 4.2, range: [28, 62] },
    kit:      { label: 'Soft Kit' },
    // ambience beds
    rain:     { label: 'Rain' }, vinyl: { label: 'Vinyl' }, ocean: { label: 'Ocean' }, wind: { label: 'Wind' }, crickets: { label: 'Crickets' }, none: { label: 'Silence' },
  };

  /* ---------- Helpers ---------- */
  let NOISE = null;
  function noiseBuf(ctx) {
    if (NOISE && NOISE.sampleRate === ctx.sampleRate) return NOISE;
    NOISE = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return NOISE;
  }
  function noiseSrc(ctx, t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf(ctx);
    s.start(t, Math.random() * 1.5, dur);
    return s;
  }
  function osc(ctx, type, f, detune) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    return o;
  }
  // Attack, then decay toward sustain, then release at `end`.
  function env(param, t, a, d, s, end, r, peak) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.setTargetAtTime(peak * s, t + a, Math.max(0.01, d / 4));
    param.setTargetAtTime(0, end, Math.max(0.01, r / 4));
  }

  /* ---------- Sampled instruments ---------- */
  // Each samples/<id>.js file registers base64 MP3s keyed by MIDI note (every minor third).
  M.Samples = {
    state: {}, banks: {}, listeners: [], ctx: null,
    on(fn) { this.listeners.push(fn); },
    emit() { this.listeners.forEach((fn) => fn(this.progress())); },
    progress() {
      const ids = Object.keys(this.state);
      // a downloaded file counts as loaded: it is decoded the moment Play unlocks audio
      const done = (st) => st === 'ready' || st === 'error' || st === 'fetched' || st === 'decoding';
      return { total: ids.length, ready: ids.filter((i) => done(this.state[i])).length, failed: ids.filter((i) => this.state[i] === 'error') };
    },
    ensure(id) {
      if (this.state[id]) return;
      this.state[id] = 'loading';
      this.emit();
      const raw = window.MZ_SAMPLES && window.MZ_SAMPLES[id];
      if (raw) { this.fetched(id); return; }
      const el = document.createElement('script');
      el.src = (window.MZ_SAMPLE_BASE || 'samples/') + id + '.js';
      el.async = true;
      el.onerror = () => { this.state[id] = 'error'; this.emit(); };
      document.head.appendChild(el);
    },
    fetched(id) {
      this.state[id] = 'fetched';
      this.emit();
      if (this.ctx) this.decode(id);
    },
    attach(ctx) {
      if (this.ctx) return;
      this.ctx = ctx;
      for (const id of Object.keys(this.state)) if (this.state[id] === 'fetched') this.decode(id);
    },
    async decode(id) {
      this.state[id] = 'decoding';
      const raw = window.MZ_SAMPLES[id];
      const bank = { notes: [], buf: {} };
      await Promise.all(Object.entries(raw).map(async ([midi, b64]) => {
        const bin = atob(b64), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        try { bank.buf[midi] = await this.ctx.decodeAudioData(bytes.buffer); } catch (e) {}
      }));
      bank.notes = Object.keys(bank.buf).map(Number).sort((a, b) => a - b);
      this.banks[id] = bank;
      this.state[id] = bank.notes.length ? 'ready' : 'error';
      this.emit();
    },
    get(id) { return this.state[id] === 'ready' ? this.banks[id] : null; },
  };
  window.MZ_SAMPLE_READY = (id) => M.Samples.fetched(id);

  function playSample(ctx, out, p, midi, t, dur, vel) {
    const bank = M.Samples.get(p.inst);
    if (!bank) { M.Samples.ensure(p.inst); return M.playVoice(ctx, out, p.fb, midi, t, dur, vel); }
    let near = bank.notes[0];
    for (const n of bank.notes) if (Math.abs(n - midi) < Math.abs(near - midi)) near = n;
    const buf = bank.buf[near], rate = Math.pow(2, (midi - near) / 12);
    const v = Math.pow(vel, 1.2);
    const bufDur = buf.duration / rate;
    // softer notes are darker, like a real instrument played gently
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.3;
    lp.frequency.value = Math.min(18000, 900 + 16000 * Math.pow(v, 1.6));
    const amp = ctx.createGain(); amp.gain.value = 0;
    let node = lp;
    if (p.trem) {
      const tg = ctx.createGain(); tg.gain.value = 1 - p.trem[1] / 2;
      const tl = osc(ctx, 'sine', p.trem[0]); const tlg = ctx.createGain(); tlg.gain.value = p.trem[1] / 2;
      tl.connect(tlg); tlg.connect(tg.gain); tl.start(t); tl.stop(t + Math.max(dur, bufDur) + 2);
      lp.connect(tg); node = tg;
    }
    node.connect(amp); amp.connect(out);
    const peak = p.gain * (0.25 + v * 0.85);
    let stopAt;
    if (!p.sustain) {
      const end = p.ring ? t + bufDur : t + Math.min(Math.max(dur, 0.06), bufDur);
      stopAt = Math.min(t + bufDur, end + (p.r || 0.2) * 2);
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
      src.connect(lp); src.start(t); src.stop(stopAt + 0.02);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(peak, t + 0.004);
      if (!p.ring) amp.gain.setTargetAtTime(0, end, (p.r || 0.2) / 4);
      else amp.gain.setTargetAtTime(0, t + bufDur - 0.25, 0.06);
    } else {
      // Long notes: chain crossfaded copies of the sustained part of the sample.
      const end = t + Math.max(dur, p.a + 0.05);
      stopAt = end + p.r * 1.6;
      const X = 0.45;
      let segStart = t, off = 0, first = true;
      for (let guard = 0; guard < 64; guard++) {
        const segEnd = segStart + (buf.duration - off) / rate - 0.06;
        const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
        const g = ctx.createGain();
        if (first) g.gain.setValueAtTime(1, segStart);
        else { g.gain.setValueAtTime(0, segStart); g.gain.linearRampToValueAtTime(1, segStart + X); }
        const next = segEnd - X;
        if (next < stopAt) { g.gain.setValueAtTime(1, next); g.gain.linearRampToValueAtTime(0, segEnd); }
        s.connect(g); g.connect(lp);
        s.start(segStart, off); s.stop(Math.min(segEnd, stopAt) + 0.05);
        if (next >= stopAt) break;
        segStart = next; off = 0.8 + Math.random() * 0.5; first = false;
      }
      env(amp.gain, t, p.a, 1, 1, end, p.r, peak);
    }
    setTimeout(() => amp.disconnect(), (stopAt - ctx.currentTime + 0.5) * 1000);
  }

  /* ---------- Synthesis ---------- */
  M.playVoice = function (ctx, out, name, midi, t, dur, vel) {
    const p = M.VOICES[name];
    if (!p || !p.kind) return;
    midi = M.foldInto(midi, p.range);
    if (p.kind === 'sample') return playSample(ctx, out, p, midi, t, dur, vel);
    if (p.oct) midi += 12 * p.oct;
    const f = M.midiFreq(midi);
    const v = Math.pow(vel, 1.3);
    const amp = ctx.createGain();
    amp.gain.value = 0;
    amp.connect(out);
    let stopAt;

    if (p.kind === 'pad') {
      const end = t + Math.max(dur, p.a);
      stopAt = end + p.r * 1.6;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = p.q;
      lp.frequency.setValueAtTime(p.cutoff * 0.5, t);
      lp.frequency.linearRampToValueAtTime(p.cutoff, t + p.a * 1.5);
      const lfo = osc(ctx, 'sine', 0.08 + Math.random() * 0.12);
      const lfoG = ctx.createGain(); lfoG.gain.value = p.cutoff * 0.25;
      lfo.connect(lfoG); lfoG.connect(lp.frequency);
      lfo.start(t); lfo.stop(stopAt);
      const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 0.8 - 0.4;
      for (const [type, det, semi, g] of p.oscs) {
        const o = osc(ctx, type, f * Math.pow(2, semi / 12), det + (Math.random() * 4 - 2));
        const og = ctx.createGain(); og.gain.value = g;
        if (p.vib) {
          const vl = osc(ctx, 'sine', 4.5 + Math.random()); const vg = ctx.createGain(); vg.gain.value = p.vib;
          vl.connect(vg); vg.connect(o.detune); vl.start(t); vl.stop(stopAt);
        }
        o.connect(og); og.connect(lp); o.start(t); o.stop(stopAt);
      }
      if (p.formant) {
        const dry = ctx.createGain(); dry.gain.value = 0.25; lp.connect(dry); dry.connect(pan);
        for (const [fq, g] of [[380, 1.2], [950, 0.7], [2600, 0.18]]) {
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 5;
          const bg = ctx.createGain(); bg.gain.value = g;
          lp.connect(bp); bp.connect(bg); bg.connect(pan);
        }
        amp.gain.value = 0;
      } else lp.connect(pan);
      pan.connect(amp);
      env(amp.gain, t, p.a, 1, 0.85, end, p.r, p.gain * (0.6 + v * 0.5));
    } else if (p.kind === 'fm') {
      const end = p.ring ? t + p.d : t + Math.max(dur, 0.05);
      stopAt = end + p.r * 1.6 + 0.05;
      const car = osc(ctx, 'sine', f);
      const m = osc(ctx, 'sine', f * p.ratio);
      const mg = ctx.createGain();
      const depth = p.index * f * p.ratio * (0.45 + v * 0.75);
      mg.gain.setValueAtTime(depth, t);
      mg.gain.setTargetAtTime(depth * 0.04, t + 0.002, p.idecay / 3);
      m.connect(mg); mg.connect(car.frequency);
      m.start(t); m.stop(stopAt);
      if (p.tine) {
        const m2 = osc(ctx, 'sine', f * 14); const g2 = ctx.createGain();
        const d2 = f * 14 * p.tine * v;
        g2.gain.setValueAtTime(d2, t); g2.gain.setTargetAtTime(0, t + 0.001, 0.02);
        m2.connect(g2); g2.connect(car.frequency); m2.start(t); m2.stop(t + 0.3);
      }
      let node = car;
      if (p.trem) {
        const tg = ctx.createGain(); tg.gain.value = 1 - p.trem[1] / 2;
        const tl = osc(ctx, 'sine', p.trem[0]); const tlg = ctx.createGain(); tlg.gain.value = p.trem[1] / 2;
        tl.connect(tlg); tlg.connect(tg.gain); tl.start(t); tl.stop(stopAt);
        car.connect(tg); node = tg;
      }
      node.connect(amp);
      car.start(t); car.stop(stopAt);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(p.gain * (0.35 + v * 0.75), t + p.a);
      amp.gain.setTargetAtTime(0, t + p.a, p.d / 4.5);
      if (!p.ring) amp.gain.setTargetAtTime(0, end, p.r / 4);
    } else if (p.kind === 'pluck') {
      stopAt = t + p.d + 0.1;
      const o = osc(ctx, p.wave, f, Math.random() * 6 - 3);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
      lp.frequency.setValueAtTime(Math.min(16000, p.cutoff * (0.6 + v)), t);
      lp.frequency.setTargetAtTime(f * 1.4, t, p.fdecay / 3);
      o.connect(lp); lp.connect(amp);
      o.start(t); o.stop(stopAt);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(p.gain * (0.4 + v * 0.7), t + 0.003);
      amp.gain.setTargetAtTime(0, t + 0.003, p.d / 5);
    } else if (p.kind === 'organ') {
      const end = t + Math.max(dur, p.a);
      stopAt = end + p.r * 2;
      const les = osc(ctx, 'sine', 5.8); const lg = ctx.createGain(); lg.gain.value = 9;
      les.connect(lg); les.start(t); les.stop(stopAt);
      p.bars.forEach((g, i) => {
        const o = osc(ctx, 'sine', f * [1, 2, 3, 4][i]);
        const og = ctx.createGain(); og.gain.value = g;
        lg.connect(o.detune);
        o.connect(og); og.connect(amp); o.start(t); o.stop(stopAt);
      });
      env(amp.gain, t, p.a, 0.5, 0.9, end, p.r, p.gain * (0.6 + v * 0.5));
    } else if (p.kind === 'lead') {
      const end = t + Math.max(dur, p.a + 0.02);
      stopAt = end + p.r * 2;
      const o = osc(ctx, p.wave, f);
      const [vr, vd, vdel] = p.vib;
      const vl = osc(ctx, 'sine', vr); const vg = ctx.createGain();
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(vd, t + vdel + 0.4);
      vl.connect(vg); vg.connect(o.detune); vl.start(t); vl.stop(stopAt);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.cutoff; lp.Q.value = 0.5;
      o.connect(lp); lp.connect(amp);
      if (p.wave === 'sine') {
        const h = osc(ctx, 'sine', f * 2); const hg = ctx.createGain(); hg.gain.value = 0.12;
        vg.connect(h.detune); h.connect(hg); hg.connect(lp); h.start(t); h.stop(stopAt);
      }
      if (p.breath) {
        const n = noiseSrc(ctx, t, stopAt - t);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.5;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(p.breath * 3, t + 0.03);
        ng.gain.setTargetAtTime(p.breath, t + 0.03, 0.08); ng.gain.setTargetAtTime(0, end, 0.05);
        n.connect(bp); bp.connect(ng); ng.connect(amp);
      }
      o.start(t); o.stop(stopAt);
      env(amp.gain, t, p.a, 0.6, 0.8, end, p.r, p.gain * (0.5 + v * 0.6));
    } else if (p.kind === 'bass') {
      const end = t + Math.max(dur, p.a + 0.02);
      stopAt = end + p.r * 2;
      const o = osc(ctx, p.wave, f);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.9;
      lp.frequency.setValueAtTime(p.cutoff + p.fenv * v, t);
      lp.frequency.setTargetAtTime(p.cutoff, t, p.fdecay / 3);
      o.connect(lp);
      if (p.sub) {
        const s = osc(ctx, 'sine', f); const sg = ctx.createGain(); sg.gain.value = p.sub;
        s.connect(sg); sg.connect(lp); s.start(t); s.stop(stopAt);
      }
      lp.connect(amp);
      o.start(t); o.stop(stopAt);
      env(amp.gain, t, p.a, p.d, p.s, end, p.r, p.gain * (0.55 + v * 0.55));
    }
    setTimeout(() => amp.disconnect(), (stopAt - ctx.currentTime + 0.5) * 1000);
  };

  M.playDrum = function (ctx, out, row, t, vel) {
    const v = vel;
    const g = ctx.createGain(); g.connect(out);
    if (row === 0) { // kick
      const o = osc(ctx, 'sine', 110);
      o.frequency.setValueAtTime(115, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.75 * v, t + 0.004);
      g.gain.setTargetAtTime(0, t + 0.01, 0.09);
      o.connect(g); o.start(t); o.stop(t + 0.6);
    } else if (row === 1) { // brush / soft snare
      const n = noiseSrc(ctx, t, 0.5);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.6;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28 * v, t + 0.018);
      g.gain.setTargetAtTime(0, t + 0.02, 0.07);
      n.connect(bp); bp.connect(g);
      const o = osc(ctx, 'triangle', 190); const og = ctx.createGain();
      og.gain.setValueAtTime(0.12 * v, t); og.gain.setTargetAtTime(0, t, 0.03);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.2);
    } else if (row === 2) { // rim / cross-stick
      const o = osc(ctx, 'triangle', 1350);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 4;
      g.gain.setValueAtTime(0.32 * v, t); g.gain.setTargetAtTime(0, t, 0.012);
      o.connect(bp); bp.connect(g); o.start(t); o.stop(t + 0.12);
    } else if (row === 3) { // hat
      const n = noiseSrc(ctx, t, 0.15);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
      g.gain.setValueAtTime(0.13 * v, t); g.gain.setTargetAtTime(0, t, 0.018);
      n.connect(hp); hp.connect(g);
    } else { // shaker
      const n = noiseSrc(ctx, t, 0.2);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6200; bp.Q.value = 1.1;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.012);
      g.gain.setTargetAtTime(0, t + 0.014, 0.025);
      n.connect(bp); bp.connect(g);
    }
    setTimeout(() => g.disconnect(), (t - ctx.currentTime + 1) * 1000);
  };

  /* ---------- Ambience beds (seamless loops rendered once) ---------- */
  function loopBuffer(ctx, seconds, fill) {
    const sr = ctx.sampleRate, L = Math.floor(sr * seconds), X = Math.floor(sr * 0.5);
    const buf = ctx.createBuffer(2, L, sr);
    for (let ch = 0; ch < 2; ch++) {
      const tmp = new Float32Array(L + X);
      fill(tmp, sr, ch);
      const d = buf.getChannelData(ch);
      for (let i = 0; i < L; i++) d[i] = tmp[i];
      for (let i = 0; i < X; i++) { const k = i / X; d[i] = tmp[i] * k + tmp[L + i] * (1 - k); }
    }
    return buf;
  }
  function pink(out, amp) {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < out.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      out[i] += (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * amp; b6 = w * 0.115926;
    }
  }
  function brown(out, amp) {
    let last = 0;
    for (let i = 0; i < out.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; out[i] += last * 3.5 * amp; }
  }
  const BEDS = {
    rain(ctx) {
      return loopBuffer(ctx, 9, (d, sr) => {
        pink(d, 0.55);
        const n = Math.floor((d.length / sr) * 70);
        for (let k = 0; k < n; k++) {
          const at = Math.floor(Math.random() * d.length), f = 1800 + Math.random() * 4500, a = 0.02 + Math.random() * 0.06;
          const len = Math.floor(sr * 0.012);
          for (let i = 0; i < len && at + i < d.length; i++) d[at + i] += Math.sin((i / sr) * f * 6.283) * a * Math.exp(-i / (len / 4));
        }
      });
    },
    vinyl(ctx) {
      return loopBuffer(ctx, 7, (d, sr) => {
        for (let i = 0; i < d.length; i++) d[i] += (Math.random() * 2 - 1) * 0.012;
        const n = Math.floor((d.length / sr) * 9);
        for (let k = 0; k < n; k++) {
          const at = Math.floor(Math.random() * d.length), a = (Math.random() < 0.15 ? 0.5 : 0.15) * (Math.random() * 2 - 1);
          for (let i = 0; i < 40 && at + i < d.length; i++) d[at + i] += a * Math.exp(-i / 6);
        }
      });
    },
    ocean(ctx) { return loopBuffer(ctx, 10, (d) => brown(d, 0.9)); },
    wind(ctx) { return loopBuffer(ctx, 10, (d) => pink(d, 0.9)); },
    crickets(ctx) {
      return loopBuffer(ctx, 8, (d, sr, ch) => {
        pink(d, 0.04);
        const voices = [[4300, 0.9], [4700, 1.3], [3900, 1.7]];
        for (const [f, every] of voices) {
          if ((ch === 0) !== (f !== 4700)) continue;
          for (let t0 = Math.random() * every; t0 < d.length / sr; t0 += every * (0.8 + Math.random() * 0.4)) {
            for (let p = 0; p < 3; p++) {
              const at = Math.floor((t0 + p * 0.045) * sr), len = Math.floor(sr * 0.022);
              for (let i = 0; i < len && at + i < d.length; i++) d[at + i] += Math.sin((i / sr) * f * 6.283) * 0.05 * Math.sin((i / len) * Math.PI);
            }
          }
        }
      });
    },
  };

  /* ---------- Engine ---------- */
  const SENDS = {
    pad: [0.55, 0.12], keys: [0.32, 0.16], bass: [0.06, 0], arp: [0.45, 0.42],
    melody: [0.42, 0.32], drums: [0.12, 0.02], texture: [0.12, 0],
  };

  class Engine {
    constructor() {
      this.ctx = null; this.playing = false; this.song = null; this.chords = [];
      this.events = []; this.listeners = {}; this.n = 0; this.arr = {};
    }
    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, data) { (this.listeners[ev] || []).forEach((fn) => fn(data)); }

    init(offlineCtx) {
      if (this.ctx) return;
      const ctx = (this.ctx = offlineCtx || new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' }));
      M.Samples.attach(ctx);
      this.master = ctx.createGain(); this.master.gain.value = 0.75;
      this.fade = ctx.createGain(); this.fade.gain.value = 1;
      this.bus = ctx.createGain();
      this.warm = ctx.createBiquadFilter(); this.warm.type = 'lowpass'; this.warm.Q.value = 0.4;
      this.hpf = ctx.createBiquadFilter(); this.hpf.type = 'highpass'; this.hpf.frequency.value = 28;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -16; this.comp.ratio.value = 3; this.comp.knee.value = 12;
      this.comp.attack.value = 0.02; this.comp.release.value = 0.4;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.85;
      this.bus.connect(this.warm); this.warm.connect(this.hpf); this.hpf.connect(this.comp);
      this.comp.connect(this.master); this.master.connect(this.fade);
      this.fade.connect(this.analyser); this.analyser.connect(ctx.destination);
      try { this.recDest = ctx.createMediaStreamDestination(); this.fade.connect(this.recDest); } catch (e) { this.recDest = null; }
      if (!offlineCtx && this.outWant) this.routeOut(this.outWant);

      // reverb
      this.revIn = ctx.createGain();
      const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 220;
      this.conv = ctx.createConvolver(); this.conv.buffer = this.makeIR(5.5);
      const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 5200;
      this.revOut = ctx.createGain();
      this.revIn.connect(rhp); rhp.connect(this.conv); this.conv.connect(rlp); rlp.connect(this.revOut); this.revOut.connect(this.bus);

      // ping-pong echo
      this.delIn = ctx.createGain();
      this.dL = ctx.createDelay(4); this.dR = ctx.createDelay(4);
      this.fb = ctx.createGain(); this.fb.gain.value = 0.42;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
      const dhp = ctx.createBiquadFilter(); dhp.type = 'highpass'; dhp.frequency.value = 350;
      const merge = ctx.createChannelMerger(2);
      this.delOut = ctx.createGain();
      this.delIn.connect(dhp); dhp.connect(this.dL);
      this.dL.connect(this.dR); this.dR.connect(this.fb); this.fb.connect(dlp); dlp.connect(this.dL);
      this.dL.connect(merge, 0, 0); this.dR.connect(merge, 0, 1);
      merge.connect(this.delOut); this.delOut.connect(this.bus); this.delOut.connect(this.revIn);

      // parts
      this.parts = {};
      for (const p of M.PARTS) {
        const input = ctx.createGain();
        const vol = ctx.createGain();
        const arr = ctx.createGain();
        const rs = ctx.createGain(); rs.gain.value = SENDS[p.id][0];
        const ds = ctx.createGain(); ds.gain.value = SENDS[p.id][1];
        input.connect(vol); vol.connect(arr); arr.connect(this.bus); arr.connect(rs); arr.connect(ds);
        rs.connect(this.revIn); ds.connect(this.delIn);
        this.parts[p.id] = { input, vol, arr };
      }
      this.bed = null;

      // a worker clock keeps time steady when the tab is in the background
      if (!offlineCtx) try {
        const src = 'let t=null;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}';
        this.clock = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        this.clock.onmessage = () => this.tick();
      } catch (e) { this.clock = null; }
      if (this.song) { this.applyFx(); this.applyMix(true); }
    }

    makeIR(sec) {
      const ctx = this.ctx, sr = ctx.sampleRate, L = Math.floor(sr * sec);
      const buf = ctx.createBuffer(2, L, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < L; i++) {
          const x = i / L;
          const k = 0.9 - x * 0.75; // high end darkens as the tail decays
          lp += ((Math.random() * 2 - 1) - lp) * k;
          d[i] = lp * Math.pow(1 - x, 3.4) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
        }
      }
      return buf;
    }

    setSong(song, { atBar = false } = {}) {
      if (atBar && this.playing) { this.pending = song; M.preloadSong(song); return; }
      this.song = song;
      this.chords = M.buildChords(song); this.shifts = {};
      M.preloadSong(song);
      if (this.ctx) { this.applyFx(); this.applyMix(); this.setBed(); }
      this.emit('song', song);
    }
    rebuild() { this.chords = M.buildChords(this.song); this.shifts = {}; this.emit('chords', this.chords); }

    // Octave shift that moves a part into its instrument's range (cached per voice).
    regShift(id, voice) {
      const key = id + ':' + voice + ':' + this.song.penta;
      if (this.shifts[key] === undefined) this.shifts[key] = M.partShift(this.song, this.chords, id, (M.VOICES[voice] || {}).range);
      return this.shifts[key];
    }

    applyFx() {
      if (!this.ctx) return;
      const { fx, tempo } = this.song, t = this.ctx.currentTime;
      this.revOut.gain.setTargetAtTime(fx.space * 1.6, t, 0.3);
      this.delOut.gain.setTargetAtTime(fx.echo * 0.9, t, 0.3);
      this.fb.gain.setTargetAtTime(0.25 + fx.echo * 0.35, t, 0.3);
      this.warm.frequency.setTargetAtTime(600 * Math.pow(30, fx.warmth), t, 0.3);
      const beat = 60 / tempo;
      this.dL.delayTime.setTargetAtTime(beat * 0.75, t, 0.1);
      this.dR.delayTime.setTargetAtTime(beat * 0.75, t, 0.1);
    }

    audible(id) {
      const s = this.song, p = s.parts[id];
      const anySolo = Object.values(s.parts).some((x) => x.solo);
      return p.on && (!anySolo || p.solo);
    }
    applyMix(instant) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (const p of M.PARTS) {
        const sp = this.song.parts[p.id];
        const target = this.audible(p.id) ? sp.vol * sp.vol * 1.4 : 0;
        if (instant) this.parts[p.id].vol.gain.value = target;
        else this.parts[p.id].vol.gain.setTargetAtTime(target, t, 0.08);
        const a = this.arr[p.id] === undefined ? 1 : this.arr[p.id];
        this.parts[p.id].arr.gain.setTargetAtTime(a, t, a ? 0.6 : 1.4);
      }
    }
    setArrangement(arr) { this.arr = arr; this.applyMix(); this.emit('arrange', arr); }
    setVolume(v) { if (this.ctx) this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.05); }

    setBed() {
      const tp = this.song.parts.texture;
      const want = tp.on && tp.voice !== 'none' ? tp.voice : null;
      if (this.bed && this.bed.name === want) return;
      const ctx = this.ctx, t = ctx.currentTime;
      if (this.bed) {
        const old = this.bed;
        old.g.gain.setTargetAtTime(0, t, 0.8);
        setTimeout(() => { old.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); old.g.disconnect(); }, 5000);
        this.bed = null;
      }
      if (!want) return;
      this.bedCache = this.bedCache || {};
      const buf = (this.bedCache[want] = this.bedCache[want] || BEDS[want](ctx));
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0;
      const nodes = [src];
      let tail = src;
      const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; tail.connect(b); tail = b; return b; };
      const lfo = (rate, depth, param) => { const o = osc(ctx, 'sine', rate); const og = ctx.createGain(); og.gain.value = depth; o.connect(og); og.connect(param); o.start(); nodes.push(o); };
      if (want === 'rain') { filt('highpass', 350); filt('lowpass', 7000); }
      if (want === 'vinyl') { filt('highpass', 900); filt('lowpass', 6500); }
      if (want === 'ocean') {
        const lp = filt('lowpass', 700); lfo(0.075, 450, lp.frequency);
        const sw = ctx.createGain(); sw.gain.value = 0.65; tail.connect(sw); tail = sw; lfo(0.075, 0.35, sw.gain);
      }
      if (want === 'wind') { const bp = filt('bandpass', 600, 2.2); lfo(0.05, 300, bp.frequency); lfo(0.13, 120, bp.frequency); }
      if (want === 'crickets') filt('highpass', 2500);
      tail.connect(g); g.connect(this.parts.texture.input);
      src.start();
      g.gain.setTargetAtTime(want === 'vinyl' ? 0.8 : 1, t, 1.2);
      this.bed = { name: want, nodes, g };
    }

    async start() {
      this.init();
      if (this.outWant && !this.outEl) this.routeOut(this.outWant);
      // play() must run inside the user's gesture, so before the first await
      if (this.outEl) this.outEl.play().catch((e) => { if (!e || e.name !== 'AbortError') this.directOut(); });
      if (this.ctx.state !== 'running') await this.ctx.resume();
      if (this.playing) return;
      this.playing = true;
      this.n = 0; this.padHeld = null;
      this.next = this.ctx.currentTime + 0.12;
      this.fade.gain.cancelScheduledValues(this.ctx.currentTime);
      this.fade.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
      this.setBed();
      if (this.clock) this.clock.postMessage(25); else this.iv = setInterval(() => this.tick(), 25);
      this.emit('play', true);
    }
    stop(fadeSec = 0.4) {
      if (!this.playing) return;
      this.playing = false;
      if (this.clock) this.clock.postMessage(0); else clearInterval(this.iv);
      const t = this.ctx.currentTime;
      this.fade.gain.cancelScheduledValues(t);
      this.fade.gain.setTargetAtTime(0, t, fadeSec / 3);
      if (this.pending) { const s = this.pending; this.pending = null; this.setSong(s); }
      this.events = []; this.padHeld = null;
      if (this.outEl) { const el = this.outEl; setTimeout(() => { if (!this.playing && this.outEl === el) el.pause(); }, fadeSec * 1000 + 250); }
      this.emit('play', false);
    }

    // Phones: send the mix through an <audio> element (srcObject) instead of ctx.destination.
    // Media playback then owns the audio session, so the music ignores the silent switch, keeps
    // going with the screen locked and gets lock-screen controls. Only one route is live at a time.
    useMediaElement(el) {
      this.outWant = el;
      if (this.ctx && !this.outEl) this.routeOut(el);
    }
    routeOut(el) {
      if (!this.recDest || !('srcObject' in el)) return;
      try { el.srcObject = this.recDest.stream; } catch (e) { return; }
      this.analyser.disconnect();
      this.outEl = el;
    }
    // Falls back to direct output (the element could not play); start() tries the element again.
    directOut() {
      const el = this.outEl;
      if (!el) return;
      this.outEl = null;
      el.pause(); el.srcObject = null;
      this.analyser.connect(this.ctx.destination);
    }

    stepDur(n) {
      const sd = 60 / this.song.tempo / 4;
      const sw = Math.min(0.35, this.song.swing);
      return n % 2 === 0 ? sd * (1 + sw) : sd * (1 - sw);
    }

    tick() {
      if (!this.playing) return;
      const ahead = document.hidden ? 1.2 : 0.16;
      while (this.next < this.ctx.currentTime + ahead) {
        this.schedule(this.n, this.next);
        this.next += this.stepDur(this.n);
        this.n++;
      }
    }

    // The bar's drum grid, with a fill on the last bar of every 8 (cached for the bar).
    drumGrid(part, bar) {
      if (bar % 8 !== 7 || !part.vary) return part.grid;
      const f = this.fill;
      if (!f || f.bar !== bar || f.src !== part.grid) this.fill = { bar, src: part.grid, grid: M.drumGridAt(this.song, part, bar) };
      return this.fill.grid;
    }
    span(n, steps) { let d = 0; for (let k = 0; k < steps; k++) d += this.stepDur(n + k); return d; }

    schedule(n, t) {
      if (n % 16 === 0 && this.pending) {
        const s = this.pending; this.pending = null; this.setSong(s);
        this.n = n = 0;
      }
      const song = this.song, ctx = this.ctx;
      const bar = Math.floor(n / 16), s16 = n % 16;
      const ci = Math.floor(bar / song.hr) % this.chords.length;
      const chord = this.chords[ci];
      if (s16 === 0) {
        this.emit('bar', { bar, t });
        if (bar % song.hr === 0) this.events.push({ t, type: 'chord', ci, chord });
        if (this.events.length > 3000) this.events.splice(0, 1500);
      }
      const visual = !document.hidden;
      if (visual) this.events.push({ t, type: 'step', n });
      // pad and keys share out the register while both are sounding
      const split = ['pad', 'keys'].every((id) => this.audible(id) && this.arr[id] !== 0);

      const held = this.padHeld;
      const ringing = (voicing) => held && held.until > t + 0.05 && held.notes === voicing;

      for (const meta of M.PARTS) {
        const id = meta.id, part = song.parts[id];
        if (!meta.len || !this.audible(id) || this.arr[id] === 0) continue;
        const out = this.parts[id].input, step = n % meta.len;
        const hits = M.partStep(song, this.chords, id, n, {
          rand: Math.random, split, ringing,
          grid: id === 'drums' ? this.drumGrid(part, bar) : null,
          shift: id === 'drums' ? 0 : this.regShift(id, part.voice), range: (M.VOICES[part.voice] || {}).range,
        });
        for (const { row, v, notes, steps, jitter, voicing } of hits) {
          const tt = Math.max(ctx.currentTime, t + jitter);
          if (id === 'drums') {
            M.playDrum(ctx, out, row, tt, v);
            if (visual) this.events.push({ t: tt, type: 'note', part: id, row, step, midi: 40 + row * 10, v });
            continue;
          }
          const whole = Math.max(1, Math.ceil(steps));
          const dur = this.span(n, whole) * (steps / whole);
          if (id === 'pad') this.padHeld = { until: tt + dur, notes: voicing };
          notes.forEach((m, i) => {
            const st = id === 'keys' ? tt + i * 0.006 : tt; // a soft strum
            M.playVoice(ctx, out, part.voice, m, st, dur, v);
          });
          if (visual) this.events.push({ t: tt, type: 'note', part: id, row, step, midi: notes[notes.length - 1], notes, v });
        }
      }
    }

    // Soft bell arpeggio used by the focus timer.
    chime() {
      this.init();
      const t = this.ctx.currentTime + 0.05;
      const k = this.song.key;
      [0, 4, 7, 12].forEach((o, i) => M.playVoice(this.ctx, this.bus, 'glassbell', 72 + k + o, t + i * 0.22, 1, 0.7));
    }
    fadeOut(sec, then) {
      const t = this.ctx.currentTime;
      this.fade.gain.cancelScheduledValues(t);
      this.fade.gain.setValueAtTime(this.fade.gain.value, t);
      this.fade.gain.linearRampToValueAtTime(0.0001, t + sec);
      clearTimeout(this.fadeT);
      this.fadeT = setTimeout(() => { this.stop(0.1); then && then(); }, sec * 1000);
    }
    cancelFade() {
      clearTimeout(this.fadeT);
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.fade.gain.cancelScheduledValues(t);
      this.fade.gain.setTargetAtTime(1, t, 0.3);
    }
  }
  M.Engine = Engine;
  M.preloadSong = (song) => {
    for (const p of Object.values(song.parts)) { const v = M.VOICES[p.voice]; if (v && v.kind === 'sample') M.Samples.ensure(v.inst); }
  };
})();
