import { expect, test } from "bun:test";
import { markerName } from "../src/game/ui/fighterMarker";

test("a marker shows a Battle.net name without its #number tag [k5 boundary battlenet-name-tag]", () => {
  expect(markerName(true, "Pilot#1234")).toBe("Pilot");
  expect(markerName(true, "Player 1")).toBe("Player 1");
  expect(markerName(false, "Pilot#1234")).toBe("CPU");
});
