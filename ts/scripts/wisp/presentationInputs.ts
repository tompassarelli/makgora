import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const PRESENTATION_MAP = "Smashcraft diagnostic native presentation.w3x";
const INPUT_SET = /^native-acceptance-\d{8}(-[0-9a-f]{7,40})?$/;

const complete = (dir: string) => existsSync(join(dir, PRESENTATION_MAP)) && existsSync(join(dir, `${PRESENTATION_MAP}.base.lua`));

export const newestPresentation = (inputs: string): string => {
  const sets = existsSync(inputs) ? readdirSync(inputs).filter(name => INPUT_SET.test(name)).map(name => join(inputs, name)).filter(complete) : [];
  const built = (dir: string) => statSync(join(dir, PRESENTATION_MAP)).mtimeMs;
  const newest = sets.sort((a, b) => built(b) - built(a))[0];
  return join(newest ?? join(inputs, "native-acceptance-YYYYMMDD-SHA"), PRESENTATION_MAP);
};
