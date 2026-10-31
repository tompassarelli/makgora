import { f32 } from "wisp/src/sim/f32";
import { PICKER_DONE } from "../../src/game/ui/settingsUi";
import { NOT_NOW_BOX } from "../../src/game/ui/tutorialMenu";

interface StartClient {
  readonly slot: number;
  readonly natives: Readonly<Record<string, unknown>>;
  run?(body: () => void): void;
}

interface StartClients {
  readonly clients: readonly StartClient[];
  click(sender: number, x: number, y: number): boolean;
  frames(count: number): void;
}

export const DONE_X = f32(PICKER_DONE.x + f32(PICKER_DONE.width / 2));
export const DONE_Y = f32(PICKER_DONE.y - f32(PICKER_DONE.height / 2));

const greetedMask = (shell: unknown): number =>
  typeof shell === "object" && shell !== null && "controlsGreeted" in shell && typeof shell.controlsGreeted === "number" ? shell.controlsGreeted : 0;

function shellOf(client: StartClient): unknown {
  let shell = client.natives["__smashcraftShell"];
  client.run?.(() => { shell ??= globalThis.__smashcraftShell; });
  return shell;
}

export const controlsGreeted = (client: StartClient): boolean => (greetedMask(shellOf(client)) & (1 << client.slot)) !== 0;

export function passStartControls(clients: StartClients, step: (count: number) => void = count => clients.frames(count), limit = 240): void {
  for (let frame = 0; frame < limit && !clients.clients.every(client => controlsGreeted(client)); frame++) step(1);
  for (const client of clients.clients) {
    if (!controlsGreeted(client)) throw new Error(`client ${client.slot} never opened its Controls screen`);
    if (!clients.click(client.slot, DONE_X, DONE_Y)) throw new Error(`client ${client.slot} has no Done button under the pointer`);
  }
  step(2);
}

const NOT_NOW_X = f32(NOT_NOW_BOX.x + f32(NOT_NOW_BOX.width / 2));
const NOT_NOW_Y = f32(NOT_NOW_BOX.y - f32(NOT_NOW_BOX.height / 2));

export function declineTutorial(clients: StartClients, step: (count: number) => void = count => clients.frames(count)): void {
  for (const client of clients.clients) {
    if (!clients.click(client.slot, NOT_NOW_X, NOT_NOW_Y)) throw new Error(`client ${client.slot} has no Not now button under the pointer`);
  }
  step(2);
}
