import { on, trampoline } from "wisp/src/platform/dispatch";
import { createEvents, destroyEvents, Events, onEvents } from "wisp/game/events";
import { addFrameEvent, eventFrameValue, Frame, FrameEvent } from "wisp/game/frames";
import { eventPlayer, Player } from "wisp/game/players";

/** The wheel over an info popup: each notch is one line, `-1` toward the top when the wheel turns away from the user and `1` toward the end when it turns toward them, for whoever turned it. The event is registered only while the popup is open, because a registration that stays raised every frame's allocation in the smoke perf gate. */
export class PopupWheel {
  private trigger: Events | undefined;

  constructor(private readonly name: string, private readonly frames: readonly Frame[], handle: (delta: number, turner: Player) => void) {
    this.bindHandler(handle);
  }

  bindHandler(handle: (delta: number, turner: Player) => void): void {
    on(this.name, () => handle(eventFrameValue() > 0 ? -1 : 1, eventPlayer()));
  }

  arm(): void {
    if (this.trigger !== undefined) return;
    this.trigger = createEvents();
    onEvents(this.trigger, trampoline(this.name));
    for (const frame of this.frames) addFrameEvent(this.trigger, frame, FrameEvent.mouseWheel);
  }

  disarm(): void {
    if (this.trigger === undefined) return;
    destroyEvents(this.trigger);
    this.trigger = undefined;
  }
}
