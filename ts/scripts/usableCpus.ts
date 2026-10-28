import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";

/**
 * The CPUs this process may use: the tightest cgroup v2 `cpu.max` quota on its
 * path (a capacity scope's CPUQuota), else every core it may run on.
 */
export function usableCpus(): number {
  let cpus = availableParallelism();
  let group: string | undefined;
  try {
    group = readFileSync("/proc/self/cgroup", "utf8").split("\n").find((line) => line.startsWith("0::"))?.slice(3);
  } catch {
    return cpus;
  }
  for (let dir = group; dir !== undefined && dir !== "/" && dir !== ""; dir = dirname(dir)) {
    try {
      const [quota, period] = readFileSync(join("/sys/fs/cgroup", dir, "cpu.max"), "utf8").trim().split(" ");
      if (quota !== undefined && quota !== "max" && Number(period) > 0) cpus = Math.min(cpus, Number(quota) / Number(period));
    } catch {
      // No cpu controller at this level.
    }
  }
  return Math.max(1, Math.floor(cpus));
}
