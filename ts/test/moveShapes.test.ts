import { expect, test } from "bun:test";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { check, judge, moveShape } from "../scripts/moveShapes";

const tilt = moveShape(Character.rifleman, AttackStyle.downTilt);
const brokenSmash = { ...tilt, startup: tilt.startup + 4, total: tilt.total + 10, reach: tilt.reach - 20 };

test("a more committal smash that wins on no option fails the smash budget [k2 property]", () => {
  const row = judge("rifleman", "down", 4, brokenSmash, tilt);
  expect(row.won).toEqual([]);
  const result = check([row], []);
  expect(result.failures.map((v) => v.rule)).toEqual(["smash budget"]);
});

test("a recorded exception excuses only its own move and rule [k2 property]", () => {
  const row = { ...judge("rifleman", "down", 4, tilt, tilt), verdicts: [{ fighter: "rifleman", direction: "down", rule: "smash budget", pass: false, detail: "" }] } as const;
  const exception = { fighter: "rifleman", direction: "down", issue: "#326", reason: "test" } as const;
  expect(check([row], [{ ...exception, rule: "range triangle" }]).failures.map((v) => v.rule)).toEqual(["smash budget"]);
  const result = check([row], [{ ...exception, rule: "smash budget" }]);
  expect(result.failures).toEqual([]);
  expect(result.excused.length).toBe(1);
});
