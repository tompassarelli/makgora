import { PARTICIPANT_CAPACITY } from "../input/participants";
import { slotColor } from "./slotColors";

export const handLabelName = (slot: number, palette: number): string => `SelectionHandLabelP${slot + 1}${slotColor(palette).name}`;

export const handLabelNames = (): readonly string[] => {
  const names: string[] = [];
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) for (let palette = 0; palette < PARTICIPANT_CAPACITY; palette++) names.push(handLabelName(slot, palette));
  return names;
};
