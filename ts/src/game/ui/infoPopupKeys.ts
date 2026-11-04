import { Action } from "../input/actions";

export interface KeyedInfoPopup {
  opened(): boolean;
  scroll(delta: number): boolean;
  close(): boolean;
}

export function infoPopupAction(popups: readonly KeyedInfoPopup[], action: Action): boolean {
  const open = popups.find(popup => popup.opened());
  if (open === undefined) return false;
  if (action === Action.moveUp || action === Action.moveDown) open.scroll(action === Action.moveUp ? -1 : 1);
  else if (action === Action.attack || action === Action.special) open.close();
  return true;
}
