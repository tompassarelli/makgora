import { type LinkCell, measureLinkCell } from "./comboLinks";
import { switchToMelee } from "./ledger/meleeSwitches";

declare const self: Worker;

self.onmessage = (event: MessageEvent<LinkCell>) => {
  if (event.data.melee !== undefined) switchToMelee(event.data.melee);
  self.postMessage(measureLinkCell(event.data));
};
