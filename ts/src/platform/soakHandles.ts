interface Handles {
  readonly live: Map<number, number>;
  installed: boolean;
}

declare global {
  var __makgoraSoakHandles: Handles | undefined;
}

const state = (): Handles => globalThis.__makgoraSoakHandles ??= { live: new Map(), installed: false };

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

type Native = (this: void, ...args: unknown[]) => unknown;

const MADE = ["CreateUnit", "CreateTimer", "CreateTrigger", "AddSpecialEffect", "AddSpecialEffectLoc", "AddSpecialEffectTarget", "CreateSound", "CreateSoundFromLabel"];

const MADE_IN_FRAME: Readonly<Record<string, number>> = { BlzCreateFrame: 1, BlzCreateSimpleFrame: 1, BlzCreateFrameByType: 2 };

const RELEASED = ["RemoveUnit", "DestroyTimer", "DestroyTrigger", "DestroyEffect", "KillSoundWhenDone"];

export function installSoakHandles(): void {
  if (state().installed) return;
  state().installed = true;
  const natives = globalThis as Record<string, unknown>;
  const wrap = (name: string, around: (call: Native) => Native): void => {
    const call = natives[name];
    if (typeof call === "function") natives[name] = around(call as Native);
  };
  for (const name of MADE) wrap(name, (call) => (...args) => made(call(...args) as handle));
  for (const [name, owner] of Object.entries(MADE_IN_FRAME)) wrap(name, (call) => (...args) => made(call(...args) as framehandle, args[owner] as framehandle));
  for (const name of RELEASED) wrap(name, (call) => (value) => { released(value as handle); call(value); });
  wrap("StopSound", (call) => (value, killWhenDone, fadeOut) => { if (killWhenDone === true) released(value as handle); call(value, killWhenDone, fadeOut); });
  wrap("BlzDestroyFrame", (call) => (value) => { released(value as handle, true); call(value); });
}
