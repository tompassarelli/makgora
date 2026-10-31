import { lockSpeed, setNormalSpeed } from "wisp/game/clock";
// Engine: game timers run in game time; lobby Fast is GameSpeed.normal (GetGameSpeed index 2, 60 callbacks/s), and Single Player's minus key drops it to 48/s unless locked.
export function holdGameSpeed(): void {
  setNormalSpeed();
  lockSpeed();
}
