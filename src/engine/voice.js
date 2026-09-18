/* ---------- the countdown voice: source-filter synthesis, no samples ----------
 * Ten words, known at build time, said with an OscillatorNode rather than a
 * recording. See docs/FEATURE-PLAN-2.md §5A for the design this follows.
 *
 * ctx is injected rather than imported so the whole module is testable
 * without a browser — jsdom implements no Web Audio at all (AudioContext,
 * OfflineAudioContext, BiquadFilterNode and OscillatorNode are all
 * undefined). It uses factory methods (ctx.createOscillator(), etc.) rather
 * than constructors, matching audio.js and keeping the test fake simple.
 *
 * Deliberately does NOT wrap itself in try/catch: a pure module that
 * swallows its own errors makes its tests pass while the graph is broken.
 * The try/catch belongs at the audio.js boundary (playCountdownTick).
 */

export const WORDS = {
  10: "ten", 9: "nine", 8: "eight", 7: "seven", 6: "six",
  5: "five", 4: "four", 3: "three", 2: "two", 1: "one",
};

// Pitch carries the count: one semitone down per number, ~165 Hz at "ten"
// down to ~98 Hz at "one". The formant table is scaled up to match (see
// FORMANT_SCALE below) — a slightly higher voice, and it helps on a phone
// speaker, which reproduces essentially nothing below ~400 Hz.
const FUNDAMENTAL_AT_TEN = 165;

function fundamentalFor(number) {
  return FUNDAMENTAL_AT_TEN * Math.pow(2, -(10 - number) / 12);
}

const FORMANT_SCALE = 1.1;

// Sum through a master gain at or below 0.3 — three summed resonant
// branches reach full scale far more easily than a single tone.
const MASTER_LEVEL = 0.28;

// A sawtooth's harmonics fall off at 1/n, which leaves F2 and F3 far weaker
// than a real voice; corrected here with per-branch gains rather than a
// shelving filter. Bandwidths (not a single Q) come from the plan's table —
// Q = frequency / bandwidth, derived per target so every passband stays at
// least one fundamental wide as the pitch glides.
const BRANCHES = [
  { key: "f1", bandwidth: 80, gain: 1.0 },
  { key: "f2", bandwidth: 110, gain: 0.8 },
  { key: "f3", bandwidth: 180, gain: 0.4 },
];

// Nasal murmurs (the /n/ and /m/ codas and onsets) sit around 250/1000/2300
// with the F2 and F3 branches pulled down about 10 dB (~0.32x linear).
const NASAL = { f1: 250, f2: 1000, f3: 2300, nasal: true };
const NASAL_BRANCH_CUT = 0.32;

/* Each word is an onset, a nucleus and a coda, built from three segment
 * kinds:
 *   vowel      — the shared per-word sawtooth source, run through three
 *                parallel bandpass formant filters. f1/f2/f3 are either a
 *                number (steady) or a [start, end] pair (a glide, ramped
 *                across the segment) — this is what makes "five" and
 *                "nine" distinguishable rather than two identical rows.
 *                Also used for nasal murmurs (fixed formants, `nasal: true`).
 *   fricative  — two oscillators in heavy FM (a square carrier a few kHz
 *                up, a sine modulator a few hundred Hz, wired modulator ->
 *                high-gain GainNode -> carrier.frequency) standing in for
 *                /s/, /f/, /θ/, /v/ and the plosive edges of /t/ and /k/ —
 *                synthesised, not sampled: no recorded audio anywhere.
 *   silence    — advances the clock without scheduling anything (the
 *                closure gap in "six").
 *
 * Durations differ on purpose (330-480 ms) — "six" is one short syllable
 * and "seven" is two, and flattening every word to the same length would
 * throw that cue away. No word schedules past ~0.47 s including its
 * release tail, comfortably under the 0.5 s budget.
 */
const WORD_SPECS = {
  ten: {
    number: 10,
    segments: [
      { type: "fricative", dur: 0.005, carrier: 7000, mod: 600, level: 0.8 }, // /t/ hard onset, 5 ms edge
      { type: "vowel", dur: 0.265, f1: 530, f2: 1840, f3: 2480 }, // ɛ steady
      { type: "vowel", dur: 0.06, ...NASAL }, // /n/ murmur coda
    ],
  },
  nine: {
    number: 9,
    segments: [
      { type: "vowel", dur: 0.06, ...NASAL }, // /n/ murmur onset
      { type: "vowel", dur: 0.30, f1: [730, 270], f2: [1090, 2290], f3: 2440 }, // aɪ glide
      { type: "vowel", dur: 0.06, ...NASAL }, // /n/ murmur coda
    ],
  },
  eight: {
    number: 8,
    segments: [
      // eɪ glide, then an abrupt /t/ cutoff: a fast release stands in for
      // the plosive edge, followed by true silence rather than another node.
      { type: "vowel", dur: 0.28, f1: [400, 270], f2: [2000, 2290], f3: 2600, release: 0.005 },
    ],
  },
  seven: {
    number: 7,
    segments: [
      { type: "fricative", dur: 0.08, carrier: 6000, mod: 400, level: 0.7 }, // /s/
      { type: "vowel", dur: 0.12, f1: 530, f2: 1840, f3: 2480 }, // ɛ
      { type: "vowel", dur: 0.12, f1: 500, f2: 1500, f3: 1600 }, // ə offglide
      { type: "fricative", dur: 0.05, carrier: 4500, mod: 200, level: 0.5 }, // /v/ voiced fricative
      { type: "vowel", dur: 0.08, ...NASAL }, // /n/ murmur
    ],
  },
  six: {
    number: 6,
    segments: [
      { type: "fricative", dur: 0.08, carrier: 6000, mod: 400, level: 0.7 }, // /s/
      { type: "vowel", dur: 0.12, f1: 390, f2: 1990, f3: 2550 }, // ɪ
      { type: "silence", dur: 0.04 }, // closure gap
      { type: "fricative", dur: 0.08, carrier: 6200, mod: 450, level: 0.7 }, // /ks/
    ],
  },
  five: {
    number: 5,
    segments: [
      { type: "fricative", dur: 0.07, carrier: 5000, mod: 250, level: 0.6 }, // /f/
      { type: "vowel", dur: 0.28, f1: [730, 270], f2: [1090, 2290], f3: 2440 }, // aɪ glide
      { type: "fricative", dur: 0.05, carrier: 4500, mod: 200, level: 0.5 }, // /v/
    ],
  },
  four: {
    number: 4,
    segments: [
      { type: "fricative", dur: 0.07, carrier: 5000, mod: 250, level: 0.6 }, // /f/
      { type: "vowel", dur: 0.28, f1: 570, f2: 840, f3: [2410, 1800] }, // ɔː, F3 dips for r-colour
    ],
  },
  three: {
    number: 3,
    segments: [
      { type: "fricative", dur: 0.06, carrier: 5500, mod: 300, level: 0.6 }, // /θ/
      { type: "vowel", dur: 0.32, f1: [300, 270], f2: [1300, 2290], f3: [1600, 3010] }, // /r/-colour into iː
    ],
  },
  two: {
    number: 2,
    segments: [
      { type: "fricative", dur: 0.005, carrier: 7000, mod: 600, level: 0.8 }, // /t/ hard onset, 5 ms edge
      { type: "vowel", dur: 0.295, f1: 300, f2: 870, f3: 2240 }, // uː steady
    ],
  },
  one: {
    number: 1,
    segments: [
      { type: "vowel", dur: 0.28, f1: [300, 640], f2: [650, 1190], f3: 2390 }, // /w/ ramping in, then ʌ
      { type: "vowel", dur: 0.06, ...NASAL }, // /n/ murmur coda
    ],
  },
};

/* Linear ramps only — never exponentialRampToValueAtTime, which can
   neither start from nor reach zero. Zero at the start, linear to level,
   linear back to zero at the end; every ramp is anchored by a
   setValueAtTime on the same param immediately before it. */
function scheduleEnvelope(param, t0, dur, level, attack = 0.018, release = 0.018) {
  const a = Math.min(attack, dur / 3);
  const r = Math.min(release, dur / 3);
  param.setValueAtTime(0, t0);
  param.linearRampToValueAtTime(level, t0 + a);
  param.setValueAtTime(level, t0 + dur - r);
  param.linearRampToValueAtTime(0, t0 + dur);
}

/* One parallel formant filter bank per vowel/murmur segment, all fed from
   the word's single shared sawtooth source and summed into `dest` (the
   word's master gain). Reused for nasal murmurs, which are just a fixed,
   narrow-branch formant target rather than a different mechanism. */
function buildVowelSegment(ctx, source, seg, t0, dest) {
  const dur = seg.dur;
  const env = ctx.createGain();
  scheduleEnvelope(env.gain, t0, dur, 1, 0.018, seg.release ?? 0.018);
  env.connect(dest);

  BRANCHES.forEach((branch, i) => {
    const raw = seg[branch.key];
    const [start, end] = Array.isArray(raw) ? raw : [raw, raw];
    const f0 = start * FORMANT_SCALE;
    const f1 = end * FORMANT_SCALE;

    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) filt.frequency.linearRampToValueAtTime(f1, t0 + dur);
    filt.Q.value = f0 / branch.bandwidth;

    const branchGain = ctx.createGain();
    branchGain.gain.value = branch.gain * (seg.nasal && i > 0 ? NASAL_BRANCH_CUT : 1);

    source.connect(filt);
    filt.connect(branchGain);
    branchGain.connect(env);
  });

  return t0 + dur;
}

/* Fricatives without a single sample: two oscillators in heavy FM. A
   square carrier a few kHz up, a sine modulator a few hundred Hz, wired
   modulator -> high-gain GainNode -> carrier.frequency. The large
   modulation index produces a dense, hiss-like spectrum that stands in
   for /s/, /f/, /θ/, /v/ and the plosive edges of /t/ and /k/. */
function buildFricativeSegment(ctx, seg, t0, dest) {
  const dur = seg.dur;
  const end = t0 + dur + 0.02; // stop must come after the release

  const carrier = ctx.createOscillator();
  carrier.type = "square";
  carrier.frequency.value = seg.carrier;

  const modulator = ctx.createOscillator();
  modulator.type = "sine";
  modulator.frequency.value = seg.mod;

  const modGain = ctx.createGain();
  modGain.gain.value = seg.carrier; // large modulation index -> dense hiss
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const env = ctx.createGain();
  scheduleEnvelope(env.gain, t0, dur, seg.level ?? 0.6);
  carrier.connect(env);
  env.connect(dest);

  carrier.start(t0);
  carrier.stop(end);
  modulator.start(t0);
  modulator.stop(end);

  return end;
}

/* Builds the graph for one word and schedules it starting at `startTime`
   (never at ctx.currentTime — the caller is responsible for scheduling
   slightly ahead). Returns the time the word finishes, so the caller can
   avoid starting another word on top of it. Unknown words are a no-op. */
export function speakWord(ctx, word, startTime) {
  const spec = WORD_SPECS[word];
  if (!spec) return startTime;

  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  master.connect(compressor);
  compressor.connect(ctx.destination);

  const source = ctx.createOscillator();
  source.type = "sawtooth"; // rich in harmonics; a sine has nothing for the filters to shape
  source.frequency.value = fundamentalFor(spec.number);

  const totalDur = spec.segments.reduce((sum, seg) => sum + seg.dur, 0);
  // One envelope for the whole word, on the master bus, so it starts and
  // stops like speech rather than clicking — on top of (not instead of)
  // each segment's own gating, which is what keeps a closure gap silent.
  scheduleEnvelope(master.gain, startTime, totalDur, MASTER_LEVEL, 0.015, 0.02);

  let cursor = startTime;
  spec.segments.forEach((seg) => {
    if (seg.type === "silence") {
      cursor += seg.dur;
      return;
    }
    if (seg.type === "fricative") {
      buildFricativeSegment(ctx, seg, cursor, master);
    } else {
      buildVowelSegment(ctx, source, seg, cursor, master);
    }
    cursor += seg.dur;
  });

  const end = cursor + 0.02;
  source.start(startTime);
  source.stop(end);

  return end;
}
