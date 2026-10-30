import type { HeadlessClient } from "wisp/src/headless/client";
import { DUO_TITLE } from "../src/game/ui/duoTitle";
import { leadsDuo } from "../src/game/sim/duoStatus";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { Phase } from "../src/game/lobby/lobbyState";
import { isActive } from "../src/game/sim/roster";
import { shell } from "../src/host/loop/state";

const SETTLED_FRAME = 30;
const PERSISTS_FRAMES = 30;

export class DuoPlateFindings {
  private readonly missing = new Map<HeadlessClient, number>();

  observe(client: HeadlessClient): { readonly detector: string; readonly text: string }[] {
    const s = shell();
    const playing = s.game.phase === Phase.match && !s.session.paused && s.runtime.simulationFrame >= SETTLED_FRAME;
    const shown = playing ? client.frames.shownText() : [];
    let absent: string | undefined;
    for (const slot of PARTICIPANT_SLOTS) {
      if (playing && isActive(s.world, slot) && leadsDuo(s.world, slot) && !shown.includes(DUO_TITLE)) absent = `Player ${slot + 1}'s plate does not read "${DUO_TITLE}"`;
    }
    const frames = absent === undefined ? 0 : (this.missing.get(client) ?? 0) + 1;
    this.missing.set(client, frames);
    return frames === PERSISTS_FRAMES && absent !== undefined ? [{ detector: "duo-plate", text: absent }] : [];
  }
}
