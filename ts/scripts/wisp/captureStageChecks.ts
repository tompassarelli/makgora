import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

const SESSION = "614-capture-stage";
const SHOTS = { kind: "frames", client: "a", count: 8, everyMs: 150 } as const;

export const captureStageChecks = (pass: readonly Rule[]): NativeCheck[] => [
  {
    id: "614-capture-blademaster", closes: "smashcraft#614 box 1", map: "presentation", session: SESSION,
    setup: [{ chat: "-dev reset" }, { chat: "-dev quick hero illidan stocks 9" }, { waitMs: 4000 }, { chat: "-dev capture blademaster forward-air right 0" }, { waitMs: 1000 }],
    capture: [{ ...SHOTS, name: "blademaster-forward-air" }],
    pass: [...pass, { kind: "receipt", pattern: "^SMASHCRAFT DEV v=1 ", min: 1 }],
    look: "The match fighters are hidden; the Blademaster alone stands in slot 0 (x=-450) facing right and loops his forward air in mid-air.",
  },
  {
    id: "614-capture-jaina", closes: "smashcraft#614 box 1", map: "presentation", session: SESSION,
    setup: [{ chat: "-dev capture jaina up-tilt left 1" }, { waitMs: 1000 }],
    capture: [{ ...SHOTS, name: "blademaster-and-jaina" }],
    pass: [...pass, { kind: "receipt", pattern: "^SMASHCRAFT DEV v=1 ", min: 1 }],
    look: "Without a reload, the Blademaster still loops his forward air in slot 0 while Jaina stands beside him in slot 1 (x=-150) facing left, looping her up tilt.",
  },
  {
    id: "614-capture-clear", closes: "smashcraft#614 box 1", map: "presentation", session: SESSION,
    setup: [{ chat: "-dev capture clear" }, { waitMs: 1000 }],
    capture: [{ ...SHOTS, name: "cleared" }],
    pass: [...pass, { kind: "receipt", pattern: "^SMASHCRAFT DEV v=1 ", min: 1 }],
    look: "Both staged fighters are gone and the quick match's own fighters are drawn again.",
  },
];
