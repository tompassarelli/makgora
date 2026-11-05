import { assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { fighter, frame, scene } from "../match/padScene";
import { Character } from "../sim/codes";
import { emptyCapsule } from "../sim/geometry/contactGeometry";
import { BEAM_TARGET_HEIGHT } from "../sim/specials/heroContact";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { specialAreaRegion } from "./disjointCues";
import { chainBoltSegment } from "./chainBolt";

const CAST_FRAMES = 80;

/** Casts Chain Lightning with foes at the given distances in front of him and returns the bolt on the first frame a foe is hit, or on the last cast frame when none is. */
function cast(distances: readonly number[]): { readonly bolt: ReturnType<typeof emptyCapsule>; readonly hit: boolean; readonly foes: readonly { x: number; z: number }[] } {
  const s = scene(0, [{ character: Character.thrall, x: 0.0, facing: 1 }, ...distances.map(x => ({ character: Character.blademaster, x, facing: -1 }))]);
  const thrall = fighter(s);
  const bolt = emptyCapsule();
  for (let tick = 0; tick < CAST_FRAMES; tick++) {
    frame(s, tick === 0 ? [Action.special] : []);
    const move = runningHeroSpecial(thrall);
    const region = move === undefined ? undefined : specialAreaRegion(thrall, 0);
    if (move?.beam?.chain !== true || region?.strike === undefined) continue;
    chainBoltSegment(bolt, thrall, s.world, move.beam, region.strike.radius);
    if (thrall.special.hit) break;
  }
  return { bolt, hit: thrall.special.hit, foes: distances.map((_, index) => fighter(s, index + 1).motion) };
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1.0;

test("Chain Lightning's bolt ends on the farthest of the foes it hits, so each lies on it [k1 scenario]", () => {
  const { bolt, hit, foes } = cast([200.0, 400.0]);
  assertTrue(hit);
  const far = foes[1];
  if (far === undefined) throw new Error("no far foe");
  assertTrue(near(bolt.x2, far.x));
  assertTrue(near(bolt.z2, f32(far.z + BEAM_TARGET_HEIGHT)));
});
