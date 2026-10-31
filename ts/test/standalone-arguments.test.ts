import { expect, test } from "bun:test";
import { standaloneArguments } from "../scripts/wisp/standalone";

test("player assets need a map and a map needs player assets [k2 property]", () => {
  expect(standaloneArguments(["--map", "Smashcraft.w3x", "--player-assets-only"]).playerAssets).toEqual({ map: "Smashcraft.w3x" });
  expect(standaloneArguments([]).playerAssets).toBeUndefined();
  expect(() => standaloneArguments(["--player-assets-only"])).toThrow("add --map");
  expect(() => standaloneArguments(["--map", "Smashcraft.w3x"])).toThrow("only with --player-assets-only");
});

test("a headless native window run needs frames but no output folder, and a Chrome run keeps needing both [k2 property]", () => {
  expect(standaloneArguments(["--headless", "--frames", "600"], "native")).toMatchObject({ headless: true, frames: 600 });
  expect(() => standaloneArguments(["--headless", "--frames", "600"])).toThrow("--headless needs --frames N and --out DIR");
  expect(() => standaloneArguments(["--headless"], "native")).toThrow("--headless needs --frames N");
});

test("--start names where the native window opens [k2 property]", () => {
  expect(standaloneArguments(["--start", "select"], "native").start).toBe("select");
  expect(standaloneArguments([]).start).toBeUndefined();
  expect(() => standaloneArguments(["--start", "title"])).toThrow("--start needs");
});

test("--digests names the file the native window writes its frame digests to, and only the native window writes it [k2 property]", () => {
  expect(standaloneArguments(["--digests", "digests.txt"], "native").digests).toBe("digests.txt");
  expect(() => standaloneArguments(["--digests", "digests.txt"])).toThrow("add --window native");
});

test("--storage names the Warcraft III: Reforged folder Wisp looks at first [k2 property]", () => {
  expect(standaloneArguments(["--storage", "/games/Warcraft III"]).storage).toBe("/games/Warcraft III");
  expect(standaloneArguments([]).storage).toBeUndefined();
  expect(() => standaloneArguments(["--storage"])).toThrow("--storage needs a value");
  expect(() => standaloneArguments(["--storage", "--headless"])).toThrow("--storage needs a value");
});
