import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, bit } from "./actions";
import { copyInput, emptyInput, sameInput } from "./inputRow";
import { commitEdges, keyboardCapture, sampleKeys } from "./keyboardCapture";
import { TransportDecoder, encodeInputMessage, encodePacket, inputPacket, packetSizeInRange } from "./wire";

const M = bit(Action.modX), U = bit(Action.moveUp), R = bit(Action.moveRight), J = bit(Action.jump);

test("keyboard rows with Mod X held, tapped and held with up and a side reach every peer unchanged as I4 packets and I5 messages, and rows without it keep the companion's bytes [k1 scenario]", () => {
  const capture = keyboardCapture();
  const rows = [M, M, 0, M, M | U | R, M | U | R | J, M | R, U | R, 0].map((held) => {
    sampleKeys(capture, held);
    const row = emptyInput();
    copyInput(row, capture.row);
    commitEdges(capture);
    return row;
  });
  const decoder = new TransportDecoder();
  rows.forEach((row, index) => {
    const wire = encodePacket(inputPacket(1, index + 1, [row])!);
    assertEquals(packetSizeInRange(wire.length, 1), true, `frame ${index + 1} size`);
    assertEquals(decoder.decode(wire), 1, `frame ${index + 1} decodes`);
    assertEquals(sameInput(decoder.at(0).rows[0]!, row), true, `frame ${index + 1} arrives as captured`);
  });
  const message = encodeInputMessage(1, 1, rows.length, (frame) => rows[frame - 1]!);
  assertEquals(message.lastFrame, rows.length);
  const packets = decoder.decode(message.wire);
  assertEquals(packets, Math.ceil(rows.length / 2));
  for (let index = 0; index < packets; index++) {
    decoder.at(index).rows.forEach((row, offset) => assertEquals(sameInput(row, rows[2 * index + offset]!), true, `message frame ${2 * index + offset + 1}`));
  }
  const jump = emptyInput();
  jump.held = J;
  jump.pressed = J;
  assertEquals(encodePacket(inputPacket(1, 1, [jump])!), "I4111300G00G000");
});
