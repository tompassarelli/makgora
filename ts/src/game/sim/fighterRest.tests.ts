import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { executeNext, testMatch } from "../match/testMatch";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Bear, type FreezeTrap, REST_BEAR, REST_FREEZE_TRAP, RESTING_GROUPS, bearResting, freezeTrapResting, settleRestingGroups } from "./fighterRest";
import { fighterAt } from "./roster";
import { FIGHTER_FIELDS } from "./state/fighterSchema";

const GROUPS = [
  { bit: REST_BEAR, name: "bear", resting: (f: Readonly<Fighter>) => bearResting(f.bear) },
  { bit: REST_FREEZE_TRAP, name: "freezeTrap", resting: (f: Readonly<Fighter>) => freezeTrapResting(f.freezeTrap) },
];

test("after every frame of a four-rifleman match that summons bears and traps and loses stocks, a resting bit holds only over a group at its spawn values [k1 scenario]", () => {
  const match = testMatch(15, Character.rifleman);
  match.game.stockCount = 9;
  const woke = [0, 0];
  const rested = [0, 0];
  const was = PARTICIPANT_SLOTS.map((slot) => fighterAt(match.world, slot).restingGroups);
  const misses: string[] = [];
  for (let frame = 1; frame <= 1500; frame++) {
    for (const slot of PARTICIPANT_SLOTS) {
      const input = match.inputs.inputs[slot];
      const phase = floorMod(frame + slot * 37, 120);
      const toward = slot < 2 ? 1 : -1;
      input.specialPressed = phase === 0 || phase === 60;
      input.specialX = phase === 0 ? toward : 0;
      input.specialZ = phase === 60 ? -1 : 0;
      input.direction = phase > 80 && phase < 100 ? toward : 0;
      input.attackRequested = phase === 105;
    }
    if (floorMod(frame, 300) === 200) fighterAt(match.world, floorMod(floorDiv(frame, 300), 4)).motion.x = f32(3000.0);
    executeNext(match);
    for (const slot of PARTICIPANT_SLOTS) {
      const f = fighterAt(match.world, slot);
      GROUPS.forEach((group, index) => {
        const now = (f.restingGroups & group.bit) !== 0;
        const before = ((was[slot] ?? 0) & group.bit) !== 0;
        if (before && !now) woke[index] = (woke[index] ?? 0) + 1;
        if (!before && now) rested[index] = (rested[index] ?? 0) + 1;
        if (now && !group.resting(f)) misses.push(`frame ${frame} slot ${slot} ${group.name}`);
      });
      was[slot] = f.restingGroups;
    }
  }
  assertEquals(misses.slice(0, 5).join("; "), "");
  for (let index = 0; index < GROUPS.length; index++) {
    assertGreaterThan(woke[index] ?? 0, 2);
    assertGreaterThan(rested[index] ?? 0, 0);
  }
});

test("a fresh fighter rests every group, and any one bear or trap field moved off its spawn value wakes that group alone on settling [k2 property]", () => {
  const rows = FIGHTER_FIELDS.filter((row) => row.path.startsWith("bear.") || row.path.startsWith("freezeTrap."));
  assertEquals(rows.length, 17);
  for (const character of [Character.rifleman, Character.demonHunter, Character.kobold]) {
    const fresh = createFighter(character, 0.0, 1);
    assertEquals(fresh.restingGroups, RESTING_GROUPS);
    settleRestingGroups(fresh);
    assertEquals(fresh.restingGroups, RESTING_GROUPS);
    for (const row of rows) {
      for (const moved of [-0.0, 1, true]) {
        const f = createFighter(character, 0.0, 1);
        const [group, field] = row.path.split(".") as [string, string];
        const record: Record<string, unknown> = group === "bear" ? (f.bear as Bear as unknown as Record<string, unknown>) : (f.freezeTrap as FreezeTrap as unknown as Record<string, unknown>);
        const spawn = record[field];
        const value = row.type === "bool" ? !(spawn as boolean) : moved === true ? 7 : moved;
        if (value === spawn && (value !== 0 || 1 / (value as number) === 1 / (spawn as number))) continue;
        record[field] = value;
        settleRestingGroups(f);
        const awake = group === "bear" ? REST_BEAR : REST_FREEZE_TRAP;
        assertEquals(f.restingGroups, RESTING_GROUPS & ~awake, `${character} ${row.path} = ${String(value)}`);
      }
    }
  }
});
