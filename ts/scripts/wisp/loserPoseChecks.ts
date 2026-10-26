import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

const LOSERS = ["Murloc", "Thrall", "Mountain King", "Peon"] as const;
const RESULT = "^result frames=\\d+ winner=P2 timed-out=0 interrupted=0$";
const slug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

export const loserPoseChecks = (pass: readonly Rule[]): readonly NativeCheck[] => LOSERS.map((loser): NativeCheck => ({
  id: `372-loser-${slug(loser)}`, closes: "smashcraft#372", map: "presentation", session: `372-loser-${slug(loser)}`,
  setup: [
    { chat: "-dev reset" }, { chat: "-dev slots 1 1" }, { chat: "-dev fighter 2 Blademaster" },
    { chat: "-dev auto-rematch off" }, { chat: "-dev time 10" }, { chat: `-dev quick pair ${loser} / Blademaster` },
    { receipt: RESULT, client: "a", seconds: 600 },
  ],
  capture: [{ kind: "frames", name: "loser-from-result", client: "a", count: 30, everyMs: 150 }],
  pass: [...pass, { kind: "receipt", pattern: "^rules stocks=1 minutes=10$", client: "a", min: 1 }, { kind: "receipt", pattern: RESULT, client: "a", min: 1 }],
  look: `Classic: idle ${loser} loses one stock to computer Blademaster by KO. On the results screen ${loser} plays its own death sequence once and then holds a defeated pose, lying or slumped, never its idle stand; a cold reader names the loser's pose "defeated".`,
}));
