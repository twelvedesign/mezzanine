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
  - Chords move smoothly from one to the next (voice-led voicings).
  - Melodies are question-and-answer phrases written relative to the current chord, with an optional pentatonic filter.
- **Sequencer:** the grid rows follow the chords, so any note you draw stays in key.
- **Evolve and Auto-arrange:** patterns, chords and key change every few bars, and parts rest and return.
- **Sounds:**
  - 14 recorded instruments, sampled from the Musyng Kite soundfont.
  - Synth voices built on FM, subtractive and pluck synthesis.
  - A synthesized soft drum kit.
  - Ambience beds: rain, vinyl, ocean, wind and crickets.
  - Reverb and ping-pong echo.
- **Study tools:** a focus timer with a chime and fade-out, song codes for sharing, a shelf of kept songs, and audio recording (local copy only).

## Project layout

| Path | What it holds |
| --- | --- |
| `index.html` | Page markup. The `<!-- page:start -->` and `<!-- body:start -->` markers are used by the build. |
| `css/style.css` | Styles, with light and dark themes defined as tokens. |
| `js/core.js` | Seeded random numbers, music theory, floors, pattern generators, song codes. No audio and no DOM. |
| `js/audio.js` | Voice presets, sampler, synths, drum kit, ambience beds, effects and the step scheduler (`M.Engine`). |
| `js/ui.js` | Interface, visualizer, Evolve and Auto-arrange logic, timer, shelf, keyboard shortcuts. |
| `samples/*.js` | Packed instrument samples (base64 MP3s, one note every minor third). |
| `tools/pack-samples.mjs` | Rebuilds `samples/` from MIDI.js soundfont files. |
| `build.mjs` | Inlines everything into `dist/mezzanine.html` for publishing as a Claude artifact. |
| `tests/` | Unit tests for theory, generation and song codes. |

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
