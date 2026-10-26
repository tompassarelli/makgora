import type { MapBuild } from "../../game/session/build";
import { PLAYABLE_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { armTrailer } from "../../platform/trailer";

const TRAILER_BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "trailer" };

export function install(this: void): void {
  installGame(TRAILER_BUILD);
}

export function start(this: void): void {
  armTrailer();
  startBuild(TRAILER_BUILD);
}
