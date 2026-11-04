import { assertEquals, test } from "wisp/src/runtime/testing";
import { advanceHandleLedger, type HandleLedger, installHandleLedger, LEDGER_TICKS, receiveLedgerReport, takeLedgerReport } from "./handleLedger";

type Native = (this: void, ...args: unknown[]) => unknown;

const STUBBED = ["AddSpecialEffect", "PreloadGenClear", "PreloadGenStart", "Preload", "PreloadGenEnd", "I2S", "S2I"];

const FROST_NOVA = "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdl";

const freshLedger = (): HandleLedger => ({ tick: 0, wrapped: false, sentWindow: -1, windows: [], reported: [false, false, false, false], lines: [] });

function withStubs(body: (globals: Record<string, unknown>) => void): void {
  const globals = globalThis as Record<string, unknown>;
  const before = STUBBED.map((name) => globals[name]);
  for (const name of STUBBED) globals[name] = () => undefined;
  globals.I2S = (value: number) => string.format("%d", value);
  globals.S2I = (text: string) => math.tointeger(tonumber(text) ?? 0) ?? 0;
  try {
    body(globals);
  } finally {
    STUBBED.forEach((name, index) => { globals[name] = before[index]; });
  }
}

function ledgerClient(globals: Record<string, unknown>): { readonly ledger: HandleLedger; readonly addEffect: Native } {
  const ledger = freshLedger();
  globals.AddSpecialEffect = () => undefined;
  installHandleLedger(ledger);
  return { ledger, addEffect: globals.AddSpecialEffect as Native };
}

test("two clients' handle ledgers agree while they make the same effects, and an effect only one of them makes is named, with its model file and tick, on both [k1 scenario]", () => {
  withStubs((globals) => {
    const early = ledgerClient(globals);
    const late = ledgerClient(globals);
    const clients = [early, late];
    const exchange = (): void => {
      const reports = clients.map(({ ledger }) => takeLedgerReport(ledger));
      clients.forEach(({ ledger }, local) => reports.forEach((report, sender) => {
        if (report !== undefined) receiveLedgerReport(ledger, local, sender, report);
      }));
    };
    const advance = (ticks: number): void => {
      for (let tick = 0; tick < ticks; tick++) {
        for (const { ledger } of clients) advanceHandleLedger(ledger);
        exchange();
      }
    };
    for (const { addEffect } of clients) addEffect(FROST_NOVA, 0, 0);
    advance(10 * LEDGER_TICKS);
    assertEquals(clients.map(({ ledger }) => ledger.lines.length).join(","), "0,0");
    const skewed = late.ledger.tick;
    late.addEffect(FROST_NOVA, 0, 0);
    advance(2 * LEDGER_TICKS);
    assertEquals(early.ledger.lines.join("\n"), `handle ledger: p0 and p1 differ at tick ${skewed}: p0 made or freed 0 () and p1 1 (AddSpecialEffect)`);
    assertEquals(late.ledger.lines.join("\n"), `handle ledger: p1 and p0 differ at tick ${skewed}: p1 made or freed 1 (AddSpecialEffect[FrostNovaTarget.mdl]) and p0 0 ()`);
  });
});

test("the handle ledger installs no wrapper where the host has no Warcraft native of that name [k2 property]", () => {
  withStubs((globals) => {
    globals.AddSpecialEffect = undefined;
    installHandleLedger(freshLedger());
    assertEquals(globals.AddSpecialEffect, undefined);
  });
});
