import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const PRESENTATION_MAP = "Smashcraft diagnostic native presentation.w3x";
const INPUT_SET = /^native-acceptance-\d{8}$/;

const complete = (dir: string) => existsSync(join(dir, PRESENTATION_MAP)) && existsSync(join(dir, `${PRESENTATION_MAP}.base.lua`));

export const newestPresentation = (inputs: string): string => {
  const names = existsSync(inputs) ? readdirSync(inputs).filter(name => INPUT_SET.test(name)).sort().reverse() : [];
  const newest = names.find(name => complete(join(inputs, name)));
  return join(inputs, newest ?? "native-acceptance-YYYYMMDD", PRESENTATION_MAP);
};
