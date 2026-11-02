import { toggleKeyboardPreview } from "../../game/ui/bindingSettings";
import { PAD_PRESENT_KEY } from "../../game/input/padCapture";
import type { HintDevice } from "../../game/ui/hintLines";
import { osKeyDown } from "../../platform/osKeys";
import { isParticipantSlot } from "../../game/input/participants";
import { Phase, humanActive } from "../../game/lobby/lobbyState";
import { warcraftChatOpen } from "../../platform/editboxJournal";
import { localParticipantSlot } from "./diagnostics";
import { type ShellState, localSlot } from "./state";
import { views } from "./ui";
import { windowFocused } from "wisp/game/input";
import { eventPlayer, playerSlot } from "wisp/game/players";

// Capture maps play pads inside the map, so -dev hints shows the preview in a chosen look, or hides it, instead of reading the player's setting and controller.
export function localPreview(s: Readonly<ShellState>): boolean {
  const local = localParticipantSlot(s);
  const look = s.dev.hintsLook;
  return local !== undefined && (look === undefined ? s.participants[local].bindings.keyboard : look !== "off");
}

export function localDevice(s: Readonly<ShellState>): HintDevice {
  const look = s.dev.hintsLook;
  return look === "keyboard" || look === "pad" ? look : windowFocused() && osKeyDown(PAD_PRESENT_KEY) ? "pad" : "keyboard";
}

export function onPreviewKeyDown(s: ShellState): void {
  const slot = playerSlot(eventPlayer());
  if (!isParticipantSlot(slot) || slot !== localSlot() || s.game.phase !== Phase.match || !humanActive(s.game, slot)) return;
  if (s.chatOpen?.() ?? warcraftChatOpen(s.chatFrame)) return;
  if (views(s).settings[slot].isOpen()) return;
  toggleKeyboardPreview(s.participants[slot].bindings);
}
