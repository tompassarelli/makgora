import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { movesShardId, smokePairs, smokeShardLabel, smokeShards, specialsShardId } from "./smokeShards";
import { neutralSpecialChecks } from "./neutralSpecialChecks";

export const gateChecks = (noErrors: Rule): NativeCheck[] => [
  {
    id: "gate-cursor-visible", closes: "T7 C1", map: "gate-playable", session: "gate-cursor",
    setup: [{ chat: "gate:cursor", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE cursor frames=\\d+ visible=\\d+ sweepMs=\\d+ picked=1 dropped=1 parked=1 pinch=1 states=1 pass=1$", min: 1 }],
  },
  {
    id: "gate-select-hands", closes: "smashcraft#744 native check", map: "gate-playable", session: "gate-hands",
    setup: [{ chat: "gate:hands", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE hands samples=(?:16|20) own=(?:8|10) remote=(?:8|10) badges=(?:16|20) chips=2 pass=1$", min: 1 }],
  },
  {
    id: "gate-select-hands-teams", closes: "hand label colours in Team Battle", map: "gate-playable", session: "gate-hands-teams",
    setup: [{ chat: "-dev teams on", client: "a" }, { chat: "-dev team 0 1", client: "a" }, { chat: "-dev team 0 3", client: "b" }, { chat: "gate:hands-teams", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE hands samples=(?:16|20) own=(?:8|10) remote=(?:8|10) badges=(?:16|20) chips=2 pass=1$", min: 1 }],
  },
  {
    id: "gate-start-anywhere", closes: "T7 C2", map: "gate-playable", session: "gate-start",
    setup: [{ chat: "gate:start", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE start trials=3 started=3 distinct=3 offButton=3 pass=1$", min: 1 }],
  },
  {
    id: "gate-start-rest", closes: "smashcraft#427", map: "gate-playable", session: "gate-start-rest",
    setup: [{ chat: "gate:start-rest", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE start-rest frames=(\\d+) character=\\1 stage=\\1 .* pass=1$", min: 1 }],
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
  {
    id: "gate-stages", closes: "smashcraft#430", map: "gate-playable", session: "gate-stages",
    setup: [{ chat: "gate:stages", client: "a" }],
    pass: [noErrors, { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE stages stages=(\\d+) started=\\1 pass=1$", min: 1 }],
    look: "Each stage's match start on the candidate: no goo or splat decals under either fighter, no squiggly line art under the platforms, and no gray rocks on the Frozen Throne platforms.",
  },
  ...neutralSpecialChecks(noErrors),
  ...smokeShards().flatMap((shard): NativeCheck[] => {
    const fighters = new Set(smokePairs()[shard]).size;
    return [
      {
        id: movesShardId(shard), closes: "smashcraft#32", map: "gate-playable", session: movesShardId(shard),
        setup: [{ chat: `gate:moves:${smokeShardLabel(shard)}`, client: "a" }],
        pass: [noErrors, { kind: "receipt", client: "a", pattern: `^SMASHCRAFT GATE moves fighters=${fighters} moves=(\\d+) started=\\1 keys=(\\d+) live=\\2 replayed=1 pass=1$`, min: 1 }],
      },
      {
        id: specialsShardId(shard), after: movesShardId(shard), closes: "smashcraft#32", map: "gate-playable", session: movesShardId(shard),
        setup: [{ chat: `gate:specials:${smokeShardLabel(shard)}`, client: "a" }],
        pass: [noErrors, { kind: "receipt", client: "a", pattern: `^SMASHCRAFT GATE specials fighters=${fighters} checked=([1-9]\\d*) clear=\\1 pass=1$`, min: 1 }],
      },
    ];
  }),
];
