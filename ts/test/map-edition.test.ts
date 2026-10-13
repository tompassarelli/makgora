import { expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { decodeBuildOptions, editionImports } from "../scripts/wisp/mapInputs";

test("package selection retains Classic resources and full editions across archive spellings [k2 property]", () => {
  const imports = Array.from({ length: 240 }, (_, index) => {
    const path = `war3mapImported\\asset-${index}.mdx`;
    const prefix = ["", "_hd.w3mod\\", "_de.w3mod/", "_HD.W3MOD/", "_DE.W3MOD\\", "war3mapImported\\_de.w3mod\\"][index % 6] ?? "";
    return { entry: prefix + path, source: `private/${index}` };
  });
  const expected = imports.filter((_, index) => index % 6 === 0 || index % 6 === 5);
  expect(editionImports(imports, "classic")).toEqual(expected);
  expect(editionImports(imports, "full")).toEqual(imports);
  expect(editionImports(editionImports(imports, "classic"), "classic")).toEqual(expected);
});

test("map build edition decodes explicit private and public choices and rejects unsupported values [k5 boundary map-build-options]", async () => {
  const args = ["--name", "Smashcraft diagnostic", "--out", "private.w3x"];
  expect((await Effect.runPromise(decodeBuildOptions(args, "classic"))).edition).toBe("classic");
  expect((await Effect.runPromise(decodeBuildOptions(args))).edition).toBe("full");
  for (const edition of ["classic", "full"] as const) {
    expect((await Effect.runPromise(decodeBuildOptions([...args, "--edition", edition], "classic"))).edition).toBe(edition);
  }
  expect(Exit.isFailure(await Effect.runPromiseExit(decodeBuildOptions([...args, "--edition", "unsupported"])))).toBe(true);
});
