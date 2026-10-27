import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { floorMod } from "wisp/src/sim/intMath";
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

const takeoff = (moment: Moment): boolean => moment.airTicks === 0;
const afterLanding = (moment: Moment): boolean => moment.landed !== undefined && moment.tick === moment.landed + 1;

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
test("A short-hop laser pressed on the takeoff frame fires on the aerial startup frame, is cut by the landing with no landing lag, and leaves the fighter able to fire at once, fast fall or not [k4 reference melee]", () => {
  for (const laser of LASERS) {
    for (const fastFall of [false, true]) {
      const hop = play(laser.character, "short", fastFall, takeoff);
      assertEquals(hop.starts.length, 1, `${laser.name} short hop starts`);
      assertEquals(hop.spawns.join(","), String(hop.starts[0]! + laser.melee.airShot - 1), `${laser.name} short hop shot`);
      assertGreaterThan(hop.landed, hop.spawns[0]!);
      assertEquals(hop.landingLag, laser.melee.landingLag, `${laser.name} landing lag`);
      assertEquals(hop.specialOnLanding, 0, `${laser.name} special on landing`);
      const chained = play(laser.character, "short", fastFall, (moment) => takeoff(moment) || afterLanding(moment));
      assertEquals(chained.starts[1], hop.landed + 1, `${laser.name} next laser starts the frame after landing`);
    }
  }
});

test("A short-hop double laser fires its air laser on the aerial startup frame and its landing laser on the standing startup frame after a landing with no lag, whether or not the first beam is still in flight [k4 reference melee]", () => {
  for (const laser of LASERS) {
    for (const fastFall of [false, true]) {
      const run = play(laser.character, "short", fastFall, (moment) => takeoff(moment) || afterLanding(moment));
      assertEquals(run.starts.length, 2, `${laser.name} double laser starts`);
      assertEquals(run.starts[1], run.landed + 1);
      assertEquals(run.spawns.join(","), [run.starts[0]! + laser.melee.airShot - 1, run.starts[1]! + laser.melee.groundShot - 1].join(","), `${laser.name} double laser shots`);
    }
  }
});

test("A full hop mashing the laser on every frame it is allowed fires one every aerial total frames from the takeoff, lands out of the one in progress and fires the landing laser the frame after [k4 reference melee]", () => {
  for (const laser of LASERS) {
    const { airShot, airFrames, groundShot } = laser.melee;
    const run = play(laser.character, "full", false, (moment) => takeoff(moment) || afterLanding(moment)
      || (moment.landed === undefined && moment.lastStart !== undefined && moment.tick === moment.lastStart + airFrames));
    const first = run.starts[0]!;
    const airStarts: number[] = [];
    for (let start = first; start <= run.landed; start += airFrames) airStarts.push(start);
    const airShots = airStarts.map((start) => start + airShot - 1).filter((shot) => shot <= run.landed);
    assertEquals(run.starts.slice(0, airStarts.length).join(","), airStarts.join(","), `${laser.name} full hop starts`);
    assertEquals(run.starts[airStarts.length], run.landed + 1);
    assertEquals(run.spawns.join(","), [...airShots, run.landed + groundShot].join(","), `${laser.name} full hop shots`);
    assertGreaterThan(airShots.length, 0);
  }
});

/** Fox's Blaster loops while B is pressed again: another shot every 10 frames from the first, a repeat press counting from frame 4 (meleeframedata.com/fox; SmashWiki Fox (SSBM)/Neutral special repeat window). */
const FOX_REFIRE = { firstPress: 4, every: 10 };

test("Shadow Strike short-hop double lasers as Fox does: B on the takeoff frame and again on the earliest refire frame throws two daggers before landing, Fox's refire apart, then lands with no lag, fast falling after the second or not [k4 reference melee]", () => {
  const shot = FOX.airShot;
  for (const fastFall of [false, true]) {
    const run = play(Character.warden, "short", (moment) => fastFall && moment.shots >= 2,
      (moment) => takeoff(moment) || (moment.lastStart !== undefined && moment.tick === moment.lastStart + FOX_REFIRE.firstPress - 1));
    const label = fastFall ? "fast fall" : "no fast fall";
    assertEquals(run.starts.length, 1, `${label}: one cast`);
    const start = run.starts[0]!;
    assertEquals(run.spawns.join(","), [start + shot - 1, start + shot - 1 + FOX_REFIRE.every].join(","), `${label}: daggers`);
    assertGreaterThan(run.landed, run.spawns[1]!);
    assertEquals(run.landingLag, 0, `${label}: landing lag`);
    assertEquals(run.specialOnLanding, 0, `${label}: special on landing`);
  }
});

test("Mashing Shadow Strike on the ground throws a dagger every 10 frames, Fox's Blaster rate, and a press before frame 4 does not loop it [k4 reference melee]", () => {
  const mashed = play(Character.warden, "none", false, (moment) => floorMod(moment.tick, 2) === 1 && moment.tick <= 60);
  const first = FOX.groundShot;
  assertEquals(mashed.starts[0], 1);
  assertEquals(mashed.spawns.slice(0, 5).join(","), [0, 1, 2, 3, 4].map((n) => first + n * FOX_REFIRE.every).join(","), "mashed daggers");
  const early = play(Character.warden, "none", false, (moment) => moment.tick === 1 || moment.tick === FOX_REFIRE.firstPress - 1);
  assertEquals(early.spawns.join(","), String(first), "a press on frame 3 does not loop");
});
