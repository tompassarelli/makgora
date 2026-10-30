import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

interface Facing {
  readonly facing: "right" | "left";
  readonly winner: "P1" | "P2";
  readonly timedOut: 0 | 1;
  readonly setup: readonly string[];
}

const FACINGS: readonly Facing[] = [
  { facing: "right", winner: "P1", timedOut: 1, setup: ["-dev fighter 2 Blademaster", "-dev time 1", "-dev quick pair Murloc / Blademaster", "-dev lives 1 99"] },
  { facing: "left", winner: "P2", timedOut: 0, setup: ["-dev fighter 2 Murloc", "-dev time 10", "-dev quick pair Blademaster / Murloc", "-dev percent 1 999", "-dev lives 1 1"] },
];

export const winnerPoseChecks = (pass: readonly Rule[]): readonly NativeCheck[] => FACINGS.map(({ facing, winner, timedOut, setup }): NativeCheck => {
  const result = `^result frames=\\d+ winner=${winner} timed-out=${timedOut} interrupted=0$`;
  return {
    id: `murlocs-win-${facing}`, closes: "smashcraft#murlocs-cheer", map: "presentation", session: `murlocs-win-${facing}`,
    setup: [
      { chat: "-dev reset" }, { chat: "-dev slots 1 2" }, { chat: "-dev auto-rematch off" },
      ...setup.map((chat) => ({ chat })),
      { receipt: result, client: "a", seconds: 600 },
    ],
    capture: [{ kind: "frames", name: `murlocs-win-${facing}`, client: "a", count: 40, everyMs: 150 }],
    pass: [...pass, { kind: "receipt", pattern: result, client: "a", min: 1 }],
    look: `Classic: Murloc wins on player ${winner.substring(1)}'s side, the side it starts facing ${facing}. At the match-end victory moment and again on the results screen, Mrgl and his partner Grgl stand side by side, Grgl slightly smaller, both facing the camera and both playing the Murloc cheer in step.`,
  };
});
