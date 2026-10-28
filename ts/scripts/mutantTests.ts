import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import ts from "typescript";
import * as tstl from "typescript-to-lua";
import { getPlugins } from "typescript-to-lua/dist/transpilation/plugins";
import { luaTestIndex } from "./luaTestIndex";
import { stockLua } from "./wisp/luaRuntimes";

type Verdict = "pass" | "fail";
type Results = Map<string, Verdict>;

const lines = (text: string | undefined) => (text ?? "").split("\n").filter((line) => line !== "");
const names = lines(process.env.MUTANT_TESTS);
const trees = lines(process.env.MUTANT_TREES).map((tree) => resolve(tree));
const change = trees[0];
if (change === undefined || names.length === 0) throw new Error("MUTANT_TREES and MUTANT_TESTS must each name at least one entry");
const project = (tree: string) => join(tree, "ts");
const results = new Map<string, Results>(trees.map((tree) => [tree, new Map()]));

const literals = (name: string) => ['"', "'"].map((quote) => quote + name.replaceAll("\\", "\\\\").replaceAll(quote, `\\${quote}`) + quote);
const testFiles = (pattern: string, ignore: (file: string) => boolean) => [...new Bun.Glob(pattern).scanSync(project(change))].filter((file) => !ignore(file)).sort();
const declaring = (files: readonly string[]) => {
  const texts = new Map(files.map((file) => [file, readFileSync(join(project(change), file), "utf8")]));
  return (name: string) => files.filter((file) => literals(name).some((literal) => texts.get(file)!.includes(literal)));
};
const gameModulesOf = declaring(testFiles("src/**/*.tests.ts", () => false));
const hostFiles = testFiles("**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}",
  (file) => file.startsWith("build/") || file.split("/").some((part) => part === "node_modules" || part === ".git"));
const hostFilesOf = declaring(hostFiles);
const filesNamed = (name: string) => hostFiles.filter((file) => basename(file) === name);
const fileNames = names.filter((name) => filesNamed(name).length > 0);
const gameNames = names.filter((name) => !fileNames.includes(name) && gameModulesOf(name).length > 0);
const hostNames = names.filter((name) => !fileNames.includes(name) && !gameNames.includes(name) && hostFilesOf(name).length > 0);
for (const name of names.filter((name) => !fileNames.includes(name) && !gameNames.includes(name) && !hostNames.includes(name))) {
  console.log(`mutant tests: no game or host test file declares ${JSON.stringify(name)}`);
}

class VariantTranspiler extends tstl.Transpiler {
  plan(program: ts.Program, diagnostics: ts.Diagnostic[], files: tstl.ProcessedFile[], plugins: tstl.Plugin[]) {
    return this.getEmitPlan(program, diagnostics, files, plugins).emitPlan;
  }
}

const exportSurface = (program: ts.Program, file: ts.SourceFile) => {
  const checker = program.getTypeChecker();
  const module = checker.getSymbolAtLocation(file);
  if (module === undefined || /\bdeclare\s+global\b/.test(file.text)) return undefined;
  return checker.getExportsOfModule(module).map((exported) => {
    const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declarations = symbol.declarations ?? [];
    const value = symbol.flags & ts.SymbolFlags.Value && !(symbol.flags & (ts.SymbolFlags.Enum | ts.SymbolFlags.Class))
      ? checker.typeToString(checker.getBaseTypeOfLiteralType(checker.getTypeOfSymbol(symbol)), undefined, ts.TypeFormatFlags.NoTruncation)
      : declarations.map((declaration) => declaration.getText()).join("\n");
    return `${exported.name}\0${symbol.flags}\0${value}`;
  }).join("\n");
};

const errors = (diagnostics: readonly ts.Diagnostic[]) => diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
const report = (tree: string, diagnostics: readonly ts.Diagnostic[]) => console.log(`mutant tests: ${tree} does not compile to Lua:\n${ts.formatDiagnostics(diagnostics, {
  getCanonicalFileName: (fileName) => fileName, getCurrentDirectory: () => project(change), getNewLine: () => "\n",
})}`);

const readText = (path: string) => existsSync(path) ? readFileSync(path, "utf8") : "";
const exitCode = (command: string, args: readonly string[], cwd: string, env?: Record<string, string | undefined>) => Effect.scoped(Effect.gen(function*() {
  const child = yield* ChildProcess.make(command, args, { cwd, stdout: "inherit", stderr: "inherit", ...(env === undefined ? {} : { env }) });
  return yield* child.exitCode;
}));

const luaRun = (lua: string, tree: string, namesFile: string) => Effect.gen(function*() {
  const resultFile = join(tree, ".mutant-lua-results");
  yield* exitCode(lua, ["build/lua-tests/tests.lua"], project(tree), { ...process.env, LUA_TEST_NAMES: namesFile, LUA_TEST_RESULT: resultFile });
  for (const line of lines(readText(resultFile))) {
    const [status, , ...name] = line.split("\t");
    if (status === "pass" || status === "fail") results.get(tree)!.set(name.join("\t"), status);
  }
});

const gameTests = Effect.gen(function*() {
  const modules = [...new Set(gameNames.flatMap(gameModulesOf))].sort();
  const changeProject = project(change);
  for (const tree of trees) writeFileSync(join(project(tree), "test/lua/index.ts"), luaTestIndex(modules));
  const namesFile = join(change, ".mutant-lua-names");
  writeFileSync(namesFile, `${gameNames.join("\n")}\n`);
  const lua = yield* stockLua;
  const config = tstl.parseConfigFileWithSystem(join(changeProject, "tsconfig.lua-tests.json"));
  const host = ts.createCompilerHost(config.options);
  const rootNames = config.fileNames.filter((file) => !file.endsWith(".tests.ts") || modules.some((module) => file === resolve(changeProject, module)));
  const clean = ts.createProgram({ rootNames, options: config.options, host });
  const { plugins } = getPlugins(clean);
  const transpiler = new VariantTranspiler();
  const transpile = (program: ts.Program, sourceFiles?: ts.SourceFile[]) =>
    tstl.getProgramTranspileResult(ts.sys, () => {}, { program, plugins, ...(sourceFiles === undefined ? {} : { sourceFiles }) });
  const emit = (tree: string, program: ts.Program, transpiled: tstl.TranspileResult) => {
    const diagnostics = [...config.errors, ...transpiled.diagnostics];
    const plan = errors(diagnostics).length > 0 ? [] : transpiler.plan(program, diagnostics, transpiled.transpiledFiles.map((file) => ({ ...file })), plugins);
    for (const plugin of plugins) diagnostics.push(...plugin.beforeEmit?.(program, program.getCompilerOptions(), ts.sys, plan) ?? []);
    if (errors(diagnostics).length > 0 || plan.length === 0) {
      report(tree, errors(diagnostics));
      return undefined;
    }
    for (const { outputPath, code } of plan) {
      const target = join(tree, outputPath.slice(change.length));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, code);
    }
    return luaRun(lua, tree, namesFile);
  };
  const cleanResult = transpile(clean);
  const cleanRun = emit(change, clean, cleanResult);
  if (cleanRun === undefined) return;
  const runs = [cleanRun];
  for (const tree of trees.slice(1)) {
    const inTree = (fileName: string) => fileName.startsWith(`${change}/`) ? join(tree, fileName.slice(change.length)) : fileName;
    const variantHost: ts.CompilerHost = {
      ...host,
      fileExists: (fileName) => host.fileExists(inTree(fileName)),
      readFile: (fileName) => host.readFile(inTree(fileName)),
      directoryExists: (directory) => host.directoryExists?.(inTree(directory)) ?? true,
      getSourceFile: (fileName, languageVersion) => {
        const old = clean.getSourceFile(fileName);
        if (old !== undefined && fileName.includes("/node_modules/")) return old;
        const text = host.readFile(inTree(fileName));
        if (text === undefined) return undefined;
        return old !== undefined && old.text === text ? old : ts.createSourceFile(fileName, text, languageVersion);
      },
    };
    const variant = ts.createProgram({ rootNames, options: config.options, host: variantHost, oldProgram: clean });
    const changed = variant.getSourceFiles().filter((file) => clean.getSourceFile(file.fileName) !== file);
    const local = changed.every((file) => {
      const old = clean.getSourceFile(file.fileName);
      const before = old === undefined ? undefined : exportSurface(clean, old);
      return before !== undefined && before === exportSurface(variant, file);
    });
    const fresh = transpile(variant, local ? changed : undefined);
    const replaced = new Map(fresh.transpiledFiles.map((file) => [file.fileName, file]));
    const transpiled = local
      ? { diagnostics: fresh.diagnostics, transpiledFiles: cleanResult.transpiledFiles.map((file) => replaced.get(file.fileName) ?? file) }
      : fresh;
    console.log(`mutant tests: ${tree} changes ${changed.map((file) => file.fileName.slice(changeProject.length + 1)).join(", ") || "no compiled file"}; ${local ? "re-emitted those files" : "re-emitted every file"}`);
    runs.push(emit(tree, variant, transpiled) ?? Effect.void);
  }
  yield* Effect.all(runs, { concurrency: "unbounded" });
});

const xmlText = (text: string) => text.replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const testCases = (junit: string) => [...readText(junit).matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)]
  .map(([, attributes = "", body = ""]) => ({
    name: xmlText(/\bname="([^"]*)"/.exec(attributes)?.[1] ?? ""),
    file: basename(xmlText(/\bfile="([^"]*)"/.exec(attributes)?.[1] ?? "")),
    verdict: /<skipped\b/.test(body) ? undefined : /<(failure|error)\b/.test(body) ? "fail" as const : "pass" as const,
  }));
const hostTests = (tree: string) => Effect.gen(function*() {
  const whole = [...new Set(fileNames.flatMap(filesNamed))];
  const titled = [...new Set(hostNames.flatMap(hostFilesOf))].filter((file) => !whole.includes(file));
  const pattern = hostNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const cases: ReturnType<typeof testCases> = [];
  for (const [kind, files, filter] of [["titled", titled, ["-t", pattern]], ["files", whole, []]] as const) {
    if (files.length === 0) continue;
    const junit = join(tree, `.mutant-${kind}-junit.xml`);
    yield* exitCode(process.execPath, ["test", "--reporter=junit", `--reporter-outfile=${junit}`, ...filter, ...files], project(tree));
    cases.push(...testCases(junit));
  }
  for (const { name, verdict } of cases) if (hostNames.includes(name) && verdict !== undefined) results.get(tree)!.set(name, verdict);
  for (const name of fileNames) {
    const verdicts = cases.filter((test) => test.file === name).map((test) => test.verdict);
    if (verdicts.includes("fail")) results.get(tree)!.set(name, "fail");
    else if (verdicts.includes("pass")) results.get(tree)!.set(name, "pass");
  }
});

BunRuntime.runMain(Effect.gen(function*() {
  yield* Effect.all([
    ...(gameNames.length > 0 ? [gameTests] : []),
    ...(hostNames.length > 0 || fileNames.length > 0 ? trees.map(hostTests) : []),
  ], { concurrency: "unbounded" });
  for (const [tree, verdicts] of results) {
    writeFileSync(join(tree, ".mutant-results"), [...verdicts].map(([name, verdict]) => `${verdict}\t${name}\n`).join(""));
  }
}).pipe(Effect.provide(BunServices.layer)));
