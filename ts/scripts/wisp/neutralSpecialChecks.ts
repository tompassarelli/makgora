import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

export const neutralSpecialChecks = (noErrors: Rule): NativeCheck[] => (["thrall", "jaina", "both"] as const).map((fighter): NativeCheck => ({
  id: `c4-${fighter}-neutral-special`, closes: "smashcraft-dev#467 C4 residual split", map: "gate-playable", session: `c4-${fighter}-neutral-special`,
  setup: [{ chat: `gate:neutral-${fighter}`, client: "a" }],
  pass: [noErrors,
    { kind: "receipt", client: "a", pattern: "^SMASHCRAFT GATE specials fighters=2 checked=1 clear=1 pass=1$", min: 1 },
    ...(fighter === "both" ? [] : [{ kind: "receipt" as const, client: "a", pattern: "^SMASHCRAFT GATE moves fighters=2 moves=1 started=1 keys=(\\d+) live=\\1 replayed=1 pass=1$", min: 1 }]),
    { kind: "receipt", client: "a", pattern: "^excess=-?\\d+ allowed=\\d+;", min: 1 }],
  look: fighter === "both" ? "Classic gate-playable: P1 Thrall Chain Lightning and P2 Jaina Frostbolt cast together on the same frame. Shared rest/neutral/rest setup and settle timing; both rest frames are retained and judged as one specialsSpot spot." : `Classic gate-playable: P1 Thrall vs P2 Jaina; only ${fighter === "thrall" ? "P1 Chain Lightning" : "P2 Frostbolt"} casts. The other fighter only performs shared reset/drop setup. Both rest frames are retained and judged by specialsSpot.`,
}));
