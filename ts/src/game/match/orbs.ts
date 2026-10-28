import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { gainUltimate, ultimateCharged } from "../sim/meter";
import { ORB_GAIN, ORB_INTERVAL_FRAMES, collectsOrb, orbPoint, orbsActive, playedFrames, respawning, touchesOrb } from "../sim/orbs";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import type { MatchState } from "../lobby/lobbyState";
import type { MatchOrbs } from "../sim/orbState";

function anyRespawning(world: Roster): boolean {
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot) && respawning(fighterAt(world, slot))) return true;
  return false;
}

export function spawnOrb(orbs: MatchOrbs): void {
  orbs.live = true;
  orbs.held = false;
  orbs.spawnSerial++;
}

function scheduleOrbs(game: MatchState, world: Roster): void {
  if (!orbsActive(game)) return;
  const played = playedFrames(game);
  if (played > 0 && floorMod(played, ORB_INTERVAL_FRAMES) === 0) game.orbs.held = true;
  if (game.orbs.held && !anyRespawning(world)) spawnOrb(game.orbs);
}

export function advanceOrbs(game: MatchState, world: Roster): void {
  scheduleOrbs(game, world);
  const { orbs } = game;
  if (!orbs.live) return;
  const point = orbPoint(game.stageChoice);
  let taker = -1;
  let nearest = 0.0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (!collectsOrb(f) || !touchesOrb(f, point)) continue;
    const gap = Math.abs(f32(f.motion.x - point.x));
    if (taker < 0 || gap < nearest) {
      taker = slot;
      nearest = gap;
    }
  }
  if (taker < 0) return;
  const f = fighterAt(world, taker);
  orbs.lastWasted = ultimateCharged(f);
  gainUltimate(f, ORB_GAIN);
  orbs.live = false;
  orbs.pickupSerial++;
  orbs.lastTaker = taker;
}
