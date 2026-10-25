import { type LinkUnit, measureLinks } from "./comboLinks";

declare const self: Worker;

self.onmessage = (event: MessageEvent<LinkUnit>) => {
  self.postMessage(measureLinks(event.data));
};
