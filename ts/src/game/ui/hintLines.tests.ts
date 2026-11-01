import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "../input/actions";
import { presetBindings, rebind } from "../input/keyBindings";
import { hintRows } from "./hintLines";

const lines = (device: "keyboard" | "pad", bindings = presetBindings("wasd"), hideKeyFree = true) => hintRows(device, bindings, hideKeyFree).map(row => `${row.keys} ${row.label}`);

test("the keyboard strip names the keys actually bound for move, jump, attack, special, shield, grab, Strong, Mod X, Mod Y, pause and hide, and a rebound attack key shows the new key [k2 property]", () => {
  assertEquals(lines("keyboard").join("|"), "W A S D move|8 jump|N attack|U special|Q shield|O grab|9 Strong|K Mod X|; Mod Y|Esc pause|H hide");
  const rebound = presetBindings("wasd");
  rebind(rebound, Action.attack, 0, "B".charCodeAt(0));
  assertEquals(lines("keyboard", rebound)[2], "B attack");
});

test("the strip drops the hide line when H is bound to an action, and a pad player's strip shows pad buttons with Start to pause [k2 property]", () => {
  assertEquals(lines("keyboard", presetBindings("wasd"), false).includes("H hide"), false);
  assertEquals(lines("pad").join("|"), "Left stick move|X/Y jump|A attack|B special|LT shield|RB grab|LB Strong|R stick tilt Mod X + Y|Start pause|H hide");
});
