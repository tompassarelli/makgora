import { expect, test } from "bun:test";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../src/game/input/participants";
import { Phase, fighterColor, humanFighterActive } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { FighterMarker } from "../src/game/ui/fighterMarker";
import { colourCode, damageText, percentText } from "../src/game/ui/plateLayout";
import { slotColor } from "../src/game/ui/slotColors";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { install, startBuild } from "../src/platform/main";
import { shellState } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

type HeadlessClient = ReturnType<ReturnType<typeof headless.clients>["client"]>;
type Rectangle = NonNullable<ReturnType<HeadlessClient["frames"]["snapshot"]>[number]["rectangle"]>;

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-fighter-marker", devConsole: true };
const LOBBY_FRAMES = 600;
const MATCH_FRAMES = 120;
const SAMPLE_EVERY = 4;
const CLOSE = 40.0;

interface Seen { readonly checksum: string; readonly spread: number; readonly close: number }

const EDGE = 1e-6;

const disjoint = ([left, top, right, bottom]: Rectangle, [otherLeft, otherTop, otherRight, otherBottom]: Rectangle): boolean =>
  right <= otherLeft + EDGE || otherRight <= left + EDGE || bottom >= otherTop - EDGE || otherBottom >= top - EDGE;

function slotsIn(client: HeadlessClient): ParticipantSlot[] {
  let slots: ParticipantSlot[] = [];
  client.run(() => {
    const s = shellState();
    if (s !== undefined) slots = PARTICIPANT_SLOTS.filter(slot => isActive(s.world, slot));
  });
  return slots;
}

function playMatch(markers: boolean): Seen {
  const update = FighterMarker.prototype.update;
  if (!markers) FighterMarker.prototype.update = () => undefined;
  try {
    const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0]);
    const client = clients.client(0);
    clients.start();
    clients.frames(120);
    clients.chat(0, "-dev quick cpu wren expert hero rifleman");
    let phase = -1;
    for (let frame = 0; frame < LOBBY_FRAMES && phase !== Phase.match; frame++) {
      clients.frames(1);
      client.run(() => { phase = shellState()?.game.phase ?? -1; });
    }
    expect(phase).toBe(Phase.match);
    clients.frames(60);
    const [first, second] = slotsIn(client);
    if (first === undefined || second === undefined) throw new Error("two fighters expected");
    clients.chat(0, `-dev percent ${first + 1} 37`);
    clients.chat(0, `-dev percent ${second + 1} 124`);
    clients.chat(0, `-dev beside ${first + 1} ${second + 1}`);
    let spread = 0, close = 0;
    for (let frame = 0; frame < MATCH_FRAMES; frame++) {
      clients.frames(1);
      if (!markers || frame % SAMPLE_EVERY !== 0) continue;
      let apart = 0.0;
      client.run(() => {
        const s = shellState();
        if (s !== undefined) apart = Math.abs(fighterAt(s.world, first).motion.x - fighterAt(s.world, second).motion.x);
      });
      const roots = client.frames.snapshot({ visibleOnly: true }).filter(frame => frame.name === `FighterMarker${first}` || frame.name === `FighterMarker${second}`);
      if (roots.length < 2) continue;
      const [a, b] = roots.map(root => root.rectangle);
      if (a === undefined || b === undefined) throw new Error("marker roots are placed");
      if (apart < CLOSE) close++;
      expect(disjoint(a, b)).toBe(true);
      if (frame === 8) console.log("RECTS", JSON.stringify(a), JSON.stringify(b), apart);
      spread++;
    }
    if (markers) expectMarkerText(client, first);
    expect(client.errors).toEqual([]);
    let checksum = "";
    client.run(() => {
      const s = shellState();
      if (s !== undefined) checksum = confirmedChecksum(s);
    });
    return { checksum, spread, close };
  } finally {
    FighterMarker.prototype.update = update;
  }
}

function expectMarkerText(client: HeadlessClient, slot: ParticipantSlot): void {
  let damage = 0.0, color = -1, human = false;
  client.run(() => {
    const s = shellState();
    if (s === undefined) return;
    damage = fighterAt(s.world, slot).status.damage;
    color = fighterColor(s.game, slot);
    human = humanFighterActive(s.game, slot);
  });
  const named = (name: string) => client.frames.snapshot({ visibleOnly: true }).find(frame => frame.name === `${name}${slot}`);
  expect(named("FighterMarkerDamage")?.text).toBe(damageText(damage));
  expect(named("FighterMarkerPercent")?.text).toBe(percentText(damage));
  expect(named("FighterMarkerName")?.text).toBe(`${colourCode(slotColor(color).rgb)}${human ? "Player 1" : "CPU"}|r`);
  expect(named("FighterMarkerArrow")?.texture).toBe(`war3mapImported\\MarkerArrow${color}.tga`);
}

test("a CPU match shows each fighter's marker with the HUD's whole percent and colour, its slot's name and colour, keeps close fighters' markers a marker apart, and leaves the simulated state byte-identical [k1 scenario]", () => {
  const shown = playMatch(true);
  const hidden = playMatch(false);
  expect(shown.spread).toBeGreaterThan(MATCH_FRAMES / SAMPLE_EVERY / 2);
  expect(shown.close).toBeGreaterThan(0);
  expect(shown.checksum).not.toBe("");
  expect(shown.checksum).toBe(hidden.checksum);
});
