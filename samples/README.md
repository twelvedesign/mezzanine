# Instrument samples: credits and licence

The recorded notes in this folder come from the **Musyng Kite** soundfont
([Musyng Kite.sfpack](http://www.synthfont.com/SoundFonts/Musyng.sfpack)), as rendered to MP3 by
[midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) by Benjamin Gleitzman.

Like their source, these files are released under the
[Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/) licence.
If you share or adapt them, keep this credit and use the same licence.

## Changes made for Mezzanine

- Only 14 instruments are kept, and of each only every third semitone (one note every minor third)
  across the range the app uses. The app plays the notes in between by re-pitching the nearest one.
- The MP3 data itself is unchanged. `tools/pack-samples.mjs` repacks each instrument's notes into one
  script, `<id>.js`.

| File | midi-js-soundfonts instrument |
| --- | --- |
| `grand.js` | `acoustic_grand_piano` |
| `rhodes.js` | `electric_piano_1` |
| `vibraphone.js` | `vibraphone` |
| `marimba_s.js` | `marimba` |
| `kalimba_s.js` | `kalimba` |
| `celesta.js` | `celesta` |
| `flute_s.js` | `flute` |
| `nylon.js` | `acoustic_guitar_nylon` |
| `acbass.js` | `acoustic_bass` |
| `fretless.js` | `fretless_bass` |
| `strings_s.js` | `string_ensemble_1` |
| `choir_s.js` | `choir_aahs` |
| `harp_s.js` | `orchestral_harp` |
| `sax.js` | `alto_sax` |

This licence covers the samples only, not the rest of Mezzanine.
