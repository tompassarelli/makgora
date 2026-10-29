import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { createMatchState, setHumanMask } from "../lobby/lobbyState";
import type { HandState } from "../menu/selectionDrag";
import { HAND_SEND_INTERVAL, HAND_UPDATES_PER_SECOND, type HandPose, HIDDEN_HAND, SelectionHands } from "./selectionHands";
import { slotColor } from "./slotColors";

const POSITION_STEP = f32(0.0011);
const STATES: readonly HandState[] = ["point", "fan", "pinch"];
const BADGE_COLOURS = [0xff0303, 0x0042ff, 0x1ce6b9, 0x540081];

const pose = (state: HandState, x: number, y: number, chip?: number): HandPose => ({ state, chip, x: f32(x), y: f32(y) });
const near = (value: number | undefined, expected: number, tolerance: number): boolean => Math.abs((value ?? 9) - f32(expected)) <= tolerance;

// Each client sends through one shared wire; every client, the sender included, receives what any client sends.
function lobby(humans: number) {
  const game = createMatchState();
  setHumanMask(game, (1 << humans) - 1);
  const clients = Array.from({ length: humans }, (_, slot) => new SelectionHands(slot));
  const step = (now: number, poses: readonly HandPose[]) => {
    clients.forEach((client, slot) => {
      const data = client.send(poses[slot] ?? HIDDEN_HAND, now);
      if (data !== undefined) clients.forEach(other => other.receive(slot, data, now));
    });
  };
  return { game, clients, step };
}

test("Each client draws one hand per connected human at the last synced position and state, badged P1 to P4 in that slot's player colour, with its own hand exactly on its mouse [k1 scenario]", () => {
  for (const humans of [2, 4]) {
    const { game, clients, step } = lobby(humans);
    const poses = clients.map((_, slot) => pose(STATES[floorMod(slot, 3)] ?? "point", f32(0.1) + slot * f32(0.17), f32(0.5) - slot * f32(0.11), floorMod(slot, 3) === 2 ? slot : undefined));
    step(100.0, poses);
    const settled = 100.0 + 2 * HAND_SEND_INTERVAL;
    clients.forEach((client, local) => {
      const hands = client.drawn(game, poses[local] ?? HIDDEN_HAND, settled);
      assertEquals(hands.length, humans);
      for (let slot = 0; slot < humans; slot++) {
        const hand = hands[slot];
        const expected = poses[slot] ?? HIDDEN_HAND;
        assertEquals(hand?.slot, slot);
        assertEquals(hand?.pose.state, expected.state);
        assertEquals(hand?.pose.chip, expected.chip);
        assertEquals(hand?.badge, `P${slot + 1}`);
        assertEquals(hand?.colour, BADGE_COLOURS[slot]);
        assertEquals(hand?.colour, slotColor(slot).rgb);
        const tolerance = slot === local ? 0.0 : POSITION_STEP;
        assertTrue(near(hand?.pose.x, expected.x, tolerance));
        assertTrue(near(hand?.pose.y, expected.y, tolerance));
      }
    });
    clients.forEach(client => assertEquals(client.drawn(game, HIDDEN_HAND, settled).length, humans - 1));
  }
  const { game, clients, step } = lobby(4);
  step(100.0, [pose("point", f32(0.2), f32(0.2)), pose("fan", f32(0.3), f32(0.3)), pose("pinch", f32(0.4), f32(0.4), 1), HIDDEN_HAND]);
  setHumanMask(game, 7);
  assertEquals((clients[0]?.drawn(game, pose("point", f32(0.2), f32(0.2)), 101.0) ?? []).map(hand => hand.slot).join(","), "0,1,2");
});

test("An unchanged cursor sends no sync data and a moving one sends at most 15 updates a second [k2 property]", () => {
  const client = new SelectionHands(0);
  assertEquals(client.send(HIDDEN_HAND, 100.0), undefined);
  assertTrue(client.send(pose("point", f32(0.4), f32(0.3)), 100.0) !== undefined);
  for (let frame = 1; frame <= 600; frame++) assertEquals(client.send(pose("point", f32(0.4), f32(0.3)), 100.0 + frame / 60), undefined);
  let sends = 0;
  for (let frame = 0; frame < 120; frame++) {
    if (client.send(pose("fan", f32(0.2) + frame / 400, f32(0.3)), 200.0 + frame / 60) !== undefined) sends++;
  }
  assertTrue(sends <= 2 * HAND_UPDATES_PER_SECOND);
  assertTrue(sends >= HAND_UPDATES_PER_SECOND);
});

test("A remote hand glides from where it was drawn to each new synced position within one send interval, and a pinching hand's chip is drawn at it [k2 property]", () => {
  const { game, clients } = lobby(2);
  const remote = clients[0];
  remote?.receive(1, new SelectionHands(1).send(pose("point", f32(0.2), f32(0.2)), 100.0) ?? "", 100.0);
  const hand = (now: number) => remote?.drawn(game, HIDDEN_HAND, now)[0]?.pose;
  assertEquals(remote?.drawn(game, HIDDEN_HAND, 100.0).length, 1);
  assertTrue(near(hand(100.0)?.x, f32(0.2), POSITION_STEP));
  remote?.receive(1, new SelectionHands(1).send(pose("pinch", f32(0.4), f32(0.3), 1), 101.0) ?? "", 101.0);
  const half = hand(101.0 + HAND_SEND_INTERVAL / 2);
  assertTrue(near(half?.x, f32(0.3), 2 * POSITION_STEP));
  assertTrue(near(half?.y, f32(0.25), 2 * POSITION_STEP));
  const later = 101.0 + 4 * HAND_SEND_INTERVAL;
  assertTrue(near(hand(later)?.x, f32(0.4), POSITION_STEP));
  assertEquals(hand(later)?.state, "pinch");
  const chips = remote?.carriedChips(game, later);
  for (const slot of PARTICIPANT_SLOTS) assertEquals(chips?.[slot] !== undefined, slot === 1);
});
