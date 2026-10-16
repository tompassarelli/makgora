import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stateHome } from "wisp/scripts/wisp/xdg";

export interface PairClaim {
  readonly pair: number;
  readonly owner: string;
  readonly session: string;
  readonly pid: number;
}

export const pairClaimPath = (pair: number) => join(stateHome(), "wisp/lan", `pair-${pair}`, "claim.json");

const readClaimAt = (path: string): PairClaim | undefined => {
  if (!existsSync(path)) return undefined;
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as Partial<PairClaim>;
    return Number.isInteger(value.pair) && typeof value.owner === "string" && typeof value.session === "string" && Number.isInteger(value.pid)
      ? value as PairClaim
      : undefined;
  } catch {
    return undefined;
  }
};
const readClaim = (pair: number): PairClaim | undefined => readClaimAt(pairClaimPath(pair));

export const processIsAlive = (pid: number, signal: (pid: number, signal: 0) => void = process.kill) => {
  try { signal(pid, 0); return true; } catch (cause) { return (cause as NodeJS.ErrnoException).code === "EPERM"; }
};

export const claimPairAt = (path: string, pair: number, owner: string, session: string, pid: number, alive = processIsAlive, log = (line: string) => console.error(line)): PairClaim => {
  if (!Number.isInteger(pair) || pair < 0) throw new Error("--pair takes a non-negative pair number");
  if (owner.trim() === "" || session.trim() === "") throw new Error("pair claims require an owner and NORTH_FLEET_SESSION");
  mkdirSync(join(path, ".."), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = readClaimAt(path);
    if (current !== undefined) {
      if (alive(current.pid)) {
        if (current.session === session && current.pid === pid) {
          const updated = { ...current, owner };
          writeFileSync(path, `${JSON.stringify(updated)}\n`, { mode: 0o600 });
          return updated;
        }
        if (current.session === session) return current;
        throw new Error(`pair ${pair} is held by ${current.owner} (fleet session ${current.session}, pid ${current.pid})`);
      }
      const stale = `${path}.dead-${current.pid}-${process.pid}`;
      try {
        renameSync(path, stale);
        log(`pair ${pair}: taking over dead claim from ${current.owner} (fleet session ${current.session}, pid ${current.pid})`);
        unlinkSync(stale);
      } catch {
        continue;
      }
    }
    const claim = { pair, owner, session, pid } satisfies PairClaim;
    try {
      const fd = openSync(path, "wx", 0o600);
      try { writeFileSync(fd, `${JSON.stringify(claim)}\n`); } finally { closeSync(fd); }
      return claim;
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "EEXIST") throw cause;
    }
  }
  throw new Error(`pair ${pair} claim changed during acquisition; retry`);
};

export const claimPair = (pair: number, owner: string, session: string, pid = process.pid): PairClaim => claimPairAt(pairClaimPath(pair), pair, owner, session, pid);

export const readPairClaim = (pair: number): PairClaim | undefined => readClaim(pair);

export const assertPairClaim = (pair: number, session: string): PairClaim => {
  const claim = readClaim(pair);
  if (claim === undefined || !processIsAlive(claim.pid)) throw new Error(`pair ${pair} has no live claim; start or claim its pool first`);
  if (claim.session !== session) throw new Error(`pair ${pair} is held by ${claim.owner} (fleet session ${claim.session}, pid ${claim.pid})`);
  return claim;
};

export const releasePair = (pair: number, session: string): void => {
  const claim = readClaim(pair);
  if (claim === undefined) return;
  if (claim.session !== session && processIsAlive(claim.pid)) throw new Error(`pair ${pair} is held by ${claim.owner} (fleet session ${claim.session}, pid ${claim.pid})`);
  unlinkSync(pairClaimPath(pair));
};
