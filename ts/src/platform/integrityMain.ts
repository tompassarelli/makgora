import { INTEGRITY_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";
import { installSceneReport, startMatchSceneReport } from "./sceneReport";

export function install(this: void): void {
  installGame();
  installSceneReport();
}

/** Normal production gameplay with the native helper's journal/editbox input, reporting the scene it draws. */
export function start(this: void): void {
  startBuild(INTEGRITY_BUILD);
  startMatchSceneReport();
}
