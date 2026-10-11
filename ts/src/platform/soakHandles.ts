interface Handles {
  readonly live: Map<number, number>;
  installed: boolean;
}

declare global {
  var __smashcraftSoakHandles: Handles | undefined;
}

const state = (): Handles => globalThis.__smashcraftSoakHandles ??= { live: new Map(), installed: false };

function made<T extends handle>(value: T, parent?: framehandle): T {
  if (GetHandleId(value) !== 0) state().live.set(GetHandleId(value), parent === undefined ? 0 : GetHandleId(parent));
  return value;
}

function released(value: handle, subtree = false): void {
  const id = GetHandleId(value);
  state().live.delete(id);
  if (!subtree || id === 0) return;
  const children: number[] = [];
  for (const [child, parent] of state().live) if (parent === id) children.push(child);
  for (const child of children) releaseId(child);
}

function releaseId(id: number): void {
  state().live.delete(id);
  const children: number[] = [];
  for (const [child, parent] of state().live) if (parent === id) children.push(child);
  for (const child of children) releaseId(child);
}

export const liveSoakHandles = (): number => state().live.size;

export function installSoakHandles(): void {
  if (state().installed) return;
  state().installed = true;
  const natives = globalThis as Record<string, unknown>;
  const createUnit = CreateUnit;
  const removeUnit = RemoveUnit;
  const createTimer = CreateTimer;
  const destroyTimer = DestroyTimer;
  const createTrigger = CreateTrigger;
  const destroyTrigger = DestroyTrigger;
  const addEffect = AddSpecialEffect;
  const addEffectLoc = AddSpecialEffectLoc;
  const addEffectTarget = AddSpecialEffectTarget;
  const destroyEffect = DestroyEffect;
  const createSound = CreateSound;
  const createSoundLabel = CreateSoundFromLabel;
  const killSound = KillSoundWhenDone;
  const stopSound = StopSound;
  const createFrame = BlzCreateFrame;
  const createSimpleFrame = BlzCreateSimpleFrame;
  const createFrameType = BlzCreateFrameByType;
  const destroyFrame = BlzDestroyFrame;
  natives.CreateUnit = (...args: Parameters<typeof CreateUnit>) => made(createUnit(...args));
  natives.RemoveUnit = (value: unit) => { released(value); removeUnit(value); };
  natives.CreateTimer = () => made(createTimer());
  natives.DestroyTimer = (value: timer) => { released(value); destroyTimer(value); };
  natives.CreateTrigger = () => made(createTrigger());
  natives.DestroyTrigger = (value: trigger) => { released(value); destroyTrigger(value); };
  natives.AddSpecialEffect = (...args: Parameters<typeof AddSpecialEffect>) => made(addEffect(...args));
  natives.AddSpecialEffectLoc = (...args: Parameters<typeof AddSpecialEffectLoc>) => made(addEffectLoc(...args));
  natives.AddSpecialEffectTarget = (...args: Parameters<typeof AddSpecialEffectTarget>) => made(addEffectTarget(...args));
  natives.DestroyEffect = (value: effect) => { released(value); destroyEffect(value); };
  natives.CreateSound = (...args: Parameters<typeof CreateSound>) => made(createSound(...args));
  natives.CreateSoundFromLabel = (...args: Parameters<typeof CreateSoundFromLabel>) => made(createSoundLabel(...args));
  natives.KillSoundWhenDone = (value: sound) => { released(value); killSound(value); };
  natives.StopSound = (value: sound, killWhenDone: boolean, fadeOut: boolean) => { if (killWhenDone) released(value); stopSound(value, killWhenDone, fadeOut); };
  natives.BlzCreateFrame = (name: string, owner: framehandle, priority: number, context: number) => made(createFrame(name, owner, priority, context), owner);
  natives.BlzCreateSimpleFrame = (name: string, owner: framehandle, context: number) => made(createSimpleFrame(name, owner, context), owner);
  natives.BlzCreateFrameByType = (kind: string, name: string, owner: framehandle, inherits: string, context: number) => made(createFrameType(kind, name, owner, inherits, context), owner);
  natives.BlzDestroyFrame = (value: framehandle) => { released(value, true); destroyFrame(value); };
}
