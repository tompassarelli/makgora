// Engine: game timers run in game time; lobby Fast is MAP_SPEED_NORMAL (GetGameSpeed index 2, 60 callbacks/s), and Single Player's minus key drops it to 48/s unless locked.
export function holdGameSpeed(): void {
  SetGameSpeed(MAP_SPEED_NORMAL);
  SetMapFlag(MAP_LOCK_SPEED, true);
}
