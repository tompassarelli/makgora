import { expect, test } from "bun:test";
import { captureFrame } from "../src/game/match/frameInput";
import { Character } from "../src/game/sim/codes";
import { requestStageSelect, selectCharacter, setParticipants } from "../src/game/lobby/lobbyState";
import { startAtGo } from "../src/game/match/testMatch";
import { copyControls, fighterAt, neutralControls } from "../src/game/sim/roster";
import { install, start } from "../src/platform/main";
import { applyFrame } from "../src/host/loop/frame";
import { startInputTrace } from "../src/host/loop/diagnostics";
import { startMatch } from "../src/host/loop/matchStart";
import { shell } from "../src/host/loop/state";
import { VOICE_CAP } from "../src/game/presentation/voiceBudget";
import { testHeadless } from "./headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("a four-fighter trace writes one voice line per admitted sound with the live count under the cap [k1 scenario]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const client = clients.client(0);
  client.run(() => {
    const s = shell();
    const roster = [Character.demonHunter, Character.rifleman, Character.demonHunter, Character.rifleman];
    setParticipants(s.game, 15, 0);
    roster.forEach((character, slot) => selectCharacter(s.game, slot, character));
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(startAtGo(s.game, 0)).toBe(true);
    startMatch(s);
    startInputTrace(s);
    for (let slot = 0; slot < 4; slot++) { const f = fighterAt(s.world, slot); f.motion.x = slot < 2 ? -40 + slot * 40 : 0 + (slot - 2) * 40; f.facing = slot % 2 === 0 ? 1 : -1; }
    for (let tick = 1; tick <= 600; tick++) {
      for (const input of s.produced.inputs) copyControls(input, neutralControls());
      for (const input of s.produced.inputs) { input.attackPressed = input.attackRequested = tick % 7 === 0; input.specialPressed = tick % 31 === 0; }
      expect(captureFrame(s.frameInput, tick, s.world.mask, s.produced, s.runtime)).toBe(true);
      applyFrame(s);
    }
    const lines = s.trace.lines.filter(line => /^\d+ \S+ frame \d+ class \d slot \d+ live \d+$/.test(line));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(Number(line.split(" live ")[1])).toBeLessThanOrEqual(VOICE_CAP);
    expect(lines.some(line => /class 2 /.test(line))).toBe(true);
  });
  expect(client.errors).toEqual([]);
});
