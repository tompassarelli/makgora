import { expect, test } from "bun:test";
import { declareMap, supportedModes, type MapInfo } from "wisp/scripts/mapInfo";
import { MAKGORA_MAP } from "../scripts/mapInfo";

const ints = (values: readonly number[]) => new Uint8Array(new Int32Array(values).buffer);

const base: MapInfo = {
  versions: new Uint8Array(28), name: "Base", author: "", description: "", suggestedPlayers: "",
  bounds: new Uint8Array(56), flags: 0, environment: new Uint8Array([...ints([1, 3]), ...ints(Array.from({ length: 14 }, () => 0))]),
  players: [], forces: [], tables: new Uint8Array(0),
};

test("the declaration the build writes into war3map.w3i reads back as SD only, so a Reforged player draws Classic art [k4 reference docs/design/visual-quality.md#the-renderer-is-fixed]", () => {
  expect(supportedModes(base.environment)).toBe("both");
  expect(supportedModes(declareMap(base, "Mak'gora", MAKGORA_MAP).environment)).toBe("sd");
});
