import { parseArgs } from "node:util";
import { f32 } from "wisp/src/sim/f32";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { produceComputerInput } from "../src/game/match/botPlay";
import { createFrameControls } from "../src/game/match/controls";
import { isCpuTier, type CpuTier } from "../src/game/match/cpuProfiles";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState, setComputerParticipants } from "../src/game/lobby/lobbyState";
import { initializeMatchFighters, matchSpawnX } from "../src/game/match/step";
import type { Character } from "../src/game/sim/codes";
import { canAttack } from "../src/game/sim/conditions";
import { observeDamageContacts } from "../src/game/sim/contacts";
import { createFighter, type Fighter, placedObject } from "../src/game/sim/fighter";
import { HERO_REFERENCE_HEIGHT } from "../src/game/sim/heroMoves";
import { companionReady, runningHeroSpecial } from "../src/game/sim/specials/engine";
import { CompanionMode, SpecialSlot } from "../src/game/sim/specials/schema";
import { heroStatusBlocksActions } from "../src/game/sim/heroStatus";
import { SELECTABLE_CHARACTERS, fighterSlug, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { type Controls, copyControls, createRoster, fighterAt, neutralControls } from "../src/game/sim/roster";
import { mainDeckLeft, mainDeckRight } from "../src/game/sim/stage";

export const SUMMONS = {
  bear: { slot: SpecialSlot.side, animal: 0, window: 70 },
  hawk: { slot: SpecialSlot.up, animal: 2, window: 50 },
  quilbeast: { slot: SpecialSlot.down, animal: 1, window: 80 },
} as const;
export type Summon = keyof typeof SUMMONS;

export const MID_RANGE = [f32(HERO_REFERENCE_HEIGHT * 1.4), f32(HERO_REFERENCE_HEIGHT * 2.7)] as const;
const EDGE_ROOM = 160.0;
const STAGE = 0;
const NEUTRAL = neutralControls();

export interface SummonTally { commands: number; hits: number; strikes: number; shielded: number }

function free(f: Readonly<Fighter>): boolean {
  return !f.status.out && f.motion.grounded && f.launch.hitstun <= 0 && f.launch.hitlag <= 0 && !heroStatusBlocksActions(f)
    && runningHeroSpecial(f) === undefined && canAttack(f as Fighter);
}

function press(input: Controls, slot: SpecialSlot, side: number): void {
  input.specialPressed = true;
  input.specialX = slot === SpecialSlot.side ? side : 0;
  input.specialZ = slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0;
  input.verticalDirection = input.specialZ;
  input.direction = side;
}

export function playSummonMatch(summon: Summon, foe: Character, tier: CpuTier, seed: number, frames: number, tally: SummonTally): void {
  const beastmaster = selectableCharacterBySlug("beastmaster");
  if (beastmaster === undefined) throw new Error("no beastmaster");
  const { slot, animal, window } = SUMMONS[summon];
  const match = createMatchState();
  setComputerParticipants(match, 3);
  match.characterChoices[0] = beastmaster;
  match.characterChoices[1] = foe;
  match.stageChoice = STAGE;
  for (const side of [0, 1] as const) {
    match.cpuOpponents[side] = "wren";
    match.cpuResolvedOpponents[side] = "wren";
    match.cpuTiers[side] = tier;
  }
  match.matchSeed = seed;
  match.stockCount = 3;
  match.timeLimitMinutes = 4;
  match.remainingFrames = match.timeLimitMinutes * 60 * MATCH_TICKS_PER_SECOND;
  match.phase = Phase.match;
  const world = createRoster(3, [createFighter(beastmaster, matchSpawnX(0), 1), createFighter(foe, matchSpawnX(1), -1)]);
  const controls = createFrameControls();
  const produced = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  initializeMatchFighters(match, world);
  let open = -1, hit = false, struck = false, guarded = false, wasLunging = false, bit = false;
  observeDamageContacts((source, target) => {
    if (open >= 0 && source === 0 && target === 1) hit = true;
  });
  const close = () => {
    if (open < 0) return;
    tally.commands++;
    if (hit) tally.hits++;
    if (struck) tally.strikes++;
    else if (guarded) tally.shielded++;
    open = -1;
  };
  try {
    for (let frame = 1; frame <= frames && match.phase === Phase.match; frame = runtime.simulationFrame + 1) {
      const me = fighterAt(world, 0), them = fighterAt(world, 1);
      for (const participant of PARTICIPANT_SLOTS) {
        copyControls(produced.inputs[participant], NEUTRAL);
        clearAttackBuffer(produced.commands[participant]);
      }
      produceComputerInput(match, world, runtime, 1, frame, produced.inputs[1], produced.commands[1]);
      const input = produced.inputs[0];
      const placed = placedObject(me, animal);
      const gap = f32(them.motion.x - me.motion.x);
      const toward = gap < 0 ? -1 : 1;
      if (free(me) && open < 0) {
        const alive = placed.life > 0 && placed.spec?.companion !== undefined;
        const mid = Math.abs(gap) >= MID_RANGE[0] && Math.abs(gap) <= MID_RANGE[1] && !them.status.out && Math.abs(f32(them.motion.z - me.motion.z)) <= 60.0;
        if (!alive) press(input, slot, toward);
        else if (mid && companionReady(me, animal)) {
          if (me.facing !== toward) input.direction = toward;
          else press(input, slot, toward);
        } else if (!them.status.out) {
          const step = Math.abs(gap) < MID_RANGE[0] ? -toward : Math.abs(gap) > MID_RANGE[1] ? toward : 0;
          const next = f32(me.motion.x + step * 40.0);
          if (step !== 0 && next > mainDeckLeft(STAGE) + EDGE_ROOM && next < mainDeckRight(STAGE) - EDGE_ROOM) input.direction = step;
        }
      }
      if (!captureFrame(row, frame, world.mask, produced, runtime)) throw new Error(`capture refused frame ${frame}`);
      if (!executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`execution refused frame ${frame}`);
      const lunging = placed.life > 0 && placed.mode === CompanionMode.lunge;
      if (lunging && !wasLunging) {
        close();
        open = frame;
        hit = false;
        struck = false;
        guarded = false;
        bit = false;
      }
      wasLunging = lunging;
      if (open >= 0) {
        if (them.shield.raised) guarded = true;
        const bitten = (placed.bitten & 2) !== 0;
        if (bitten && !bit && !them.shield.raised) struck = true;
        bit = bitten;
        if (frame - open >= window) close();
      }
    }
    close();
  } finally {
    observeDamageContacts(undefined);
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { summons: { type: "string" }, tier: { type: "string" }, seeds: { type: "string" }, frames: { type: "string" }, opponents: { type: "string" } },
    strict: true,
  });
  const tier = values.tier ?? "intermediate";
  if (!isCpuTier(tier)) throw new Error(`no difficulty named ${tier}`);
  const summons = (values.summons?.split(",") ?? Object.keys(SUMMONS)).map((name) => {
    if (!(name in SUMMONS)) throw new Error(`no summon named ${name}`);
    return name as Summon;
  });
  const opponents = values.opponents === undefined
    ? SELECTABLE_CHARACTERS.filter((c) => fighterSlug(c) !== "beastmaster")
    : values.opponents.split(",").map((slug) => {
      const c = selectableCharacterBySlug(slug);
      if (c === undefined) throw new Error(`no fighter named ${slug}`);
      return c;
    });
  const seeds = Number(values.seeds ?? 2);
  const frames = Number(values.frames ?? 3600);
  console.log(`Scripted Beastmaster vs ${tier} CPU, ${opponents.length} opponents x ${seeds} seeds x ${frames} frames on sky-deck; commands only at mid range ${MID_RANGE[0].toFixed(0)}-${MID_RANGE[1].toFixed(0)} units, foe within 60 units of height.`);
  console.log("summon\tcommands\thits\thit-rate\tanimal-strikes\tshielded");
  for (const summon of summons) {
    const tally: SummonTally = { commands: 0, hits: 0, strikes: 0, shielded: 0 };
    for (const foe of opponents) for (let seed = 0; seed < seeds; seed++) playSummonMatch(summon, foe, tier, seed, frames, tally);
    const rate = tally.commands === 0 ? 0 : tally.hits / tally.commands;
    console.log(`${summon}\t${tally.commands}\t${tally.hits}\t${(rate * 100).toFixed(1)}%\t${tally.strikes}\t${tally.shielded}`);
  }
}
