import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { Action } from "../../input/actions";
import { type Scene, airborne, fighter, frame, scene } from "../../match/padScene";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { finishDamageContacts, openDamageContacts } from "../../sim/contacts";
import { ANGLES } from "../../sim/heroes/authoring";
import type { HitEffect } from "../../sim/hitRegions";
import { applyAttackHit } from "../../sim/hits";
import { beginAttack } from "../../sim/transitions";

const BATTLEFIELD = 2;
const MID_WEIGHT = Character.mountainKing;
const FLIGHT = 360;
const FOX_UP_SMASH: HitEffect = { damage: 18.0, growth: 112.0, base: 30.0, launchX: ANGLES[80].x, launchZ: ANGLES[80].z, electric: false, element: HitElement.normal };
const UP_SMASH_KILL = 106.0;
const UP_SMASH_GAP = 30.0;

function duel(gap: number, percent: number): Scene {
  const s = scene(BATTLEFIELD, [{ character: Character.warden, x: 0.0, facing: 1 }, { character: MID_WEIGHT, x: gap, facing: -1 }]);
  for (let n = 0; n < 3; n++) frame(s);
  fighter(s, 1).status.damage = percent;
  return s;
}

function flies(s: Scene, held: (n: number) => readonly Action[] = () => []): boolean {
  for (let n = 1; n <= FLIGHT; n++) {
    frame(s, held(n));
    if (fighter(s, 1).status.out) return true;
  }
  return false;
}

function upSmashKills(percent: number): boolean {
  const s = duel(UP_SMASH_GAP, percent);
  beginAttack(fighter(s, 0), AttackStyle.upSmash, false);
  return flies(s);
}

function foxUpSmashKills(percent: number): boolean {
  const s = duel(UP_SMASH_GAP, percent);
  openDamageContacts();
  applyAttackHit(s.world, 0, 1, AttackStyle.upSmash, 1, FOX_UP_SMASH, true, false);
  finishDamageContacts(s.world);
  return flies(s);
}

test("Maiev's clean up smash kills a standing Mountain King at the battlefield stage's centre from 106% and not at 105%, the same percent Fox's fightcore clean up smash (18%, 80 degrees, base 30, growth 112) kills him from [k4 reference references/melee-frame-data/fightcore.csv]", () => {
  assertEquals(`${upSmashKills(UP_SMASH_KILL - 1.0)} ${upSmashKills(UP_SMASH_KILL)}`, "false true", "Maiev at 105%, 106%");
  assertEquals(`${foxUpSmashKills(UP_SMASH_KILL - 1.0)} ${foxUpSmashKills(UP_SMASH_KILL)}`, "false true", "Fox's values at 105%, 106%");
});

function upAirHits(dx: number, dz: number): string {
  const s = duel(dx, 60.0);
  const maiev = fighter(s, 0), foe = fighter(s, 1);
  airborne(maiev, 0.0, 80.0);
  airborne(foe, dx, f32(80.0 + dz));
  beginAttack(maiev, AttackStyle.upAir, false);
  const hits: number[] = [];
  let last = foe.status.damage;
  for (let n = 1; n <= 20; n++) {
    frame(s);
    if (foe.status.damage > last) hits.push(Math.round(foe.status.damage - last));
    last = foe.status.damage;
  }
  return hits.join(",");
}

test("Maiev's up air carries a foe its lifts touch into the final blade: from 20 behind to 40 in front and 60 to 100 above her, the two 2% lifts and Fox's 13% second hit all land [k4 reference references/melee-frame-data/fightcore.csv]", () => {
  for (const dx of [-20.0, 0.0, 20.0, 40.0]) for (const dz of [60.0, 100.0]) assertEquals(upAirHits(dx, dz), "2,2,13", `foe at ${dx}, ${dz}`);
});

const UP_THROW_KILL = 118.0;
const JUMP_HELD = 8;
const UP_AIR_AFTER_JUMP = 6;

function upThrowUpAir(percent: number): { readonly killed: boolean; readonly hits: string } {
  const s = duel(40.0, percent);
  const maiev = fighter(s, 0), foe = fighter(s, 1);
  let released = 0, last = percent;
  const hits: number[] = [];
  const held = (n: number): readonly Action[] => {
    if (n === 1) return [Action.grab];
    if (released === 0) return maiev.grab.action === GrabAction.hold && imod(n, 2) === 0 ? [Action.moveUp] : [];
    const after = n - released;
    if (after === UP_AIR_AFTER_JUMP + 1) return [Action.cUp, Action.moveRight];
    return after >= 1 && after <= JUMP_HELD ? [Action.jump, Action.moveRight] : [Action.moveRight];
  };
  for (let n = 1; n <= FLIGHT; n++) {
    frame(s, held(n));
    if (released === 0 && n > 2 && maiev.grab.action === GrabAction.none && foe.status.damage > percent) released = n;
    if (foe.status.damage > last) hits.push(Math.round(foe.status.damage - last));
    last = foe.status.damage;
    if (foe.status.out) return { killed: true, hits: hits.join(",") };
  }
  return { killed: false, hits: hits.join(",") };
}

test("Maiev's up throw into a full-hop up air lands the lifts and the final blade on Mountain King on the battlefield stage, and kills him from 118% [k3 measure docs/design/maiev.md]", () => {
  const short = upThrowUpAir(UP_THROW_KILL - 4.0), kill = upThrowUpAir(UP_THROW_KILL);
  assertEquals(short.hits.split(",").slice(0, 4).join(","), "4,2,2,13", "up throw, two lifts and the final blade at 114%");
  assertTrue(!short.killed);
  assertTrue(kill.killed);
});
