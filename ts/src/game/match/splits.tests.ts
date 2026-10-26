import { assertEquals, test } from "wisp/src/runtime/testing";
import { createBufferedFrameControls } from "./controls";
import { createMatchState, Phase } from "../lobby/lobbyState";
import { stepMatch } from "./step";
import { Action, bit } from "../input/actions";
import { adaptInput } from "./inputAdapter";
import { commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { authoredTuning } from "../sim/tuning";

const S = bit(Action.strong), D = bit(Action.moveDown);
const SPLITS = [Character.warden, Character.demonHunter] as const;
const SPACING = 60.0;

test("Maiev's and Illidan's down smash is the splits: one press hits a foe in front and one behind on the same first active frame and launches each low and away from them, in both facings [k1 scenario]", () => {
  for (const character of SPLITS) {
    for (const facing of [1, -1]) {
      const name = `${character} facing ${facing}`;
      const game = createMatchState();
      game.phase = Phase.match;
      const owner = createFighter(character, 0.0, facing);
      const front = createFighter(Character.rifleman, SPACING * facing, -facing);
      const behind = createFighter(Character.rifleman, -SPACING * facing, facing);
      const world = createRoster(0b111, [owner, front, behind]);
      const frameControls = createBufferedFrameControls();
      const capture = keyboardCapture();
      let frame = 0;
      const press = (held: number) => {
        frame++;
        sampleKeys(capture, held);
        adaptInput(capture.row, owner, frame, frameControls.inputs[0], frameControls.commands[0]);
        commitEdges(capture);
        stepMatch(game, world, frameControls, frame);
      };
      for (let i = 0; i < 3; i++) press(0);
      press(S);
      press(S | D);
      assertEquals(owner.attack.style, AttackStyle.downSmash, `${name} starts the down smash`);
      const move = authoredTuning(character).moves?.normals[AttackStyle.downSmash];
      assertEquals(move !== undefined, true, `${name} authors its down smash`);
      let frontHit: number | undefined;
      let behindHit: number | undefined;
      for (let i = 0; i < 40 && (frontHit === undefined || behindHit === undefined); i++) {
        press(0);
        const attackFrame = owner.attack.frame;
        if (frontHit === undefined && front.status.damage > 0) frontHit = attackFrame;
        if (behindHit === undefined && behind.status.damage > 0) behindHit = attackFrame;
      }
      assertEquals(frontHit, move?.startupFrames, `${name} hits in front on its first active frame`);
      assertEquals(behindHit, frontHit, `${name} hits behind on the same frame`);
      assertEquals(front.status.damage, behind.status.damage, `${name} deals the same damage both sides`);
      for (let i = 0; i < 30 && (front.launch.knockbackX === 0.0 || behind.launch.knockbackX === 0.0); i++) press(0);
      assertEquals(Math.sign(front.launch.knockbackX) === facing, true, `${name} sends the front foe away`);
      assertEquals(Math.sign(behind.launch.knockbackX) === -facing, true, `${name} sends the foe behind away`);
      for (const foe of [front, behind]) {
        assertEquals(foe.launch.knockbackZ > 0.0 && foe.launch.knockbackZ < Math.abs(foe.launch.knockbackX), true, `${name} launches low, under 45 degrees`);
      }
    }
  }
});
