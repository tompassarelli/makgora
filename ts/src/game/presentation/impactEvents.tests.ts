import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { controls } from "../sim/testWorld";
import { duelPair, stepDuel } from "../sim/testDuel";
import { CAIRNE_SPECIALS } from "../sim/heroes/cairneSpecials";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { playImpact, soundFiles } from "./moveSounds";

test("a whiffed War Stomp plays Warstomp once, on the frame its first region turns on [k1 scenario]", () => {
  const owner = createFighter(Character.cairne, 0.0, 1);
  const target = createFighter(Character.rifleman, 700.0, -1);
  const { world } = duelPair(owner, target);
  const events = createImpactEvents();
  const warstomp = soundFiles("Warstomp");
  let first = -1;
  for (const region of CAIRNE_SPECIALS.down.ground.regions ?? []) if (first < 0 || region.firstFrame < first) first = region.firstFrame;
  const played: number[] = [];
  let frame = 0;
  do {
    frame++;
    captureImpactEventsBefore(events, owner);
    stepDuel(world, frame === 1 ? controls({ specialPressed: true, specialZ: -1, verticalDirection: -1 }) : controls());
    finishImpactEventsAfter(events, owner, world);
    if (events.impact >= 0) playImpact(events.character, events.impact, events.performSerial, (file) => { if (warstomp.includes(file)) played.push(owner.special.frame); });
  } while (owner.special.action === SpecialAction.heroDown && frame < 120);
  assertEquals(first, 19);
  assertEquals(target.status.damage, 0.0);
  assertEquals(played.join(","), "19");
});
