import { type ThrowRoleUnit, checkThrowRole } from "./throwRoleObjectives";

declare const self: Worker;

self.onmessage = (event: MessageEvent<ThrowRoleUnit>) => {
  self.postMessage(checkThrowRole(event.data));
};
