/* Mezzanine — song form, evolve and auto-arrange: slow changes made at bar lines, for live playback and offline renders.
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

  // Evolve without the form (Auto-arrange off): one move at a bar line. Mutates the song and
  // returns { msg, lane, chords, key } describing the change, or null when it lets the bar pass.
  function evolve(song, engine, bar, rand) {
    const r = rand;
    if (bar % 32 === 0 && r() < 0.55) {
      if (r() < 0.6) {
        M.regenProgression(song, M.rng('evolve:' + r()));
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
    const gen = M.rng('evolve:' + r());
    const msg = pick === 'melody' ? M.varyMelody(song, gen) : (M.regenPart(song, pick, gen), 'new ' + M.PART[pick].name.toLowerCase() + ' pattern');
    return { msg, lane: pick };
  }

  /* ---------- Song form ---------- */
  // A song is endless, told in rounds: the first opens with an intro, then each moves through
  // theme, variation, bridge (on its own progression), breather and the return to the theme.
  const SECTIONS = {
    intro: { label: 'Intro', harmony: 'A' },
    theme: { label: 'Theme', harmony: 'A' },
    variation: { label: 'Variation', harmony: 'A' },
    bridge: { label: 'Bridge', harmony: 'B' },
    breather: { label: 'Breather', harmony: 'A' },
    return: { label: 'Return', harmony: 'A' },
  };
  // Energy levels: which parts play. The melody follows each section's own rule.
  const LAYERS = {
    1: ['pad', 'texture', 'arp'],
    2: ['pad', 'texture', 'arp', 'bass', 'keys'],
    3: ['pad', 'texture', 'arp', 'bass', 'keys', 'drums'],
  };

  // Arrangement map ({ part: 0 | 1 }) for an energy level: any part beyond pad and texture
  // sits a section out now and then. `r` is a seeded M.rng.
  function lineup(energy, melody, r) {
    const arr = {};
    for (const p of M.PARTS) {
      let on = LAYERS[energy].includes(p.id);
      if (on && p.id !== 'pad' && p.id !== 'texture' && r.chance(0.15)) on = false;
      arr[p.id] = on ? 1 : 0;
    }
    arr.melody = melody ? 1 : 0;
    return arr;
  }

  // Bars in a section: the floor's pace rounded up to whole loops of the section's progression.
  // The breather is half that and the intro about four bars, either one at most a pace and 8.
  function sectionBars(song, kind) {
    const pace = (M.MOOD[song.mood] || M.MOODS[0]).pace || 16;
    const prog = SECTIONS[kind].harmony === 'B' && song.progB && song.progB.length ? song.progB : song.prog;
    const loop = prog.length * song.hr;
    const up = (x) => Math.ceil(x / loop) * loop;
    if (kind === 'intro') return Math.min(8, up(4));
    if (kind === 'breather') return Math.min(pace, up(pace / 2));
    return up(pace);
  }

  // The sections of one round, seeded by song, floor and round: [{ kind, label, harmony, energy, melody, arr, bars }].
  function planChapter(song, chapter) {
    const r = M.rng(song.seed + ':' + song.mood + ':form:' + chapter);
    const kinds = chapter === 0 ? ['intro', 'theme', 'variation', 'bridge', 'breather', 'return']
      : ['theme', r.chance(0.7) && 'variation', 'bridge', r.chance(0.75) && 'breather', 'return'].filter(Boolean);
    return kinds.map((kind) => {
      const energy = kind === 'intro' || kind === 'breather' ? 1 : kind === 'bridge' ? (r.chance(0.6) ? 2 : 3) : 3;
      const melody = kind === 'intro' ? false : kind === 'bridge' ? r.chance(0.5) : kind === 'breather' ? r.chance(0.35) : true;
      return { kind, label: SECTIONS[kind].label, harmony: SECTIONS[kind].harmony, energy, melody, arr: lineup(energy, melody, r), bars: sectionBars(song, kind) };
    });
  }

  // Drives an engine from its 'bar' events. `evolve` and `arrange` are getters, so the live page
  // can follow its checkboxes; `onChange(result)` hears about every change. With Auto-arrange on,
  // it walks the song's sections and tells the engine which one is playing (setSection) and who
  // plays in it (setArrangement); Evolve then acts only where sections start, and every 16 bars
  // inside long ones, seeded by the song so a journey replays exactly. With Auto-arrange off the
  // loop plays as written and Evolve makes a move every 8 bars (`rand`, seeded by default).
  class Conductor {
    constructor(engine, { evolve: ev = () => true, arrange: ar = () => true, rand = null, onChange = () => {} } = {}) {
      this.engine = engine; this.wantEvolve = ev; this.wantArrange = ar; this.rand = rand; this.onChange = onChange;
      this.reset();
      // Sections and Evolve act at bar lines, slightly ahead of what you hear.
      engine.on('bar', ({ bar }) => this.bar(bar));
    }
    // Back to the plain loop: no section, every part in. Left at bar line `bar`, the loop starts
    // again there from the theme's first chord.
    reset(bar = 0) {
      this.sec = null; this.plan = null; this.lineup = null; this.theme = null; this.varied = null; this.origin = bar;
      this.engine.setSection(null, bar);
      this.engine.setArrangement({});
    }
    rng(tag) { const s = this.engine.song; return M.rng(s.seed + ':' + s.mood + ':' + tag); }

    bar(bar) {
      const song = this.engine.song;
      if (!song) return;
      // bar 0 is a new song, or Play again: nothing carries over from what played before
      if (bar === 0) { this.plan = null; this.theme = this.varied = null; this.origin = 0; }
      if (!this.wantArrange()) {
        if (this.sec) this.reset(bar);
        if (bar && bar % 8 === 0 && this.wantEvolve()) {
          const res = evolve(song, this.engine, bar, this.rand || this.rng('evolve:' + bar).next);
          if (res) this.onChange(res);
        }
        return;
      }
      if (bar === 0) return this.enter(0, 0, 0); // from the top: the intro
      if (!this.sec) {
        // joining a loop that is already playing: the theme, once the loop comes round
        if ((bar - this.origin) % (song.prog.length * song.hr) === 0) this.enter(0, 1, bar);
        return;
      }
      const at = bar - this.sec.start;
      if (at >= this.sec.bars) {
        const last = this.plan.sections.length - 1;
        return this.sec.index < last ? this.enter(this.sec.chapter, this.sec.index + 1, bar) : this.enter(this.sec.chapter + 1, 0, bar);
      }
      if (at % 16 === 0 && this.wantEvolve()) this.move(at);
    }

    enter(chapter, index, bar) {
      const song = this.engine.song;
      if (!this.plan || this.plan.chapter !== chapter || this.plan.song !== song) this.plan = { song, chapter, sections: planChapter(song, chapter) };
      const plan = this.plan.sections[index];
      const res = this.wantEvolve() ? this.develop(plan.kind, chapter, index) : null;
      // the length is worked out now, after any new chords, from the loop as it is
      this.sec = { kind: plan.kind, label: plan.label, harmony: plan.harmony, chapter, index, start: bar, bars: sectionBars(song, plan.kind) };
      this.lineup = plan.arr;
      this.engine.setSection(this.sec);
      this.engine.setArrangement(plan.arr);
      this.onChange(Object.assign({ section: this.sec, arr: plan.arr }, res));
    }

    // Evolve where a section starts. A new round may bring a new melody, new chords or a new key;
    // the variation varies the melody and the return brings the theme back (unless the melody was
    // redrawn by hand in between); the bridge may get a new arp or keys pattern.
    develop(kind, chapter, index) {
      const song = this.engine.song, melody = song.parts.melody, r = this.rng('develop:' + chapter + ':' + index);
      if (kind === 'theme' && chapter > 0) {
        const move = r.weighted({ melody: 3, chords: 1, key: 1, none: 2 });
        if (move === 'melody' && melody.on) { M.regenPart(song, 'melody', r); return { msg: 'new melody', lane: 'melody' }; }
        if (move === 'chords') { M.regenProgression(song, r); this.engine.rebuild(); return { msg: 'new chord progression', chords: true }; }
        if (move === 'key') {
          song.key = M.mod(song.key + r.pick([5, 7, 2, -2]), 12);
          this.engine.rebuild();
          return { msg: 'modulated to ' + M.NOTE[song.key] + ' ' + M.MODES[song.mode].name, chords: true, key: true };
        }
        return null;
      }
      if (kind === 'variation' && melody.on) {
        this.theme = melody.grid.map((row) => row.slice());
        const msg = M.varyMelody(song, r);
        this.varied = JSON.stringify(melody.grid);
        return { msg, lane: 'melody' };
      }
      if (kind === 'bridge') {
        const pool = ['arp', 'keys'].filter((id) => song.parts[id].on);
        if (!pool.length || !r.chance(0.5)) return null;
        const id = r.pick(pool);
        M.regenPart(song, id, r);
        return { msg: 'new ' + id + ' pattern', lane: id };
      }
      if (kind === 'return' && this.theme) {
        const back = JSON.stringify(melody.grid) === this.varied;
        if (back) melody.grid = this.theme;
        this.theme = this.varied = null;
        if (back) return { msg: 'the theme returns', lane: 'melody' };
      }
      return null;
    }

    // Inside a long section, every 16 bars: now and then a new pattern for a part that is playing.
    move(at) {
      const song = this.engine.song, { chapter, index } = this.sec;
      const r = this.rng('move:' + chapter + ':' + index + ':' + at);
      if (!r.chance(0.35)) return;
      const pool = ['arp', 'keys', 'bass', 'drums'].filter((id) => song.parts[id].on && this.lineup[id]);
      if (!pool.length) return;
      const id = r.pick(pool);
      M.regenPart(song, id, r);
      this.onChange({ msg: 'new ' + M.PART[id].name.toLowerCase() + ' pattern', lane: id });
    }
  }

  M.Evolve = { evolve, weighted, SECTIONS, LAYERS, lineup, sectionBars, planChapter, Conductor };
})();
