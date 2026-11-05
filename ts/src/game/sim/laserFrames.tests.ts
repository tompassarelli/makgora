import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "../input/actions";
import { airborne, fighter, frame, scene } from "../match/padScene";
import { Character } from "./codes";

/** Fox's and Falco's neutral specials, Blaster, ground and air: first active frame, total frames, aerial landing lag (fightcore.csv, records.jsonl). */
interface Blaster {
  readonly groundShot: number;
  readonly groundFrames: number;
  readonly airShot: number;
  readonly airFrames: number;
  readonly landingLag: number;
}

const FOX: Blaster = { groundShot: 10, groundFrames: 36, airShot: 10, airFrames: 36, landingLag: 0 };
const FALCO: Blaster = { groundShot: 23, groundFrames: 57, airShot: 13, airFrames: 42, landingLag: 0 };

interface Laser {
  readonly name: string;
  readonly character: Character;
  readonly melee: Blaster;
}

const LASERS: readonly Laser[] = [
  { name: "Eye Beam", character: Character.demonHunter, melee: FALCO },
  { name: "Shadow Strike", character: Character.warden, melee: FOX },
];

const FOE_DISTANCE = 3000.0;
const DROP_HEIGHT = 1500.0;
const TICKS = 160;

interface Moment {
  readonly tick: number;
  readonly airTicks: number;
  readonly grounded: boolean;
  readonly landed: number | undefined;
  readonly lastStart: number | undefined;
  readonly shots: number;
}

interface Played {
  readonly starts: number[];
  readonly spawns: number[];
  readonly landed: number;
  readonly landingLag: number;
  readonly specialOnLanding: number;
}

type Hop = "none" | "short" | "full" | "drop";

/** Steps one fighter through a hop (or none), pressing neutral special on the ticks `press` names, fast falling from the apex when asked. */
function play(character: Character, hop: Hop, fastFall: boolean | ((moment: Moment) => boolean), press: (moment: Moment) => boolean): Played {
  const s = scene(0, [{ character, x: 0.0, facing: 1 }, { character: Character.blademaster, x: FOE_DISTANCE, facing: -1 }]);
  const user = fighter(s);
  if (hop === "drop") airborne(user, 0.0, DROP_HEIGHT);
  const starts: number[] = [];
  const spawns: number[] = [];
  let landingLag = -1;
  let specialOnLanding = -1;
  let airTicks = -1;
  let landed: number | undefined;
  const lives = user.projectiles.map(() => 0);
  for (let tick = 1; tick <= TICKS; tick++) {
    const grounded = user.motion.grounded;
    if (!grounded && airTicks < 0) airTicks = 0; else if (airTicks >= 0) airTicks++;
    const held: Action[] = [];
    if (tick === 1 && (hop === "short" || hop === "full")) held.push(hop === "short" ? Action.shortHop : Action.jump);
    const lastStart = starts[starts.length - 1];
    const moment: Moment = { tick, airTicks, grounded, landed, lastStart, shots: spawns.length };
    if (press(moment)) held.push(Action.special);
    if ((typeof fastFall === "boolean" ? fastFall : fastFall(moment)) && airTicks > 0 && !grounded && user.motion.vz <= 0.0) held.push(Action.moveDown);
    frame(s, held);
    if (user.special.action !== 0 && user.special.frame === 1) starts.push(tick);
    user.projectiles.forEach((projectile, slot) => {
      if (projectile.life > (lives[slot] ?? 0)) spawns.push(tick);
      lives[slot] = projectile.life;
    });
    if (airTicks >= 0 && user.motion.grounded && landed === undefined) {
      landed = tick;
      landingLag = user.landing.lag;
      specialOnLanding = user.special.action;
    }
  }
  return { starts, spawns, landed: landed ?? -1, landingLag, specialOnLanding };
}

test("Eye Beam and Shadow Strike leave on Falco's and Fox's startup frame, standing and in the air, and a second one only starts after their total frames, never a frame sooner [k4 reference melee]", () => {
  for (const laser of LASERS) {
    for (const air of [false, true]) {
      const { melee } = laser;
      const shot = air ? melee.airShot : melee.groundShot;
      const total = air ? melee.airFrames : melee.groundFrames;
      const where = `${laser.name} ${air ? "in the air" : "standing"}`;
      const hop: Hop = air ? "drop" : "none";
      const exact = play(laser.character, hop, false, (moment) => moment.tick === 1 || moment.tick === 1 + total);
      assertEquals(exact.starts.join(","), [1, 1 + total].join(","), `${where} starts`);
      assertEquals(exact.spawns.join(","), [shot, total + shot].join(","), `${where} shots`);
      const early = play(laser.character, hop, false, (moment) => moment.tick === 1 || moment.tick === total);
      assertTrue(early.starts.every((start) => start === 1 || start >= 1 + total));
      assertTrue(early.spawns.every((spawn) => spawn === shot || spawn >= total + shot));
    }
  }
});
