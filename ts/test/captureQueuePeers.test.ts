import { expect, test } from "bun:test";
import { pairRemoteSpec, pairsOf, peerOf } from "../scripts/captureQueuePeers";

test("a peer's pairs are the installs that have both clients, and each host's peer is the other [k2 property]", () => {
  expect(pairsOf(["lan0a", "lan0b", "lan4a", "lan15a", "lan15b", "lan1b", "notes"])).toEqual([0, 15]);
  expect(pairRemoteSpec("whiterabbit", [0, 15])).toBe("whiterabbit=0,15");
  expect(pairRemoteSpec("gex45", [])).toBe("");
  expect([peerOf("gex45"), peerOf("whiterabbit")]).toEqual(["whiterabbit", "gex45"]);
});
