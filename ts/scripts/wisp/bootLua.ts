import { luaLockstep, readFile } from "wisp/src/headless/lua";
import { Phase } from "../../src/game/lobby/lobbyState";
import { gameOf } from "./botMatch";
import { SMASHCRAFT_NOOPS, smashcraftNativeBehavior } from "./headlessNatives";
import { SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { DONE_X, DONE_Y, controlsGreeted } from "./startControls";

declare const arg: Readonly<Record<number, string | undefined>>;
declare function print(this: void, ...values: unknown[]): void;

const BOOT_POINTER: readonly (readonly [number, number])[] = [[960, 540], [380, 90], [1540, 90], [1630, 650], [190, 970]];
const SELECT_FRAMES = 12;
const START_FRAMES = 240;

// The Lua32 half of `bun wisp map boot`: both clients pass the first-run Controls screen where the build shows it and settle on character select.
const [bundlePath, declarationsPath] = [arg[1], arg[2]];
if (bundlePath === undefined || declarationsPath === undefined) throw new Error("usage: lua boot.lua MAP_LUA WARCRAFT_D_TS");
const clients = luaLockstep({ filePrefix: "smashcraft", localNatives: SMASHCRAFT_LOCAL_NATIVES, intentionalNoops: SMASHCRAFT_NOOPS, natives: smashcraftNativeBehavior }, readFile(bundlePath), readFile(declarationsPath));
const problems: string[] = [];
const [booted, failure] = pcall(() => {
  clients.start();
  const greeted = () => clients.clients.every((client) => controlsGreeted(client));
  for (let frame = 0; frame < START_FRAMES && !greeted(); frame++) clients.frames(1);
  if (greeted()) {
    for (const client of clients.clients) if (!clients.click(client.slot, DONE_X, DONE_Y)) throw new Error(`p${client.slot + 1} has no Controls Done button under the pointer`);
    clients.frames(2);
  }
  for (const [x, y] of BOOT_POINTER) {
    for (const client of clients.clients) { client.mouseScreenX = x; client.mouseScreenY = y; }
    clients.frames(SELECT_FRAMES);
  }
});
if (!booted) problems.push(`the map threw before character select settled: ${String(failure)}`);
for (const client of clients.clients) {
  const p = `p${client.slot + 1}`;
  if (booted) {
    const phase = gameOf(client).phase;
    if (phase !== Phase.characterMenu) problems.push(`${p} left character select: phase ${phase}`);
    const panel = client.frames.named(`MeleeSelectRoot${client.slot}`, 0);
    if (panel === undefined || !client.frames.shown(panel)) problems.push(`${p} shows no character select panel`);
  }
  for (const error of client.errors) problems.push(`${p}: ${error}`);
  for (const thrown of client.thrown) problems.push(`${p} threw: ${thrown}`);
}
for (const problem of problems) print(`problem ${problem}`);
print(`done problems=${problems.length}`);
if (problems.length > 0) os.exit(1);
