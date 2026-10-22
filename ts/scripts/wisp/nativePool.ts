export const pairClientCount = (status: { readonly network?: boolean }): number => status.network === true ? 1 : 2;

export const attachedPoolReady = (status: { readonly network?: boolean; readonly clients: readonly { readonly pid?: number }[] } | undefined): boolean =>
  status !== undefined && status.clients.length === pairClientCount(status) && status.clients.every(client => client.pid !== undefined && client.pid > 0);

export const attachExistingPool = (status: Parameters<typeof attachedPoolReady>[0], holderAlive: boolean): boolean =>
  holderAlive || attachedPoolReady(status);
