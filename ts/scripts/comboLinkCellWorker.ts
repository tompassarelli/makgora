import { type LinkCell, measureLinkCell } from "./comboLinks";
import { switchToMelee } from "./ledger/meleeSwitches";

declare const self: Worker;

self.onmessage = (event: MessageEvent<LinkCell>) => {
  for (const row of event.data.melee ?? []) switchToMelee(row);
  self.postMessage(measureLinkCell(event.data));
};
