import { assertEquals, assertLessThan, test } from "wisp/src/runtime/testing";
import { AUTO_DELAY, agreedDelay, autoDelay, delayPolicy, observeRtt, rttEstimate, stepManualDelay } from "wisp/src/netcode/delay";
import { PLAYABLE_BUILD } from "../../game/session/currentBuild";
import { createMatchState, setHumanCount, setParticipants } from "../../game/lobby/lobbyState";
import { delayLabel, delayStepTarget } from "../../game/ui/selectionRules";
import { MAX_INPUT_DELAY } from "../../game/netcode/inputSchedule";
import { createNetDelay, hostDelayFrom, lobbyNet, matchDelay } from "./netDelay";

const window = PLAYABLE_BUILD.input.kind === "keyboard" ? PLAYABLE_BUILD.input.rollback : 0;

function settledDelay(rttMs: number): number {
  const estimate = rttEstimate();
  for (let sample = 0; sample < 64; sample++) observeRtt(estimate, rttMs);
  return autoDelay(delayPolicy(window, MAX_INPUT_DELAY), estimate);
}

test("online rollback repairs at most 7 frames with 4 frames of rollback budget and input delay covers the rest of the trip without a ceiling: 100 and 200 ms play at 2 frames, 300 ms at 5, 500 ms at 11, 1000 ms at 26 and 2000 ms at 56 [k3 measure #679]", () => {
  assertEquals(window, 7);
  assertEquals(settledDelay(100), 2);
  assertEquals(settledDelay(200), 2);
  assertEquals(settledDelay(300), 5);
  assertEquals(settledDelay(500), 11);
  assertEquals(settledDelay(1000), 26);
  assertEquals(settledDelay(2000), 56);
  assertLessThan(settledDelay(2000), delayPolicy(window, MAX_INPUT_DELAY).ceiling);
  assertEquals(agreedDelay([2, 26, 11]), 26);
});

test("a host-set input delay overrides Auto for every client, including values above 60, and only the host can set it [k3 measure #679]", () => {
  const game = createMatchState();
  setHumanCount(game, 2);
  const clients = [createNetDelay(window), createNetDelay(window)];
  for (const net of clients) {
    net.proposals[0] = 3;
    net.proposals[1] = 26;
    assertEquals(matchDelay(net, game), 26);
  }
  for (const manual of [2, 0, 70, MAX_INPUT_DELAY]) {
    for (const net of clients) {
      hostDelayFrom(net, game, 1, 9);
      hostDelayFrom(net, game, 0, manual);
      assertEquals(matchDelay(net, game), manual);
    }
  }
  for (const net of clients) {
    hostDelayFrom(net, game, 0, AUTO_DELAY);
    assertEquals(matchDelay(net, game), 26);
  }
  assertEquals(stepManualDelay(delayPolicy(window, MAX_INPUT_DELAY), AUTO_DELAY, 26, 1), 27);
  assertEquals(stepManualDelay(delayPolicy(window, MAX_INPUT_DELAY), 0, 26, -1), 0);
});

const stepOf = (target: ReturnType<typeof delayStepTarget>): number => target?.kind === "inputDelay" ? target.step : 0;

const gearDelay = (humans: number, computers: number, local: number, manual = AUTO_DELAY) => {
  const game = createMatchState();
  setParticipants(game, (1 << humans) - 1, ((1 << computers) - 1) << humans);
  const net = createNetDelay(window);
  net.proposals[0] = 2;
  net.proposals[1] = 2;
  if (manual !== AUTO_DELAY) hostDelayFrom(net, game, 0, manual);
  return lobbyNet(net, game, local).delay;
};

test("The gear's input delay control is fixed at 2 and says why when one person plays, alone or against computers, adjustable only for the online host, and set by the host for an online guest [k1 scenario]", () => {
  const versusComputers = gearDelay(1, 2, 0);
  assertEquals([versusComputers.adjustable, versusComputers.frames, versusComputers.canLess, versusComputers.canMore].join(), "false,2,false,false");
  assertEquals(versusComputers.note, "Fixed at 2 vs computers");
  assertEquals(gearDelay(1, 0, 0).note, "Fixed at 2 when playing alone");
  const host = gearDelay(3, 0, 0);
  assertEquals([host.adjustable, host.auto, host.canLess, host.canMore, host.frames].join(), "true,true,true,true,2");
  assertEquals(host.note, "Auto follows the slowest connection");
  const guest = gearDelay(3, 0, 1);
  assertEquals([guest.adjustable, guest.canLess, guest.canMore].join(), "false,false,false");
  assertEquals(guest.note, "Set by the host");
  const guestSeesHostNumber = gearDelay(3, 0, 1, 9);
  assertEquals([guestSeesHostNumber.frames, guestSeesHostNumber.auto, guestSeesHostNumber.adjustable].join(), "9,false,false");
});

test("The online host's delay control leaves Auto when a number is set and shows Auto's value, and its - stops at 0 and its + at the ceiling [k1 scenario]", () => {
  const set = gearDelay(3, 0, 0, 5);
  assertEquals([set.auto, set.frames, set.canLess, set.canMore].join(), "false,5,true,true");
  assertEquals(set.note, "Set by you; Auto would be 2");
  const floor = gearDelay(3, 0, 0, 0);
  assertEquals([floor.canLess, floor.canMore].join(), "false,true");
  const ceiling = gearDelay(3, 0, 0, MAX_INPUT_DELAY);
  assertEquals([ceiling.canLess, ceiling.canMore].join(), "true,false");
});

test("A pad's left and right step the delay only where the control can step, and never when it is fixed [k1 scenario]", () => {
  const host = gearDelay(3, 0, 0, 5);
  assertEquals(delayStepTarget(host, -1)?.kind, "inputDelay");
  assertEquals(stepOf(delayStepTarget(host, -1)), -1);
  assertEquals(stepOf(delayStepTarget(host, 1)), 1);
  assertEquals(stepOf(delayStepTarget(gearDelay(3, 0, 0, 0), -1)), 0);
  assertEquals(stepOf(delayStepTarget(gearDelay(3, 0, 0, MAX_INPUT_DELAY), 1)), 0);
  for (const fixed of [gearDelay(1, 2, 0), gearDelay(3, 0, 1)]) {
    assertEquals(stepOf(delayStepTarget(fixed, -1)), 0);
    assertEquals(stepOf(delayStepTarget(fixed, 1)), 0);
  }
});

test("The delay label reads Input delay with its frames, in red when high and dim when it cannot change [k1 scenario]", () => {
  assertEquals(delayLabel(gearDelay(1, 2, 0)), "|cff8c95a3Input delay: |r|cff8c95a32|r|cff8c95a3 frames|r");
  assertEquals(delayLabel(gearDelay(3, 0, 0)), "|cffeee4ccInput delay: |r|cffffcc002|r|cffeee4cc frames|r");
  assertEquals(delayLabel(gearDelay(3, 0, 0, 40)).includes("|cffff404040|r"), true);
});
