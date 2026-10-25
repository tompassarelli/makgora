import { PLAYABLE_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";

export function install(this: void): void {
  installGame(PLAYABLE_BUILD);
}

export function start(this: void): void {
  startBuild(PLAYABLE_BUILD);
}
