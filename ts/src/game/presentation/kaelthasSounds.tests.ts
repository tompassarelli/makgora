import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import type { Controls, Roster } from "../sim/roster";
import { attackStartupFrames } from "../sim/moves";
import { duelPair, stepDuel } from "../sim/testDuel";
import { controls, testBeginAttacks } from "../sim/testWorld";
import { FLAME_STRIKE_BURST, FLAME_STRIKE_STEER } from "../fighters/kaelthas/specials";
import { KAELTHAS_MOVES } from "../fighters/kaelthas/moves";
import { type ImpactEvents, captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { presentFighterSounds } from "./hitPresentation";
import { soundFiles } from "./moveSounds";

const press = controls({ specialPressed: true, specialX: 1, specialHeld: true });
const hold = controls({ specialHeld: true });
const idle = controls();
const HELD_FRAMES = 12;

interface SoundReplay {
  readonly kael: Fighter;
  readonly target: Fighter;
  readonly world: Roster;
  readonly own: ImpactEvents;
  readonly struck: ImpactEvents;
  frame: number;
}

function replay(targetX: number): SoundReplay {
  const kael = createFighter(Character.kaelthas, 0.0, 1);
  const target = createFighter(Character.rifleman, targetX, -1);
  const { world } = duelPair(kael, target);
  return { kael, target, world, own: createImpactEvents(), struck: createImpactEvents(), frame: 0 };
}

function step(run: SoundReplay, input: Readonly<Controls>): { readonly own: string[]; readonly struck: string[] } {
  captureImpactEventsBefore(run.own, run.kael);
  captureImpactEventsBefore(run.struck, run.target);
  stepDuel(run.world, input);
  run.frame++;
  finishImpactEventsAfter(run.own, run.kael, run.world);
  finishImpactEventsAfter(run.struck, run.target, run.world);
  const own: string[] = [], struck: string[] = [];
  presentFighterSounds(run.own, (sound) => { own.push(sound); });
  presentFighterSounds(run.struck, (sound) => { struck.push(sound); });
  return { own, struck };
}

const sounds = (heard: readonly string[], label: string): boolean => heard.some((sound) => soundFiles(label).includes(sound));

test("Flame Strike's cast sounds once when the held cast is released, never on press, and the burst sounds Flame Strike on the foe it strikes [k1 scenario]", () => {
  assertTrue(soundFiles("FlameStrikeTarget").length > 0 && soundFiles("FlameStrike").length > 0);
  const run = replay(-300.0);
  const cast: number[] = [];
  let release = -1, burstHeard = false;
  for (let frame = 0; frame < 120 && !burstHeard; frame++) {
    const input = frame === 0 ? press : frame <= FLAME_STRIKE_STEER.frame + HELD_FRAMES ? hold : idle;
    if (frame === FLAME_STRIKE_STEER.frame + HELD_FRAMES + 1) run.target.motion.x = run.kael.projectiles.find((projectile) => projectile.life > 0)?.x ?? 0.0;
    const heard = step(run, input);
    if (release < 0 && run.kael.special.frame > FLAME_STRIKE_STEER.frame) release = run.frame;
    if (sounds(heard.own, "FlameStrikeTarget")) cast.push(run.frame);
    burstHeard = sounds(heard.struck, "FlameStrike");
  }
  assertTrue(release > FLAME_STRIKE_STEER.frame + HELD_FRAMES);
  assertEquals(cast.join(), `${release}`, "the cast sounds on the release frame alone");
  assertTrue(burstHeard && run.frame >= release);
});

test("Siphon Mana sounds once, on the frame its tether goes out [k1 scenario]", () => {
  const run = replay(400.0);
  testBeginAttacks(run.world, AttackStyle.grab, undefined);
  const heard: number[] = [];
  for (let frame = 0; frame < 60; frame++) if (sounds(step(run, idle).own, "SiphonManaCaster")) heard.push(run.kael.attack.frame);
  assertEquals(heard.join(), `${attackStartupFrames(AttackStyle.grab, KAELTHAS_MOVES)}`);
});
