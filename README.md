# Mezzanine

A browser-based generator of relaxing ambient and elevator music, built from step sequences.
Pick a mood ("floor"). Mezzanine writes a song for it and plays it through seven parts:
pad, keys, bass, arpeggio, melody, soft drums and ambience. It then keeps the music
evolving for as long as you study or rest.

Published version: https://claude.ai/artifact/7AtTkHqGS5GMVLCMonGWzD

## Run it

Open `index.html` in a browser. It works straight from the file system and has no dependencies.

To use a local server instead (handy for the browser preview tools):

```bash
npm run serve
```

Then visit http://localhost:8791.

## What it does

- **8 floors (moods):** Night Shift, Lobby, Mezzanine Café, Library Rain, Deep Focus, Tea Garden, Cloud Room and Rooftop Stars. Each one sets the tempo range, modes, chord colours, instruments, rhythm styles and effects.
- **Seeded songs:** every song comes from a seed, so the same seed and floor always give the same song.
- **Music theory engine:**
  - Chord progressions follow functional harmony (a weighted chain of chord moves) and avoid diminished chords.
  - Each song also has a bridge: a second progression that starts away from home and leads back to the theme.
  - Chords move smoothly from one to the next (voice-led voicings).
  - Melodies are question-and-answer phrases written relative to the current chord, with an optional pentatonic filter. With Breathe on they rest every other two bars, taking turns across the loop so they reach every chord.
- **Song form (Auto-arrange):** each song is told in rounds that repeat for as long as you listen. The first opens with an intro, then every round moves through the theme, a variation, the bridge, a breather and the return. Each section sets who plays and how much, drums fill into the next one, and the slow floors take longer over each section.
- **Evolve:** patterns, chords and key change where sections start (now and then inside long ones too), seeded by the song, so a song replays the same journey. With Auto-arrange off the loop plays as written and Evolve makes a small change every eight bars.
- **Sequencer:** the grid rows follow the chords, so any note you draw stays in key.
- **Sounds:**
  - 14 recorded instruments, sampled from the Musyng Kite soundfont.
  - Synth voices built on FM, subtractive and pluck synthesis.
  - A synthesized soft drum kit.
  - Ambience beds: rain, vinyl, ocean, wind and crickets.
  - Reverb and ping-pong echo.
- **Study tools:** a focus timer with a chime and fade-out, song codes for sharing, a shelf of kept songs, and audio recording (local copy only).
- **Phones and background tabs:**
  - On touch devices the music plays through a hidden `<audio>` element, so it ignores the silent switch and keeps going with the screen locked.
  - Lock-screen and media-key controls: play, pause, next song on this floor, and previous song.
  - Cover art is drawn from the floor's colours and the song title.
  - Below 600px wide, the chords, mixer and sequencer fold away behind a Studio button.
- **Installable offline app (local or hosted copies):** add it to your home screen. After the first visit, a service worker keeps it and its instruments working offline.
- **Export (local copy only):**
  - WAV: 2, 5 or 10 minutes of 16-bit stereo audio, rendered faster than real time. It evolves and arranges itself as live playback does, and has a fade-in and a fade-out.
  - MIDI: a type 1 Standard MIDI File with tempo, key signature and one track per part (pad, keys, bass, arp, melody, and GM drums on channel 10). Swing is kept in the note timing. It holds the theme's loop as written, without the song's sections (no intro, bridge or line-up changes yet). Opens in Logic Pro or any DAW.

## Project layout

| Path | What it holds |
| --- | --- |
| `index.html` | Page markup. The `<!-- page:start -->` and `<!-- body:start -->` markers are used by the build. |
| `css/style.css` | Styles, with light and dark themes defined as tokens. |
| `js/core.js` | Seeded random numbers, music theory, floors, pattern generators, song codes. No audio and no DOM. |
| `js/audio.js` | Voice presets, sampler, synths, drum kit, ambience beds, effects and the step scheduler (`M.Engine`). |
| `js/evolve.js` | Song form, Evolve and Auto-arrange (`M.Evolve`): the sections of each round, their line-ups and lengths, and the `Conductor` that walks them from an engine's `bar` events, for live play and offline renders. |
| `js/export.js` | Pure export formats: song to MIDI notes (`M.songNotes`), the MIDI file writer, 16-bit WAV encoding. |
| `js/render.js` | Offline rendering of a song to WAV (`M.renderSong`), capped at 10 minutes. |
| `js/ui.js` | Interface, visualizer, timer, shelf, export controls, keyboard shortcuts. |
| `js/device.js` | Phone and background listening: media-element output, resuming after interruptions, Media Session, the Studio disclosure, service worker registration. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline app for local or hosted copies. Rebuild the icons with `node tools/make-icons.mjs`. |
| `samples/*.js` | Packed instrument samples (base64 MP3s, one note every minor third). |
| `tools/pack-samples.mjs` | Rebuilds `samples/` from MIDI.js soundfont files. |
| `build.mjs` | Inlines everything into `dist/mezzanine.html` for publishing as a Claude artifact. |
| `tests/` | Unit tests for theory, generation, song codes, export formats, song form and the evolve module. |

## Develop

```bash
npm test        # unit tests (Node 22+)
npm run build   # writes dist/mezzanine.html
```

All scripts are classic (not ES modules) and share the `window.M` namespace, so the page keeps working from `file://`.

## Credits

The recorded instruments come from the Musyng Kite soundfont (CC BY-SA 3.0), via
[midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) by Benjamin Gleitzman.
If you redistribute the samples, keep this credit and the same licence.
