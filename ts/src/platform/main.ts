


import { CURRENT_BUILD } from "../game/session/currentBuild";
import type { MapBuild } from "../game/session/build";
import { replayHistoryPlayback } from "../game/session/rollbackPlayback";
import { configureRuntime } from "wisp/src/runtime/config";
import { installDispatch } from "wisp/src/platform/dispatch";
import { installHotReload, startHotReload } from "wisp/src/platform/hotReload";
import { startModelFailures } from "wisp/src/platform/modelFailures";
import { installShell, startShell } from "../host/loop/shell";
import { installObjectData } from "../host/loop/objectData";
import { installTuning } from "../host/loop/tuning";
import { prepareKitDigests } from "../game/replay/canonical";


export function install(this: void, build: MapBuild = CURRENT_BUILD): void {
  configureRuntime({ filePrefix: "smashcraft", globalPrefix: "__smashcraft", readyPrefix: "SC_HRR", errorsOnScreen: build.errorsOnScreen });
  installDispatch();
  installShell();
  installObjectData();
  installTuning();

  prepareKitDigests();
  installHotReload();
}


export function startBuild(this: void, build: MapBuild, beforeShell?: (this: void) => void): void {
  install(build);
  startModelFailures();
  beforeShell?.();
  startShell(build, replayHistoryPlayback());
  if (build.hotReload) startHotReload();
}

export function start(this: void): void {
  startBuild(CURRENT_BUILD);
}
