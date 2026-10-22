import type { Character } from "../src/game/sim/codes";
import type { Position } from "./comboExplorer";
import { TARGETS, trueZeroToDeaths } from "./advantageState";

declare const self: Worker;

self.onmessage = (event: MessageEvent<{ readonly attacker: Character; readonly target: number; readonly position: Position }>) => {
  const { attacker, target, position } = event.data;
  const weight = TARGETS[target];
  if (weight === undefined) throw new Error(`no target ${target}`);
  self.postMessage(trueZeroToDeaths(attacker, [weight], [position]));
};
