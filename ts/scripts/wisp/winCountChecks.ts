import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { QUICK_CPU_COMMAND } from "../../src/game/session/devSettings";

const TWO_WINS = "^SETUP .* wins=0,2,0,0 $";

export const winCountChecks = (noErrors: Rule, noImportFailures: Rule): NativeCheck[] => [
  {
    id: "c46-second-match", closes: "smashcraft#7 C46 setup: the first Wren match ends and the rematch starts", map: "presentation", session: "c46-win-counts",
    setup: [
      { chat: "-dev reset" }, { chat: "-dev slots 1 0" }, { chat: "-dev auto-rematch on" }, { chat: `${QUICK_CPU_COMMAND}wren expert` },
      { receipt: "^SETUP phase=\\d+ human-fighters=1 computers=[1-9]\\d* .* stocks=3 ", client: "a", seconds: 10 },
      { receipt: "^parts [0-9]+$", client: "a", seconds: 600 },
    ],
    pass: [noErrors],
  },
  {
    id: "c46-win-counts", closes: "smashcraft#7 C46", map: "presentation", session: "c46-win-counts", after: "c46-second-match",
    setup: [
      { receipt: "^parts [0-9]+$", client: "a", seconds: 600 },
      { waitMs: 2500 }, { keys: ["n"], client: "a" }, { waitMs: 300 }, { keys: ["n"], client: "b" }, { waitMs: 300 },
      { keys: ["n"], client: "a" }, { waitMs: 300 }, { keys: ["n"], client: "b" }, { waitMs: 3000 },
      { chat: "-dev trace" }, { receipt: "^SETUP .* wins=", client: "a", seconds: 10 }, { receipt: "^SETUP .* wins=", client: "b", seconds: 10 },
    ],
    capture: [{ kind: "frames", name: "fighter-select-after-two", client: "a" }, { kind: "frames", name: "fighter-select-after-two", client: "b" }],
    pass: [noImportFailures, noErrors, { kind: "receipt", pattern: TWO_WINS, client: "a", min: 1 }, { kind: "receipt", pattern: TWO_WINS, client: "b", min: 1 }],
    look: "Two one-sided matches against Wren Expert have ended by KO; after both players cancel the rematch countdown and confirm from results, both clients' fighter select still holds the computer in slot 2 and shows x2 on its card and no tally on player 1's card, so each win was awarded exactly once to the fixed slot through results, rematch and the return to the menu.",
  },
];
