import { type LinkUnit, measureLinks } from "./comboLinks";
import { switchToMelee } from "./ledger/meleeSwitches";

declare const self: Worker;

self.onmessage = (event: MessageEvent<LinkUnit>) => {
  for (const row of event.data.melee ?? []) switchToMelee(row);
  self.postMessage(measureLinks(event.data));
};
