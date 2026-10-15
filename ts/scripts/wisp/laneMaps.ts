import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { Option, Schema } from "effect";
import { LANE_TRAILER } from "../sheriff";
import { LANE_FILE } from "./greenBuilds";

const LaneRecord = Schema.fromJsonString(Schema.Struct({ branch: Schema.String }));

export const laneSlug = (branch: string) =>
  (branch.split("/").at(-1) ?? "").replace(/^land-/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const laneMapTitle = (version: string, slug: string) => `Smashcraft ${version}-${slug}`;

const library = (documents: string) => join(documents, "Maps/00-Smashcraft");

export function removeLaneMaps(documents: string, slugs: readonly string[], keep?: string): string[] {
  const root = library(documents);
  return [root, join(root, "tests"), join(root, "older")].flatMap((folder) => existsSync(folder) ? readdirSync(folder).map((entry) => join(folder, entry)) : [])
    .filter((path) => path !== keep && slugs.includes(LANE_FILE.exec(basename(path))?.[2] ?? ""))
    .map((path) => {
      rmSync(path, { force: true });
      return path;
    });
}

export function installLaneMap(documents: string, map: string, slug: string): string {
  const name = basename(map);
  if (LANE_FILE.exec(name)?.[2] !== slug) throw new Error(`not a map of lane ${slug}: ${name}`);
  const root = library(documents);
  mkdirSync(root, { recursive: true });
  const target = join(root, name);
  const staged = `${target}.${process.pid}.next`;
  copyFileSync(map, staged);
  renameSync(staged, target);
  removeLaneMaps(documents, [slug], target);
  return target;
}

export const landedBranches = (messages: string): string[] => messages.split("\n")
  .filter((line) => line.startsWith(LANE_TRAILER))
  .flatMap((line) => Option.toArray(Schema.decodeOption(LaneRecord)(line.slice(LANE_TRAILER.length).trim())).map(({ branch }) => branch));
