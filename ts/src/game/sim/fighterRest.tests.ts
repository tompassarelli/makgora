import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type TestMatch, executeNext, testMatch } from "../match/testMatch";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { REST_BEAR, REST_CANDLE, REST_CANNON, REST_FREEZE_TRAP, REST_PLACED, REST_WATER, RESTING_GROUPS, bearResting, candleResting, cannonResting, freezeTrapResting, placedResting, settleRestingGroups, waterResting } from "./fighterRest";
import { fighterAt } from "./roster";
import { CANNON_TEST_STAGE, TOMB_OF_SARGERAS_STAGE } from "./stage";
import { FIGHTER_FIELDS } from "./state/fighterSchema";
import { CANNON_Z, cannonX } from "./stageHazards";

interface RestGroup {
  readonly bit: number;
  readonly name: string;
  readonly resting: (f: Readonly<Fighter>) => boolean;
  readonly record: (f: Fighter) => Record<string, unknown>;
}

const fields = (group: object) => group as unknown as Record<string, unknown>;

const GROUPS: readonly RestGroup[] = [
  { bit: REST_BEAR, name: "bear", resting: (f) => bearResting(f.bear), record: (f) => fields(f.bear) },
  { bit: REST_FREEZE_TRAP, name: "freezeTrap", resting: (f) => freezeTrapResting(f.freezeTrap), record: (f) => fields(f.freezeTrap) },
  { bit: REST_CANNON, name: "cannon", resting: (f) => cannonResting(f.cannon), record: (f) => fields(f.cannon) },
  { bit: REST_WATER, name: "water", resting: (f) => waterResting(f.water), record: (f) => fields(f.water) },
  { bit: REST_CANDLE, name: "candle", resting: (f) => candleResting(f.candle), record: (f) => fields(f.candle) },
  { bit: REST_PLACED, name: "placed", resting: (f) => placedResting(f), record: (f) => fields(f.placed) },
  { bit: REST_PLACED, name: "pack[]", resting: (f) => placedResting(f), record: (f) => fields(f.pack[0] ?? f.placed) },
];

function auditRestingBits(character: Character, stage: number, frames: number, woken: readonly number[], rests: readonly number[], nudge?: (match: TestMatch, frame: number) => void): void {
  const match = testMatch(15, character);
  match.game.stockCount = 9;
  match.game.stageChoice = stage;
  const woke = GROUPS.map(() => 0);
  const rested = GROUPS.map(() => 0);
  const was = PARTICIPANT_SLOTS.map((slot) => fighterAt(match.world, slot).restingGroups);
  const misses: string[] = [];
  for (let frame = 1; frame <= frames; frame++) {
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
    nudge?.(match, frame);
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
  const quiet = GROUPS.filter((group, index) => (woken.includes(group.bit) && (woke[index] ?? 0) <= 2) || (rests.includes(group.bit) && (rested[index] ?? 0) <= 0));
  assertEquals(quiet.map((group) => `${group.name} woke ${woke[GROUPS.indexOf(group)] ?? 0} rested ${rested[GROUPS.indexOf(group)] ?? 0}`).join("; "), "");
}

test("after every frame of a four-rifleman match that summons bears and traps and loses stocks, a resting bit holds only over a group at its spawn values [k1 scenario]", () => {
  auditRestingBits(Character.rifleman, 2, 1500, [REST_BEAR, REST_FREEZE_TRAP], [REST_BEAR, REST_FREEZE_TRAP]);
});

test("after every frame of four-rifleman matches on the cannon and tide stages, a resting bit holds only over a cannon or water group at its spawn values [k1 scenario]", () => {
  auditRestingBits(Character.rifleman, CANNON_TEST_STAGE, 900, [REST_CANNON], [REST_CANNON], (match, frame) => {
    if (floorMod(frame, 150) !== 100) return;
    const { motion } = fighterAt(match.world, floorMod(floorDiv(frame, 150), 4));
    motion.x = cannonX(match.game.matchFrame + 1);
    motion.z = f32(CANNON_Z + 40.0);
    motion.grounded = false;
    motion.surface = undefined;
  });
  auditRestingBits(Character.rifleman, TOMB_OF_SARGERAS_STAGE, 900, [REST_WATER], [REST_WATER]);
});

test("a fresh fighter rests every group, and any one resting-group field moved off its spawn value wakes that group alone on settling [k2 property]", () => {
  const rows = FIGHTER_FIELDS.filter((row) => GROUPS.some((group) => row.path.startsWith(`${group.name}.`)));
  assertEquals(rows.length, 73);
  for (const character of [Character.rifleman, Character.demonHunter, Character.kobold, Character.peon]) {
    const fresh = createFighter(character, 0.0, 1);
    assertEquals(fresh.restingGroups, RESTING_GROUPS);
    settleRestingGroups(fresh);
    assertEquals(fresh.restingGroups, RESTING_GROUPS);
    for (const row of rows) {
      for (const moved of [-0.0, 1, true]) {
        const f = createFighter(character, 0.0, 1);
        const [name, path] = row.path.split(".") as [string, string];
        const field = path.replace("[]", "");
        const group = GROUPS.find((candidate) => candidate.name === name);
        if (group === undefined) throw new Error(`no resting group ${name}`);
        if (name === "pack[]" && f.pack.length === 0) continue;
        const record = path.endsWith("[]") ? (group.record(f)[field] as unknown[]) : group.record(f);
        const key = path.endsWith("[]") ? 1 : field;
        const spawn = (record as Record<string | number, unknown>)[key];
        const value = row.type === "bool" ? !(spawn as boolean) : moved === true ? 7 : moved;
        if (value === spawn && (value !== 0 || 1 / (value as number) === 1 / (spawn as number))) continue;
        (record as Record<string | number, unknown>)[key] = value;
        settleRestingGroups(f);
        assertEquals(f.restingGroups, RESTING_GROUPS & ~group.bit, `${character} ${row.path} = ${String(value)}`);
      }
    }
  }
});

test("after every frame of a four-kobold match that heats candles and loses stocks, a resting bit holds only over a candle at its spawn values [k1 scenario]", () => {
  auditRestingBits(Character.kobold, 2, 1200, [REST_CANDLE], [REST_CANDLE], (match, frame) => {
    if (floorMod(frame, 20) !== 0) return;
    const kobold = fighterAt(match.world, floorMod(floorDiv(frame, 20), 4));
    const foe = fighterAt(match.world, floorMod(floorDiv(frame, 20) + 1, 4));
    kobold.motion.x = f32(foe.motion.x - f32(30.0 * kobold.facing));
    kobold.motion.z = foe.motion.z;
    const input = match.inputs.inputs[floorMod(floorDiv(frame, 20), 4)];
    if (input !== undefined) input.attackRequested = true;
  });
});

test("after every frame of four-fighter matches that summon companions, wards and towers, a resting bit holds only over placed objects and a pack at their spawn values [k1 scenario]", () => {
  for (const character of [Character.beastmaster, Character.shadowHunter, Character.peon]) auditRestingBits(character, 2, 600, [REST_PLACED], []);
});
