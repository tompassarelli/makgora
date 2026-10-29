import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { agentSocket } from "wisp/scripts/wisp/lan/pool";
import { pairAgentStatus } from "../scripts/pairAgentStatus";

test("a pair's status comes from its agent socket inside this process, and a pair with no agent fails [k5 boundary pair-agent-status]", async () => {
  const previous = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = mkdtempSync(join(tmpdir(), "pair-status-"));
  try {
    mkdirSync(join(process.env.XDG_STATE_HOME, "wisp/lan/pair-9"), { recursive: true });
    const server = Bun.serve({ unix: agentSocket(9), fetch: () => Response.json({ clients: [{ name: "lan9a", pid: 1 }] }) });
    try {
      expect(JSON.parse(await Effect.runPromise(pairAgentStatus(9)))).toEqual({ clients: [{ name: "lan9a", pid: 1 }] });
    } finally {
      await server.stop(true);
    }
    await expect(Effect.runPromise(pairAgentStatus(8))).rejects.toThrow("pair 8's agent");
  } finally {
    if (previous === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = previous;
  }
});
