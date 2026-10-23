/* Mezzanine — evolve and auto-arrange: slow changes made at bar lines, for live playback and offline renders.
   No DOM. Functions take the song, the engine and a random source, and report what changed. */
(function () {
  const M = (window.M = window.M || {});

  // Weighted pick driven by a plain random function (Math.random or a seeded r.next).
  function weighted(obj, rand) {
    const ks = Object.keys(obj);
    let tot = 0;
    for (const k of ks) tot += obj[k];
    let x = rand() * tot;
    for (const k of ks) { x -= obj[k]; if (x <= 0) return k; }
    return ks[ks.length - 1];
  }

  // One evolve move at a bar line. Mutates the song and returns
  // { msg, lane, chords, key } describing the change, or null when it lets the bar pass.
  function evolve(song, engine, bar, rand) {
    const r = rand;
    if (bar % 32 === 0 && r() < 0.55) {
      if (r() < 0.6) {
        M.regenProgression(song);
        engine.rebuild();
        return { msg: 'new chord progression', chords: true };
      }
      const shift = [5, 7, 2, -2][Math.floor(r() * 4)];
      song.key = M.mod(song.key + shift, 12);
      engine.rebuild();
      return { msg: 'modulated to ' + M.NOTE[song.key] + ' ' + M.MODES[song.mode].name, chords: true, key: true };
    }
    if (r() < 0.35) return null;
    const pool = { melody: 4, arp: 2, keys: 1, bass: 1, drums: 1 };
    for (const k of Object.keys(pool)) if (!song.parts[k].on) delete pool[k];
    if (!Object.keys(pool).length) return null;
    const pick = weighted(pool, r);
    const msg = pick === 'melody' ? M.varyMelody(song) : (M.regenPart(song, pick), 'new ' + M.PART[pick].name.toLowerCase() + ' pattern');
    return { msg, lane: pick };
  }

  // Energy levels: which parts play. Auto-arrange drifts between them.
  const LAYERS = {
    1: ['pad', 'texture', 'arp'],
    2: ['pad', 'texture', 'arp', 'bass', 'keys'],
    3: ['pad', 'texture', 'arp', 'bass', 'keys', 'melody', 'drums'],
  };
  // Pure: next energy level and arrangement map ({ part: 0 | 1 }) from the current energy.
  function arrange(energy, rand) {
    const r = rand;
    const step = r() < 0.6 ? (r() < 0.5 ? -1 : 1) : 0;
    energy = Math.max(1, Math.min(3, energy + step));
    const arr = {};
    for (const p of M.PARTS) {
      let on = LAYERS[energy].includes(p.id);
      if (on && p.id !== 'pad' && p.id !== 'texture' && r() < 0.15) on = false;
      arr[p.id] = on ? 1 : 0;
    }
    if (energy < 3 && r() < 0.35) arr.melody = 1;
    return { energy, arr };
  }

  // Drives an engine from its 'bar' events. `evolve` and `arrange` are getters, so the
  // live page can follow its checkboxes; `onChange(result)` hears about every change.
  class Conductor {
    constructor(engine, { evolve: ev = () => true, arrange: ar = () => true, rand = Math.random, onChange = () => {} } = {}) {
      this.engine = engine; this.wantEvolve = ev; this.wantArrange = ar; this.rand = rand; this.onChange = onChange;
      this.energy = 3;
      // Evolve and auto-arrange run at bar lines, slightly ahead of what you hear.
      engine.on('bar', ({ bar }) => this.bar(bar));
    }
    bar(bar) {
      if (bar === 0 || bar % 8 !== 0 || !this.engine.song) return;
      if (this.wantEvolve()) {
        const res = evolve(this.engine.song, this.engine, bar, this.rand);
        if (res) this.onChange(res);
      }
      if (this.wantArrange()) {
        const res = arrange(this.energy, this.rand);
        this.energy = res.energy;
        this.engine.setArrangement(res.arr);
        this.onChange({ arr: res.arr, energy: res.energy });
      }
    }
    reset() { this.energy = 3; this.engine.setArrangement({}); }
  }

  M.Evolve = { evolve, arrange, LAYERS, weighted, Conductor };
})();
