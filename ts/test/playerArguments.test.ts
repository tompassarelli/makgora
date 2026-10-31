import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { playerArguments, playerMap } from "../scripts/playerArguments";

test("the player takes the map from its first .w3x argument and keeps the other flags [k2 property]", () => {
  expect(playerMap(["Makgora.w3x", "--host", "--relay", "eu"], [])).toEqual({ map: "Makgora.w3x", rest: ["--host", "--relay", "eu"] });
  expect(playerArguments("Makgora.w3x", ["--join", "CODE"])).toEqual(["--standalone", "--window", "native", "--player-assets-only", "--map", "Makgora.w3x", "--join", "CODE"]);
});

test("with no map argument the player takes the only .w3x beside it, and refuses none or two [k2 property]", () => {
  const folder = mkdtempSync(join(tmpdir(), "player-map-"));
  expect(typeof playerMap([], [folder])).toBe("string");
  writeFileSync(join(folder, "a.w3x"), "");
  expect(playerMap([], [folder])).toEqual({ map: join(folder, "a.w3x"), rest: [] });
  writeFileSync(join(folder, "b.w3x"), "");
  expect(typeof playerMap([], [folder])).toBe("string");
});
