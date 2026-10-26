/** Delivers a player's key event to one client at once, outside the lockstep's link: the sender's client also holds the key. */
export const deliverKey = (client: { readonly slot: number; hold(key: number, meta: number, down: boolean): void; keyEvent(sender: number, key: number, meta: number, down: boolean): void }, sender: number, key: number, meta: number, down: boolean): void => {
  if (sender === client.slot) client.hold(key, meta, down);
  client.keyEvent(sender, key, meta, down);
};
