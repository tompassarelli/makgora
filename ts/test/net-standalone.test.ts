import { expect, test } from "bun:test";
import type { LinkEvent, LockstepLink } from "wisp/src/headless/lockstep";
import { createNetStandalone } from "../scripts/wisp/net";
import { Phase } from "../src/game/lobby/lobbyState";
import { shell } from "../src/host/loop/state";

function loopback(): LockstepLink {
  const queued = new Map<number, LinkEvent[]>();
  return {
    delay: 1,
    sent: (frame, event) => { queued.set(frame, [...(queued.get(frame) ?? []), event]); },
    due: (frame) => queued.get(frame) ?? [],
  };
}

test("a net player whose pad skips straight to the match with -dev quick plays on past fighter selection instead of looking for the Controls screen's Done button [k1 scenario]", async () => {
  const session = await createNetStandalone(loopback(), 0, 2, { script: "#! chat -dev quick stage 14 pair grom hellscream / thrall\n40 a stick 1 0\n" });
  try {
    session.start();
    for (let frame = 0; frame < 60; frame++) session.step();
    let phase = -1;
    session.client.run(() => { phase = shell().game.phase; });
    expect(phase).toBe(Phase.match);
  } finally {
    session.close();
  }
});
