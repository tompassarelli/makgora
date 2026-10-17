import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { PLAYABLE_CHARACTERS } from "../../src/game/sim/heroes/registry";
import { neutralSpecialChecks } from "./neutralSpecialChecks";

export const gateChecks = (noErrors: Rule): NativeCheck[] => [
  {
    id: "gate-cursor-visible", closes: "T7 C1", map: "gate-playable", session: "gate-cursor",
    setup: [{ chat: "gate:cursor", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE cursor frames=\\d+ visible=\\d+ sweepMs=\\d+ picked=1 dropped=1 parked=1 pinch=1 pass=1$", min: 1 }],
  },
  {
    id: "gate-start-anywhere", closes: "T7 C2", map: "gate-playable", session: "gate-start",
    setup: [{ chat: "gate:start", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE start trials=3 started=3 distinct=3 offButton=3 pass=1$", min: 1 }],
  },
  {
    id: "gate-bindings", closes: "T7 C3", map: "gate-playable", session: "gate-bindings",
    setup: [{ chat: "gate:bindings", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE bindings labels=\\d+ samples=(\\d+) passed=\\1 pass=1 remaps=none$", min: 1 }],
  },
  {
    id: "gate-results-rematch", closes: "smashcraft#106", map: "gate-playable", session: "gate-results",
    setup: [{ chat: "gate:results", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE results stocks=1 epoch=\\d+ result=1 cursor=1 held=1 rematch=1 pass=1$", min: 1 }],
  },
  ...neutralSpecialChecks(noErrors),
  {
    id: "gate-moves", closes: "smashcraft-dev#467", map: "gate-playable", session: "gate-moves",
    setup: [{ chat: "gate:moves", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: `^SMASHCRAFT GATE moves fighters=${PLAYABLE_CHARACTERS.length} moves=(\\d+) started=\\1 keys=(\\d+) live=\\2 replayed=1 pass=1$`, min: 1 }],
  },
  {
    id: "gate-specials-spot", after: "gate-moves", closes: "smashcraft-dev#467", map: "gate-playable", session: "gate-moves",
    setup: [{ chat: "gate:specials", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: `^SMASHCRAFT GATE specials fighters=${PLAYABLE_CHARACTERS.length} checked=([1-9]\\d*) clear=\\1 pass=1$`, min: 1 }],
  },
];
