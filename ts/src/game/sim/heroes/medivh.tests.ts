import { assertEquals, assertFalse, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../codes";
import { createFighter } from "../fighter";
import { controls, testWorld } from "../testWorld";
import { MEDIVH_SPECIALS } from "./medivhSpecials";
import { strikeMeets } from "../../match/botHeroKit";
import { lift, stepDuel } from "../testDuel";

function pair(x: number, facing = 1) {
  const owner = createFighter(Character.medivh, 0.0, facing);
  const target = createFighter(Character.rifleman, f32(x * facing), -facing);
  for (const fighter of [owner, target]) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  owner.mana.points = 40; target.mana.points = 60;
  return { owner, target, world: testWorld(owner, target) };
}


test("Medivh computer's blink strike prediction agrees with where the real blink lands its hit [k1 scenario]", () => {
 for(const [x,specialX,specialZ,form] of [[80.0,1,0,MEDIVH_SPECIALS.side.ground],[240.0,1,0,MEDIVH_SPECIALS.side.ground],[40.0,0,-1,MEDIVH_SPECIALS.down.ground],[-120.0,0,-1,MEDIVH_SPECIALS.down.ground]] as const){
  const {target,world}=pair(x);
  const predicted=strikeMeets(form,target,x,0.0);
  stepDuel(world,controls({specialPressed:true,specialX,specialZ}));
  for(let tick=2;tick<=30;tick++)stepDuel(world);
  assertEquals(predicted,target.status.damage>0.0,`blink at ${x}`);
 }
});

test("Medivh's air Vanishing Act leaves him helpless unless it hits [k2 property]", () => {
  for (const [x, hits] of [[240.0, true], [600.0, false]] as const) {
    const { owner, target, world } = pair(x);
    lift(owner, 20.0);
    owner.jump.remaining = 1;
    stepDuel(world, controls({ specialPressed: true, specialX: 1, direction: 1 }));
    for (let tick = 0; tick < 60 && owner.special.action !== SpecialAction.none; tick++) stepDuel(world);
    assertEquals(target.status.damage > 0.0, hits, `blink at ${x}`);
    assertFalse(owner.motion.grounded);
    assertEquals(owner.special.fall, !hits, `fall at ${x}`);
    assertEquals(owner.jump.remaining, hits ? 1 : 0, `jumps at ${x}`);
  }
});
