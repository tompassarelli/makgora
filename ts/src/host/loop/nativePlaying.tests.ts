import { assertEquals, test } from "wisp/src/runtime/testing";
import { Phase } from "../../game/lobby/lobbyState";
import { announcePlaying } from "./nativePlaying";
import type { ShellState } from "./state";

const host = globalThis as unknown as { WispSetPlaying?: ((playing: boolean) => void) | undefined };

function shell(): { readonly at: (phase: number) => void } {
  const s = { game: { phase: Phase.characterMenu } } as unknown as ShellState;
  return { at: (phase) => { s.game.phase = phase as typeof s.game.phase; announcePlaying(s); } };
}

test("the window hears playing once when a match starts and not-playing once when the menus return, nothing between [k1 scenario]", () => {
  const calls: boolean[] = [];
  host.WispSetPlaying = (playing) => { calls.push(playing); };
  const { at } = shell();
  at(Phase.characterMenu);
  at(Phase.stageMenu);
  assertEquals(calls.length, 1);
  assertEquals(calls[0], false);
  at(Phase.match);
  at(Phase.match);
  at(Phase.result);
  assertEquals(calls.length, 2);
  assertEquals(calls[1], true);
  at(Phase.characterMenu);
  at(Phase.characterMenu);
  assertEquals(calls.length, 3);
  assertEquals(calls[2], false);
  host.WispSetPlaying = undefined;
});

test("a native window without WispSetPlaying plays a match without error [k1 scenario]", () => {
  host.WispSetPlaying = undefined;
  const { at } = shell();
  at(Phase.match);
  at(Phase.characterMenu);
});
