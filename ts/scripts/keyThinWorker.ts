import { keyThinWorkerHandler } from './keyThin';

declare const self: Worker;

self.onmessage = keyThinWorkerHandler();
