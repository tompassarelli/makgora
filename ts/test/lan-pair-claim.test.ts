import { expect, test } from "bun:test";
import { claimedLanPair } from "../scripts/wisp/commands/lan";

test("lan fresh and lan end name the pair whose claim they need [k2 property]", () => {
  for (const verb of ["fresh", "end"]) {
    expect(claimedLanPair([verb])).toBe(0);
    expect(claimedLanPair([verb, "--pair", "0"])).toBe(0);
    expect(claimedLanPair([verb, "--pair=3"])).toBe(3);
  }
  expect(claimedLanPair(["status", "--pair", "0"])).toBeUndefined();
});
