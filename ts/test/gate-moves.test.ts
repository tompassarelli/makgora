import { expect, test } from "bun:test";
import { isReplayFromMatch, startPromptReady } from "../scripts/wisp/gateMoves";
import { RESET_LEAD, SETTLE_AT, neutralSpecialSchedule, settlePoints, smokeMoves } from "../scripts/wisp/smokeTape";
import { MIN_EXCESS_SHARE, brightCount, playArea, specialsSpot } from "../scripts/wisp/specialsSpot";
import { rehearsal } from "../scripts/wisp/smokeRehearsal";
import { judgeSmoke, smokeReceipt } from "../scripts/wisp/smokeJudge";
import { SMOKE_BINDINGS } from "../scripts/wisp/smokeTape";
import { Character } from "../src/game/sim/codes";

test("a gate replay created during the match remains discoverable after the end timestamp [k2 property]", () => {
  expect(isReplayFromMatch("smashcraft-replay-508.txt", 150, 100)).toBe(true);
  expect(isReplayFromMatch("smashcraft-replay-508.txt", 250, 100)).toBe(true);
  expect(isReplayFromMatch("smashcraft-replay-507.txt", 90, 100)).toBe(false);
  expect(isReplayFromMatch("smashcraft-rates-508-44673996-0.txt", 150, 100)).toBe(false);
});

test("the gate only starts from the ready prompt at the bottom of the character menu [k2 property]", () => {
  expect(startPromptReady([{ text: "Start", y: 920 }, { text: "Click", y: 930 }], 1000)).toBe(true);
  expect(startPromptReady([{ text: "Choose", y: 920 }, { text: "fighter", y: 930 }], 1000)).toBe(false);
  expect(startPromptReady([{ text: "Start", y: 120 }, { text: "Click", y: 930 }], 1000)).toBe(false);
});

test("isolated neutral checks keep the idle opponent quiet and use the gate rest window and brightness rule [k1 scenario]", () => {
  for (const caster of [0, 1] as const) {
    const segment = neutralSpecialSchedule(caster)[0] ?? [];
    const schedule = neutralSpecialSchedule(caster);
    const replay = rehearsal(Character.thrall, Character.jaina, SMOKE_BINDINGS, schedule);
    expect(smokeReceipt(judgeSmoke(replay.lines, schedule.flat()), 2)).toEndWith("replayed=1 pass=1");
    const active = segment.find(tape => tape.slot === caster)?.steps ?? [];
    const idle = segment.find(tape => tape.slot !== caster)?.steps ?? [];
    const neutral = smokeMoves(caster === 0 ? 1 : -1).find(step => step.expect?.kind === "special" && step.expect.move === "neutral");
    expect(active[1]).toEqual(neutral);
    expect(idle.flatMap(step => step.presses).every(press => press.at < RESET_LEAD)).toBe(true);
    expect(idle.some(step => step.expect !== undefined)).toBe(false);
    const points = settlePoints(active);
    expect(points.map(point => point.frame)).toEqual([SETTLE_AT, RESET_LEAD + SETTLE_AT, RESET_LEAD + (neutral?.frames ?? 0) + SETTLE_AT]);
    const frame = (lit: boolean) => ({ width: 2, height: 4, rgb: new Uint8Array(24).fill(lit ? 255 : 0) });
    const before = frame(false);
    const after = frame(true);
    const runs = [points.map((point, index) => ({ ...point, count: brightCount(index === 2 ? after : before), onTime: true }))];
    const results = specialsSpot(runs, playArea(before));
    expect(results).toHaveLength(1);
    expect(results[0]?.pass).toBe(false);
    expect(results[0]?.reason).toContain(`excess=${brightCount(after)} allowed=${Math.round(MIN_EXCESS_SHARE * playArea(before))}`);
    expect(specialsSpot([runs[0]?.map(point => ({ ...point, count: 0 })) ?? []], playArea(before))[0]?.pass).toBe(true);
  }
});
