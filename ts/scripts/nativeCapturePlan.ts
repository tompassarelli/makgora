











import { join } from "node:path";
import { Effect, Schema } from "effect";
import type { MapEntry } from "wisp/src/headless/client";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { Roster } from "../src/game/sim/roster";
import { fighterAt } from "../src/game/sim/roster";
import { damageTint, hitlagShake } from "../src/game/presentation/hitPresentation";
import { SMASHCRAFT_HEADLESS } from "./wisp/headless";
import type { CaptureFixture } from "../src/platform/captureFixtures";
import { SELECTABLE_CHARACTERS, fighterName, fighterSlug } from "../src/game/sim/heroes/registry";
import { authoredTuning } from "../src/game/sim/tuning";
import { AttackStyle } from "../src/game/sim/codes";
import { attackDurationFramesForGrounding, attackStartupFrames, isAerialAttack } from "../src/game/sim/moves";
import { specialKit } from "../src/game/sim/specials/schema";
import { heroCueWindows } from "../src/game/presentation/specialCues";

export function reelFixtures(only: string | undefined, holdTicks = 6): CaptureFixture[][] {
  if (!Number.isInteger(holdTicks) || holdTicks < 6 || holdTicks > 180) throw new Error("reel hold ticks must be 6..180");
  const batches = SELECTABLE_CHARACTERS.filter(character => only === undefined || fighterSlug(character) === only).map(character => {
    const tuning = authoredTuning(character);
    const fighter = fighterSlug(character);
    const normals = tuning.moves === undefined
      ? Object.entries(AttackStyle).filter(([, code]) => code !== AttackStyle.grab && code !== AttackStyle.dashAttack)
      : Object.entries(AttackStyle).filter(([, code]) => tuning.moves?.normals[code] !== undefined);
    const moves: { slot: string; kind: string; code: number; first: number; end: number }[] = normals.map(([slot, code]) => ({ slot, kind: "normal", code, first: attackStartupFrames(code, tuning.moves), end: attackDurationFramesForGrounding(code, !isAerialAttack(code), tuning.moves) }));
    ["neutral_b", "side_b", "up_b", "down_b"].forEach((slot, code) => {
      const special = tuning.specials === undefined ? undefined : specialKit(tuning.specials, code).ground;
      moves.push({ slot, kind: "special", code, first: special === undefined ? 12 : heroCueWindows(special).active.first, end: special?.endFrame ?? 120 });
    });
    if (tuning.ultimate !== undefined) moves.push({ slot: "ultimate", kind: "ultimate", code: 0, first: heroCueWindows(tuning.ultimate).active.first, end: tuning.ultimate.endFrame });
    return moves.flatMap((move, index) => (["right", "left"] as const).map((facing, side) => {
      const row = `R${String(index * 2 + side + 1).padStart(2, "0")}`;
      const duration = Math.max(8, move.end);
      const samples = [1, Math.max(2, Math.floor(move.first / 2)), move.first, Math.round(duration / 3), Math.round(duration * 2 / 3), duration, duration + 2, duration + (move.kind === "ultimate" ? 300 : 4)];
      const frames: number[] = [];
      for (const sample of samples.sort((a, b) => a - b)) frames.push(Math.max(40 + sample, (frames.at(-1) ?? 40) + 1));
      const script = `#! chat -dev quick hero ${fighterName(character).toLowerCase()}\n#! reel ${fighter} ${row} ${move.slot} ${facing} ${holdTicks}\n40 a move ${move.kind} ${move.code} ${facing}\n${frames.map(frame => `${frame} a capture`).join("\n")}\n`;
      return { name: `${fighter}-${row}`, frames, script, holdTicks, openingTicks: 1, tailFrames: 0, reel: { fighter, row, slot: move.slot, facing } };
    }));
  });
  if (batches.length === 0) throw new Error(`unknown fighter ${only}`);
  return batches;
}


const platform = join(import.meta.dir, "../src/platform");
interface Shell { readonly world: Roster; readonly runtime: { readonly simulationFrame: number } }
const loadPlatform = async () => {
  const { shell }: { shell(): Shell } = await import(join(platform, "../host/loop/state.ts"));
  const { nativeDriverCommand }: { nativeDriverCommand(text: string): void } = await import(join(platform, "nativeDriver.ts"));
  const entry: MapEntry = await import(join(platform, "../host/entries/nativeDriverMain.ts"));
  return { shell, nativeDriverCommand, entry };
};
type Platform = Awaited<ReturnType<typeof loadPlatform>>;

export class PlanFailure extends Schema.TaggedError<PlanFailure>()("PlanFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

type Look = "tint" | "shake" | "recoil";
type Check = { readonly kind: "sound"; readonly name: string } | { readonly kind: "effect"; readonly name: string } | { readonly kind: Look; readonly slot: number };
export interface Cue { readonly from: number; readonly to: number; readonly name: string; readonly checks: readonly Check[]; readonly line: number }

export function parseCues(script: string): Cue[] {
  const cues: Cue[] = [];
  script.split("\n").forEach((raw, index) => {
    const match = /^\s*#!\s*cue\s+(\d+)(?:-(\d+))?\s+([^:]+):\s*(.+?)\s*$/.exec(raw);
    if (match === null) {
      if (/^\s*#!\s*cue\b/.test(raw)) throw new Error(`line ${index + 1}: a cue line is "#! cue FROM[-TO] NAME: CHECK..."`);
      return;
    }
    const checks = (match[4] ?? "").split(/\s+/).map((word): Check => {
      const [kind, value = ""] = word.split("=");
      if (kind === "sound" || kind === "effect") return kind === "sound" ? { kind, name: value } : { kind, name: value };
      if ((kind === "tint" || kind === "shake" || kind === "recoil") && (value === "a" || value === "b")) return { kind, slot: value === "a" ? 0 : 1 };
      throw new Error(`line ${index + 1}: unknown check ${word}`);
    });
    const from = Number(match[1]);
    cues.push({ from, to: match[2] === undefined ? from : Number(match[2]), name: (match[3] ?? "").trim(), checks, line: index + 1 });
  });
  return cues;
}

const fileName = (path: string) => path.replace(/.*[\\/]/, "").replace(/\.[^.]*$/, "");

interface Held {
  readonly frame: number;
  readonly effects: readonly { readonly model: string; readonly made: number }[];
  readonly looks: readonly (readonly Look[])[];
}


function play({ shell, nativeDriverCommand, entry }: Platform, fixture: CaptureFixture) {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients(entry, [0]);
    const client = clients.client(0);
    let frame = 0;
    const read = () => client.run(() => { frame = shell().runtime.simulationFrame; });
    clients.start();
    clients.frames(3);
    clients.everywhere(() => nativeDriverCommand(fixture.script));
    clients.frames(3);
    const sounds: { name: string; frame: number }[] = [];
    const made = new Map<unknown, number>();
    let showing = new Set<unknown>();
    const held: Held[] = [];
    let heard = client.soundLog.length;
    const advance = () => {
      clients.frames(1);
      read();
      for (const cue of client.soundLog.slice(heard)) if (cue.event === "start") sounds.push({ name: fileName(cue.label ?? cue.source ?? ""), frame });
      heard = client.soundLog.length;

      const visible = new Set(client.effectPoses({ visibleOnly: true }).map(pose => pose.handle));
      for (const handle of visible) if (!showing.has(handle)) made.set(handle, frame);
      showing = visible;
    };
    for (const target of fixture.frames) {
      clients.everywhere(() => nativeDriverCommand(`resume ${target}`));
      for (let guard = 0; frame !== target; guard++) {
        if (guard > (target + 30) * 4) throw new Error(`${fixture.name}: the match never reached frame ${target} (stopped at ${frame})`);
        advance();
      }
      advance();
      if (frame !== target) throw new Error(`${fixture.name}: frame ${target} wasn't held`);
      const looks: Look[][] = [];
      client.run(() => {
        for (const slot of [0, 1]) {
          const fighter = fighterAt(shell().world, slot);
          const shown: Look[] = [];
          if (damageTint(fighter) !== undefined) shown.push("tint");
          if (hitlagShake(fighter) !== 0) shown.push("shake");
          if (fighter.shield.raised && fighter.shield.stun > 0) shown.push("recoil");
          looks.push(shown);
        }
      });
      held.push({ frame, looks, effects: client.effectPoses({ visibleOnly: true }).map(pose => ({ model: fileName(pose.model), made: made.get(pose.handle) ?? 0 })) });
    }
    if (client.errors.length > 0) throw new Error(`${fixture.name}: ${client.errors.join("; ")}`);
    return { sounds, held };
  } finally {
    runtime.restore();
  }
}


export function judge(cues: readonly Cue[], run: ReturnType<typeof play>) {
  return cues.map(cue => {
    const inRange = (frame: number) => frame >= cue.from && frame <= cue.to;
    const stamped = run.held.filter(hold => inRange(hold.frame)).map(hold => hold.frame);
    const found = cue.checks.map(check => {
      if (check.kind === "sound") {
        const at = run.sounds.find(sound => sound.name === check.name && inRange(sound.frame))?.frame;
        return { check: `sound ${check.name}`, at };
      }
      if (check.kind === "effect") {
        const at = run.held.find(hold => inRange(hold.frame) && hold.effects.some(effect => effect.model.startsWith(check.name) && effect.made >= cue.from && effect.made <= hold.frame))?.frame;
        return { check: `effect ${check.name}`, at };
      }
      const { kind, slot } = check;
      const at = run.held.find(hold => inRange(hold.frame) && (hold.looks[slot] ?? []).includes(kind))?.frame;
      return { check: `${kind} ${"ab"[slot]}`, at };
    });
    return { cue, stamped, found, pass: stamped.length > 0 && found.every(row => row.at !== undefined) };
  });
}

export const planFixture = (fixture: CaptureFixture) => Effect.gen(function*() {
  const cues = yield* Effect.try({ try: () => parseCues(fixture.script), catch: cause => new PlanFailure({ problem: `${fixture.name}: ${String(cause)}` }) });
  if (cues.length === 0 && fixture.reel === undefined) return yield* new PlanFailure({ problem: `${fixture.name}: no #! cue lines to check` });
  const loaded = yield* Effect.tryPromise({ try: loadPlatform, catch: cause => new PlanFailure({ problem: `load the map code: ${String(cause)}` }) });
  const run = yield* Effect.try({ try: () => play(loaded, fixture), catch: cause => new PlanFailure({ problem: String(cause) }) });
  if (fixture.reel !== undefined) {
    console.log(`PLAN ${fixture.name}: ${run.held.length} held frames through the native-driver map entry (headless, no pixel verdict)`);
    return { fixture: fixture.name, cues: run.held.length, passed: run.held.length };
  }
  const verdicts = judge(cues, run);
  for (const { cue, stamped, found, pass } of verdicts) {
    const seen = found.map(row => `${row.check} ${row.at === undefined ? "MISSING" : `@${row.at}`}`).join(", ");
    console.log(`${pass ? "PASS" : "FAIL"} ${fixture.name} ${cue.from}${cue.to === cue.from ? "" : `-${cue.to}`} ${cue.name}: ${seen}; stamped ${stamped.length === 0 ? "nowhere" : stamped.join(",")}`);
  }
  return { fixture: fixture.name, cues: verdicts.length, passed: verdicts.filter(row => row.pass).length };
});
