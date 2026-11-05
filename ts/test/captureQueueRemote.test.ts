import { expect, test } from "bun:test";
import { manifestAt } from "../scripts/captureQueueRemote";

test("a remote capture's manifest names the map at the pair host's store path, so its batch accepts the plan's row [k2 property]", () => {
  const local = JSON.stringify({ map: "/home/tom/batch/g0.w3x", mapSha256: "abc", fixtures: [{ name: "a", frames: [1] }] });
  expect(JSON.parse(manifestAt(local, "/home/tom/.cache/wisp/maps/key/map.w3x"))).toEqual({ map: "/home/tom/.cache/wisp/maps/key/map.w3x", mapSha256: "abc", fixtures: [{ name: "a", frames: [1] }] });
});
