import { assertEquals, test } from "wisp/src/runtime/testing";
import { Phase } from "../../game/lobby/lobbyState";
import { announcePlaying } from "./nativePlaying";
import type { ShellState } from "./state";

const host = globalThis as unknown as { WispSetPlaying?: ((playing: boolean) => void) | undefined };

function shell(): { readonly at: (phase: number) => void } {
  const s = { game: { phase: Phase.characterMenu } } as unknown as ShellState;
  return { at: (phase) => { s.game.phase = phase as typeof s.game.phase; announcePlaying(s); } };
}

test("a native window without WispSetPlaying plays a match without error [k1 scenario]", () => {
  host.WispSetPlaying = undefined;
  const { at } = shell();
  at(Phase.match);
  at(Phase.characterMenu);
});
