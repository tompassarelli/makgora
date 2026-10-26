import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { duelPair, stepDuel } from "../sim/testDuel";
import { controls } from "../sim/testWorld";
import { FLAME_STRIKE_AIM, FLAME_STRIKE_BURST, FLAME_STRIKE_RUNE } from "../fighters/kaelthas/specials";
import { type DiscLook, discLook } from "./discLook";
import { PROJECTILE_DRAW_OFFSETS } from "./projectileArt";
import { projectedProjectile } from "./projectilePose";

const press = controls({ specialPressed: true, specialX: 1, specialHeld: true });
const hold = controls({ specialHeld: true });
const idle = controls();
const HELD_FRAMES = 12;

test("Flame Strike's ring stays small while the rune slides, then grows and heats onto the burst's whole hit area where the pillar bursts [k1 scenario]", () => {
  const draw = PROJECTILE_DRAW_OFFSETS[FLAME_STRIKE_RUNE.model ?? ""];
  if (draw?.fuse === undefined || draw.disc === undefined) throw new Error("the rune draws no fuse ring");
  const kael = createFighter(Character.kaelthas, 0.0, 1);
  const { world } = duelPair(kael, createFighter(Character.rifleman, 900.0, -1));
  const ring: DiscLook = { lift: 0.0, radius: 0.0, red: 0, green: 0, blue: 0, alpha: 0 };
  const held: number[] = [], fused: number[] = [], greens: number[] = [];
  let last = { x: 0.0, z: 0.0 }, burst: { x: number; z: number } | undefined;
  for (let frame = 0; frame < 90 && burst === undefined; frame++) {
    stepDuel(world, frame === 0 ? press : frame <= FLAME_STRIKE_AIM.frame + HELD_FRAMES ? hold : idle);
    const index = kael.projectiles.findIndex((projectile) => projectile.life > 0 && projectile.spec === FLAME_STRIKE_RUNE);
    const pillar = kael.projectiles.find((projectile) => projectile.life > 0 && projectile.spec === FLAME_STRIKE_BURST);
    if (pillar !== undefined) burst = { x: pillar.x, z: pillar.z };
    if (index < 0) continue;
    const pose = projectedProjectile(kael, index, true);
    discLook(ring, draw, pose, false, false, -1);
    (frame <= FLAME_STRIKE_AIM.frame + HELD_FRAMES ? held : fused).push(ring.radius);
    greens.push(ring.green);
    last = { x: pose.x, z: f32(pose.z + ring.lift) };
  }
  assertTrue(burst !== undefined && held.length > 0 && fused.length >= 30);
  assertTrue(held.every((radius) => radius === held[0]) && (held[0] ?? 0.0) < FLAME_STRIKE_BURST.radius * 0.5);
  assertTrue(fused.every((radius, i) => i === 0 || radius > (fused[i - 1] ?? 0.0)));
  assertTrue((fused[fused.length - 1] ?? 0.0) >= FLAME_STRIKE_BURST.radius * f32(0.95));
  assertTrue((greens[greens.length - 1] ?? 0) > (greens[0] ?? 0) + 100);
  assertEquals(`${last.x},${last.z}`, `${burst?.x},${burst?.z}`, "the ring centres where the pillar's hit area bursts");
});
