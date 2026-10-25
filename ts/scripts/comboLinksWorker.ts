import { type LinkUnit, measureLinks } from "./comboLinks";
import { switchToMelee } from "./ledger/meleeSwitches";

declare const self: Worker;

self.onmessage = (event: MessageEvent<LinkUnit>) => {
  if (event.data.melee !== undefined) switchToMelee(event.data.melee);
  self.postMessage(measureLinks(event.data));
};
