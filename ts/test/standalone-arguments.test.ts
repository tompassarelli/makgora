import { expect, test } from "bun:test";
import { standaloneArguments } from "../scripts/wisp/standalone";

test("player assets need a map and a map needs player assets [k2 property]", () => {
  expect(standaloneArguments(["--map", "Smashcraft.w3x", "--player-assets-only"]).playerAssets).toEqual({ map: "Smashcraft.w3x" });
  expect(standaloneArguments([]).playerAssets).toBeUndefined();
  expect(() => standaloneArguments(["--player-assets-only"])).toThrow("add --map");
  expect(() => standaloneArguments(["--map", "Smashcraft.w3x"])).toThrow("only with --player-assets-only");
});
