import { Phase } from "../../game/lobby/lobbyState";
import type { ShellState } from "./state";

const announced = new WeakMap<ShellState, boolean>();

export function announcePlaying(s: ShellState): void {
  const playing = s.game.phase === Phase.match || s.game.phase === Phase.result;
  if (announced.get(s) === playing) return;
  announced.set(s, playing);
  WispSetPlaying(playing);
}
