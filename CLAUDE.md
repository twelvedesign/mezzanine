# Mezzanine: notes for coding sessions

Generative ambient and elevator music in the browser. See README.md for features and layout.

## Ground rules
- No dependencies and no bundler. Scripts are classic `<script>` files sharing `window.M`, loaded in this order: core.js, audio.js, evolve.js, export.js, render.js, ui.js, device.js. A new script also belongs in the `SHELL` list in `sw.js`. The page must keep working when opened from `file://`.
- `js/core.js` and `js/export.js` stay pure: no DOM and no Web Audio, so they can be tested in Node. `js/evolve.js` needs only an object with `on`, `rebuild` and `setArrangement`.
- Musicality comes first. Grid rows are relative to the current chord (bass: R/3/5/8/approach; arp: chord tones rising; melody: scale-degree offsets −3..+8 from the chord root). Keep new generators chord-aware.
- `M.partStep` in `js/core.js` decides which notes a part plays on a step, for both `Engine.schedule` and the MIDI export (`M.songNotes`). Change note choice, lengths, ties, ranges or fills there, so live audio and MIDI stay the same.
- Song codes (`M.encodeSong`/`M.decodeSong`) are a public format. Saved songs on users' shelves must keep loading, so add fields with defaults and never rename them.
- Song links (`M.songLink`/`M.songFromLink`) carry the code as the `#fragment`, so codes must stay bare tokens: letters, digits, `.` `-` `_`. A test checks this.
- Do not edit `dist/` or the packed `samples/*.js` by hand. Regenerate them with `npm run build` and `tools/pack-samples.mjs`.

## Published version (Claude artifact) constraints
`dist/mezzanine.html` is published at https://claude.ai/artifact/7AtTkHqGS5GMVLCMonGWzD together with `samples/*.js`. Inside the artifact:
- File downloads, `window.print`, `alert`/`confirm`/`prompt`, microphone and service workers do not work.
- Only a bare-token `#fragment` from the artifact's link reaches `location.hash`, and the page cannot change the viewer's address bar. So Copy link there points at the public site (`MZ_LINK`, set in `build.mjs`), which needs no claude.ai sign-in, and only local or hosted copies keep the address in step with the song.
- Code paths that need any of these must check `window.MZ_ARTIFACT` (set by the build) and hide or adapt the feature.
- The manifest, home-screen and link-preview tags and the service worker are for local or hosted copies only. Tags placed before `<!-- page:start -->` in `index.html` never reach the artifact; `js/device.js` registers the worker only over http(s) when `MZ_ARTIFACT` is unset.

## Public site (GitHub Pages)
`main` of the public repository https://github.com/twelvedesign/mezzanine is served at https://twelvedesign.github.io/mezzanine/, so pushing `main` publishes it. Everything committed there is public.
- `samples/` is CC BY-SA 3.0. Keep `samples/README.md` and the credits in README.md and the page footer.
- The preview tags in `index.html` point at that address. `.nojekyll` makes Pages serve the files as they are.

## Verify
- `npm test` must pass. Add tests for new pure logic in `tests/`.
- Browser check: `.claude/launch.json` has a `mezzanine` server on port 8791. Look for console errors, then click Play.
- Audio check without ears: render offline and measure the level. Build an `M.Engine`, call `init(new OfflineAudioContext(...))`, then `setSong` and set `playing = true`. Loop `schedule(n, t)` with `t += stepDur(n)`, then `startRendering()`. Check the peak stays below 1.0 and that there are no NaN samples. Mixes currently sit around −16 dB RMS.
- Nobody can listen inside a session. Say so when reporting, and describe what should be heard.
