import { expect, test } from "bun:test";
import { standaloneParityArguments } from "../scripts/wisp/standaloneParity";

test("parity standalone compares in-process unless it is told --window native [k2 property]", () => {
  expect(standaloneParityArguments(["a.pad"])).toMatchObject({ pad: "a.pad", window: "chrome" });
  expect(standaloneParityArguments(["a.pad", "--presentation", "native", "--window", "native"])).toMatchObject({ presentations: ["native"], window: "native" });
  expect(standaloneParityArguments(["a.pad", "--window", "warcraft"])).toBe("--window needs chrome or native");
});
