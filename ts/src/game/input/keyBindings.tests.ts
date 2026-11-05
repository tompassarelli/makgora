import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "./actions";
import { PAD_LAYER, padLayerAction } from "./padKeys";
import { BINDING_PRESETS, type BindingPreset, actionFor, decodeBindings, encodeBindings, keyFor, presetBindings, slotIndex, spaceUpBoxKeys } from "./keyBindings";
import { type LayoutBindings, layoutSave, decodeLayouts, encodeLayouts, presetLayouts } from "./layoutSave";

const code = (character: string) => character.charCodeAt(0);
const SPACE = 32;
const encodeSlots = (save: { layouts: LayoutBindings; active: BindingPreset }) => encodeLayouts(layoutSave(save.layouts, save.active));

test("no preset binds one key to two actions, and each survives a save and load unchanged [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    const { keys } = presetBindings(preset);
    const bound = keys.filter((key) => key !== 0);
    assertEquals(new Set(bound).size, bound.length, `${preset} duplicate key`);
    assertEquals(decodeBindings(encodeBindings({ keys }))?.keys.join(","), keys.join(","), `${preset} round trip`);
  }
});

const SAVED_IN_0_2 = {
  stockBox: "KL1KC065000068000083000087032056000078000085000079000081000055000074000076000048000080000075000069000073000057089186000KC087000082000069000032000056000078000085000079000081000055000074000076000048000080000075000065000073000057089186000KC087000082000069000032000057000078000085000079000081000056000074000076000189000080000075000065000073000048000186000",
  editedCustom: "KL2KC065000068000083000087032056000078000085000079000081000055000074000076000048000080000075000069000073000057089186000KC087000082000069000032000056000078000085000079000081000055000074000076000048000080000075000065000073000057089186000KC087000082000069000032000057000066000085000079000081000056000074000076000189000080000075000065000073000048000186000",
};

const savedKeys = (saved: string, layout: number) => {
  const block = saved.slice(3).split("KC")[layout + 1] ?? "";
  const keys: number[] = [];
  for (let at = 0; at < block.length; at += 3) keys.push(Number(block.slice(at, at + 3)));
  return keys;
};

test("a stock WASD or Box layout saved by 0.2, or a Box with Space as Up, loads as the current layout with P on Up and Space on Walk, and an edited Custom or Box layout stays as saved [k2 property]", () => {
  const stock = decodeLayouts(SAVED_IN_0_2.stockBox);
  assertEquals(stock?.active, "standard");
  assertEquals(stock?.layouts.standard.keys.join(","), presetBindings("standard").keys.join(","), "0.2 Box");
  assertEquals(keyFor(stock?.layouts.standard ?? { keys: [] }, Action.moveUp, 0), code("P"));
  assertEquals(keyFor(stock?.layouts.standard ?? { keys: [] }, Action.modX, 0), SPACE);
  assertEquals(stock?.layouts.wasd.keys.join(","), presetBindings("wasd").keys.join(","), "0.2 WASD");
  const edited = decodeLayouts(SAVED_IN_0_2.editedCustom);
  assertEquals(edited?.active, "custom");
  assertEquals(edited?.layouts.custom.keys.join(","), savedKeys(SAVED_IN_0_2.editedCustom, 2).join(","), "0.2 edited Custom");
  assertEquals(edited?.layouts.standard.keys.join(","), presetBindings("standard").keys.join(","), "0.2 Box beside it");
  const spaceUp = decodeLayouts(encodeSlots({ layouts: { ...presetLayouts(), standard: { keys: spaceUpBoxKeys() } }, active: "standard" }));
  assertEquals(spaceUp?.layouts.standard.keys.join(","), presetBindings("standard").keys.join(","), "Space-up Box");
  const ownBox = spaceUpBoxKeys();
  ownBox[slotIndex(Action.attack, 0)] = code("B");
  const kept = decodeLayouts(encodeSlots({ layouts: { ...presetLayouts(), standard: { keys: ownBox } }, active: "standard" }));
  assertEquals(kept?.layouts.standard.keys.join(","), ownBox.join(","), "edited Space-up Box");
});

test("the pad layer keeps its own keys, and a layout binds a pad key only to the action the pad gives it or C on Mod Y [k2 property]", () => {
  assertEquals(PAD_LAYER.map(({ key }) => key).join(""), "cvt123456/`[]='," + ".-\\");
  for (const preset of BINDING_PRESETS) {
    for (const { code: padCode, action } of PAD_LAYER) {
      const bound = actionFor(presetBindings(preset), padCode);
      assertEquals(bound === undefined || bound === action || (padCode === code("C") && bound === Action.modY), true, `${preset} binds pad key ${padCode} to another action`);
    }
  }
  for (const character of ["Z", "X", "G"]) assertEquals(padLayerAction(code(character)), undefined, `${character} is no pad key`);
});
