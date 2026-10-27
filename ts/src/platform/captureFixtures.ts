import type { Character } from "../game/sim/codes";
import { fighterKey, fighterSlug } from "../game/roster/kits";
import { SHOWCASE_FIRST_FRAME, type ShowcaseMove, showcaseRows } from "../game/session/showcaseTimeline";

export interface Silhouette {
  readonly slot: 0 | 1;
  readonly fighter: string;
  readonly move: string;
  readonly width: number;
  readonly height: number;
  readonly conceal?: "fighter" | "cues";
}

export interface CaptureFixture {
  readonly name: string;
  readonly frames: readonly number[];
  readonly script: string;
  readonly holdTicks?: number;
  readonly openingTicks?: number;
  readonly tailFrames?: number;
  readonly reel?: { readonly fighter: string; readonly row: string; readonly slot: string; readonly facing: "right" | "left" };
  readonly silhouette?: Silhouette;
}

// A hidden capture's stamp names frame + SILHOUETTE_HIDDEN_FRAME, so a pixel stamp tells the pair apart.
export const SILHOUETTE_HIDDEN_FRAME = 16384;

export const SHOWCASE_HOLD_TICKS = 6;

interface TimedLine { readonly frame: number; readonly line: string }

const inputAt = (frame: number, line: string): TimedLine => ({ frame: SHOWCASE_FIRST_FRAME + frame - 0.5, line: `${SHOWCASE_FIRST_FRAME + frame} ${line}` });

function timedInputs(move: Readonly<ShowcaseMove>, facing: "right" | "left"): TimedLine[] {
  return [
    ...(move.again === undefined ? [] : [inputAt(move.again.frame, `a move ${move.kind} ${move.code} ${facing} ${move.again.gap}`)]),
    ...(move.cross === undefined ? [] : [inputAt(move.cross.frame, `a cross ${facing} ${move.cross.gap}`)]),
    ...(move.hold === undefined ? [] : [inputAt(move.hold.frame, `a hold ${move.hold.frames}`)]),
    ...(move.release === undefined ? [] : [inputAt(move.release, "a release X")]),
    ...(move.aim === undefined ? [] : [inputAt(move.aim.frame, `a stick 0 ${move.aim.z}`), inputAt(move.aim.until, "a stick 0 0")]),
  ];
}

export function showcaseFixtures(character: Character, holdTicks = SHOWCASE_HOLD_TICKS): CaptureFixture[] {
  const fighter = fighterSlug(character);
  return showcaseRows(character).map(({ row, move, facing, frames }) => {
    const timed = [...frames.map(frame => ({ frame, line: `${frame} a capture` })), ...timedInputs(move, facing)].sort((a, b) => a.frame - b.frame);
    const script = `#! chat -dev quick hero ${fighterKey(character).toLowerCase()} stocks 9\n#! reel ${fighter} ${row} ${move.slot} ${facing} ${holdTicks}\n${move.incoming === undefined ? "" : `${SHOWCASE_FIRST_FRAME - move.incoming.lead} b move special 0 ${facing === "left" ? "right" : "left"} ${move.incoming.gap}\n`}${SHOWCASE_FIRST_FRAME} a move ${move.kind} ${move.code} ${facing}${move.incoming !== undefined ? " -" : move.gap === undefined && move.lift === undefined ? "" : ` ${move.gap ?? 500}`}${move.lift === undefined ? "" : ` ${move.lift}`}\n${move.cross === undefined ? "" : `${SHOWCASE_FIRST_FRAME} a brace\n`}${move.release === undefined ? "" : `${SHOWCASE_FIRST_FRAME} a press X\n`}${timed.map(entry => entry.line).join("\n")}\n`;
    return { name: `${fighter}-${row}`, frames, script, holdTicks, openingTicks: 1, tailFrames: 0, reel: { fighter, row, slot: move.slot, facing } };
  });
}

const WALK = "#! chat -dev quick hero illidan\n40 a stick 1 0\n70 a stick 0 0\n90 b tap X 2\n";
const OTHER = "#! chat -dev quick hero mountain king\n40 b stick -1 0\n70 b stick 0 0\n";

export const CAPTURE_FIXTURES: readonly CaptureFixture[] = [
  { name: "control-walk", frames: [30, 31, 62, 100, 101], script: WALK },
  { name: "control-other", frames: [30, 62, 100], script: OTHER },
  { name: "control-walk-again", frames: [30, 31, 62, 100, 101], script: WALK },
];

export function captureStageCommand(character: Character, move: string, facing: "right" | "left", slot = 0): string {
  return `-dev capture ${fighterSlug(character)} ${move} ${facing} ${slot}`;
}

export const CAPTURE_STAGE_CLEAR = "-dev capture clear";
