import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

export const teamResultsCheck = (pass: readonly Rule[]): NativeCheck => ({
      id: "c45-team-results", closes: "smashcraft#7 C45", map: "team-results", session: "c45-team-results",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev slots 0 15" }, { chat: "-dev teams on" },
        { chat: "-dev team 1 0" }, { chat: "-dev team 2 0" }, { chat: "-dev team 3 1" }, { chat: "-dev team 4 1" },
        { chat: "-dev fighter 1 Kobold" }, { chat: "-dev fighter 2 Kobold" },
        { chat: "-dev fighter 3 Rifleman" }, { chat: "-dev fighter 4 Rifleman" },
        { chat: "-dev auto-rematch off" }, { chat: "-dev setup quick;percent 1 999;percent 3 999" },
        { receipt: "^parts [0-9]+$", client: "a", seconds: 600 }, { waitMs: 2500 },
      ],
      capture: [{ kind: "frames", name: "team-results", client: "a", count: 8, everyMs: 125 }, { kind: "frames", name: "team-results", client: "b", count: 8, everyMs: 125 }],
      pass,
      look: "After the four-computer 2v2 ends, both clients show the winning team's two fighters as winners, including a teammate eliminated before the final KO. Both teammates receive the team victory and winning presentation; the opposing team's two fighters do not. The team colours and winner labels agree on both clients.",
    });
