import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { captureScene, renderScenes, type RenderScene } from "wisp/scripts/wisp/headlessRender";
import { originalClip } from "../src/generated/clips/fighterOriginalClipInfo";
import { cameraFieldOfView, FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { MATCH_CAMERA_ASPECT } from "../src/game/sim/matchCamera";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/roster/kits";
import { CAMERA_LIFT, judgeCamera } from "./wisp/animJudgeCamera";
import { runProcess } from "./hostProcess";
import { headlessRender } from "./wisp/headlessRender";
import { projectRoot } from "./wisp/project";
import { createStandaloneSession, NEUTRAL_INPUT } from "./wisp/standalone";

type Row = { readonly fighter: string; readonly sequence: string; readonly samples: number; readonly detached: number; readonly intersecting: number; readonly worstGapSeconds: number; readonly worstClearanceSeconds: number };
type Panel = { readonly id: number; readonly label: string };

const VIEWS = [{ name: "side", yaw: 0 }, { name: "far side", yaw: Math.PI }, { name: "three-quarter", yaw: -Math.PI / 4 }] as const;
const CROP = "340x300+790+440";

const [auditJson, fighter, out, assets] = process.argv.slice(2);
if (!auditJson || !fighter || !out || !assets) throw new Error("usage: bun scripts/gripStrips.ts GRIP_AUDIT_JSON FIGHTER PRIVATE_OUTPUT ASSETS");
const output = resolve(out);
if (!relative(projectRoot, output).startsWith("..")) throw new Error("grip strips stay in private storage");
mkdirSync(join(output, "frames"), { recursive: true });
const character = SELECTABLE_CHARACTERS.find(candidate => fighterName(candidate).replaceAll(" ", "") === fighter.replaceAll(" ", ""));
if (character === undefined) throw new Error(`unknown fighter ${fighter}`);
const body = originalClip(character, 0);
if (body === undefined) throw new Error(`${fighter}: no shipped clips`);
const { rows } = await Bun.file(auditJson).json() as { rows: Row[] };
const flagged = rows.filter(row => row.fighter === fighter && (row.detached > 0 || row.intersecting > 0));

function moments(row: Row): Map<number, string> {
  const picks = new Map<number, string>();
  if (row.detached > 0) picks.set(row.worstGapSeconds, "worst grip gap");
  if (row.intersecting > 0 && !picks.has(row.worstClearanceSeconds)) picks.set(row.worstClearanceSeconds, "worst clearance");
  return picks;
}

const program = Effect.scoped(Effect.gen(function*() {
  const session = yield* Effect.acquireRelease(Effect.promise(() => createStandaloneSession({ presentation: "pool-confirmed", script: "#! chat -dev quick" })), open => Effect.sync(() => open.close()));
  for (let frame = 0; frame < 60; frame++) session.step(NEUTRAL_INPUT);
  const base = captureScene(session.client, { visibleOnly: true });
  const bodyEffect = base.effects.find(effect => /TimelineBody/.test(effect.model)) ?? base.effects[0];
  if (bodyEffect === undefined) return yield* Effect.die(new Error("the sample scene has no fighter body to render"));
  const judge = judgeCamera();
  const scenes: RenderScene[] = [];
  const strips = flagged.map(row => ({ row, panels: VIEWS.map((): Panel[] => []) }));
  for (const [view, { name, yaw }] of VIEWS.entries()) for (const { row, panels } of strips) for (const [seconds, label] of moments(row)) {
    const id = scenes.length;
    scenes.push({
      ...base, frame: id, units: [], ui: [], textTags: [],
      camera: { ...base.camera, x: 0, y: 0, fields: { ...base.camera.fields, CAMERA_FIELD_TARGET_DISTANCE: judge.distance, CAMERA_FIELD_ZOFFSET: FLOOR_HEIGHT + CAMERA_LIFT, CAMERA_FIELD_FIELD_OF_VIEW: cameraFieldOfView(judge, MATCH_CAMERA_ASPECT) } },
      effects: [{ ...bodyEffect, model: body.modelPath, animation: "Stand", animationElapsed: seconds, animationClock: 0, timeScale: 0, x: 0, y: 0, z: FLOOR_HEIGHT, yaw, teamColor: 0, alpha: 255 }],
    });
    panels[view]!.push({ id, label: `${label}, ${name}` });
  }
  yield* renderScenes({ ...headlessRender({ assets }), width: 1920, height: 1080 }, scenes, join(output, "frames"), "classic");
  for (const { row, panels } of strips) {
    const tile = ({ id, label }: Panel) => ["(", join(output, "frames", `p${base.client}-frame-${id}.png`), "+gravity", "-crop", CROP, "+repage", "-resize", "150%", "-gravity", "north", "-annotate", "+0+4", label, ")"];
    const lines = panels.map(view => ["(", ...view.flatMap(tile), "+append", ")"]);
    const name = join(output, `${row.sequence.replaceAll(/[^A-Za-z0-9]+/g, "-")}.png`);
    const caption = `${fighter} ${row.sequence}: ${row.detached} detached, ${row.intersecting} intersecting of ${row.samples}`;
    yield* runProcess(ChildProcess.make("magick", ["-background", "#101522", "-fill", "white", "-font", "DejaVu-Sans", "-pointsize", "18", ...lines.flat(), "-append", "-gravity", "south", "-splice", "0x28", "-annotate", "+0+4", caption, name]));
    yield* Console.log(name);
  }
}));

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
