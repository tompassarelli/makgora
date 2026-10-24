import { mkdirSync, mkdtempSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { type Family, INPUTS_STORE, hashTree, publish, removeTree, seal } from "./buildInputs";

export type Fetched = "fetched" | "absent";

const ABSENT = 3;

const REMOTE_STORE = relative(homedir(), INPUTS_STORE);

export async function fetchEntry(host: string, family: Family, hash: string, store = INPUTS_STORE): Promise<Fetched> {
  const parent = join(store, family);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, ".fetch-"));
  try {
    const remote = Bun.spawn(["ssh", "-o", "BatchMode=yes", "--", host, `cd ${REMOTE_STORE}/${family} 2>/dev/null && test -d ${hash} || exit ${ABSENT}; tar -cf - ${hash}`], { stdout: "pipe", stderr: "pipe" });
    const local = Bun.spawn(["tar", "-x", "--strip-components=1", "-C", staging], { stdin: remote.stdout, stderr: "pipe" });
    const [remoteCode, localCode] = await Promise.all([remote.exited, local.exited]);
    if (remoteCode === ABSENT) return "absent";
    if (remoteCode !== 0) throw new Error(`ssh ${host} exited ${remoteCode}: ${(await new Response(remote.stderr).text()).trim()}`);
    if (localCode !== 0) throw new Error(`tar exited ${localCode}: ${(await new Response(local.stderr).text()).trim()}`);
    const actual = await hashTree(staging);
    if (actual !== hash) throw new Error(`${family} ${hash} from ${host} hashes to ${actual}; ${host}'s copy was changed in place, so fetch it from another host or produce it again`);
    seal(staging);
    publish(staging, join(parent, hash));
    return "fetched";
  } finally {
    removeTree(staging);
  }
}
