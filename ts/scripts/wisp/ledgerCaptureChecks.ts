import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { QUICK_HERO_COMMAND } from "../../src/game/session/devSettings";

const RESULT = "^result frames=\\d+ winner=P2 timed-out=0 interrupted=0$";

const LOST_TO_BLADEMASTER: NativeCheck["setup"] = [
  { chat: "-dev reset" }, { chat: "-dev slots 1 2" }, { chat: "-dev fighter 2 Blademaster" },
  { chat: "-dev auto-rematch off" }, { chat: "-dev stocks 1" }, { chat: "-dev time 10" }, { chat: "-dev quick pair Rifleman / Blademaster" },
  { receipt: RESULT, client: "a", seconds: 600 },
];

export const ledgerCaptureChecks = (rules: readonly Rule[]): NativeCheck[] => [
  {
    id: "ledger-4a-victory", closes: "smashcraft#431 (ledger row 4a)", map: "presentation", session: "ledger-victory",
    setup: LOST_TO_BLADEMASTER,
    capture: [{ kind: "frames", name: "results", client: "a", count: 60, everyMs: 67 }],
    pass: [...rules, { kind: "receipt", pattern: RESULT, client: "a", min: 1 }],
    look: "Classic presentation map at this commit: idle Rifleman loses his stock to computer Blademaster. Over the four seconds after the result the results panel shows Blademaster playing his victory animation (moving between frames), not only a level-up burst over a still stand pose. The client's recording keeps the full level-up sound, the control for row 4b.",
  },
  {
    id: "ledger-4b-levelup-sound", closes: "smashcraft#431 (ledger row 4b)", map: "presentation", session: "ledger-sound",
    setup: [...LOST_TO_BLADEMASTER, { waitMs: 2200 }, { keys: ["n"], client: "a" }],
    capture: [{ kind: "frames", name: "after-results", client: "a", count: 20, everyMs: 200 }],
    pass: [...rules, { kind: "receipt", pattern: RESULT, client: "a", min: 1 }],
    look: "Classic presentation map at this commit: player 1 confirms the results screen just after the winner's level-up burst starts, and the frames show fighter select. In client a's audio recording the level-up sound stops when results close instead of playing on over fighter select, unlike its full length in ledger-4a-victory.",
  },
  {
    id: "ledger-12-shadow-hunter-jump", closes: "smashcraft#431 (ledger row 12)", map: "presentation", session: "ledger-moves",
    setup: [{ chat: "-dev reset" }, { chat: `${QUICK_HERO_COMMAND}shadow hunter` }, { waitMs: 4000 }, { keys: ["w"], holdMs: 100, client: "a" }],
    capture: [{ kind: "frames", name: "jump", client: "a", count: 20, everyMs: 50 }],
    pass: [...rules],
    look: "Classic presentation map at this commit: player 1's Shadow Hunter jumps straight up in a neutral ready pose, body upright and weapons held, with no back-air style swing or flourish.",
  },
  {
    id: "ledger-13-peon-rest", closes: "smashcraft#431 (ledger row 13)", map: "presentation", session: "ledger-moves",
    setup: [{ chat: "-dev reset" }, { chat: `${QUICK_HERO_COMMAND}peon` }, { waitMs: 4000 }, { keys: ["s+u"], client: "a" }],
    capture: [{ kind: "frames", name: "rest", client: "a", count: 30, everyMs: 100 }],
    pass: [...rules],
    look: "Classic presentation map at this commit: player 1's Peon down special is a point-blank Rest: a short hit pose, then he lies down asleep and stays asleep across the later frames, not a heal.",
  },
];
