import type { HeadlessClient } from "wisp/src/headless/client";
import { DUO_TITLE, duoHasPartner, duoPipText } from "../src/game/ui/duoPip";
import { duoPipFor } from "../src/game/sim/duoStatus";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { Phase } from "../src/game/lobby/lobbyState";
import { isActive } from "../src/game/sim/roster";
import { shell } from "../src/host/loop/state";

const SETTLED_FRAME = 30;
const PERSISTS_FRAMES = 30;
const PIP_SHAPE = /^(\d+% (SYNC|HOLD|APART)|DOWN|REVIVE|NO ROOM)$/;

export class DuoPlateFindings {
  private readonly missing = new Map<HeadlessClient, number>();

  observe(client: HeadlessClient): { readonly detector: string; readonly text: string }[] {
    const s = shell();
    const playing = s.game.phase === Phase.match && !s.session.paused && s.runtime.simulationFrame >= SETTLED_FRAME;
    const shown = playing ? client.frames.shownText() : [];
    let absent: string | undefined;
    for (const slot of PARTICIPANT_SLOTS) {
      const pip = playing && isActive(s.world, slot) ? duoPipFor(s.world, slot) : undefined;
      if (pip === undefined) continue;
      if (duoHasPartner(pip.state) && !shown.includes(DUO_TITLE)) absent = `Player ${slot + 1}'s plate does not read "${DUO_TITLE}"`;
      else if (!shown.some((text) => PIP_SHAPE.test(text))) absent = `Player ${slot + 1}'s plate shows no partner pip (${duoPipText(pip.state, pip.percent)} expected)`;
    }
    const frames = absent === undefined ? 0 : (this.missing.get(client) ?? 0) + 1;
    this.missing.set(client, frames);
    return frames === PERSISTS_FRAMES && absent !== undefined ? [{ detector: "duo-plate", text: absent }] : [];
  }
}
