import { ParasolState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";

export { PARASOL_MODEL } from "../../generated/assets/parasolAssetInfo";
export { CHEN_PARASOL_GRIP as PARASOL_GRIP } from "../fighters/chen/look";

export const PARASOL_FOLD_FRAMES = 5;

export function parasolShown(f: Readonly<Fighter>): boolean {
  return f.special.parasol === ParasolState.open && !f.status.out;
}
