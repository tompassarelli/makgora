import { on, trampoline } from "wisp/src/platform/dispatch";
import { createEvents, destroyEvents, onEvents } from "wisp/game/events";
import { addFrameEvent, eventFrameValue, Frame, FrameEvent } from "wisp/game/frames";
import { eventPlayer, Player } from "wisp/game/players";

/** The wheel over an info popup: each notch is one line, `-1` toward the top when the wheel turns away from the user and `1` toward the end when it turns toward them, for whoever turned it. */
export class PopupWheel {
  private readonly trigger = createEvents();

  constructor(private readonly name: string, handle: (delta: number, turner: Player) => void) {
    onEvents(this.trigger, trampoline(name));
    this.bindHandler(handle);
  }

  bindHandler(handle: (delta: number, turner: Player) => void): void {
    on(this.name, () => handle(eventFrameValue() > 0 ? -1 : 1, eventPlayer()));
  }

  add(frame: Frame): void {
    addFrameEvent(this.trigger, frame, FrameEvent.mouseWheel);
  }

  destroy(): void {
    destroyEvents(this.trigger);
  }
}
