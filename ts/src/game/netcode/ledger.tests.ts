import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { type InputRow, inputRow, sameInput } from "../input/inputRow";
import { inputPacket } from "../input/wire";
import { REPLAY_HISTORY_CAPACITY } from "../replay/limits";
import { FUTURE_LIMIT, InputLedger } from "./ledger";

const EPOCH = 3;
const DELAY = 2;
const PEERS = 2;
const STEPS = 1500;
const CATCH_UP = 6;

const rowAt = (frame: number, sender: number): InputRow =>
  assertDefined(inputRow({ held: imod(frame * 7 + sender, 32768), pressed: imod(frame * 13 + sender, 32768) }), "row");

interface Peer {
  readonly ledger: InputLedger;
  sent: number;
  stalled: number;
}

function sweepSeed(seed: number): void {
  let state = seed;
  const next = (bound: number) => {
    state = imod(state * 75 + 74, 65537);
    return imod(state, bound);
  };
  const peers: Peer[] = [];
  for (let slot = 0; slot < PEERS; slot++) {
    const ledger = new InputLedger();
    assertTrue(ledger.beginEpoch(EPOCH, 1, DELAY, (1 << PEERS) - 1));
    peers.push({ ledger, sent: DELAY, stalled: 0 });
  }
  const wire: { sender: number; frame: number; count: number }[] = [];
  for (let step = 0; step < STEPS; step++) {
    for (let slot = 0; slot < PEERS; slot++) {
      const peer = assertDefined(peers[slot]);
      const { ledger } = peer;
      if (peer.stalled > 0) peer.stalled--;
      else if (next(150) === 0) peer.stalled = 60 + next(120);
      for (let run = 0; run < CATCH_UP && peer.stalled === 0; run++) {
        const frame = ledger.consumedThrough() + 1;
        if (!ledger.markConsumed(EPOCH, frame)) break;
        if (frame - REPLAY_HISTORY_CAPACITY >= ledger.firstRetained()) assertTrue(ledger.discardThrough(EPOCH, frame - REPLAY_HISTORY_CAPACITY));
      }
      for (let run = 0; run < CATCH_UP; run++) {
        const frame = peer.sent + 1;
        if (frame - ledger.consumedThrough() > FUTURE_LIMIT) break;
        const count = frame + 1 - ledger.consumedThrough() <= FUTURE_LIMIT && next(2) === 0 ? 2 : 1;
        wire.push({ sender: slot, frame, count });
        peer.sent = frame + count - 1;
      }
    }
    for (let delivered = next(wire.length + 1); delivered > 0; delivered--) {
      const sent = assertDefined(wire.shift());
      const rows = sent.count === 2 ? [rowAt(sent.frame, sent.sender), rowAt(sent.frame + 1, sent.sender)] : [rowAt(sent.frame, sent.sender)];
      const packet = assertDefined(inputPacket(EPOCH, sent.frame, rows), "packet");
      for (const peer of peers) assertEquals(peer.ledger.acceptPacket(sent.sender, packet), "accepted", `seed ${seed} step ${step} sender ${sent.sender} frame ${sent.frame} at consumed ${peer.ledger.consumedThrough()} K ${peer.ledger.knownThrough()}`);
    }
  }
  const first = assertDefined(peers[0]).ledger;
  for (const peer of peers) assertEquals(peer.ledger.knownThrough(), first.knownThrough());
  assertTrue(first.knownThrough() > STEPS);
  for (let frame = Math.max(...peers.map((peer) => peer.ledger.firstRetained())); frame <= first.knownThrough(); frame++) {
    for (let sender = 0; sender < PEERS; sender++) {
      for (const peer of peers) assertTrue(sameInput(assertDefined(peer.ledger.accepted(EPOCH, sender, frame)), frame <= DELAY ? assertDefined(inputRow({})) : rowAt(frame, sender)));
    }
  }
}

test("every client accepts each row a sender admitted past its own confirmed frame, however long either stalls [k2 property]", () => {
  for (let seed = 1; seed <= 6; seed++) sweepSeed(seed);
});
