import type { MapBuild } from "../../game/session/build";
import { NATIVE_DRIVER_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { CAPTURE_FIXTURES } from "../../platform/captureFixtures";
import { captureTick } from "../loop/captureRunner";

const BUILD: MapBuild = { ...NATIVE_DRIVER_BUILD, presentation: "pool-predicted", receiptsOnScreen: false, disjointCues: CAPTURE_FIXTURES.some(fixture => fixture.silhouette?.conceal === "cues") };
const TICK = "capture.fixtures";

function tick(): void {
  captureTick(CAPTURE_FIXTURES);
}

export function install(this: void): void {
  installGame(BUILD);
  on(TICK, tick);
}

export function start(this: void): void {
  startBuild(BUILD);
  on(TICK, tick);
  TimerStart(CreateTimer(), f32(0.01666666753590107), true, trampoline(TICK));
}
