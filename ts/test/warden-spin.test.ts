import { expect, test } from "bun:test";
import { AttackStyle } from "../src/game/sim/codes";
import { WARDEN_MOVES } from "../src/game/sim/heroes/wardenMoves";
import { WARDEN_SPIN_PIVOT_Z, WARDEN_SPIN_SECTORS, wardenSpinTipDegrees } from "../src/game/sim/heroes/wardenSpin";

const SECTOR = 360 / WARDEN_SPIN_SECTORS;
const sectorAt = (x: number, z: number) => Math.floor(((Math.atan2(z - WARDEN_SPIN_PIVOT_Z, x) * 180 / Math.PI) + 360) % 360 / SECTOR) % WARDEN_SPIN_SECTORS;

test("Warden's neutral-air tip turns a full circle over the active frames, every 45-degree sector it passes on a frame holds a blade region on that frame, and no region reaches a sector it does not pass [k3 measure #440]", () => {
  const move = WARDEN_MOVES.normals[AttackStyle.neutralAir];
  if (move === undefined) throw new Error("Warden neutral air is missing");
  const active = move.activeFrames, start = move.startupFrames;
  expect(wardenSpinTipDegrees(active, active) - wardenSpinTipDegrees(0, active)).toBeGreaterThanOrEqual(360);
  const problems: string[] = [];
  for (let frame = 0; frame < move.totalFrames; frame++) {
    const strikes = move.regions.filter((region) => region.firstFrame <= frame && frame <= region.lastFrame).map((region) => region.hit.strike);
    const passed = new Set<number>();
    if (frame >= start && frame < start + active) {
      for (let step = 0; step < 64; step++) {
        const radians = wardenSpinTipDegrees(frame - start + step / 64, active) * Math.PI / 180;
        passed.add(sectorAt(Math.cos(radians), WARDEN_SPIN_PIVOT_Z + Math.sin(radians)));
      }
    }
    const held = new Set<number>();
    for (const strike of strikes) {
      if (strike === undefined) { problems.push(`frame ${frame}: region without a blade`); continue; }
      held.add(sectorAt((strike.x1 + strike.x2) / 2, (strike.z1 + strike.z2) / 2));
      for (let along = 0; along <= 20; along++) for (let around = 0; around < 32; around++) {
        const x = strike.x1 + (strike.x2 - strike.x1) * along / 20 + strike.radius * Math.cos(around * Math.PI / 16);
        const z = strike.z1 + (strike.z2 - strike.z1) * along / 20 + strike.radius * Math.sin(around * Math.PI / 16);
        if (!passed.has(sectorAt(x, z))) problems.push(`frame ${frame}: region reaches sector ${sectorAt(x, z)}`);
      }
    }
    for (const sector of passed) if (!held.has(sector)) problems.push(`frame ${frame}: sector ${sector} uncovered`);
  }
  expect([...new Set(problems)]).toEqual([]);
});
