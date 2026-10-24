/* Mezzanine — interface: floors, progression editor, mixer, sequencer lanes, visualizer, timer and shelf. */
(function () {
  const M = window.M;
  const $ = (s, el = document) => el.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mezzanine:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mezzanine:' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const LOCAL = !window.MZ_ARTIFACT;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const engine = new M.Engine();
  M.engine = engine;
  let song = null;
  let sel = null; // the chord open in the editor: { bridge, i }
  const lanes = {};

  /* ---------- Song lifecycle ---------- */
  function loadSong(s, opts = {}) {
    song = s;
    sel = null;
    engine.setSong(s, { atBar: !!opts.atBar });
    if (!opts.atBar || !engine.playing) resetArrangement();
    renderAll();
    remember();
  }
  function newSong(moodId, atBar = true) {
    const s = M.generateSong(M.newSeed(), moodId || song.mood);
    if (!$('#realChk').checked) M.setInstrumentFamily(s, false);
    loadSong(s, { atBar });
  }
  function touched(auto) { song.edited = true; remember(auto); renderCode(); }
  let remT, addressDue = false;
  function remember(auto) {
    if (!auto) addressDue = true;
    clearTimeout(remT);
    remT = setTimeout(() => {
      const code = M.encodeSong(song);
      store.set('last', code);
      if (addressDue) { addressDue = false; showInAddress(code); }
    }, 400);
    renderCode();
  }
  // Local and hosted copies keep the address on the song the listener picked or edited, so a
  // bookmark or a reload brings it back. Evolve's own changes stay out of it (they would rewrite
  // the address every few bars), and the artifact viewer never shows the frame's address.
  function showInAddress(code) {
    if (!LOCAL || location.hash === '#' + code) return;
    try { history.replaceState(history.state, '', '#' + code); } catch (e) {}
  }

  /* ---------- Rendering ---------- */
  function renderAll() {
    renderFloors(); renderInfo(); renderProg(); renderMixer(); renderRack(); renderCode();
    viz.setMood(M.MOOD[song.mood]);
  }

  function renderFloors() {
    const box = $('#floors');
    if (!box.children.length) {
      M.MOODS.forEach((m) => {
        box.append(h('button', { class: 'floor', type: 'button', 'data-id': m.id, title: m.blurb, onclick: () => pickFloor(m.id) },
          h('span', { class: 'btn-round' }, m.floor), h('span', { class: 'fl-name' }, m.name)));
      });
    }
    box.querySelectorAll('.floor').forEach((b) => {
      const lit = b.dataset.id === song.mood;
      b.classList.toggle('lit', lit);
      b.setAttribute('aria-pressed', lit);
    });
    $('#moodBlurb').textContent = M.MOOD[song.mood].blurb;
  }
  function pickFloor(id) {
    newSong(id);
    if (!engine.playing) togglePlay();
  }

  function renderInfo() {
    const mood = M.MOOD[song.mood];
    $('#floorLed').textContent = mood.floor;
    $('#indMood').textContent = mood.name;
    $('#indSong').textContent = '“' + song.title + '”';
    $('#keyRead').textContent = M.spell(song.key, song.mode)[song.key] + ' ' + M.MODES[song.mode].name;
    $('#bpmRead').textContent = song.tempo + ' BPM';
    if (!engine.playing) {
      const c = M.buildChords(song)[0];
      $('#chordName').textContent = c.name;
      $('#chordRoman').textContent = 'press play';
    }
    document.title = song.title + ' · ' + mood.name + ' · Mezzanine';
  }

  // The theme's chords and, below them, the bridge's; either row opens the same editor.
  function renderProg() {
    if (sel && !selList()[sel.i]) sel = null; // its chord went (Evolve wrote new chords)
    for (const [box, list, bridge] of [[$('#prog'), song.prog, false], [$('#progB'), song.progB, true]]) {
      box.innerHTML = '';
      M.buildChords(song, list).forEach((c, i) => {
        const open = !!sel && sel.bridge === bridge && sel.i === i;
        box.append(h('button', {
          class: 'chip' + (open ? ' sel' : ''), type: 'button', 'data-i': i,
          'aria-label': 'Edit ' + (bridge ? 'bridge' : 'theme') + ' chord ' + (i + 1) + ', ' + c.name,
          onclick: () => { sel = open ? null : { bridge, i }; renderProg(); },
        }, h('span', { class: 'cn' }, c.name), h('span', { class: 'cr' }, c.roman + ' · ' + M.EXT_LABEL[list[i].e])));
      });
    }
    $('#progBRow').classList.toggle('idle', !$('#arrangeChk').checked);
    markNow();
    $('#hrSel').value = String(song.hr);
    const ed = $('#progEditor');
    ed.hidden = !sel;
    if (!sel) return;
    const list = selList(), cur = list[sel.i];
    const degs = $('#peDegs'); degs.innerHTML = '';
    for (let d = 0; d < 7; d++) {
      degs.append(h('button', {
        class: 'btn' + (cur.d === d ? ' on' : ''), type: 'button',
        onclick: () => { cur.d = d; if (M.isDim(song.mode, d) && (cur.e === '9' || cur.e === '6')) cur.e = '7'; changedChords(); },
      }, M.chordName(song.key, song.mode, d, cur.e), ' ', h('small', {}, M.roman(song.mode, d))));
    }
    const exts = $('#peExts'); exts.innerHTML = '';
    for (const e of M.EXTS) {
      exts.append(h('button', { class: 'btn' + (cur.e === e ? ' on' : ''), type: 'button', onclick: () => { cur.e = e; changedChords(); } }, M.EXT_LABEL[e]));
    }
    $('#peDel').disabled = list.length <= 1;
    $('#peAdd').disabled = list.length >= 8;
  }
  const selList = () => (sel.bridge ? song.progB : song.prog);
  // The chord sounding now, in whichever progression is playing.
  const curChord = () => (engine.curBridge ? engine.chordsB : engine.chords)[engine.curChord || 0] || engine.chords[0];
  function markNow() {
    for (const [rowSel, bridge] of [['#prog', false], ['#progB', true]]) {
      document.querySelectorAll(rowSel + ' .chip').forEach((c, i) => c.classList.toggle('now', engine.playing && !!engine.curBridge === bridge && i === engine.curChord));
    }
  }
  function changedChords() {
    engine.rebuild();
    touched();
    renderProg();
    renderInfo();
  }

  function renderMixer() {
    const ks = $('#keySel');
    if (!ks.options.length) {
      M.NOTE.forEach((n, i) => ks.append(h('option', { value: i }, n)));
      M.MODE_ORDER.forEach((m) => $('#modeSel').append(h('option', { value: m }, M.MODES[m].name)));
    }
    ks.value = song.key;
    $('#modeSel').value = song.mode;
    setRange('tempo', song.tempo, (v) => v);
    setRange('swing', song.swing, (v) => Math.round(v * 100) + '%');
    setRange('space', song.fx.space, pct);
    setRange('echo', song.fx.echo, pct);
    setRange('warmth', song.fx.warmth, pct);
    setRange('volume', store.get('volume', 0.8), pct);
    $('#pentaChk').checked = !!song.penta;
  }
  const pct = (v) => Math.round(v * 100);
  function setRange(id, v, fmt) {
    $('#' + id).value = v;
    $('#' + id + 'Out').textContent = fmt(+v);
  }

  /* ---------- Rack ---------- */
  function rowLabels(id) {
    const meta = M.PART[id];
    if (id === 'drums') return M.DRUM_ROWS;
    if (id === 'pad' || id === 'keys') return [''];
    return Array.from({ length: meta.rows }, (_, r) => String(r));
  }

  function renderRack() {
    const rack = $('#rack');
    if (!rack.children.length) M.PARTS.forEach((meta, i) => rack.append(buildLane(meta, i)));
    M.PARTS.forEach((meta) => syncLane(meta.id));
    updateLabels(M.buildChords(song)[0]);
  }

  function buildLane(meta, idx) {
    const id = meta.id;
    const L = (lanes[id] = { id });
    const el = (L.el = h('div', { class: 'lane', style: `--pc: var(--c-${id})`, 'data-part': id }));
    const voiceSel = (L.voice = h('select', { 'aria-label': meta.name + ' sound', id: 'voice-' + id }));
    const real = meta.voices.filter((v) => M.VOICES[v].kind === 'sample');
    const synth = meta.voices.filter((v) => M.VOICES[v].kind !== 'sample');
    if (real.length) {
      voiceSel.append(h('optgroup', { label: 'Recorded instruments' }, real.map((v) => h('option', { value: v }, M.VOICES[v].label))));
      voiceSel.append(h('optgroup', { label: 'Synthesizers' }, synth.map((v) => h('option', { value: v }, M.VOICES[v].label))));
    } else meta.voices.forEach((v) => voiceSel.append(h('option', { value: v }, M.VOICES[v].label)));
    voiceSel.addEventListener('change', () => {
      song.parts[id].voice = voiceSel.value;
      M.preloadSong(song);
      if (id === 'texture') engine.ctx && engine.setBed();
      touched();
    });
    L.mute = h('button', { class: 'tbtn', type: 'button', title: 'Mute (' + (idx + 1) + ')', 'aria-label': 'Mute ' + meta.name, onclick: () => toggleMute(id) }, 'M');
    L.solo = h('button', { class: 'tbtn', type: 'button', title: 'Solo', 'aria-label': 'Solo ' + meta.name, onclick: () => { song.parts[id].solo = !song.parts[id].solo; engine.applyMix(); syncAllButtons(); } }, 'S');
    const btns = [L.mute, L.solo];
    if (meta.rows) {
      btns.push(h('button', { class: 'tbtn', type: 'button', title: 'Write a new pattern', 'aria-label': 'New ' + meta.name + ' pattern', onclick: () => { M.regenPart(song, id); syncLane(id); touched(); flash('new ' + meta.name.toLowerCase() + ' pattern'); } }, diceSvg()));
      btns.push(h('button', { class: 'tbtn', type: 'button', title: 'Clear pattern', 'aria-label': 'Clear ' + meta.name, onclick: () => { song.parts[id].grid.forEach((r) => r.fill(0)); syncLane(id); touched(); } }, 'Clear'));
    }
    if (id === 'melody') {
      L.breathe = h('button', { class: 'tbtn', type: 'button', title: 'Play two bars, rest two bars, taking turns across the loop', onclick: () => { song.parts.melody.breathe = !song.parts.melody.breathe; syncLane(id); touched(); } }, 'Breathe');
      btns.push(L.breathe);
    }
    L.vol = h('input', { type: 'range', min: 0, max: 1, step: 0.01, id: 'vol-' + id, 'aria-label': meta.name + ' volume' });
    L.vol.addEventListener('input', () => { song.parts[id].vol = +L.vol.value; engine.applyMix(); touched(); });
    const faders = [h('label', {}, 'Level', L.vol)];
    if (meta.rows) {
      L.vary = h('input', { type: 'range', min: 0, max: 1, step: 0.01, id: 'vary-' + id, 'aria-label': meta.name + ' variation' });
      L.vary.addEventListener('input', () => { song.parts[id].vary = +L.vary.value; touched(); });
      faders.push(h('label', { title: 'How freely each pass improvises on the pattern' }, 'Vary', L.vary));
    }
    // Brightness: the middle leaves the instrument as it is; a double-click puts it back there.
    L.bright = h('input', { type: 'range', min: 0, max: 1, step: 0.01, id: 'bright-' + id, 'aria-label': meta.name + ' brightness' });
    L.bright.addEventListener('input', () => { song.parts[id].bright = +L.bright.value; engine.applyMix(); touched(); });
    L.bright.addEventListener('dblclick', () => { delete song.parts[id].bright; L.bright.value = 0.5; engine.applyMix(); touched(); });
    faders.push(h('label', { title: 'Darker to the left, brighter to the right. Double-click for the middle.' }, 'Bright', L.bright));
    L.rest = h('span', { class: 'rest-tag', hidden: true }, 'resting');
    const head = h('div', { class: 'lane-head' },
      h('div', { class: 'lane-title' }, h('span', { class: 'dot' }), h('span', { class: 'lane-name' }, meta.name),
        h('span', { class: 'lane-sub' }, meta.sub + (meta.len ? ' · ' + meta.len / 16 + (meta.len > 16 ? ' bars' : ' bar') : '')), L.rest),
      h('div', { class: 'lane-row' }, voiceSel, ...btns),
      h('div', { class: 'faders' }, ...faders));
    el.append(head);

    if (!meta.rows) {
      L.chips = h('div', { class: 'tex-chips', role: 'group', 'aria-label': 'Ambience' });
      meta.voices.filter((v) => v !== 'none').forEach((v) => {
        L.chips.append(h('button', { class: 'tex-chip', type: 'button', 'data-v': v, onclick: () => {
          const p = song.parts.texture;
          if (p.voice === v && p.on) p.on = false; else { p.voice = v; p.on = true; }
          if (engine.ctx) { engine.setBed(); engine.applyMix(); }
          syncLane('texture'); touched();
        } }, M.VOICES[v].label));
      });
      voiceSel.hidden = true;
      el.append(L.chips);
      return el;
    }

    const rowh = meta.rows === 1 ? 26 : meta.rows >= 12 ? 13 : meta.rows >= 8 ? 15 : 18;
    const wrap = h('div', { class: 'grid-wrap', style: `--rowh:${rowh}px` });
    L.labels = h('div', { class: 'labels' });
    L.cells = h('div', { class: 'cells', style: `--len:${meta.len}`, role: 'grid', 'aria-label': meta.name + ' steps' });
    L.cellEls = [];
    for (let vr = meta.rows - 1; vr >= 0; vr--) {
      L.labels.append(h('span', {}, ''));
      L.cellEls[vr] = [];
      for (let s = 0; s < meta.len; s++) {
        const c = h('div', { class: 'cell' + (s % 4 === 0 ? ' beat' : ''), 'data-r': vr, 'data-s': s });
        L.cellEls[vr][s] = c;
        L.cells.append(c);
      }
    }
    L.playhead = h('div', { class: 'playhead' });
    L.cells.append(L.playhead);
    if (meta.len > 16) L.cells.append(h('div', { class: 'bar-mark' }));
    wireGrid(L, meta);
    wrap.append(L.labels, L.cells);
    el.append(wrap);
    return el;
  }

  function wireGrid(L, meta) {
    let painting = null;
    const apply = (cell) => {
      const r = +cell.dataset.r, s = +cell.dataset.s;
      const g = song.parts[meta.id].grid;
      if (painting === 'draw') {
        if (meta.mono) for (let k = 0; k < meta.rows; k++) g[k][s] = 0;
        g[r][s] = 0.8;
        if (engine.ctx && engine.ctx.state === 'running') preview(meta.id, r);
      } else g[r][s] = 0;
      syncCells(meta.id);
    };
    L.cells.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      e.preventDefault();
      painting = song.parts[meta.id].grid[+cell.dataset.r][+cell.dataset.s] ? 'erase' : 'draw';
      apply(cell);
    });
    L.cells.addEventListener('pointermove', (e) => {
      if (!painting) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el && el.closest && el.closest('.cell');
      if (!cell || !L.cells.contains(cell)) return;
      const g = song.parts[meta.id].grid[+cell.dataset.r][+cell.dataset.s];
      if ((painting === 'draw' && !g) || (painting === 'erase' && g)) apply(cell);
    });
    const end = () => { if (painting) { painting = null; touched(); } };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function preview(id, row) {
    const ctx = engine.ctx, t = ctx.currentTime + 0.01, ch = curChord();
    const out = engine.parts[id].input, voice = song.parts[id].voice;
    if (id === 'drums') return M.playDrum(ctx, out, row, t, 0.7);
    const notes = id === 'pad' ? ch.pad : id === 'keys' ? ch.keys : id === 'bass' ? [ch.bass[row]] : id === 'arp' ? [ch.arp[row]] : [M.melodyMidi(song, ch, row)];
    notes.forEach((m) => M.playVoice(ctx, out, voice, m, t, 0.35, 0.6));
  }

  function syncCells(id) {
    const L = lanes[id], meta = M.PART[id], g = song.parts[id].grid;
    for (let r = 0; r < meta.rows; r++) for (let s = 0; s < meta.len; s++) {
      const c = L.cellEls[r][s], v = g[r][s];
      c.classList.toggle('on', !!v);
      if (v) c.style.setProperty('--v', v.toFixed(2)); else c.style.removeProperty('--v');
    }
  }
  function syncLane(id) {
    const L = lanes[id], p = song.parts[id], meta = M.PART[id];
    L.voice.value = p.voice;
    L.vol.value = p.vol;
    if (L.vary) L.vary.value = p.vary;
    L.bright.value = M.brightOf(p);
    if (meta.rows) syncCells(id);
    if (L.breathe) { L.breathe.classList.toggle('on-b', !!p.breathe); L.breathe.setAttribute('aria-pressed', !!p.breathe); }
    if (L.chips) L.chips.querySelectorAll('.tex-chip').forEach((c) => { const on = p.on && c.dataset.v === p.voice; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
    syncAllButtons();
  }
  function syncAllButtons() {
    for (const meta of M.PARTS) {
      const L = lanes[meta.id], p = song.parts[meta.id];
      if (!L) continue;
      L.mute.classList.toggle('on-m', !p.on);
      L.mute.setAttribute('aria-pressed', !p.on);
      L.solo.classList.toggle('on-s', !!p.solo);
      L.solo.setAttribute('aria-pressed', !!p.solo);
      L.el.classList.toggle('off', !engine.song || !engine.audible(meta.id));
    }
  }
  function toggleMute(id) {
    const p = song.parts[id];
    p.on = !p.on;
    if (engine.ctx) { engine.applyMix(); if (id === 'texture') engine.setBed(); }
    syncLane(id); touched();
  }

  function updateLabels(ch) {
    if (!ch) return;
    const NAME = M.spell(song.key, song.mode);
    for (const meta of M.PARTS) {
      const L = lanes[meta.id];
      if (!L || !L.labels) continue;
      const spans = L.labels.children;
      for (let vr = 0; vr < meta.rows; vr++) {
        let txt;
        if (meta.id === 'drums') txt = M.DRUM_ROWS[vr];
        else if (meta.id === 'pad' || meta.id === 'keys') txt = ch.name;
        else if (meta.id === 'bass') txt = ['R', '3', '5', '8', '→'][vr] + ' ' + NAME[M.mod(ch.bass[vr], 12)];
        else if (meta.id === 'arp') txt = NAME[M.mod(ch.arp[vr], 12)];
        else txt = NAME[M.mod(M.melodyMidi(song, ch, vr), 12)];
        spans[meta.rows - 1 - vr].textContent = txt;
      }
    }
  }

  function renderCode() {
    if (!song) return;
    $('#codeOut').value = M.encodeSong(song);
  }

  /* ---------- Transport + live events ---------- */
  async function togglePlay() {
    if (engine.playing) { engine.stop(); return; }
    await engine.start();
    engine.setVolume(+$('#volume').value);
  }
  engine.on('play', (on) => {
    $('#playBtn').classList.toggle('on', on);
    $('#playBtn').setAttribute('aria-label', on ? 'Stop' : 'Play');
    $('#rack').classList.toggle('playing', on);
    if (!on) { markNow(); showSection(null); renderInfo(); }
  });
  engine.on('song', (s) => {
    if (s !== song) return;
    syncAllButtons();
  });
  engine.on('chords', () => { renderProg(); updateLabels(curChord()); });

  // The song's sections, Evolve and auto-arrange live in evolve.js; the page only reacts to what changed.
  const conductor = new M.Evolve.Conductor(engine, {
    evolve: () => $('#evolveChk').checked,
    arrange: () => $('#arrangeChk').checked,
    onChange(res) {
      if (res.section) flash(res.section.label.toLowerCase() + (res.msg ? ' · ' + res.msg : ''));
      else if (res.msg) flash(res.msg);
      if (!res.msg) return;
      if (res.key) renderMixer();
      if (res.chords) renderInfo();
      if (res.lane) syncLane(res.lane);
      touched(true);
    },
  });
  function resetArrangement() { conductor.reset(); showSection(null); }
  function showSection(sec) {
    const el = $('#secRead');
    el.hidden = !sec;
    el.textContent = sec ? sec.label : '';
  }
  engine.on('arrange', (arr) => {
    for (const meta of M.PARTS) {
      const L = lanes[meta.id];
      if (L) L.rest.hidden = !(arr[meta.id] === 0 && song.parts[meta.id].on);
    }
  });

  let flashT;
  function flash(msg) {
    const el = $('#log');
    el.textContent = '↳ ' + msg;
    el.classList.add('show');
    clearTimeout(flashT);
    flashT = setTimeout(() => el.classList.remove('show'), 4200);
  }

  function handle(ev) {
    if (ev.type === 'step') {
      const n = ev.n;
      for (const meta of M.PARTS) {
        const L = lanes[meta.id];
        if (L && L.playhead) L.playhead.style.transform = `translateX(${(n % meta.len) * 100}%)`;
      }
      const bar = Math.floor(n / 16) + 1, beat = Math.floor((n % 16) / 4) + 1;
      $('#barRead').textContent = 'BAR ' + String(bar).padStart(3, '0') + ' · ' + beat;
    } else if (ev.type === 'chord') {
      engine.curChord = ev.ci; engine.curBridge = ev.bridge;
      $('#chordName').textContent = ev.chord.name;
      $('#chordRoman').textContent = ev.chord.roman + ' · ' + (ev.bridge ? 'bridge chord ' : 'chord ') + (ev.ci + 1) + ' of ' + (ev.bridge ? engine.chordsB : engine.chords).length;
      markNow();
      updateLabels(ev.chord);
      viz.chord(ev.chord);
    } else if (ev.type === 'section') {
      showSection(ev.sec);
    } else if (ev.type === 'note') {
      const L = lanes[ev.part];
      if (L && L.cellEls && L.cellEls[ev.row]) {
        const c = L.cellEls[ev.row][ev.step];
        if (c) { c.classList.add('hit'); setTimeout(() => c.classList.remove('hit'), 160); }
      }
      viz.note(ev);
    }
  }

  /* ---------- Visualizer ---------- */
  const viz = (function () {
    const cv = $('#viz'), g = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, colors = {}, hues = [200, 250, 30], parts = [], halos = [];
    const wave = new Uint8Array(1024);
    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      for (const p of M.PARTS) colors[p.id] = cs.getPropertyValue('--c-' + p.id).trim();
      colors.bg = cs.getPropertyValue('--viz-bg').trim();
      colors.brass = cs.getPropertyValue('--brass').trim();
      colors.dark = cs.getPropertyValue('color-scheme').trim() !== 'light';
    }
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function xFor(m) { return W * (0.06 + 0.88 * Math.min(1, Math.max(0, (m - 30) / 66))); }
    function note(ev) {
      if (parts.length > 260) parts.splice(0, 40);
      const c = colors[ev.part];
      if (ev.part === 'drums') {
        parts.push({ x: W * (0.1 + 0.8 * (ev.step / 16)), y: H - 26, vx: 0, vy: -6, r: 1.5 + ev.v * 2, life: 0, max: 0.9, c });
        return;
      }
      const ms = ev.notes && ev.part !== 'bass' ? ev.notes : [ev.midi];
      ms.forEach((m) => {
        const big = ev.part === 'melody' ? 5 : ev.part === 'arp' ? 3.5 : ev.part === 'bass' ? 6 : 2.5;
        parts.push({
          x: xFor(m) + (Math.random() - 0.5) * 18, y: H * (0.92 - ((m - 30) / 66) * 0.55) + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 6, vy: reduced ? 0 : -(6 + Math.random() * 14), r: big * (0.6 + ev.v * 0.7),
          life: 0, max: ev.part === 'pad' ? 5 : 2.6 + Math.random() * 1.6, c,
        });
      });
    }
    function chord(ch) {
      halos.push({ life: 0, max: 7, c: colors.pad, r0: 30 });
      if (halos.length > 6) halos.shift();
    }
    let last = performance.now(), T = 0;
    function draw() {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
      last = now; T += dt * (reduced ? 0.2 : 1);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = colors.bg; g.fillRect(0, 0, W, H);
      // drifting colour fields keyed to the floor's hues
      hues.forEach((hue, i) => {
        const x = W * (0.5 + 0.38 * Math.sin(T * 0.05 + i * 2.1)), y = H * (0.5 + 0.3 * Math.cos(T * 0.037 + i * 1.7));
        const rad = Math.max(W, H) * (0.45 + 0.1 * Math.sin(T * 0.08 + i));
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `hsla(${hue}, ${colors.dark ? 45 : 55}%, ${colors.dark ? 45 : 62}%, ${colors.dark ? 0.2 : 0.3})`);
        gr.addColorStop(1, 'hsla(0,0%,0%,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      });
      g.globalCompositeOperation = colors.dark ? 'lighter' : 'source-over';
      halos = halos.filter((o) => (o.life += dt) < o.max);
      halos.forEach((o) => {
        const k = o.life / o.max;
        g.strokeStyle = o.c; g.globalAlpha = 0.35 * (1 - k); g.lineWidth = 1.5;
        g.beginPath(); g.arc(W / 2, H / 2, o.r0 + k * Math.max(W, H) * 0.5, 0, Math.PI * 2); g.stroke();
      });
      parts = parts.filter((p) => (p.life += dt) < p.max);
      for (const p of parts) {
        const k = p.life / p.max;
        const a = k < 0.08 ? k / 0.08 : 1 - (k - 0.08) / 0.92;
        p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = a * 0.22; g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2); g.fill();
        g.globalAlpha = a * 0.9;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      if (engine.analyser && engine.playing) {
        engine.analyser.getByteTimeDomainData(wave);
        g.strokeStyle = colors.brass; g.globalAlpha = 0.55; g.lineWidth = 1.2;
        g.beginPath();
        const y0 = H * 0.7;
        for (let i = 0; i < wave.length; i += 4) {
          const x = (i / wave.length) * W, y = y0 + ((wave[i] - 128) / 128) * H * 0.18;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke(); g.globalAlpha = 1;
      }
    }
    readColors(); resize();
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);
    return { draw, note, chord, readColors, setMood(m) { hues = m.hue; } };
  })();

  function frame() {
    if (engine.ctx && engine.playing) {
      const now = engine.ctx.currentTime, ev = engine.events;
      let i = 0;
      while (i < ev.length && ev[i].t <= now) handle(ev[i++]);
      if (i) ev.splice(0, i);
    }
    viz.draw();
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && engine.ctx) engine.events = engine.events.filter((e) => e.t > engine.ctx.currentTime - 0.05); });

  M.Samples.on(({ total, ready, failed }) => {
    const el = $('#loadLine');
    if (failed.length) { el.textContent = 'Some instruments could not load, so their synth versions are playing.'; el.hidden = false; return; }
    el.hidden = ready >= total;
    el.textContent = 'Loading recorded instruments · ' + ready + ' of ' + total;
  });

  /* ---------- Timer ---------- */
  let timerEnd = 0, timerIv = null;
  $('#timerSel').addEventListener('change', async (e) => {
    const min = +e.target.value;
    clearInterval(timerIv);
    engine.cancelFade();
    $('#timerBox').classList.toggle('running', min > 0);
    if (!min) { $('#timerReadout').textContent = '--:--'; return; }
    timerEnd = Date.now() + min * 60000;
    if (!engine.playing) await togglePlay();
    tickTimer();
    timerIv = setInterval(tickTimer, 500);
  });
  function tickTimer() {
    const left = Math.max(0, timerEnd - Date.now());
    const s = Math.ceil(left / 1000);
    $('#timerReadout').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    if (left <= 0) {
      clearInterval(timerIv);
      $('#timerSel').value = '0';
      $('#timerBox').classList.remove('running');
      $('#timerReadout').textContent = 'done';
      engine.chime();
      flash('focus session complete');
      if ($('#timerFade').checked && engine.playing) engine.fadeOut(20);
    }
  }

  /* ---------- Library ---------- */
  function renderShelf() {
    const list = store.get('shelf', []);
    const ul = $('#shelf'); ul.innerHTML = '';
    if (!list.length) { ul.append(h('li', { class: 'empty' }, 'Nothing kept yet. Press “Keep this song” to add the current song.')); return; }
    list.forEach((it, i) => {
      ul.append(h('li', {},
        h('span', { class: 'sh-name' }, it.title, h('small', {}, M.MOOD[it.mood] ? M.MOOD[it.mood].name : '')),
        h('button', { class: 'tbtn', type: 'button', onclick: () => { try { loadSong(M.decodeSong(it.code), { atBar: true }); } catch (e) { msg(e.message); } } }, 'Play'),
        h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Remove ' + it.title, onclick: () => { list.splice(i, 1); store.set('shelf', list); renderShelf(); } }, '×')));
    });
  }
  function msg(t) { $('#codeMsg').textContent = t; clearTimeout(msg.t); msg.t = setTimeout(() => ($('#codeMsg').textContent = ''), 4000); }

  $('#saveBtn').addEventListener('click', () => {
    const list = store.get('shelf', []);
    list.unshift({ title: song.title, mood: song.mood, code: M.encodeSong(song) });
    store.set('shelf', list.slice(0, 40));
    renderShelf();
    msg('Kept “' + song.title + '” on your shelf.');
  });
  // Copies text, or when the clipboard is refused shows it selected in the code box.
  function copy(text, what, done) {
    const inp = $('#codeOut');
    const fallback = () => { inp.value = text; inp.focus(); inp.select(); msg(what + ' selected. Press Ctrl+C or ⌘C to copy.'); };
    try { navigator.clipboard.writeText(text).then(() => msg(done), fallback); } catch (e) { fallback(); }
  }
  $('#codeOut').addEventListener('blur', renderCode);
  $('#copyBtn').addEventListener('click', () => copy(M.encodeSong(song), 'Code', 'Song code copied.'));
  // Song links open this page on the song. Inside the artifact the frame's own address is private,
  // so links go to MZ_LINK instead, which the build sets to the public site.
  const linkBase = LOCAL ? location.href : window.MZ_LINK;
  if (!linkBase) $('#linkBtn').hidden = true;
  $('#linkBtn').addEventListener('click', () => copy(M.songLink(linkBase, song), 'Link', 'Link to “' + song.title + '” copied.'));
  // A link pasted into the address bar of an open page only changes the fragment.
  window.addEventListener('hashchange', () => { try { loadSong(M.songFromLink(location.hash), { atBar: true }); } catch (e) {} });
  $('#loadBtn').addEventListener('click', () => {
    try { loadSong(M.songFromLink($('#codeIn').value), { atBar: true }); $('#codeIn').value = ''; msg('Loaded “' + song.title + '”.'); }
    catch (e) { msg('That code could not be read. ' + (e.message.startsWith('Song codes') ? e.message : 'Check that it was copied in full.')); }
  });

  // Recording (local copies only; the hosted page cannot download files)
  let rec = null, recChunks = [], recStart = 0, recIv;
  const recBtn = $('#recBtn');
  if (!LOCAL) recBtn.hidden = true;
  recBtn.addEventListener('click', async () => {
    if (rec) { rec.stop(); return; }
    engine.init();
    if (!engine.recDest || !window.MediaRecorder) { msg('Recording is not supported in this browser.'); return; }
    if (!engine.playing) await togglePlay();
    recChunks = [];
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    rec = new MediaRecorder(engine.recDest.stream, type ? { mimeType: type } : {});
    rec.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
    rec.onstop = () => {
      clearInterval(recIv);
      const blob = new Blob(recChunks, { type: rec.mimeType });
      const a = h('a', { href: URL.createObjectURL(blob), download: song.title.replace(/\s+/g, '-').toLowerCase() + (rec.mimeType.includes('mp4') ? '.m4a' : '.webm') });
      document.body.append(a); a.click(); a.remove();
      rec = null; recBtn.classList.remove('rec'); recBtn.textContent = 'Record audio';
      msg('Recording saved to your downloads.');
    };
    rec.start(1000); recStart = Date.now();
    recBtn.classList.add('rec');
    recIv = setInterval(() => { const s = Math.floor((Date.now() - recStart) / 1000); recBtn.textContent = 'Stop recording ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 500);
  });

  /* ---------- Export (local copies only, like recording) ---------- */
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function expMsg(t) { $('#expMsg').textContent = t; }
  if (!LOCAL) $('#exportCol').hidden = true;
  const wavLabel = () => { $('#wavBtn').textContent = 'Download WAV (' + $('#wavLen').value + ' min)'; };
  const midiLabel = () => { $('#midiBtn').textContent = 'Download MIDI (' + $('#midiBars').value + ' bars)'; };
  $('#wavLen').addEventListener('change', wavLabel);
  $('#midiBars').addEventListener('change', midiLabel);

  $('#midiBtn').addEventListener('click', () => {
    const bars = +$('#midiBars').value;
    const score = M.songNotes(song, { bars });
    download(new Blob([M.writeMidi(score)], { type: 'audio/midi' }), M.fileSlug(song.title) + '-' + bars + 'bars.mid');
    expMsg('MIDI saved: ' + score.tracks.length + ' parts, ' + bars + ' bars at ' + song.tempo + ' BPM.');
  });

  let exporting = null;
  const PHASE = { samples: 'Loading instruments', render: 'Rendering', write: 'Writing WAV' };
  $('#wavBtn').addEventListener('click', async () => {
    if (exporting) return;
    const min = +$('#wavLen').value;
    exporting = new AbortController();
    $('#wavBtn').disabled = true;
    $('#expProg').hidden = false;
    expMsg('');
    const started = Date.now();
    try {
      engine.init(); // instruments are decoded on the live context and shared with the render
      const res = await M.renderSong(song, {
        seconds: min * 60, evolve: $('#evolveChk').checked, arrange: $('#arrangeChk').checked, signal: exporting.signal,
        onProgress({ phase, done }) {
          const bar = $('#expBar');
          if (done == null) bar.removeAttribute('value'); else bar.value = done;
          $('#expText').textContent = PHASE[phase] + (done == null ? '…' : ' ' + Math.round(done * 100) + '%');
        },
      });
      download(res.blob, M.fileSlug(song.title) + '-' + min + 'min.wav');
      expMsg('WAV saved: ' + min + ' min, ' + Math.round(res.blob.size / 1048576) + ' MB, rendered in ' + Math.round((Date.now() - started) / 1000) + ' s.');
    } catch (e) {
      expMsg(e.name === 'AbortError' ? 'Export cancelled.' : 'The WAV could not be rendered. ' + e.message);
    } finally {
      exporting = null;
      $('#wavBtn').disabled = false;
      $('#expProg').hidden = true;
    }
  });
  $('#expCancel').addEventListener('click', () => exporting && exporting.abort());

  /* ---------- Controls ---------- */
  $('#playBtn').addEventListener('click', togglePlay);
  $('#newBtn').addEventListener('click', () => { newSong(); if (!engine.playing) togglePlay(); });
  $('#progDice').addEventListener('click', () => { M.regenProgression(song); sel = null; changedChords(); flash('new chords for the theme and bridge'); });
  $('#hrSel').addEventListener('change', (e) => { song.hr = +e.target.value; changedChords(); });
  $('#peAdd').addEventListener('click', () => {
    const list = selList(), c = list[sel.i];
    list.splice(sel.i + 1, 0, { d: M.mod(c.d + 3, 7), e: c.e });
    if (M.isDim(song.mode, list[sel.i + 1].d)) list[sel.i + 1].d = 4;
    sel.i++; changedChords();
  });
  $('#peDel').addEventListener('click', () => { const list = selList(); list.splice(sel.i, 1); sel.i = Math.min(sel.i, list.length - 1); changedChords(); });
  $('#peClose').addEventListener('click', () => { sel = null; renderProg(); });
  $('#keySel').addEventListener('change', (e) => { song.key = +e.target.value; changedChords(); });
  $('#modeSel').addEventListener('change', (e) => {
    song.mode = e.target.value;
    song.prog.concat(song.progB).forEach((c) => { if (M.isDim(song.mode, c.d)) c.d = M.mod(c.d + 2, 7); });
    changedChords();
  });
  const bindRange = (id, apply, fmt) => $('#' + id).addEventListener('input', (e) => { const v = +e.target.value; $('#' + id + 'Out').textContent = fmt(v); apply(v); });
  bindRange('tempo', (v) => { song.tempo = v; engine.applyFx(); renderInfo(); touched(); }, (v) => v);
  bindRange('swing', (v) => { song.swing = v; touched(); }, (v) => Math.round(v * 100) + '%');
  bindRange('space', (v) => { song.fx.space = v; engine.applyFx(); touched(); }, pct);
  bindRange('echo', (v) => { song.fx.echo = v; engine.applyFx(); touched(); }, pct);
  bindRange('warmth', (v) => { song.fx.warmth = v; engine.applyFx(); touched(); }, pct);
  bindRange('volume', (v) => { engine.setVolume(v); store.set('volume', v); }, pct);
  $('#pentaChk').addEventListener('change', (e) => { song.penta = e.target.checked; updateLabels(curChord()); touched(); });
  $('#evolveChk').addEventListener('change', (e) => store.set('evolve', e.target.checked));
  $('#realChk').addEventListener('change', (e) => {
    store.set('real', e.target.checked);
    M.setInstrumentFamily(song, e.target.checked);
    M.preloadSong(song);
    M.PARTS.forEach((m) => syncLane(m.id));
    touched();
    flash(e.target.checked ? 'recorded instruments' : 'synthesizers');
  });
  $('#arrangeChk').addEventListener('change', (e) => {
    store.set('arrange', e.target.checked);
    $('#progBRow').classList.toggle('idle', !e.target.checked);
    // while playing, the Conductor leaves the form at the next bar line
    if (!e.target.checked && !engine.playing) resetArrangement();
  });

  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    viz.readColors();
  }
  $('#themeBtn').addEventListener('click', () => {
    const dark = getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim() !== 'light';
    const t = dark ? 'light' : 'dark';
    store.set('theme', t); applyTheme(t);
  });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => viz.readColors());

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); togglePlay(); }
    else if (k === 'n' || k === 'N') { newSong(); if (!engine.playing) togglePlay(); }
    else if (k === 'ArrowRight' || k === 'ArrowLeft') {
      if (e.target.closest('button')) return;
      const i = M.MOODS.findIndex((m) => m.id === song.mood);
      pickFloor(M.MOODS[M.mod(i + (k === 'ArrowRight' ? 1 : -1), M.MOODS.length)].id);
    } else if (k === 'e' || k === 'E') { const c = $('#evolveChk'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); flash('evolve ' + (c.checked ? 'on' : 'off')); }
    else if (k === 'a' || k === 'A') { const c = $('#arrangeChk'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); flash('auto-arrange ' + (c.checked ? 'on' : 'off')); }
    else if (/^[1-7]$/.test(k)) toggleMute(M.PARTS[+k - 1].id);
  });
  // Transport for js/device.js (lock-screen controls)
  M.ui = { togglePlay, newSong, loadSong, song: () => song };

  /* ---------- Boot ---------- */
  const theme = store.get('theme', null);
  if (theme) applyTheme(theme);
  $('#evolveChk').checked = store.get('evolve', true);
  $('#arrangeChk').checked = store.get('arrange', true);
  $('#realChk').checked = store.get('real', true);
  let first = null;
  try { if (location.hash) first = M.songFromLink(location.hash); } catch (e) {}
  if (!first) { try { const last = store.get('last', null); if (last) { first = M.decodeSong(last); M.setInstrumentFamily(first, $('#realChk').checked); } } catch (e) {} }
  if (!first) first = M.generateSong(M.newSeed(), 'lobby');
  loadSong(first);
  renderShelf();
  requestAnimationFrame(frame);

  function diceSvg() {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>';
    return s;
  }
})();
