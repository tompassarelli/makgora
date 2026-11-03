import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const FORMERLY = /formerly called Smashcraft/g;
const OLD_NAME = /smashcraft(?!-client\b)/i;
const LINK = /\]\(([^)\s]+)\)/g;

export const readmeProblems = (text: string, exists: (path: string) => boolean): string[] => {
  const problems: string[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    if (OLD_NAME.test(line.replace(FORMERLY, ""))) problems.push(`README.md:${index + 1} still says Smashcraft; the game is Mak'gora (one "formerly called Smashcraft" mention is allowed)`);
    for (const [, target = ""] of line.matchAll(LINK)) {
      if (/^([a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
      const path = decodeURIComponent(target.split("#")[0] ?? "");
      if (path !== "" && !exists(path)) problems.push(`README.md:${index + 1} links ${target}, which is not in the tree`);
    }
  }
  return problems;
};

if (import.meta.main) {
  const repository = resolve(import.meta.dir, "../..");
  const problems = readmeProblems(readFileSync(resolve(repository, "README.md"), "utf8"), (path) => existsSync(resolve(repository, path)));
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}
