import { expect, test } from "bun:test";
import { pairRemoteSpec, pairsOf, peerOf, remoteInvocations } from "../scripts/captureFanout";

test("a peer's pairs are the installs that have both clients, and each host's peer is the other [k2 property]", () => {
  expect(pairsOf(["lan0a", "lan0b", "lan4a", "lan15a", "lan15b", "lan1b", "notes"])).toEqual([0, 15]);
  expect(pairRemoteSpec("whiterabbit", [0, 15])).toBe("whiterabbit=0,15");
  expect(pairRemoteSpec("gex45", [])).toBe("");
  expect([peerOf("gex45"), peerOf("whiterabbit")]).toEqual(["whiterabbit", "gex45"]);
});

test("a group captured on a peer pair travels as map, manifest and plan, runs its own pair and returns the frames [k2 property]", () => {
  const home = process.env.HOME ?? "/home/tom";
  const steps = remoteInvocations({
    slot: { host: "whiterabbit", pair: 3 }, batch: "b1", index: 2, directory: `${home}/q/b1`, map: `${home}/q/b1/g2.w3x`, manifest: `${home}/q/b1/g2.captures.json`, plan: `${home}/q/b1/plan-2.json`,
    minutes: 4, clientsFile: `${home}/.local/state/wisp/lan/clients.json`, desktop: `${home}/code/north/main/pd.sh`, capacity: `${home}/code/north/main/mc.mjs`, install: `${home}/.local/share/wisp/lan/clients/lan3a/pfx/drive_c/Program Files (x86)/Warcraft III`,
  }, `${home}/q/b1/plan-2.json.remote`);
  const run = steps[4]?.at(-1) ?? "";
  expect(run).toContain("--pair 3");
  expect(run).toContain('--client lan3a');
  expect(run).toContain('--install "$HOME/.local/share/wisp/lan/clients/lan3a/pfx/drive_c/Program Files (x86)/Warcraft III"');
  expect(steps[1]?.at(-1)).toBe("whiterabbit:.local/state/smashcraft/capture-queue/b1-g2/");
  expect(steps[5]?.slice(-2)).toEqual(["whiterabbit:.local/state/smashcraft/capture-queue/b1-g2/native/", `${home}/q/b1/native-2/`]);
});
