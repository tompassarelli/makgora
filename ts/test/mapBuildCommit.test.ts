import { expect, test } from "bun:test";
import { buildSentence, commitMismatch, stampedCommit } from "../scripts/wisp/mapBuildCommit";

const MAP = "5fe9a1b32fb8144fa8e3e8607feb07bf6f3d510a";
const CHECKOUT = "dedc0361928c3c2e0b2c5f0a0c1b9e8d7f6a5b4c";

test("a released map's script names the commit its description was stamped with [k2 property]", () => {
  expect(stampedCommit(`SetMapDescription([[Smashcraft heroes fight. ${buildSentence(MAP)}]])`)).toBe(MAP);
  expect(stampedCommit("SetMapDescription([[Smashcraft heroes fight.]])")).toBeUndefined();
});

test("--player-assets-only refuses a map built from another commit than the checkout, naming both [k2 property]", () => {
  expect(commitMismatch("676.w3x", MAP, CHECKOUT)).toBe("676.w3x was built from Smashcraft 5fe9a1b32f and this checkout is at dedc036192; play a map built from dedc036192, or check out 5fe9a1b32f");
  expect(commitMismatch("676.w3x", MAP, MAP)).toBeUndefined();
  expect(commitMismatch("local.w3x", undefined, CHECKOUT)).toBeUndefined();
  expect(commitMismatch("676.w3x", MAP, undefined)).toBeUndefined();
});
