import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { DownState, LedgeState } from "../sim/codes";
import { isTumbling } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { exCharged, fillEx, gainUltimate, regenerateMeter, ultimateCharged } from "../sim/meter";
import { ORB_INTERVAL_FRAMES, ULTIMATE_ORB_GAIN, orbPoint, orbsActive, playedFrames, respawning, scheduledOrb, touchesOrb } from "../sim/orbs";
import { OrbKind } from "../sim/orbState";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import type { MatchState } from "../lobby/lobbyState";

function anyRespawning(world: Roster): boolean {
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot) && respawning(fighterAt(world, slot))) return true;
  return false;
}

function takesOrb(f: Readonly<Fighter>): boolean {
  const rolling = (f.dodge.groundFrame > 0 && f.dodge.groundDirection !== 0) || f.down.state === DownState.roll || f.down.state === DownState.techRoll || f.ledge.state === LedgeState.roll;
  return !f.status.out && !rolling && !isTumbling(f) && f.launch.hitlag <= 0 && f.launch.hitstun <= 0;
}

export function advanceMeterRegen(game: Readonly<MatchState>, world: Roster): void {
  if (playedFrames(game) <= 0) return;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) regenerateMeter(fighterAt(world, slot));
}

function collect(f: Fighter, kind: OrbKind): boolean {
  if (kind === OrbKind.ex) {
    const wasted = exCharged(f);
    fillEx(f);
    return wasted;
  }
  const wasted = ultimateCharged(f);
  gainUltimate(f, ULTIMATE_ORB_GAIN);
  return wasted;
}

export function advanceOrbs(game: MatchState, world: Roster): void {
  if (!orbsActive(game)) return;
  const { orbs } = game;
  const played = playedFrames(game);
  if (played > 0 && floorMod(played, ORB_INTERVAL_FRAMES) === 0) orbs.held = scheduledOrb(floorDiv(played, ORB_INTERVAL_FRAMES));
  if (orbs.held !== OrbKind.none && !anyRespawning(world)) {
    orbs.live = orbs.held;
    orbs.held = OrbKind.none;
    orbs.spawnSerial++;
  }
  if (orbs.live === OrbKind.none) return;
  const point = orbPoint(game.stageChoice);
  let taker = -1;
  let nearest = 0.0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (!takesOrb(f) || !touchesOrb(f, point)) continue;
    const gap = Math.abs(f32(f.motion.x - point.x));
    if (taker < 0 || gap < nearest) {
      taker = slot;
      nearest = gap;
    }
  }
  if (taker < 0) return;
  orbs.lastWasted = collect(fighterAt(world, taker), orbs.live);
  orbs.lastKind = orbs.live;
  orbs.live = OrbKind.none;
  orbs.pickupSerial++;
  orbs.lastTaker = taker;
}
