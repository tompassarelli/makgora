import { ItemKind } from "../sim/codes";

export const stockSetting = (count: number) => (count === 1 ? "1 Stock" : `${count} Stocks`);
export const timeSetting = (minutes: number) => (minutes === 0 ? "No time limit" : `${minutes}:00`);
export const endlessSetting = (endless: boolean) => `Endless play: ${endless ? "On" : "Off"}`;
export const automaticRematchSetting = (automatic: boolean) => `Automatic rematch: ${automatic ? "On" : "Off"}`;
export const itemsSetting = (on: boolean) => `Items: ${on ? "On" : "Off"}`;
export const ultimatesSetting = (on: boolean) => `Ultimates: ${on ? "On" : "Off"}`;
export const itemKindSetting = (kind: ItemKind, on: boolean) => `${kind === ItemKind.speed ? "Speed" : "Heavy"} item: ${on ? "On" : "Off"}`;

const BEHAVIOUR_NAMES = ["Stand", "Shield", "Crouch", "Jump", "Attack", "Fight"];
const ESCAPE_NAMES = ["None", "Toward you", "Away", "Random"];
const TECH_NAMES = ["None", "In place", "Toward you", "Away", "Random"];
export const partnerBehaviourSetting = (code: number) => `Partner: ${BEHAVIOUR_NAMES[code] ?? ""}`;
export const partnerEscapeSetting = (code: number) => `Partner drift: ${ESCAPE_NAMES[code] ?? ""}`;
export const partnerTechSetting = (code: number) => `Partner tech: ${TECH_NAMES[code] ?? ""}`;
export const partnerDamageSetting = (damage: number) => `Partner damage: ${damage}%`;
export const hitAreasSetting = (shown: boolean) => `Hit areas: ${shown ? "On" : "Off"}`;
export const trainingSpeedSetting = (speed: number) => `Game speed: ${speed === 4 ? "Quarter" : speed === 2 ? "Half" : "Full"}`;
