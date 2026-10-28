export const luaTestIndex = (modules: readonly string[]): string => [
  'import { registeredTests } from "wisp/src/runtime/testing";',
  "export const testModules: [number, string][] = [];",
  "const mark = (module: string): void => {",
  "  testModules.push([registeredTests.length, module]);",
  "};",
  ...modules.map((module) => `mark("${module}");\nrequire("../../${module.replace(/\.ts$/, "")}");`),
  "",
].join("\n");
