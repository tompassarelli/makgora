import { expect, test } from "bun:test";
import { IN_FRAME_RULES, IN_FRAME_THRESHOLDS, type BustMeasure, inFrameVerdict } from "../scripts/portraitInFrame";

/** A small deterministic generator, so every run scores the same synthetic busts. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
}

/** A bust that clears every rule: a readable face under a clear crown, the weapon beside it touching the hand. */
function clearBust(next: () => number): BustMeasure {
  const t = IN_FRAME_THRESHOLDS, top = 10 + Math.floor(next() * 20), left = 20 + Math.floor(next() * 20);
  const height = t.faceHeightPx + Math.floor(next() * 20), width = 20 + Math.floor(next() * 20);
  const face = { pixels: Math.max(t.facePixels, Math.floor(height * width * (0.6 + next() * 0.4))), box: { left, top, right: left + width, bottom: top + height } };
  const weapon = { pixels: t.weaponPixels + Math.floor(next() * 400), box: { left: left + width + 2, top, right: left + width + 12, bottom: top + 60 } };
  const hand = { pixels: 40, box: { left: weapon.box.left - 3, top: top + 30, right: weapon.box.left + 5, bottom: top + 38 } };
  return { parts: { head: face, face, weapon, hand }, crownMargin: top - 2, faceHidden: 0 };
}

test("a weapon moved over the face fails 'nothing crosses the face' exactly when it hides over 2% of the face pixels [k2 property]", () => {
  const next = random(363);
  for (let bust = 0; bust < 200; bust++) {
    const clear = clearBust(next);
    expect(IN_FRAME_RULES.every((rule) => inFrameVerdict(clear, true)[rule] === "pass")).toBe(true);
    const facePixels = clear.parts.face?.pixels ?? 0, faceBox = clear.parts.face?.box;
    if (faceBox === undefined) throw new Error("synthetic face has no box");
    // The weapon's box slides onto the face; the face pixels it covers are hidden and stop showing.
    const hidden = Math.floor(next() * facePixels * 0.1);
    const weaponBox = { left: faceBox.left, top: faceBox.top, right: faceBox.right, bottom: faceBox.top + 60 };
    const over: BustMeasure = {
      ...clear,
      parts: { ...clear.parts, face: { pixels: facePixels - hidden, box: faceBox }, weapon: { pixels: clear.parts.weapon?.pixels ?? 0, box: weaponBox } },
      faceHidden: hidden,
    };
    const verdict = inFrameVerdict(over, true);
    const crosses = hidden > IN_FRAME_THRESHOLDS.faceHiddenShare * (facePixels - hidden);
    expect(verdict["nothing crosses the face"]).toBe(crosses ? "fail" : "pass");
    expect(verdict["crown margin"]).toBe("pass");
    expect(verdict["weapon in frame"]).toBe("pass");
  }
});
