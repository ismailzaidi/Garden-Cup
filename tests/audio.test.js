import { describe, it, expect, vi, afterEach } from "vitest";

/* The seam nothing else covers: useTimers.test.js mocks all of audio.js,
   and voice.test.js sits below it testing voice.js in isolation. This is
   the one function that decides whether anything plays at all, so it gets
   its own hand-rolled Web Audio fake (jsdom has none) rather than reusing
   the real thing. `sharedAudioCtx` inside audio.js is a module singleton,
   so every case resets modules and re-imports fresh. */

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  localStorage.clear();
});

describe("playCountdownTick", () => {
  it("with the voice preference on, gives a voice graph rather than a beep", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(true);

    audio.playCountdownTick(7);

    // A voice graph builds more than a single tone: the countdown word for
    // 7 ("seven") has fricative consonants, so it needs more than one
    // oscillator and a bank of formant filters neither of which a plain
    // beep uses.
    expect(ctx.oscillators.length).toBeGreaterThan(1);
    expect(ctx.filters.length).toBeGreaterThan(0);
    expect(ctx.oscillators.some((o) => o.type === "square" && o.frequency.value === 1200)).toBe(false);
  });

  it("with the voice preference off, falls back to a single 1200 Hz square tick", async () => {
    const ctx = new FakeAudioContext();
    const audio = await freshAudio(ctx);
    audio.setVoicePref(false);

    audio.playCountdownTick(7);

    expect(ctx.oscillators.length).toBe(1);
    expect(ctx.oscillators[0].type).toBe("square");
    expect(ctx.oscillators[0].frequency.value).toBe(1200);
    expect(ctx.filters.length).toBe(0);
  });

  it("schedules nothing at all when the context isn't running", async () => {
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
