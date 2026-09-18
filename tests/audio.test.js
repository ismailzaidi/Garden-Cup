import { describe, it, expect, vi, afterEach } from "vitest";

/* The seam nothing else covers: useTimers.test.js mocks all of audio.js.
   This is the one module that decides whether anything plays at all — for
   both the Web Audio tones (beeps, chimes) and, now, all of the app's
   speech — so it gets its own hand-rolled fakes rather than reusing the
   real thing. jsdom implements neither Web Audio nor the Web Speech API at
   all: AudioContext and speechSynthesis are both undefined. `sharedAudioCtx`
   and the cached-voices state inside audio.js are module singletons, so
   every case resets modules and re-imports fresh. */

function makeParam(owner, initial = 0) {
  return {
    value: initial,
    _owner: owner,
    setValueAtTime(v) { this.value = v; return this; },
    linearRampToValueAtTime(v) { this.value = v; return this; },
    exponentialRampToValueAtTime(v) { this.value = v; return this; },
    cancelScheduledValues() { return this; },
  };
}

function makeNode(type) {
  const node = { _type: type, connections: [] };
  node.connect = (target) => { node.connections.push(target); return target; };
  node.disconnect = () => {};
  return node;
}

class FakeAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = makeNode("destination");
    this.oscillators = [];
    this.filters = [];
    this.gains = [];
    this.compressors = [];
  }

  createOscillator() {
    const osc = makeNode("oscillator");
    osc.type = "sine";
    osc.frequency = makeParam(osc, 440);
    osc.start = () => {};
    osc.stop = () => {};
    this.oscillators.push(osc);
    return osc;
  }

  createBiquadFilter() {
    const f = makeNode("biquad");
    f.frequency = makeParam(f, 350);
    f.Q = makeParam(f, 1);
    f.gain = makeParam(f, 0);
    this.filters.push(f);
    return f;
  }

  createGain() {
    const g = makeNode("gain");
    g.gain = makeParam(g, 1);
    this.gains.push(g);
    return g;
  }

  createDynamicsCompressor() {
    const c = makeNode("compressor");
    c.threshold = makeParam(c, -24);
    c.knee = makeParam(c, 30);
    c.ratio = makeParam(c, 12);
    c.attack = makeParam(c, 0.003);
    c.release = makeParam(c, 0.25);
    this.compressors.push(c);
    return c;
  }

  resume() {
    // Real AudioContext.resume() only flips state once the promise
    // settles, not synchronously — unlockAudio() fires it and moves on
    // without awaiting, so a synchronous "suspended" check right after
    // must still see "suspended".
    return Promise.resolve().then(() => { this.state = "running"; });
  }
}

async function freshAudio(ctx) {
  vi.resetModules();
  // A plain arrow function can't be used as a constructor — audio.js calls
  // `new Ctx()` — so the stub has to be a real function.
  vi.stubGlobal("AudioContext", vi.fn(function FakeCtor() { return ctx; }));
  vi.stubGlobal("webkitAudioContext", undefined);
  return import("../src/engine/audio.js");
}

// Stands up just enough of the Web Speech API for speak() (and everything
// built on it) to take its speech path — jsdom has neither
// SpeechSynthesis nor SpeechSynthesisUtterance at all. `voices` defaults to
// one local voice; pass [] or a network-only voice to exercise the
// fallback paths. Returns the utterances actually sent to `speak()` and the
// `cancel` spy, so tests can assert both what was said and that a repeat
// doesn't queue behind itself.
function stubSpeech(voices = [{ name: "Test Voice", lang: "en-US", localService: true }]) {
  const utterances = [];
  const cancel = vi.fn();
  vi.stubGlobal("SpeechSynthesisUtterance", vi.fn(function FakeUtterance(text) {
    this.text = text;
    this.rate = 1;
    this.voice = null;
  }));
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => voices,
    speak: (u) => utterances.push({ text: u.text, rate: u.rate, voice: u.voice }),
    cancel,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return { utterances, cancel };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  localStorage.clear();
});

describe("playCountdownTick", () => {
  it("speaks the word for the second when speech and a local voice are available", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);
    const { utterances } = stubSpeech();

    audio.playCountdownTick(7);

    expect(utterances).toHaveLength(1);
    expect(utterances[0].text).toBe("seven");
    expect(ctx.oscillators.length).toBe(0); // no beep when speech succeeds
  });

  it("speaks the correct word for every one of the final ten seconds", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);
    const { utterances } = stubSpeech();

    for (let n = 10; n >= 1; n--) audio.playCountdownTick(n);

    expect(utterances.map((u) => u.text)).toEqual([
      "ten", "nine", "eight", "seven", "six", "five", "four", "three", "two", "one",
    ]);
  });

  it("falls back to the 1200 Hz beep when there is no speech engine at all", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);
    // window.speechSynthesis is left unset — the jsdom default

    audio.playCountdownTick(7);

    expect(ctx.oscillators.length).toBe(1);
    expect(ctx.oscillators[0].type).toBe("square");
    expect(ctx.oscillators[0].frequency.value).toBe(1200);
    expect(ctx.filters.length).toBe(0);
  });

  it("falls back to the beep when speech exists but no local voice can be confirmed", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);
    const { utterances } = stubSpeech([{ name: "Cloud Voice", lang: "en-US", localService: false }]);

    audio.playCountdownTick(7);

    expect(utterances).toHaveLength(0);
    expect(ctx.oscillators.length).toBe(1);
    expect(ctx.oscillators[0].frequency.value).toBe(1200);
  });

  it("with the voice preference off, falls back to the beep even with a local voice available", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(false);
    const { utterances } = stubSpeech();

    audio.playCountdownTick(7);

    expect(utterances).toHaveLength(0);
    expect(ctx.oscillators.length).toBe(1);
    expect(ctx.oscillators[0].frequency.value).toBe(1200);
  });

  it("schedules nothing at all when the context isn't running and there's no speech engine", async () => {
    const ctx = new FakeAudioContext();
    ctx.state = "suspended";
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);

    audio.playCountdownTick(7);

    expect(ctx.oscillators.length).toBe(0);
    expect(ctx.gains.length).toBe(0);
    expect(ctx.filters.length).toBe(0);
  });

  it("never throws when there's no AudioContext global at all", async () => {
    vi.resetModules();
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const audio = await import("../src/engine/audio.js");
    audio.setVoicePref(true);

    expect(() => audio.playCountdownTick(7)).not.toThrow();
  });
});

describe("playPauseReminder", () => {
  it("speaks 'Game paused' when speech and a local voice are available", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);
    const { utterances } = stubSpeech();

    audio.playPauseReminder();

    expect(utterances).toHaveLength(1);
    expect(utterances[0].text).toBe("Game paused");
  });

  it("cancels whatever is currently being said before speaking again — no stutter on a repeat", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);
    const { utterances, cancel } = stubSpeech();

    audio.playPauseReminder();
    audio.playPauseReminder();

    expect(cancel).toHaveBeenCalledTimes(2);
    expect(utterances).toHaveLength(2);
  });

  it("is silent — no invented beep — when there is no speech engine at all", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);

    expect(() => audio.playPauseReminder()).not.toThrow();
    expect(ctx.oscillators.length).toBe(0);
  });

  it("is silent when the voice preference is off", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(false);
    const { utterances } = stubSpeech();

    audio.playPauseReminder();

    expect(utterances).toHaveLength(0);
    expect(ctx.oscillators.length).toBe(0);
  });

  it("is silent when speech exists but no local voice can be confirmed", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);
    const { utterances } = stubSpeech([{ name: "Cloud Voice", lang: "en-US", localService: false }]);

    audio.playPauseReminder();

    expect(utterances).toHaveLength(0);
    expect(ctx.oscillators.length).toBe(0);
  });
});

describe("cancelSpeech", () => {
  it("cancels the speech engine when one exists", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    const { cancel } = stubSpeech();

    audio.cancelSpeech();

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("never throws when there is no speech engine at all", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);

    expect(() => audio.cancelSpeech()).not.toThrow();
  });
});

describe("speakVoiceSample", () => {
  it("speaks a sample word when speech and a local voice are available", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);
    const { utterances } = stubSpeech();

    audio.speakVoiceSample();

    expect(utterances).toHaveLength(1);
  });

  it("never throws with no speech engine at all", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);

    expect(() => audio.speakVoiceSample()).not.toThrow();
  });
});

describe("unlockAudio", () => {
  it("resumes on any state other than running, not just suspended", async () => {
    const ctx = new FakeAudioContext();
    ctx.state = "interrupted"; // iOS's non-standard post-call state
    const resumeSpy = vi.spyOn(ctx, "resume");
    const audio = await freshAudio(ctx);

    audio.unlockAudio();

    expect(resumeSpy).toHaveBeenCalled();
  });
});
