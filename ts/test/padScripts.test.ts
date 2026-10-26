import { expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BTN_A, BTN_START, EV_ABS, EV_KEY } from "../scripts/integrity/linuxInput";
import { type PadStep, parsePadScript } from "../scripts/integrity/padScript";

const PADS = join(import.meta.dir, "native/pads");

const parsed = (path: string): readonly PadStep[] => parsePadScript(readFileSync(join(PADS, path), "utf8"));

const presses = (steps: readonly PadStep[], code: number): number[] =>
  steps.flatMap((step) => step.kind === "edge" && step.edges.some((edge) => edge.type === EV_KEY && edge.code === code && edge.value === 1) ? [step.frame] : []);

test("every committed pad script parses [k2 property]", () => {
  const paths = [...new Glob("**/*.pad").scanSync(PADS)];
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths) expect(() => parsed(path), path).not.toThrow();
});

test("the Windows C1 script moves the cursor, picks fighters and a stage, presses Start and plays 30 s [k1 scenario]", () => {
  const steps = parsed("c1/windows-select-match.pad");
  const [stageSelect, matchStart, ...extra] = presses(steps, BTN_START);
  expect(extra).toEqual([]);
  if (stageSelect === undefined || matchStart === undefined) throw new Error("the script presses Start twice");
  const before = (frame: number, slot: number) => steps.filter((step) => step.slot === slot && step.frame < frame);
  for (const slot of [0, 1]) {
    const menu = before(stageSelect, slot);
    expect(menu.some((step) => step.kind === "edge" && step.edges.some((edge) => edge.type === EV_ABS && edge.value !== 0))).toBe(true);
    expect(presses(menu, BTN_A).length).toBe(1);
  }
  const stagePick = steps.filter((step) => step.frame > stageSelect && step.frame < matchStart);
  expect(stagePick.some((step) => step.kind === "edge" && step.edges.some((edge) => edge.type === EV_ABS && edge.value !== 0))).toBe(true);
  const playing = steps.filter((step) => step.frame > matchStart + 4);
  const span = Math.max(...playing.map((step) => step.frame)) - Math.min(...playing.map((step) => step.frame));
  expect(span).toBeGreaterThanOrEqual(30 * 60);
  expect(new Set(playing.map((step) => step.slot))).toEqual(new Set([0, 1]));
});
