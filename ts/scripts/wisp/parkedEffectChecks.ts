import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { QUICK_CPU_COMMAND, QUICK_HERO_COMMAND } from "../../src/game/session/devSettings";

const ROUND_ENDED = "^result frames=\\d+ ";
const HELLFIRE = 14;
const SESSION = "996-long-session";
const LONG_SESSION = "makgora#996 box 1 (long session)";
const RULES = [{ chat: "-dev setup orbs on;time 1" }, { chat: "-dev setup auto-rematch on;rematch 2" }];
const RESET = [{ chat: "-dev reset" }, { waitMs: 1500 }];
const CPU_ROUND = { chat: `${QUICK_CPU_COMMAND}wren peon stage ${HELLFIRE} hold` };
const THRALL_MIRROR = { chat: `-dev quick stage ${HELLFIRE} pair thrall / thrall` };
const roundEnd = { receipt: ROUND_ENDED, client: "a", seconds: 150 };
const jabs = Array.from({ length: 12 }, () => [{ keys: ["n"], client: "a" }, { waitMs: 700 }]).flat();
const LEFT_BEHIND = "no golden fireball with a lens-flare star at the right end of the stage before the orb's warning, and no flat red or blue shapes on Thrall's Doomhammer handle or pommel";
const TRAINING_MIRROR = [...RESET, { chat: "-dev auto-rematch off" }, { chat: "-dev setup training on;hit-areas on" }, { chat: `${QUICK_HERO_COMMAND}thrall hit-areas` }, { waitMs: 3000 }, ...jabs];

const round = (id: string, setup: NonNullable<NativeCheck["setup"]>, pass: readonly Rule[]): NativeCheck => ({
  id, closes: LONG_SESSION, map: "fighter-select", session: SESSION, setup, pass: [...pass],
});

export const parkedEffectChecks = (pass: readonly Rule[]): NativeCheck[] => [
  {
    id: "996-fresh-training-mirror", closes: "makgora#996 box 1 (fresh-start reference)", map: "fighter-select", session: "996-fresh-start",
    setup: TRAINING_MIRROR,
    capture: [{ kind: "frames", name: "training-mirror", client: "a", count: 8, everyMs: 250 }],
    pass: [...pass],
    look: "The same Thrall mirror in training on a freshly hosted map, the reference for how each Thrall's Doomhammer handle and pommel draw before any long session.",
  },
  round("996-round-1", [...RESET, ...RULES, CPU_ROUND, roundEnd], pass),
  round("996-round-2", [roundEnd], pass),
  round("996-round-3", [roundEnd], pass),
  round("996-round-4", [...RESET, ...RULES, CPU_ROUND, roundEnd], pass),
  round("996-round-5", [roundEnd], pass),
  round("996-round-6", [...RESET, ...RULES, CPU_ROUND, roundEnd], pass),
  {
    id: "996-training-mirror", closes: LONG_SESSION, map: "fighter-select", session: SESSION,
    setup: TRAINING_MIRROR,
    capture: [{ kind: "frames", name: "training-mirror", client: "a", count: 8, everyMs: 250 }],
    pass: [...pass],
    look: `A Thrall mirror in training on the default stage after six orb-on versus rounds on Hellfire Citadel: ${LEFT_BEHIND}.`,
  },
  {
    id: "996-countdown", closes: "makgora#996 box 1", map: "fighter-select", session: SESSION,
    setup: [...RESET, { chat: "-dev training off" }, ...RULES, CPU_ROUND],
    capture: [{ kind: "frames", name: "fresh-countdown", client: "a", count: 20, everyMs: 400 }],
    pass: [...pass],
    look: `A computer round on Hellfire Citadel started after the long session, through its 3-2-1 countdown: ${LEFT_BEHIND}.`,
  },
  {
    id: "996-thrall-rematch-countdown", closes: "makgora#996 box 1", map: "fighter-select", session: SESSION,
    setup: [...RESET, ...RULES, THRALL_MIRROR, roundEnd],
    capture: [{ kind: "frames", name: "rematch-countdown", client: "a", count: 24, everyMs: 300 }],
    pass: [...pass],
    look: `Thrall against a computer Thrall on Hellfire Citadel, from that round's results through the automatic rematch's 3-2-1 countdown: ${LEFT_BEHIND}.`,
  },
];
