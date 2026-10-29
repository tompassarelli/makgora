import costs from "./tapeCosts.json";

const MEASURED: Readonly<Record<string, number>> = costs;

export const unmeasuredTapes = (names: readonly string[]): readonly string[] => names.filter((name) => !(name in MEASURED));

export const staleTapeCosts = (names: readonly string[]): readonly string[] => Object.keys(MEASURED).filter((name) => !names.includes(name));

export const tapeReplayCost = (name: string): number => MEASURED[name] ?? 0;
