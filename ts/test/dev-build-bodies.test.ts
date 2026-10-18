import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { captureScene } from "wisp/scripts/wisp/headlessRender";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { renderAssetStore } from "../scripts/wisp/renderAssetStore";
import { install, startBuild } from "../src/platform/main";
import { CURRENT_BUILD } from "../src/game/session/currentBuild";
import { FIGHTER_OBJECTS } from "../src/game/objectData";
import { Character } from "../src/game/sim/codes";
import { FIGHTER_ART } from "../src/generated/fighterArtData";
import { originalClip, originalClipCount } from "../src/generated/clips/fighterOriginalClipInfo";

const clipBodies = (character: Character) => new Set(Array.from({ length: originalClipCount(character) }, (_, index) => originalClip(character, index)?.modelPath));

test("a dev-build match draws each fighter with its imported clip-pool body, never its unit's stock model [k1 scenario]", () => {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install: () => install(CURRENT_BUILD), start: () => startBuild(CURRENT_BUILD) }, [0, 1], { keepCalls: 0 });
    clients.start();
    clients.frames(30);
    clients.chat(0, "-dev quick pair Dreadlord / Kobold");
    clients.frames(90);
    const scene = captureScene(clients.client(0), { visibleOnly: true });
    const fighterTypes = new Set(Object.values(FIGHTER_OBJECTS).map(({ id }) => id));
    expect(scene.units.filter((unit) => unit.visible && fighterTypes.has(unit.typeId)).map((unit) => unit.typeId)).toEqual([]);
    for (const character of [Character.dreadlord, Character.kobold]) {
      const bodies = clipBodies(character);
      const drawn = scene.effects.filter((effect) => bodies.has(effect.model)).map((effect) => effect.model);
      expect(drawn).toHaveLength(1);
      expect(drawn[0]).toMatch(/^war3mapImported\\/);
    }
    for (const client of clients.clients) expect(client.errors).toEqual([]);
  } finally {
    runtime.restore();
  }
});

test("the render store serves a fighter's stock unit path only from stock storage, not from an authored source the map never imports [k5 boundary render-store]", async () => {
  const root = mkdtempSync(join(tmpdir(), "dev-build-bodies-"));
  try {
    const storage = join(root, "storage"), assets = join(root, "assets"), extractor = join(root, "casc-extract");
    mkdirSync(storage);
    writeFileSync(join(storage, ".build.info"), "Branch!STRING:0|Active!DEC:1|Version!STRING:0\nus|1|2.0.3\n");
    writeFileSync(extractor, "#!/bin/sh\necho \"open asset failed: 2\" >&2\nexit 1\n", { mode: 0o755 });
    const art = [...FIGHTER_ART.values()].filter((entry) => entry.model !== undefined);
    expect(art.length).toBeGreaterThan(0);
    for (const { source } of art) {
      mkdirSync(join(assets, source, ".."), { recursive: true });
      writeFileSync(join(assets, source), "authored source");
    }
    const body = join(root, "body.mdx");
    writeFileSync(body, "timeline body");
    const entry = "war3mapImported\\DreadlordTimelineBody-0.mdx";
    const store = renderAssetStore({ storage, extractor, cache: join(root, "cache"), assets, imports: [{ entry, source: body }] });
    for (const { model } of art) expect(new TextDecoder().decode((await store.resolveAsset(model ?? "")).bytes ?? new Uint8Array())).not.toBe("authored source");
    expect(new TextDecoder().decode(await store.readAsset(entry))).toBe("timeline body");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
