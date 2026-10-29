import { hostname } from "node:os";
import { Effect } from "effect";

const LAPTOP = "whiterabbit";
const BIG_HOST = "gex45";

export const peerOf = (local: string) => (local === BIG_HOST ? LAPTOP : BIG_HOST);

export const pairsOf = (installs: readonly string[]) => {
  const names = new Set(installs);
  return [...names].flatMap(name => /^lan(\d+)a$/.exec(name)?.[1] ?? []).map(Number).filter(pair => names.has(`lan${pair}b`)).sort((left, right) => left - right);
};

export const pairRemoteSpec = (peer: string, pairs: readonly number[]) => (pairs.length === 0 ? "" : `${peer}=${pairs.join(",")}`);

export const peerSpec = Effect.promise(async () => {
  const given = process.env.WISP_PAIR_REMOTE;
  if (given !== undefined) return given;
  const peer = peerOf(hostname());
  const run = Bun.spawn(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "--", peer, "ls ~/.local/share/wisp/lan/clients"], { stdin: "ignore", stdout: "pipe", stderr: "ignore" });
  const text = await new Response(run.stdout).text();
  return await run.exited === 0 ? pairRemoteSpec(peer, pairsOf(text.split("\n"))) : "";
}).pipe(Effect.orElseSucceed(() => ""));
