import { basename } from "node:path";
import { LANE_FILE } from "./greenBuilds";
import { installTryout } from "./mapLibrary";

export const laneSlug = (branch: string) =>
  (branch.split("/").at(-1) ?? "").replace(/^land-/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const laneMapTitle = (version: string, slug: string) => `Smashcraft ${version}-${slug}`;

export function installLaneMap(documents: string, map: string, slug: string): string {
  const name = basename(map);
  if (LANE_FILE.exec(name)?.[2] !== slug) throw new Error(`not a map of lane ${slug}: ${name}`);
  return installTryout(documents, map);
}
