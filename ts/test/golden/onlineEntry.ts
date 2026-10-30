import { runLuaPerfWith } from "wisp/src/headless/luaPerf";
import { PREDICTED_LOCAL_NATIVES, SMASHCRAFT_LOCAL_NATIVES } from "../../scripts/wisp/localNatives";
import { SMASHCRAFT_NOOPS, smashcraftNativeBehavior } from "../../scripts/wisp/headlessNatives";
import { ONLINE_PLAYERS, onlineDelivery, playOnlineGolden } from "./onlineMatch";

declare const arg: Readonly<Record<number, string | undefined>>;
declare function print(this: void, ...values: unknown[]): void;

const [bundle, declarations] = [arg[1], arg[2]];
if (bundle === undefined || declarations === undefined) throw new Error("usage: lua online-golden.lua PLAYABLE_LUA WARCRAFT_D_TS");
const map = { filePrefix: "smashcraft", localNatives: { ...SMASHCRAFT_LOCAL_NATIVES, ...PREDICTED_LOCAL_NATIVES }, intentionalNoops: SMASHCRAFT_NOOPS, natives: () => smashcraftNativeBehavior(), players: ONLINE_PLAYERS };
let record: string[] = [];
runLuaPerfWith(map, bundle, declarations, (clients, measure) => {
  record = playOnlineGolden(clients, measure);
  return { problems: 0, lines: [] };
}, { delivery: onlineDelivery() });
print(record.join("\n"));
