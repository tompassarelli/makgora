import { parseNativeDeclarations } from "wisp/src/headless/declarations";
import { luaLockstep, readFile } from "wisp/src/headless/lua";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { SMASHCRAFT_NOOPS, smashcraftNativeBehavior } from "./headlessNatives";
import { gameOf } from "./botMatch";
import { SOAK_MATCHES, frameLine, handleLine, handleProblems, playHandleBaseline } from "./handleBaseline";
import { SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { compactEmulator } from "./memoryCensus";

declare const arg: Readonly<Record<number, string | undefined>>;

// The Lua32 half of `bun wisp soak handles`: smashcraft:ts/scripts/wisp/handleBaseline.ts's scenario on the
// compiled integrity build, printing the same lines as its Bun half (test/soak/handles.ts).
const [bundlePath, declarationsPath, matchesText] = [arg[1], arg[2], arg[3]];
const matches = matchesText === undefined ? SOAK_MATCHES : Number(matchesText);
if (bundlePath === undefined || declarationsPath === undefined || !(matches >= 2)) throw new Error("usage: lua handles.lua MAP_LUA WARCRAFT_D_TS [MATCHES >= 2]");
const declarationsText = readFile(declarationsPath);
const { functions } = parseNativeDeclarations(declarationsText);
const clients = luaLockstep({ filePrefix: "smashcraft", localNatives: SMASHCRAFT_LOCAL_NATIVES, intentionalNoops: SMASHCRAFT_NOOPS, natives: smashcraftNativeBehavior }, readFile(bundlePath), declarationsText, undefined, syncDelivery(MEASURED_BATTLE_NET, 7));
// compactEmulator hands back and clears each client's errors so far.
const errors: string[] = [];
const run = playHandleBaseline(clients, functions, matches, gameOf, { compact: (client, released) => {
  for (const error of compactEmulator(client, released)) errors.push(`p${client.slot + 1}: ${error}`);
} });
const slots = clients.clients.map((client) => client.slot);
const problems = [...handleProblems(run, slots), ...errors];
clients.clients.forEach((client, index) => {
  const p = `p${client.slot + 1}`;
  print(`${p} before: ${handleLine(run.cold[index])}`);
  print(`${p} after match 1: ${handleLine(run.afterMatches[0]?.[index])}`);
  print(`${p} after match ${matches} (rematch ${matches - 1}): ${handleLine(run.afterMatches[matches - 1]?.[index])}`);
  for (const error of client.errors) problems.push(`${p}: ${error}`);
});
print(frameLine(run));
for (const problem of problems) print(`problem ${problem}`);
print(`done problems=${problems.length}`);
if (problems.length > 0) os.exit(1);
