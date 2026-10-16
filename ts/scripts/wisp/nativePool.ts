export const attachedPoolReady = (status: { readonly clients: readonly { readonly pid?: number }[] } | undefined): boolean =>
  status !== undefined && status.clients.length === 2 && status.clients.every(client => client.pid !== undefined && client.pid > 0);
