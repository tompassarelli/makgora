










import { type PerfMeasure, runLuaPerf, runLuaPerfWith } from "wisp/src/headless/luaPerf";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../../src/game/sim/heroes/registry";
import { BOT_FOUR, BOT_THREE, HUMAN_DUEL, HUMAN_FOUR, botMatchAgainst, playBotMatch } from "./botMatch";
import { PREDICTED_LOCAL_NATIVES, SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import { QUICK_MATCH } from "./quickMatch";
import { playFighterCensus, playStageCensus } from "./census";
import { profileRun } from "./censusProfile";
import type { LuaHeadlessMap } from "wisp/src/headless/lua";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { SMASHCRAFT_NOOPS, smashcraftNativeBehavior } from "./headlessNatives";
import { DEEP_ROLLBACK_DEPTHS, DEEP_ROLLBACK_SPIKES, confirmedLag, deepestRollback, lagSpikeDelivery } from "./rollbackSpike";
import { CATCH_UP_FRAMES } from "../../src/game/session/playback";

declare const arg: Readonly<Record<number, string | undefined>>;
declare function print(this: void, ...values: unknown[]): void;

const [bundle, declarations, run = "quick-match", framesText = "1800", samples] = [arg[1], arg[2], arg[3], arg[4], arg[5]];
if (bundle === undefined || declarations === undefined) throw new Error("usage: lua perf.lua MAP_LUA WARCRAFT_D_TS [RUN [FRAMES [samples]]]");
const map = { filePrefix: "smashcraft", localNatives: SMASHCRAFT_LOCAL_NATIVES, intentionalNoops: SMASHCRAFT_NOOPS, natives: () => smashcraftNativeBehavior() };
const options = { samples: samples === "samples" };
const computer = SELECTABLE_CHARACTERS.find((character) => run === `bot-${fighterSlug(character)}`);
const capturing = run === "native-perf-four";
const deep = run === "rollback-four" || capturing;
const CAPTURE_SETTLE_FRAMES = 30;
const humans = run === "playable-duel" ? HUMAN_DUEL : run === "playable-human-four" ? HUMAN_FOUR : deep ? { ...HUMAN_FOUR, everyRowChanges: true } : undefined;
const bot = humans ?? (run === "bot" ? BOT_THREE : run === "bot-four" || run === "playable-bot-four" ? BOT_FOUR : computer !== undefined ? botMatchAgainst(computer) : undefined);
const censusFighter = SELECTABLE_CHARACTERS.find((character) => run === `census-${fighterSlug(character)}`);
const censusStage = run.startsWith("census-stage-") ? Number(run.substring("census-stage-".length)) : undefined;

const profileText = os.getenv("PERF_PROFILE_FRAMES");
const measured = (headless: LuaHeadlessMap, play: (this: void, clients: Lockstep, measure: PerfMeasure) => { readonly problems: number; readonly lines: readonly string[] }, delivery?: SyncDelivery) => {
  if (profileText === undefined) return runLuaPerfWith(headless, bundle, declarations, play, delivery === undefined ? options : { ...options, delivery });
  const frames = new Set<number>();
  for (const text of profileText.split(",")) if (text !== "") frames.add(Number(text));
  return profileRun(headless, bundle, declarations, frames, play, delivery, os.getenv("PERF_PROFILE_PHASES") === "1");
};
function writeCapture(clients: Lockstep, notes: string[]): string[] {
  const out = os.getenv("PERF_CAPTURE");
  const receipt = clients.client(0).files.get("smashcraft-perf-capture-p0-run1.txt");
  if (receipt === undefined) return ["p0 wrote no frame capture"];
  if (out === undefined) {
    notes.push(`p0 capture of ${receipt.length - 1} callbacks; set PERF_CAPTURE=FILE to keep it`);
    return [];
  }
  const [file] = io.open(out, "w");
  if (file === undefined) return [`cannot write ${out}`];
  for (const line of receipt) file.write(`p0 capture: ${line}\n`);
  file.close();
  notes.push(`p0 capture of ${receipt.length - 1} callbacks written to ${out}`);
  return [];
}

let problems: number;
if (censusFighter !== undefined || censusStage !== undefined) {

  const census = { ...map, players: [0] };
  const play = (clients: Lockstep, measure: PerfMeasure) => censusFighter !== undefined ? playFighterCensus(clients, measure, censusFighter, fighterSlug(censusFighter)) : playStageCensus(clients, measure, censusStage ?? 0, `${censusStage}`);
  problems = measured(census, play);
} else if (run === "quick-match") problems = runLuaPerf(map, QUICK_MATCH, bundle, declarations, options);
else if (bot !== undefined) {

  const predicted = { ...map, localNatives: PREDICTED_LOCAL_NATIVES, players: run === "playable-human-four" || deep ? [0, 1, 2, 3] : [0, 1], ...(capturing ? { natives: () => ({ ...smashcraftNativeBehavior(), os: { clock: os.clock } }) } : {}) };
  const build = run.startsWith("playable-") || deep ? PLAYABLE_BUILD : undefined;
  const delivery = deep ? lagSpikeDelivery(syncDelivery(MEASURED_BATTLE_NET, 7), DEEP_ROLLBACK_SPIKES, 4) : syncDelivery(MEASURED_BATTLE_NET, 7);
  const depths: string[] = [];
  const play = (clients: Lockstep, measure: PerfMeasure) => {
    const catchingUp = clients.clients.map(() => 0);
    let requested = false;
    const played = () => {
      if (capturing && !requested) {
        requested = true;
        clients.chat(0, `-dev capture ${Number(framesText) - CAPTURE_SETTLE_FRAMES}`);
      }
      clients.clients.forEach((client, index) => {
        if ((confirmedLag(client) ?? 0) > CATCH_UP_FRAMES) catchingUp[index] = (catchingUp[index] ?? 0) + 1;
      });
    };
    const result = playBotMatch(clients, bot, Number(framesText), measure, build, deep ? played : undefined);
    if (!deep) return result;
    const lines = [...result.lines];
    if (capturing) lines.push(...writeCapture(clients, depths));
    clients.clients.forEach((client, index) => {
      const depth = deepestRollback(client);
      if (depth === undefined) lines.push(`p${client.slot} has no rollback session`);
      else {
        depths.push(`p${client.slot} rollback window ${depth.window} deepest ${depth.deepest} corrections ${depth.corrections} catch-up callbacks ${catchingUp[index] ?? 0}`);
        const reached = DEEP_ROLLBACK_DEPTHS[index] ?? depth.window;
        if (depth.deepest < reached) lines.push(`p${client.slot} deepest rollback ${depth.deepest} never reached ${reached} frames`);
      }
    });
    return { problems: lines.length, lines };
  };
  problems = measured(predicted, play, delivery);
  for (const line of depths) print(`journey: ${line}`);
} else throw new Error(`no run named ${run}: quick-match, bot, bot-four, playable-bot-four, playable-duel, playable-human-four, rollback-four, native-perf-four or bot-FIGHTER`);
if (problems > 0) os.exit(1);
