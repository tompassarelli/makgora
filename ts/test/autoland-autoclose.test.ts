import { expect, test } from "bun:test";
import { autoclose, boxes, issueRefs, pendingChecks } from "../scripts/autolandCore";

const random = (seed: number) => () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
const pick = <T>(next: () => number, items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;

const CHECKS = ["bun test a", "bun wisp view b", "false", "grep -q x ../y"];
const TAGS = ["", "", " [native]", " [Tom]"];

function body(next: () => number): string {
  return Array.from({ length: Math.floor(next() * 8) }, (_, index) => {
    if (next() < 0.3) return pick(next, ["**Done when.**", "", "Prose with check: `not a box`", "  - nested prose", "-[ ] not a box"]);
    const check = next() < 0.6 ? ` check: \`${pick(next, CHECKS)}\`` : "";
    return `${pick(next, ["- ", "* ", "  - "])}[${pick(next, [" ", " ", "x", "X"])}] box ${index}${pick(next, TAGS)}${check}`;
  }).join("\n");
}

test("auto-close ticks exactly the passing declared boxes and closes only when it ticked the last open ones, over 2000 generated bodies [k2 property]", () => {
  for (let seed = 1; seed <= 2000; seed++) {
    const next = random(seed);
    const text = body(next);
    const passed = new Map(CHECKS.filter(() => next() < 0.7).map((check) => [check, next() < 0.6]));
    const result = autoclose(text, passed, "f".repeat(40));
    const before = text.split("\n");
    const after = result.body.split("\n");
    const ticks = (box: { done: boolean; check?: string; needs?: string }): boolean => box.done || (box.needs === undefined && box.check !== undefined && passed.get(box.check) === true);
    const found = boxes(text);
    expect(after.length).toBe(before.length);
    for (const [index, line] of before.entries()) {
      const box = found.find((candidate) => candidate.line === index);
      expect(after[index]).toBe(box !== undefined && !box.done && ticks(box) ? line.replace("[ ]", "[x]") : line);
    }
    expect(result.close).toBe(found.some((box) => !box.done && ticks(box)) && found.every(ticks));
    expect(result.comment === undefined).toBe(found.every((box) => box.check === undefined && box.needs === undefined));
    if (result.close) expect(result.comment).toContain(`Closed by auto-close after ${"f".repeat(40)} landed`);
    expect(autoclose(result.body, passed, "e".repeat(40)).body).toBe(result.body);
    expect(pendingChecks(result.body).some((check) => passed.get(check) === true)).toBe(false);
  }
});

test("Refs, Fixes and Closes name issues in this repository's spellings [k4 reference docs/ci.md#auto-close]", () => {
  expect(issueRefs("Fix\n\nRefs smashcraft#513\nFixes #12, closes tompassarelli/smashcraft#7\nSee #99 and wisp#3")).toEqual([7, 12, 513]);
});
