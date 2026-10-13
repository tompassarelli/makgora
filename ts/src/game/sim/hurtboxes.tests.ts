import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { stateChecksum } from "../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../physics/contactGeometry";
import { attackStartupFrames } from "./moves";
import { BLADEMASTER_MOVES } from "./heroes/blademasterMoves";
import { heroHurtPose } from "./heroMoves";
import { type FighterHurtboxes, HurtContact, HurtState, fighterHurtParts, hurtPart, hurtPose, strikeHurtContact } from "./hurtboxes";
import { HERO_ROSTER } from "./heroes/registry";
import { fighterAt } from "./roster";

const KIT_BODY: FighterHurtboxes = {
  stand: [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0)],
  attacks: {
    [AttackStyle.jab]: [
      heroHurtPose(1, 3, [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0), hurtPart(10.0, 60.0, 90.0, 60.0, 10.0)]),
      heroHurtPose(4, 6, [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0, HurtState.intangible)]),
      heroHurtPose(7, 9, [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0, HurtState.invincible)]),
    ],
  },
};

test("a kit's hurt volumes are part of its rollback record [k3 measure docs/commands/testing.md]", () => {
  const live = createReplaySnapshot();
  const saved = createReplaySnapshot();
  const f = fighterAt(live.world, 0);
  f.tuning.moves = BLADEMASTER_MOVES;
  const without = stateChecksum(live);
  f.tuning.moves = { ...BLADEMASTER_MOVES, hurtboxes: KIT_BODY };
  const authored = stateChecksum(live);
  assertTrue(authored !== without);
  copyReplayState(saved, live);
  f.tuning.moves = BLADEMASTER_MOVES;
  copyReplayState(live, saved);
  assertEquals(f.tuning.moves.hurtboxes, KIT_BODY);
  assertEquals(stateChecksum(live), authored);
});

const SHIPPED = [Character.rifleman, Character.demonHunter] as const;

/** A two-unit probe strike at a point relative to the fighter, along its facing. */
function probe(f: Fighter, ahead: number, height: number): HurtContact {
  const x = f32(f.motion.x + f32(ahead * f.facing));
  const z = f32(f.motion.z + height);
  return strikeHurtContact({ x1: x, z1: z, x2: x, z2: z, radius: 2.0 }, f);
}

function attackingAt(character: Character, style: AttackStyle, frame: number, facing: number): Fighter {
  const f = createFighter(character, 100.0, facing);
  f.attack.style = style;
  f.attack.frame = frame;
  return f;
}

test("each shipped fighter's extended jab arm is hit where its standing body is not, on the side it faces [k3 measure docs/hurtboxes.md]", () => {
  for (const character of SHIPPED) {
    const stand = createFighter(character, 100.0, 1);
    const height = f32(hurtCapsule(character).z2 * f32(0.62));
    assertEquals(probe(stand, 46.0, height), HurtContact.none);
    for (const facing of [1, -1]) {
      const jabbing = attackingAt(character, AttackStyle.jab, attackStartupFrames(AttackStyle.jab), facing);
      assertEquals(probe(jabbing, 46.0, height), HurtContact.hit);
      assertEquals(probe(jabbing, -46.0, height), HurtContact.none);
    }
  }
});


function inUltimate(character: Character, frame: number): Fighter {
  const f = createFighter(character, 100.0, 1);
  f.special.action = SpecialAction.heroUltimate;
  f.special.frame = frame;
  return f;
}

test("a fighter whose ultimate authors no hurt poses keeps its own body on every frame of it [k2 property]", () => {
  const changed: string[] = [];
  for (const hero of HERO_ROSTER) {
    const ultimate = createFighter(hero.character, 100.0, 1).tuning.ultimate;
    if (ultimate === undefined || ultimate.hurt !== undefined) continue;
    const outside = fighterHurtParts(createFighter(hero.character, 100.0, 1));
    for (let frame = 0; frame <= ultimate.endFrame + 1; frame++) {
      if (fighterHurtParts(inUltimate(hero.character, frame)) !== outside) changed.push(`${hero.name} f${frame}`);
    }
  }
  assertEquals(changed.join(" "), "");
});

test("an ultimate's authored hurt poses replace the body on their frames only [k1 scenario]", () => {
  const reach = [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0), hurtPart(10.0, 60.0, 90.0, 60.0, 10.0)];
  const stand = fighterHurtParts(createFighter(Character.blademaster, 100.0, 1));
  const at = (frame: number) => {
    const f = inUltimate(Character.blademaster, frame);
    const ultimate = f.tuning.ultimate;
    if (ultimate !== undefined) f.tuning.ultimate = { ...ultimate, hurt: [hurtPose(5, 9, reach)] };
    return fighterHurtParts(f);
  };
  assertEquals(at(4), stand);
  assertEquals(at(5), reach);
  assertEquals(at(9), reach);
  assertEquals(at(10), stand);
});
