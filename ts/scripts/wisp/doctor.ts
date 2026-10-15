import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { type DoctorDeclaration, clientsDoctor } from "wisp/scripts/wisp/clientDoctorCommand";
import { DoctorStop, withDoctor } from "wisp/scripts/wisp/doctor";
import { ClientWatch } from "wisp/scripts/wisp/watch";
import { prefixOf } from "./nativeTools";
import { clientState } from "./project";

const ACCOUNTS: Readonly<Record<string, string>> = { c: "c", b: "b" };
const SECRETS = join(homedir(), "code/nixos-config/main/secrets/bnet.yaml");

export const accountField = (account: string, field: "username" | "password") => {
  const runtime = `/run/secrets/bnet-${account}-${field}`;
  return existsSync(runtime)
    ? ["cat", runtime]
    : ["sudo", "-n", "env", "SOPS_AGE_KEY_FILE=/var/lib/sops-nix/key.txt", "sops", "--decrypt", "--extract", `["${account}"]["${field}"]`, SECRETS];
};

const ClientsFile = Schema.Struct({ clients: Schema.Array(Schema.Struct({ name: Schema.String, run: Schema.String,
  documents: Schema.String, menuReportPort: Schema.optionalKey(Schema.Finite), offline: Schema.optionalKey(Schema.Boolean),
})) });

export const readClientsFile = (clientsFile = clientState) => Schema.decodeUnknownSync(ClientsFile)(JSON.parse(readFileSync(clientsFile, "utf8")));

const CLONE_LAUNCH = join(homedir(), ".local/share/wisp/online/launch.sh");

export const cloneLauncher = (clone: string, run: string) => ({
  kind: "command" as const, command: [CLONE_LAUNCH, clone, run], log: join(homedir(), `.local/share/wisp/online/clone-${clone}-launch.log`),
});

/** The launcher and account follow each client's own Wine prefix, never its name, so a client called a or b can't start another prefix. */
export const smashcraftDoctor = (clientsFile = clientState): DoctorDeclaration => {
  const file = readClientsFile(clientsFile);
  const start: Record<string, DoctorDeclaration["start"][string]> = {};
  const accounts: Record<string, NonNullable<DoctorDeclaration["accounts"]>[string]> = {};
  for (const { name, run, documents, offline } of file.clients) {
    if (offline === true) continue;
    const clone = /^clone-([abcd])$/.exec(prefixOf(documents) ?? "")?.[1];
    if (clone === undefined) continue;
    start[name] = cloneLauncher(clone, run);
    const account = ACCOUNTS[clone];
    if (account !== undefined) accounts[name] = { username: accountField(account, "username"), password: accountField(account, "password") };
  }
  return { clientsFile, start, ...(Object.keys(accounts).length === 0 ? {} : { accounts }) };
};

export const smashcraftWatch = ClientWatch.layer({ filePrefix: "smashcraft" });

export const checkClients = (print: (line: string) => void = console.log, clientsFile = clientState) =>
  Effect.try({ try: () => smashcraftDoctor(clientsFile), catch: (cause) => new DoctorStop({ problem: `can't read the clients from ${clientsFile}: ${String(cause)}` }) }).pipe(
    Effect.flatMap((declaration) => clientsDoctor(declaration, [], print)),
    Effect.provide(smashcraftWatch),
  );

export const onHealthyClients = <A, E, R>(run: Effect.Effect<A, E, R>, options: { readonly retry?: boolean; readonly clientsFile?: string } = {}) =>
  withDoctor(checkClients(console.log, options.clientsFile), console.log, run, options.retry === undefined ? {} : { retry: options.retry });
