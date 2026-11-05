import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { createTapeSession, performTapeOperation } from "../replay/tapeRunner";
import { createMatchTally, resultRows } from "../presentation/matchCues";
import { createTrainingState } from "../match/trainingState";
import { trainingReadout } from "../session/messages";
import { PLAYABLE_CHARACTERS } from "../roster/kits";
import { fighterAt } from "../sim/roster";
import { Phase } from "../lobby/lobbyState";
import { selectCharacter } from "../lobby/characterChoice";
import { requestStageSelect } from "../lobby/stageSelect";
import { PLATE_TOP, SHAKE_FRAMES, type PlateBox, type PlateRow, boxLeft, boxTop, damageText, numberJolt, panelLayout, panelMirrored, percentText, plateLeft, plateOrder, plateRow, previewPanelLeft, stepJolt } from "./plateLayout";
import { PREVIEW_PANEL } from "./keyboardPreview";
import { NET_INDICATOR_TOP } from "./hudLayout";
import { unitsForPixels } from "./portraitFrames";

const plain = (text: string): string => text.substring(10, text.length - 2);


test("a fighter at 150% that takes no hit keeps its percent at rest on every frame, a hit shakes it, and it returns to rest after the shake [k1 scenario]", () => {
  const jolt = numberJolt();
  stepJolt(jolt, false, 150.0);
  for (let frame = 0; frame < 30; frame++) {
    stepJolt(jolt, true, 150.0);
    assertEquals(jolt.dx, 0.0, `no hit, frame ${frame} dx`);
    assertEquals(jolt.dy, 0.0, `no hit, frame ${frame} dy`);
  }
  assertTrue(stepJolt(jolt, true, 162.5));
  assertTrue(jolt.dx !== 0.0 && jolt.dy !== 0.0);
  for (let frame = 1; frame < SHAKE_FRAMES; frame++) stepJolt(jolt, true, 162.5);
  stepJolt(jolt, true, 162.5);
  assertEquals(jolt.dx, 0.0, "rest after the shake dx");
  assertEquals(jolt.dy, 0.0, "rest after the shake dy");
  assertTrue(!stepJolt(jolt, true, 162.5));
});

const span = (left: number, centerY: number, width: number, height: number) => ({ left, right: left + width, top: centerY + height / 2, bottom: centerY - height / 2 });
const boxSpan = (left: number, box: PlateBox) => span(boxLeft(left, box), boxTop(box) - unitsForPixels(box.height) / 2, unitsForPixels(box.width), unitsForPixels(box.height));
const overlaps = (a: ReturnType<typeof span>, b: ReturnType<typeof span>) => a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;


const SCREEN_WIDTH = f32(0.8);
const PLATE_WIDTH = unitsForPixels(544);

const DAMAGE_DIGITS_PX = 192;
const SCREEN_LEFT = 0.0;

function plateParts(left: number, row: PlateRow, position: number): ReturnType<typeof span>[] {
  const panel = panelLayout(position, row);
  const digits: PlateBox = { ...panel.damage, x: panel.damage.x + panel.damage.width - DAMAGE_DIGITS_PX, width: DAMAGE_DIGITS_PX };
  return [panel.frame, panel.namePlate, panel.percent, digits, panel.pingSignal, panel.pingNumber, ...panel.stockShadows].map(box => boxSpan(left, box));
}

const ARRANGEMENTS: readonly { readonly name: string; readonly active: readonly number[]; readonly teams?: readonly number[]; readonly slots: string; readonly split: number }[] = [
  { name: "1 player", active: [0], slots: "0", split: 1 },
  { name: "2-player free-for-all", active: [0, 1], slots: "0,1", split: 1 },
  { name: "3-player free-for-all", active: [0, 1, 2], slots: "0,1,2", split: 2 },
  { name: "4-player free-for-all", active: [0, 1, 2, 3], slots: "0,1,2,3", split: 2 },
  { name: "2v2 Team Battle", active: [0, 1, 2, 3], teams: [0, 1, 0, 1], slots: "0,2,1,3", split: 2 },
  { name: "1v1 Team Battle", active: [0, 2], teams: [1, 0, 0, 1], slots: "2,0", split: 1 },
  { name: "1v2 Team Battle", active: [0, 1, 2], teams: [1, 0, 0, 0], slots: "1,2,0", split: 2 },
  { name: "1v3 Team Battle", active: [0, 1, 2, 3], teams: [1, 0, 0, 0], slots: "1,2,3,0", split: 3 },
  { name: "three-team battle", active: [0, 1, 2, 3], teams: [2, 0, 1, 1], slots: "1,2,3,0", split: 1 },
];

