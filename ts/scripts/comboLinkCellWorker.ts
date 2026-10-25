import { type LinkCell, measureLinkCell } from "./comboLinks";

declare const self: Worker;

self.onmessage = (event: MessageEvent<LinkCell>) => {
  self.postMessage(measureLinkCell(event.data));
};
