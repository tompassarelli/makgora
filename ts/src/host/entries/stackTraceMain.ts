

import { CURRENT_BUILD } from "../../game/session/currentBuild";
import type { MapBuild } from "../../game/session/build";
import { install as installMap, startBuild } from "../../platform/main";
import { installStackDemo, startStackDemo } from "../../platform/stackDemo";

const STACK_TRACE_BUILD: MapBuild = { ...CURRENT_BUILD, id: "typescript-stack-trace" };

export function install(this: void): void {
  installMap();
  installStackDemo(STACK_TRACE_BUILD);
}

export function start(this: void): void {
  startBuild(STACK_TRACE_BUILD);
  installStackDemo(STACK_TRACE_BUILD);
  startStackDemo(STACK_TRACE_BUILD);
}
