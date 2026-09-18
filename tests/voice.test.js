import { describe, it, expect } from "vitest";
import { speakWord, WORDS } from "../src/engine/voice.js";

/* jsdom implements no Web Audio at all — AudioContext, OfflineAudioContext,
   BiquadFilterNode and OscillatorNode are all undefined — so this is a
   hand-rolled fake rather than a new dependency. AudioParam objects record
   every scheduling call and keep a reference back to the node that owns
   them, which is what lets the reachability walk below follow a
   modulator -> gain -> carrier.frequency edge through to the carrier node:
   an oscillator that only ever "connects" to another node's AudioParam is
   not a dead branch, it's shaping what that node produces. */
function makeParam(owner, initial = 0) {
  const events = [];
  return {
    value: initial,
    _owner: owner,
    _events: events,
    setValueAtTime(v, t) {
      this.value = v;
      events.push({ op: "set", v, t });
      return this;
    },
    linearRampToValueAtTime(v, t) {
      this.value = v;
      events.push({ op: "linear", v, t });
      return this;
    },
    exponentialRampToValueAtTime(v, t) {
      this.value = v;
      events.push({ op: "exp", v, t });
      return this;
    },
    cancelScheduledValues(t) {
      events.push({ op: "cancel", t });
      return this;
    },
  };
}

function makeNode(type) {
  const node = { _type: type, connections: [] };
  node.connect = (target) => {
    node.connections.push(target);
    return target;
  };
  node.disconnect = () => {};
  return node;
}

class FakeAudioContext {
  constructor(currentTime = 0) {
    this.state = "running";
    this.currentTime = currentTime;
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
    osc.detune = makeParam(osc, 0);
    osc.started = false;
    osc.stopped = false;
    osc.startTime = null;
    osc.stopTime = null;
    osc.start = (t = 0) => {
      osc.started = true;
      osc.startTime = t;
    };
    osc.stop = (t = 0) => {
      osc.stopped = true;
      osc.stopTime = t;
    };
    this.oscillators.push(osc);
    return osc;
  }

  createBiquadFilter() {
    const f = makeNode("biquad");
    f.type = "lowpass";
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
}

// Walks .connect() targets from `node`, following a connection to an
// AudioParam through to the node that owns it, until `dest` is found.
function reaches(node, dest, seen = new Set()) {
  if (node === dest) return true;
  if (seen.has(node)) return false;
  seen.add(node);
  return node.connections.some((target) => {
    const next = target._owner || target;
    return reaches(next, dest, seen);
  });
}

const NUMBERS = Object.keys(WORDS).map(Number);
const ALL_WORDS = NUMBERS.map((n) => WORDS[n]);

describe("speakWord", () => {
  it("keeps every started oscillator reachable from the destination", () => {
    ALL_WORDS.forEach((word) => {
      const ctx = new FakeAudioContext();
      speakWord(ctx, word, 0);
      expect(ctx.oscillators.length).toBeGreaterThan(0);
      ctx.oscillators.forEach((osc) => {
        expect(reaches(osc, ctx.destination)).toBe(true);
      });
    });
  });

  it("schedules a non-zero envelope value after a zero, on every word's master gain", () => {
    ALL_WORDS.forEach((word) => {
      const ctx = new FakeAudioContext();
      speakWord(ctx, word, 0);
      // The master bus is the last gain created that connects to a
      // compressor (every per-segment envelope connects to the master
      // gain instead, never to a compressor directly).
      const master = ctx.gains.find((g) => g.connections.some((t) => t._type === "compressor"));
      expect(master).toBeTruthy();
      const events = master.gain._events;
      const firstZero = events.findIndex((e) => e.v === 0);
      expect(firstZero).toBeGreaterThanOrEqual(0);
      const laterNonZero = events.slice(firstZero + 1).some((e) => e.v > 0);
      expect(laterNonZero).toBe(true);
    });
  });

  it("never schedules an event before the startTime passed in, and anchors every ramp with a prior setValueAtTime", () => {
    const startTime = 2.5;
    ALL_WORDS.forEach((word) => {
      const ctx = new FakeAudioContext(startTime);
      speakWord(ctx, word, startTime);

      const allParams = [
        ...ctx.gains.map((g) => g.gain),
        ...ctx.filters.map((f) => f.frequency),
        ...ctx.filters.map((f) => f.Q),
        ...ctx.oscillators.map((o) => o.frequency),
      ];

      allParams.forEach((param) => {
        param._events.forEach((e) => {
          expect(e.t).toBeGreaterThanOrEqual(startTime);
        });
        param._events.forEach((e, i) => {
          if (e.op === "linear") {
            const anchored = param._events.slice(0, i).some((prior) => prior.op === "set" && prior.t <= e.t);
            expect(anchored).toBe(true);
          }
        });
      });

      ctx.oscillators.forEach((osc) => {
        expect(osc.startTime).toBeGreaterThanOrEqual(startTime);
        expect(osc.stopTime).toBeGreaterThanOrEqual(startTime);
      });
    });
  });

  it("keeps every word under the 0.5 s budget, measured on the scheduled nodes rather than the return value", () => {
    ALL_WORDS.forEach((word) => {
      const startTime = 1.1;
      const ctx = new FakeAudioContext(startTime);
      speakWord(ctx, word, startTime);
      const maxStop = Math.max(...ctx.oscillators.map((o) => o.stopTime));
      expect(maxStop - startTime).toBeLessThan(0.5);
    });
  });

  it("gives every one of the ten words a distinct schedule — the 'five' vs 'nine' regression", () => {
    const signatures = new Set();
    ALL_WORDS.forEach((word) => {
      const ctx = new FakeAudioContext();
      speakWord(ctx, word, 0);
      const oscSig = ctx.oscillators
        .map((o) => `${o.type}:${o.frequency.value.toFixed(1)}:${(o.stopTime - o.startTime).toFixed(3)}`)
        .sort()
        .join("|");
      const filterSig = ctx.filters
        .map((f) => `${f.frequency._events.map((e) => `${e.op}${e.v.toFixed(1)}`).join(",")}:${f.Q.value.toFixed(2)}`)
        .sort()
        .join("|");
      const gainSig = ctx.gains
        .map((g) => g.gain._events.map((e) => `${e.op}${e.v.toFixed(3)}@${e.t.toFixed(3)}`).join(","))
        .sort()
        .join("|");
      signatures.add(`${oscSig}##${filterSig}##${gainSig}`);
    });
    expect(signatures.size).toBe(10);
    expect(signatures.size).toBe(ALL_WORDS.length);
  });

  it("ramps formant frequencies on a diphthong ('nine') but not on a steady vowel ('two')", () => {
    const nine = new FakeAudioContext();
    speakWord(nine, "nine", 0);
    const nineRamped = nine.filters.some((f) => f.frequency._events.some((e) => e.op === "linear"));
    expect(nineRamped).toBe(true);

    const two = new FakeAudioContext();
    speakWord(two, "two", 0);
    const twoRamped = two.filters.some((f) => f.frequency._events.some((e) => e.op === "linear"));
    expect(twoRamped).toBe(false);
  });

  it("stops every oscillator it starts", () => {
    ALL_WORDS.forEach((word) => {
      const ctx = new FakeAudioContext();
      speakWord(ctx, word, 0);
      expect(ctx.oscillators.length).toBeGreaterThan(0);
      ctx.oscillators.forEach((osc) => {
        expect(osc.started).toBe(true);
        expect(osc.stopped).toBe(true);
      });
    });
  });

  it("returns the end time, at or after every scheduled stop", () => {
    ALL_WORDS.forEach((word) => {
      const ctx = new FakeAudioContext();
      const end = speakWord(ctx, word, 0);
      ctx.oscillators.forEach((osc) => {
        expect(osc.stopTime).toBeLessThanOrEqual(end);
      });
    });
  });

  it("is a no-op that doesn't throw for a word outside the vocabulary", () => {
    const ctx = new FakeAudioContext();
    expect(() => speakWord(ctx, "eleven", 0)).not.toThrow();
    expect(ctx.oscillators.length).toBe(0);
  });

  it("never uses an AudioBufferSourceNode or createBuffer", () => {
    const ctx = new FakeAudioContext();
    expect(ctx.createBuffer).toBeUndefined();
    expect(typeof window.AudioBufferSourceNode).toBe("undefined");
    speakWord(ctx, "six", 0);
    // every node created went through the factory methods the fake tracks
    expect(ctx.oscillators.length + ctx.filters.length + ctx.gains.length + ctx.compressors.length).toBeGreaterThan(0);
  });
});

describe("WORDS", () => {
  it("maps ten down to one, one word each", () => {
    expect(Object.keys(WORDS).length).toBe(10);
    for (let n = 1; n <= 10; n++) expect(WORDS[n]).toBeTruthy();
    const words = Object.values(WORDS);
    expect(new Set(words).size).toBe(10);
  });
});
