/* Mezzanine — phone and background listening: output through a media element, a context that
   resumes after interruptions, Media Session (lock-screen controls and artwork), the compact
   Studio disclosure, and the installable offline app for local or hosted copies. */
(function () {
  const M = window.M, ui = M.ui, engine = M.engine;
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mezzanine:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mezzanine:' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const WEB = /^https?:$/.test(location.protocol) && !window.MZ_ARTIFACT;
  const touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  /* ---------- Audio output ---------- */
  // Safari 17+: the "playback" session is not muted by the ring/silent switch.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  // Phones and tablets play through a hidden <audio> element. Desktop keeps direct Web Audio
  // output, which has lower latency for drawing notes into the sequencer.
  if (touch) {
    const el = document.createElement('audio');
    el.setAttribute('playsinline', '');
    el.hidden = true;
    document.body.append(el);
    engine.useMediaElement(el);
    // The system paused the element (a call, another app took the audio): show it as stopped.
    el.addEventListener('pause', () => { if (engine.playing && engine.outEl === el) engine.stop(0.05); });
  }

  /* ---------- Keep the context running ---------- */
  let watched = null, graceT;
  function wake() {
    const ctx = engine.ctx;
    if (ctx && engine.playing && ctx.state !== 'running') ctx.resume().catch(() => {});
  }
  function watch(ctx) {
    watched = ctx;
    ctx.addEventListener('statechange', () => {
      clearTimeout(graceT);
      if (ctx.state === 'running' || ctx.state === 'closed' || !engine.playing) return;
      wake();
      // A short interruption (a notification sound) passes by itself. A longer one stops the
      // music so the Play button tells the truth; the next tap on Play starts it again.
      graceT = setTimeout(() => { if (engine.playing && ctx.state !== 'running') engine.stop(0.05); }, 2500);
    });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('pageshow', wake);
  document.addEventListener('pointerdown', wake, true);

  /* ---------- Media Session ---------- */
  const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
  let artKey = '', artUrl = '';

  // Square cover drawn from the floor's colours, its indicator letter and the song title.
  function artwork(song, mood) {
    const key = song.title + '|' + song.mood;
    if (key === artKey) return artUrl;
    const S = 512, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.fillStyle = '#0c1416'; g.fillRect(0, 0, S, S);
    const spots = [[0.2, 0.25], [0.85, 0.4], [0.45, 0.95]];
    mood.hue.forEach((hue, i) => {
      const [x, y] = spots[i % 3], gr = g.createRadialGradient(x * S, y * S, 0, x * S, y * S, S * 0.75);
      gr.addColorStop(0, `hsla(${hue}, 50%, 48%, 0.55)`);
      gr.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    });
    const display = "'Poiret One', Didot, Georgia, serif";
    // floor indicator
    g.fillStyle = 'rgba(12, 20, 22, 0.55)'; g.strokeStyle = 'rgba(241, 208, 142, 0.6)'; g.lineWidth = 3;
    g.beginPath(); g.roundRect ? g.roundRect(196, 92, 120, 120, 22) : g.rect(196, 92, 120, 120); g.fill(); g.stroke();
    g.fillStyle = '#f1d08e'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(211, 170, 95, 0.7)'; g.shadowBlur = 24;
    g.font = `500 76px 'DM Mono', ui-monospace, Menlo, monospace`;
    g.fillText(mood.floor, S / 2, 156);
    g.shadowBlur = 0;
    // title, wrapped onto at most two lines
    g.fillStyle = '#e9e4d8';
    let size = 58;
    const lines = () => {
      g.font = `400 ${size}px ${display}`;
      const out = [''];
      for (const w of song.title.split(/\s+/)) {
        const t = out[out.length - 1] ? out[out.length - 1] + ' ' + w : w;
        if (g.measureText(t).width > S - 72 && out[out.length - 1]) out.push(w); else out[out.length - 1] = t;
      }
      return out;
    };
    let ls = lines();
    while ((ls.length > 2 || ls.some((l) => g.measureText(l).width > S - 72)) && size > 30) { size -= 4; ls = lines(); }
    ls.slice(0, 2).forEach((l, i) => g.fillText(l, S / 2, 300 + i * size * 1.1 - (ls.length > 1 ? size * 0.3 : 0)));
    g.fillStyle = '#d3aa5f';
    g.font = `500 22px 'DM Mono', ui-monospace, Menlo, monospace`;
    g.fillText(mood.name.toUpperCase(), S / 2, 432);
    g.fillStyle = 'rgba(233, 228, 216, 0.55)';
    g.font = `400 26px ${display}`;
    g.fillText('Mezzanine', S / 2, 470);
    // JPEG: as a PNG the gradients weigh about 450 KB
    try { artUrl = cv.toDataURL('image/jpeg', 0.86); artKey = key; } catch (e) { artUrl = ''; }
    return artUrl;
  }

  function setMeta(song) {
    if (!ms || !song || !window.MediaMetadata) return;
    const mood = M.MOOD[song.mood];
    const art = artwork(song, mood);
    try {
      ms.metadata = new MediaMetadata({
        title: song.title, artist: 'Mezzanine', album: mood.name,
        artwork: art ? [{ src: art, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    } catch (e) {}
  }

  // Previous track returns to the song before (this visit); with none left, it steps down a floor.
  const history = [];
  let goingBack = false, current = engine.song;
  engine.on('song', (s) => {
    if (current && s !== current && !goingBack) {
      history.push(M.encodeSong(current));
      if (history.length > 20) history.shift();
    }
    goingBack = false;
    current = s;
    setMeta(s);
  });
  function previous() {
    const code = history.pop();
    if (code) {
      try { goingBack = true; ui.loadSong(M.decodeSong(code), { atBar: true }); return; } catch (e) { goingBack = false; }
    }
    const i = M.MOODS.findIndex((m) => m.id === ui.song().mood);
    ui.newSong(M.MOODS[M.mod(i - 1, M.MOODS.length)].id);
  }

  engine.on('play', (on) => {
    if (on && engine.ctx && engine.ctx !== watched) watch(engine.ctx);
    if (ms) ms.playbackState = on ? 'playing' : 'paused';
  });
  if (ms) {
    const act = (name, fn) => { try { ms.setActionHandler(name, fn); } catch (e) {} };
    act('play', () => { if (!engine.playing) ui.togglePlay(); });
    act('pause', () => { if (engine.playing) ui.togglePlay(); });
    act('stop', () => { if (engine.playing) ui.togglePlay(); });
    act('nexttrack', () => ui.newSong());
    act('previoustrack', previous);
    ['seekbackward', 'seekforward', 'seekto'].forEach((n) => act(n, null));
    setMeta(engine.song);
    // redraw the cover once the display font has arrived
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { artKey = ''; setMeta(engine.song); });
  }

  /* ---------- Studio disclosure (compact layout) ---------- */
  const studio = $('#studio'), studioBtn = $('#studioBtn');
  function setStudio(open) {
    studio.classList.toggle('shut', !open);
    studioBtn.setAttribute('aria-expanded', open);
  }
  setStudio(store.get('studio', false));
  studioBtn.addEventListener('click', () => {
    const open = studio.classList.contains('shut');
    setStudio(open);
    store.set('studio', open);
  });

  /* ---------- Offline app (local or hosted copies only) ---------- */
  // The Claude artifact frame refuses service workers, and file:// cannot fetch a manifest.
  if (WEB) {
    document.head.append(Object.assign(document.createElement('link'), { rel: 'manifest', href: 'manifest.webmanifest' }));
    if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
