import { hintsKeyFree, toggleNewPlayerHints } from "../../game/ui/bindingSettings";
import { PAD_PRESENT_KEY } from "../../game/input/padCapture";
import type { HintDevice } from "../../game/ui/hintLines";
import { osKeyDown } from "../../platform/osKeys";
import { isParticipantSlot } from "../../game/input/participants";
import { Phase, humanActive } from "../../game/lobby/lobbyState";
import { warcraftChatOpen } from "../../platform/editboxJournal";
import { localParticipantSlot } from "./diagnostics";
import { type ShellState, localSlot } from "./state";
import { views } from "./ui";
import { eventPlayer, playerSlot } from "wisp/game/players";

export function localHints(s: Readonly<ShellState>): boolean {
  const local = localParticipantSlot(s);
  return local !== undefined && s.participants[local].bindings.hints;
}

// Capture maps play pads inside the map, so -dev hints chooses the look there instead of reading the connected controller.
export function localDevice(s: Readonly<ShellState>): HintDevice {
  return s.dev.hintsLook ?? (BlzIsLocalClientActive() && osKeyDown(PAD_PRESENT_KEY) ? "pad" : "keyboard");
}

export function localHintsKey(s: Readonly<ShellState>): boolean {
  const local = localParticipantSlot(s);
  return local !== undefined && hintsKeyFree(s.participants[local].bindings);
}

export function onHintsKeyDown(s: ShellState): void {
  const slot = playerSlot(eventPlayer());
  if (!isParticipantSlot(slot) || slot !== localSlot() || s.game.phase !== Phase.match || !humanActive(s.game, slot)) return;
  if (s.chatOpen?.() ?? warcraftChatOpen(s.chatFrame)) return;
  const settings = s.participants[slot].bindings;
  if (!hintsKeyFree(settings) || views(s).settings[slot].isOpen()) return;
  toggleNewPlayerHints(settings);
}
