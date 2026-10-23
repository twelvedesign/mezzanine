/* Mezzanine — offline rendering of a song to a 16-bit stereo WAV, with Evolve and Auto-arrange.

   Renders are capped at RENDER_MAX_MIN minutes and made in one OfflineAudioContext. One
   continuous graph keeps the reverb and echo tails, compressor, tremolo LFOs, ambience loop
   and arrangement fades exactly as live playback has them. Rendering in chunks would need
   overlapping pre-rolls and crossfades at every seam, and the random reverb impulse and
   noise sources differ per context, so seams could never be sample-exact. The cost is
   memory: 10 minutes at 48 kHz is about 230 MB of float audio plus a 115 MB WAV. */
(function () {
  const M = (window.M = window.M || {});
  M.RENDER_MAX_MIN = 10;

  const pause = () => new Promise((res) => setTimeout(res, 0));
  const aborted = () => { const e = new Error('Export cancelled.'); e.name = 'AbortError'; return e; };

  // Recorded instruments are decoded once on the live context; the AudioBuffers play in any context.
  async function samplesReady(song, signal) {
    if (!M.Samples.ctx) M.Samples.attach(new (window.AudioContext || window.webkitAudioContext)());
    M.preloadSong(song);
    const ids = Object.values(song.parts).map((p) => M.VOICES[p.voice]).filter((v) => v && v.kind === 'sample').map((v) => v.inst);
    const until = Date.now() + 60000; // after a minute, missing instruments fall back to their synth versions
    while (ids.some((id) => !['ready', 'error'].includes(M.Samples.state[id])) && Date.now() < until) {
      if (signal && signal.aborted) throw aborted();
      await new Promise((res) => setTimeout(res, 100));
    }
  }

  // Renders `seconds` of the song. onProgress({ phase: 'samples' | 'render' | 'write', done: 0..1 or null }).
  // Resolves to { blob, seconds, sampleRate, peak, gain }.
  M.renderSong = async function (source, { seconds = 300, evolve = true, arrange = true, fadeIn = 2, onProgress = () => {}, signal } = {}) {
    seconds = Math.max(5, Math.min(seconds, M.RENDER_MAX_MIN * 60));
    const song = typeof structuredClone === 'function' ? structuredClone(source) : JSON.parse(JSON.stringify(source));
    onProgress({ phase: 'samples', done: null });
    await samplesReady(song, signal);

    const live = M.Samples.ctx.sampleRate;
    const sr = live === 44100 || live === 48000 ? live : 44100; // match the live context so shared noise buffers are not rebuilt
    const frames = Math.ceil(seconds * sr);
    const ctx = new OfflineAudioContext(2, frames, sr);
    const eng = new M.Engine();
    eng.init(ctx);
    eng.setSong(song);
    eng.playing = true;

    // Without suspend() everything is scheduled before rendering starts, so arrangement fades
    // (automation at ctx.currentTime) would all land at 0; only Evolve runs in that case.
    const stepwise = typeof ctx.suspend === 'function';
    new M.Evolve.Conductor(eng, { evolve: () => evolve, arrange: () => arrange && stepwise });

    const fadeOut = Math.min(10, Math.max(4, seconds * 0.06));
    const fg = eng.fade.gain;
    fg.setValueAtTime(0, 0);
    fg.linearRampToValueAtTime(1, fadeIn);
    fg.setValueAtTime(1, seconds - fadeOut);
    fg.linearRampToValueAtTime(0, seconds);

    let n = 0, t = 0.1;
    // Schedule up to the next bar line (or the end). Returns false when the song is fully scheduled.
    const scheduleBar = () => {
      do { eng.schedule(n, t); t += eng.stepDur(n); n++; } while (n % 16 && t < seconds);
      return t < seconds;
    };

    let buffer;
    if (stepwise) {
      // Like the live clock: each bar is scheduled about 0.1 s before it sounds, so Evolve and
      // Auto-arrange act at bar lines and finished notes can be released along the way.
      buffer = await new Promise((resolve, reject) => {
        const plan = () => {
          if (!scheduleBar()) return;
          const at = Math.max(t - 0.1, ctx.currentTime + 0.05);
          if (at >= seconds - 0.05) { while (scheduleBar()); return; }
          ctx.suspend(at).then(() => {
            if (signal && signal.aborted) return reject(aborted()); // left suspended; the context is dropped
            onProgress({ phase: 'render', done: ctx.currentTime / seconds });
            try { plan(); } catch (e) { return reject(e); }
            ctx.resume();
          });
        };
        plan();
        ctx.startRendering().then(resolve, reject);
      });
    } else {
      onProgress({ phase: 'render', done: null });
      let bars = 0;
      while (scheduleBar()) {
        if (++bars % 8 === 0) { await pause(); if (signal && signal.aborted) throw aborted(); }
      }
      buffer = await ctx.startRendering();
    }
    if (signal && signal.aborted) throw aborted();

    // 16-bit stereo WAV, written in slices so the page stays responsive.
    const chs = [buffer.getChannelData(0), buffer.getChannelData(1)];
    const peak = M.peak(chs);
    const gain = peak > 0.98 ? 0.98 / peak : 1; // safety only; the bus compressor normally keeps peaks well below
    const parts = [M.wavHeader(frames, sr, 2)];
    const slice = sr * 10;
    for (let from = 0; from < frames; from += slice) {
      parts.push(M.pcm16(chs, from, Math.min(frames, from + slice), gain));
      onProgress({ phase: 'write', done: Math.min(1, (from + slice) / frames) });
      await pause();
      if (signal && signal.aborted) throw aborted();
    }
    return { blob: new Blob(parts, { type: 'audio/wav' }), seconds, sampleRate: sr, peak, gain };
  };
})();
