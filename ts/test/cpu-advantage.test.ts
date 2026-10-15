import { expect, test } from "bun:test";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { produceComputerInput } from "../src/game/match/botPlay";
import { createFrameControls } from "../src/game/match/controls";
import type { CpuTier } from "../src/game/match/cpuProfiles";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { Phase, createMatchState } from "../src/game/lobby/lobbyState";
import { setSweepSeedOffset, sweepSeed } from "../src/game/core/sweep";
import { Character, DownState } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { SELECTABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../src/game/sim/roster";
import { sweep } from "./sweep";

setSweepSeedOffset(Number(process.env.SWEEP_SEED_OFFSET ?? 0));

const NEUTRAL = neutralControls();
const MATCH_FRAMES = 3600;
const SEEDS = 2;

const GET_UP_FRAMES = 12;

interface Advantage { hits: number; techChases: number; juggles: number }

const lying = (state: DownState): boolean => state !== DownState.none && state !== DownState.tumble;

// A tech chase is a hit on a knocked-down fighter or one up for at most GET_UP_FRAMES; a juggle is a new move
// hitting a fighter still airborne from the same attacker's earlier hit.
function play(first: Character, second: Character, tier: CpuTier, seed: number, counts: Advantage): void {
  const world = createRoster(3, [createFighter(first, -200.0, 1), createFighter(second, 200.0, -1)]);
  const match = createMatchState();
  match.phase = Phase.match;
  for (const slot of [0, 1] as const) {
    match.cpuOpponents[slot] = "wren";
    match.cpuResolvedOpponents[slot] = "wren";
    match.cpuTiers[slot] = tier;
  }
  match.stageChoice = 0;
  match.timeLimitMinutes = 0;
  match.matchSeed = seed;
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const launchedBy: (number | undefined)[] = [undefined, undefined];
  const lastMove = [-1, -1];
  const upAt = [-GET_UP_FRAMES - 1, -GET_UP_FRAMES - 1];
  const damage = [0.0, 0.0];
  const down: DownState[] = [DownState.none, DownState.none];
  const airborne = [false, false];
  for (let n = 0; n < MATCH_FRAMES && match.phase === Phase.match; n++) {
    const frame = runtime.simulationFrame + 1;
    for (const slot of [0, 1] as const) {
      const fighter = fighterAt(world, slot);
      damage[slot] = fighter.status.damage;
      down[slot] = fighter.down.state;
      airborne[slot] = !fighter.motion.grounded;
    }
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
    }
    expect(captureFrame(row, frame, world.mask, produced, runtime)).toBe(true);
    expect(executeMatchFrame(row, match, world, controls, runtime, frame)).toBe(true);
    for (const slot of [0, 1] as const) {
      const target = fighterAt(world, slot);
      const by = slot === 0 ? 1 : 0;
      const before = down[slot] ?? DownState.none;
      if (lying(before) && target.down.state === DownState.none) upAt[slot] = n;
      if (target.status.damage > (damage[slot] ?? 0.0) && target.hits.lastAttacker === by && target.launch.hitlag > 0) {
        const attacker = fighterAt(world, by);
        const move = attacker.attack.serial * 1024 + attacker.special.action;
        counts.hits++;
        if (lying(before) || n - (upAt[slot] ?? 0) <= GET_UP_FRAMES) counts.techChases++;
        if (airborne[slot] === true && launchedBy[slot] === by && move !== lastMove[slot]) counts.juggles++;
        launchedBy[slot] = by;
        lastMove[slot] = move;
      }
      if (target.motion.grounded || target.status.out) launchedBy[slot] = undefined;
    }
  }
}

function field(tier: CpuTier): Advantage {
  const counts: Advantage = { hits: 0, techChases: 0, juggles: 0 };
  const roster = SELECTABLE_CHARACTERS;
  for (let index = 0; index < roster.length; index++) for (let seed = 0; seed < SEEDS; seed++) {
    play(roster[index] ?? Character.rifleman, roster[(index + 1 + seed * 7) % roster.length] ?? Character.rifleman, tier, sweepSeed(index * SEEDS + seed), counts);
  }
  return counts;
}

sweep("Wren Expert computers tech-chase and juggle more than one and a half times as often as Rookie in two seeded matches of every fighter: tech chases 2.3-3.1 and juggles 2.2-3.9 times on four seed offsets [k3 measure #388]", () => {
  const expert = field("expert");
  const rookie = field("rookie");
  expect(expert.techChases * 2).toBeGreaterThan(rookie.techChases * 3);
  expect(expert.juggles * 2).toBeGreaterThan(rookie.juggles * 3);
}, 300_000);

test("a seeded Wren Expert Rifleman and Cairne match has more tech chases and juggles than the same Rookie match, 7 and 5 against 0 and 1 [k3 measure #388]", () => {
  const expert: Advantage = { hits: 0, techChases: 0, juggles: 0 };
  const rookie: Advantage = { hits: 0, techChases: 0, juggles: 0 };
  play(Character.rifleman, Character.cairne, "expert", 1, expert);
  play(Character.rifleman, Character.cairne, "rookie", 1, rookie);
  expect(expert.techChases).toBeGreaterThan(rookie.techChases);
  expect(expert.juggles).toBeGreaterThan(rookie.juggles);
});
