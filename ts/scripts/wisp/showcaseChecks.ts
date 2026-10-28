import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

const RECEIPT_SECONDS = 3;
const CYCLES = [1, 2, 3] as const;
const padsReceipt = (mask: number) => `^SETUP phase=\\d+ human-fighters=${mask} `;
const RUN = [{ chat: "driver resume", client: "a" }, { waitMs: 1500 }] as const;

export const showcaseChecks = (pass: readonly Rule[]): NativeCheck[] => CYCLES.flatMap((cycle): NativeCheck[] => [
  {
    id: `422-showcase-spawn-${cycle}`, closes: "smashcraft#422 box 1", map: "showcase", session: "422-showcase",
    setup: [
      { chat: "-dev showcase start rifleman", client: "a" }, { receipt: padsReceipt(1), client: "a", seconds: RECEIPT_SECONDS },
      { chat: "-dev showcase spawn b murloc", client: "a" }, { receipt: padsReceipt(3), client: "a", seconds: RECEIPT_SECONDS },
      ...RUN,
    ],
    capture: [{ kind: "frames", name: "pads-a-b", client: "a" }],
    pass: [...pass, { kind: "receipt", pattern: padsReceipt(3), client: "a", min: 1 }],
    look: `Cycle ${cycle}: the Rifleman stands on pad a and the Murloc on pad b of the showcase stage, both pad markers drawn.`,
  },
  {
    id: `422-showcase-clear-${cycle}`, closes: "smashcraft#422 box 1", map: "showcase", session: "422-showcase",
    setup: [{ chat: "-dev showcase clear a", client: "a" }, { receipt: padsReceipt(2), client: "a", seconds: RECEIPT_SECONDS }, ...RUN],
    capture: [{ kind: "frames", name: "pad-b", client: "a" }],
    pass: [...pass, { kind: "receipt", pattern: padsReceipt(2), client: "a", min: 1 }],
    look: `Cycle ${cycle}: pad a is empty and the Murloc alone stands on pad b.`,
  },
]);
