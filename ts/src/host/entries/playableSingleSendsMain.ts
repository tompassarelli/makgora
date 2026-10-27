import { PLAYABLE_SINGLE_SENDS_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { installSessionRates } from "../loop/sessionRates";

export function install(this: void): void {
  installGame(PLAYABLE_SINGLE_SENDS_BUILD);
  installSessionRates(PLAYABLE_SINGLE_SENDS_BUILD.id);
}

export function start(this: void): void {
  startBuild(PLAYABLE_SINGLE_SENDS_BUILD);
  installSessionRates(PLAYABLE_SINGLE_SENDS_BUILD.id);
}
