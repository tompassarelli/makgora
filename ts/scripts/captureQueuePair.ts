import { homedir } from "node:os";
import { join } from "node:path";

export const lanState = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "wisp/lan");

/** The private desktop, capacity helper, clients file and Warcraft install a pair's batch uses on this host unless a flag names others. */
export const pairDefaults = (pair: number, client = `lan${pair}a`) => {
  const skills = join(homedir(), "code/north/main/harness/skills");
  return {
    client,
    desktop: join(skills, "private-desktop-development/scripts/private-desktop.sh"),
    capacity: join(skills, "machine-capacity/scripts/machine-capacity.mjs"),
    clientsFile: join(lanState, "clients.json"),
    install: join(homedir(), `.local/share/wisp/lan/clients/${client}/pfx/drive_c/Program Files (x86)/Warcraft III`),
  };
};
