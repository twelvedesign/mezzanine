# Mezzanine: notes for coding sessions

Generative ambient and elevator music in the browser. See README.md for features and layout.

## Ground rules
- No dependencies and no bundler. Scripts are classic `<script>` files sharing `window.M`, loaded in this order: core.js, audio.js, ui.js, device.js. A new script also belongs in the `SHELL` list in `sw.js`. The page must keep working when opened from `file://`.
- `js/core.js` stays pure: no DOM and no Web Audio, so it can be tested in Node.
- Musicality comes first. Grid rows are relative to the current chord (bass: R/3/5/8/approach; arp: chord tones rising; melody: scale-degree offsets −3..+8 from the chord root). Keep new generators chord-aware.
- Song codes (`M.encodeSong`/`M.decodeSong`) are a public format. Saved songs on users' shelves must keep loading, so add fields with defaults and never rename them.
- Do not edit `dist/` or `samples/` by hand. Regenerate them with `npm run build` and `tools/pack-samples.mjs`.

## Published version (Claude artifact) constraints
`dist/mezzanine.html` is published at https://claude.ai/artifact/7AtTkHqGS5GMVLCMonGWzD together with `samples/*.js`. Inside the artifact:
- File downloads, `window.print`, `alert`/`confirm`/`prompt`, microphone and service workers do not work.
- `location.hash` only carries bare tokens.
- Code paths that need any of these must check `window.MZ_ARTIFACT` (set by the build) and hide or adapt the feature.
- The manifest, home-screen tags and service worker are for local or hosted copies only. Tags placed before `<!-- page:start -->` in `index.html` never reach the artifact; `js/device.js` registers the worker only over http(s) when `MZ_ARTIFACT` is unset.

## Verify
- `npm test` must pass. Add tests for new pure logic in `tests/`.
- Browser check: `.claude/launch.json` has a `mezzanine` server on port 8791. Look for console errors, then click Play.
- Audio check without ears: render offline and measure the level. Build an `M.Engine`, call `init(new OfflineAudioContext(...))`, then `setSong` and set `playing = true`. Loop `schedule(n, t)` with `t += stepDur(n)`, then `startRendering()`. Check the peak stays below 1.0 and that there are no NaN samples. Mixes currently sit around −16 dB RMS.
- Nobody can listen inside a session. Say so when reporting, and describe what should be heard.
