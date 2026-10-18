import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { installHeadless, playHeadless } from "wisp/scripts/wisp/headless";
import { type RenderScene, captureScene, renderScenes } from "wisp/scripts/wisp/headlessRender";
import { parseGraphics } from "wisp/scripts/wisp/graphicsProfiles";
import type { Graphics } from "wisp/scripts/wisp/renderAssets";
import type { MapEntry } from "wisp/src/headless/client";
import { SELECTABLE_CHARACTERS, fighterKey } from "../src/game/sim/heroes/registry";
import { contactDamageClips } from "../src/game/presentation/damagePose";
import { PAIN_ENTRY_BLEND_FRAMES } from "../src/game/presentation/damageBlend";
import { PAIN_SCENARIOS } from "../src/game/session/painFixture";
import { DROPS_COMMAND, HAZARDS_COMMAND, ITEMS_COMMAND } from "../src/game/session/sessionSetup";
import { PREDICTED_HEADLESS } from "./wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import * as platformMain from "../src/platform/main";
import { headlessRender } from "./wisp/headlessRender";
import { smashcraftNativeBehavior } from "./wisp/headlessNatives";
import { RETURNING_PLAYER_FILES } from "./selectStrip";
import { runProcess } from "./hostProcess";
import { shellState } from "../src/host/loop/state";
import { fighterAt } from "../src/game/sim/roster";

class PainStripFailure extends Schema.TaggedError<PainStripFailure>()("PainStripFailure", { problem: Schema.String }) {}

const USAGE = "usage: bun scripts/painStrip.ts OUT_DIR [--graphics classic|definitive] [--resolution WxH] [--fighters NAME,NAME...]";
const CHAT_FRAME = 30;
const FIRST_OBSERVED = 40;
const HELD_FRAMES = 14;
const QUIET_ARENA = [`${HAZARDS_COMMAND}off`, `${ITEMS_COMMAND}off`, `${DROPS_COMMAND}off`];
const LAST_OBSERVED = 420;
const SHEET_ORDER = ["high-small", "high-medium", "high-large", "middle-small", "middle-medium", "middle-large", "low-small", "low-medium", "low-large"];

export interface PainShot {
  readonly fighter: string;
  readonly category: string;
  readonly expectedClip: number;
  readonly hitFrame: number | undefined;
  readonly first: RenderScene | undefined;
  readonly held: RenderScene | undefined;
}

export function playerBuildEntry(): MapEntry {
  const build = { ...PLAYABLE_BUILD, devConsole: true };
  return { install: () => platformMain.install(build), start: () => platformMain.startBuild(build) };
}

export function painShots(entry: MapEntry, characters: readonly number[], screen: { readonly width: number; readonly height: number }, graphics: Graphics): PainShot[] {
  const runtime = installHeadless({ ...PREDICTED_HEADLESS, natives: (client) => smashcraftNativeBehavior(client, graphics) });
  const files = { read: (name: string) => RETURNING_PLAYER_FILES[name], written: () => undefined };
  const shots: PainShot[] = [];
  const frames = Array.from({ length: LAST_OBSERVED - FIRST_OBSERVED + 1 }, (_, step) => FIRST_OBSERVED + step);
  try {
    for (const character of characters) {
      const row = contactDamageClips(character) ?? [];
      for (const [index, scenario] of PAIN_SCENARIOS.entries()) {
        const expectedClip = row[index]?.index ?? -1;
        const settle = PAIN_ENTRY_BLEND_FRAMES[index % 3] ?? 0;
        const [, height = "", strength = ""] = scenario.split("-");
        let hitFrame: number | undefined;
        let first: RenderScene | undefined;
        let held: RenderScene | undefined;
        let holding = true;
        const journey = { frames: LAST_OBSERVED + 1, events: [...QUIET_ARENA.map((chat, step) => ({ frame: CHAT_FRAME - 10 + step, player: 0, chat })), { frame: CHAT_FRAME, player: 0, chat: `-dev pain ${height} ${strength} ${fighterKey(character)}` }] };
        const lockstep = runtime.clients(entry, [0, 1], { keepCalls: 1, screen, files: () => files });
        const painFrames = new Map<number, boolean>();
        const [observed] = lockstep.clients;
        if (observed !== undefined) {
          const setCameraField = observed.natives["SetCameraField"] as (...args: unknown[]) => unknown;
          observed.natives["SetCameraField"] = (...args: unknown[]) => {
            const shell = shellState();
            const victim = shell === undefined ? undefined : fighterAt(shell.world, 0);
            painFrames.set(observed.frame, shell?.runtime.poses[0]?.clipIndex === expectedClip && victim?.visuals.hitHeight === Math.floor(index / 3) && victim.visuals.hitStrength === index % 3 && victim.launch.hitstun > 0);
            return setCameraField(...args);
          };
        }
        playHeadless(lockstep, journey, "pain-strip", undefined, { observationFrames: frames, observe: (running, frame) => {
          const client = running.clients[0];
          if (client === undefined) return;
          const shown = painFrames.get(client.frame) === true;
          if (hitFrame === undefined && shown) hitFrame = frame;
          if (hitFrame === undefined || !holding) return;
          if (!shown) { holding = false; return; }
          if (frame === hitFrame + settle) first = captureScene(client);
          if (frame >= hitFrame + settle && frame <= hitFrame + settle + HELD_FRAMES) held = captureScene(client);
        } });
        shots.push({ fighter: fighterKey(character), category: `${height}-${strength}`, expectedClip, hitFrame, first, held });
      }
    }
  } finally {
    runtime.restore();
  }
  return shots;
}

export function victimCrop(scene: RenderScene, screen: { readonly width: number; readonly height: number }): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const victim = scene.units.find((unit) => unit.owner === 0);
  const fields = scene.camera.fields;
  const distance = fields["CAMERA_FIELD_TARGET_DISTANCE"] ?? 1000;
  const focal = screen.width / 2 / Math.tan((fields["CAMERA_FIELD_FIELD_OF_VIEW"] ?? 70) * Math.PI / 360);
  const scale = focal / distance;
  const centerX = screen.width / 2 + ((victim?.x ?? scene.camera.x) - scene.camera.x) * scale;
  const feetY = screen.height / 2 - ((victim?.z ?? 0) - (fields["CAMERA_FIELD_ZOFFSET"] ?? 0)) * scale;
  const width = Math.round(Math.min(screen.width, 360 * scale)), height = Math.round(Math.min(screen.height, 300 * scale));
  const x = Math.round(Math.max(0, Math.min(screen.width - width, centerX - width / 2)));
  const y = Math.round(Math.max(0, Math.min(screen.height - height, feetY - height * 0.72)));
  return { x, y, width, height };
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const painStrip = (args: readonly string[]) => Effect.gen(function*() {
  const [out] = args;
  const flag = (name: string) => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
  if (out === undefined || out.startsWith("--")) return yield* new PainStripFailure({ problem: USAGE });
  const [width = 1280, height = 720] = (flag("--resolution") ?? "1280x720").split("x").map(Number);
  const screen = { width, height };
  const graphics = parseGraphics(flag("--graphics") ?? "classic");
  const wanted = flag("--fighters")?.split(",");
  const characters = SELECTABLE_CHARACTERS.filter((character) => wanted === undefined || wanted.includes(fighterKey(character)));
  const shots = painShots(playerBuildEntry(), characters, screen, graphics);
  const missed = shots.filter((shot) => shot.first === undefined || shot.held === undefined);
  for (const shot of missed) yield* Effect.logError(`${shot.fighter} ${shot.category}: clip ${shot.expectedClip} never shown between frames ${FIRST_OBSERVED} and ${LAST_OBSERVED}`);
  const drawn = shots.flatMap((shot, id) => shot.first === undefined || shot.held === undefined ? [] : [{ shot, id, first: { ...shot.first, matchFrame: id * 2 }, held: { ...shot.held, matchFrame: id * 2 + 1 } }]);
  const raw = join(out, "raw");
  yield* renderScenes({ ...headlessRender(), ...screen }, drawn.flatMap(({ first, held }) => [first, held]), raw, graphics);
  const font = yield* runProcess(ChildProcess.make("fc-match", ["-f", "%{file}", "sans"], { stdin: "ignore" }));
  const sheets: string[] = [];
  for (const character of characters) {
    const name = fighterKey(character);
    const dir = join(out, slug(name));
    yield* Effect.promise(() => mkdir(dir, { recursive: true }));
    const mine = drawn.filter(({ shot }) => shot.fighter === name).sort((a, b) => SHEET_ORDER.indexOf(a.shot.category) - SHEET_ORDER.indexOf(b.shot.category));
    const tiles: string[] = [];
    if (mine.length === 0) continue;
    for (const { shot, first, held } of mine) {
      for (const [moment, scene] of [["first", first], ["held", held]] as const) {
        const crop = victimCrop(scene, screen);
        const tile = join(dir, `${shot.category}-${moment}.png`);
        yield* runProcess(ChildProcess.make("magick", [join(raw, `p0-match-${scene.matchFrame}.png`), "-crop", `${crop.width}x${crop.height}+${crop.x}+${crop.y}`, "+repage", "-resize", "420x350!", tile], { stdin: "ignore" }));
        tiles.push("-label", `${shot.category} ${moment} (frame ${scene.frame})`, tile);
      }
    }
    const sheet = join(out, `${slug(name)}-${graphics}.png`);
    yield* runProcess(ChildProcess.make("montage", ["-font", font, "-pointsize", "18", "-title", `${name} - ${graphics} - nine reactions, first pain frame and held frame`, ...tiles, "-tile", "6x3", "-geometry", "+4+4", sheet], { stdin: "ignore" }));
    sheets.push(sheet);
  }
  yield* Effect.promise(() => Bun.write(join(out, "shots.json"), JSON.stringify({ graphics, screen, shots: shots.map(({ first, held, ...shot }) => ({ ...shot, firstFrame: first?.frame, heldFrame: held?.frame })) }, null, 2) + "\n"));
  yield* Effect.log(`${drawn.length}/${shots.length} categories, ${sheets.length} sheets in ${out}`);
  if (missed.length > 0) return yield* new PainStripFailure({ problem: `${missed.length} categories never showed their pain clip` });
});

if (import.meta.main) BunRuntime.runMain(painStrip(Bun.argv.slice(2)).pipe(Effect.provide(BunServices.layer)));
