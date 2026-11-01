import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import { install, startBuild } from "../src/platform/main";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { type BarBox, DRAWER_ROWS, GUIDE_ROWS, MODE_ROWS, SELECT_BAR } from "../src/game/core/selectBarLayout";
import { shell } from "../src/host/loop/state";
import { views } from "../src/host/loop/ui";
import { passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);
const HUMANS = [0, 1];
const centre = (box: BarBox) => [f32(box.x + f32(box.width / 2)), f32(box.y - f32(box.height / 2))] as const;
const DRAWER_TITLE = "Match Rules";
const plain = (texts: readonly string[]): string => texts.join("\n").replace(/\|c[0-9a-fA-F]{8}|\|r/g, "");

test("rule changes made in the bar's panels reach every client in the lobby, and only the clicking player's panel opens [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, HUMANS);
  clients.start();
  passStartControls(clients);
  clients.frames(10);
  const rules = (slot: number) => {
    let seen = {};
    clients.client(slot).run(() => {
      const { game } = shell();
      seen = { stocks: game.stockCount, minutes: game.timeLimitMinutes, ultimatesOff: game.ultimatesOff, items: game.items.on, endless: game.endless, training: game.training };
    });
    return seen;
  };
  const press = (box: BarBox) => {
    expect(clients.click(0, ...centre(box))).toBe(true);
    clients.frames(3);
  };
  const everywhere = (expected: object) => {
    for (const slot of HUMANS) expect(rules(slot)).toEqual({ ...rules(0), ...expected });
    expect(rules(1)).toEqual(rules(0));
  };
  press(SELECT_BAR.rules);
  expect(plain(clients.client(0).frames.shownText())).toContain(DRAWER_TITLE);
  expect(plain(clients.client(1).frames.shownText())).not.toContain(DRAWER_TITLE);
  press(DRAWER_ROWS.stocks.less);
  press(DRAWER_ROWS.ultimates);
  everywhere({ stocks: 2, ultimatesOff: true });
  press(DRAWER_ROWS.items);
  press(DRAWER_ROWS.endless);
  everywhere({ items: true, endless: true });
  press(DRAWER_ROWS.presets[0] ?? DRAWER_ROWS.reset);
  everywhere({ stocks: 4, minutes: 8, ultimatesOff: true, items: false, endless: false });
  press(DRAWER_ROWS.reset);
  everywhere({ stocks: 3, minutes: 7, ultimatesOff: false, items: false, endless: false });
  press(SELECT_BAR.mode);
  expect(plain(clients.client(0).frames.shownText())).not.toContain(DRAWER_TITLE);
  press(MODE_ROWS.modes[1] ?? MODE_ROWS.teamBattle);
  everywhere({ training: true });
  press(SELECT_BAR.mode);
  press(MODE_ROWS.modes[0] ?? MODE_ROWS.teamBattle);
  everywhere({ training: false });
  press(SELECT_BAR.guide);
  press(GUIDE_ROWS.controls);
  let settings = false;
  clients.client(0).run(() => { settings = views(shell()).settings[0]?.isOpen() === true; });
  expect(settings).toBe(true);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("the pad reaches the rules drawer from the bar: down past the fighter card, Back, Mode and Teams to the rules pill, attack opens it, down and right step the stocks, special closes it [k1 scenario]", async () => {
  const session = await createStandaloneSession({ start: "select" });
  try {
    for (let step = 0; step < 45; step++) session.step(NEUTRAL_INPUT);
    const tap = (button: string) => {
      session.step({ buttons: [button], axisX: 0, axisY: 0 });
      for (let step = 0; step < 4; step++) session.step(NEUTRAL_INPUT);
    };
    const shown = () => plain(session.client.frames.shownText()).includes(DRAWER_TITLE);
    let stocks = 0;
    const readStocks = () => session.client.run(() => { stocks = shell().game.stockCount; });
    for (let press = 0; press < 4; press++) tap("down");
    tap("attack");
    expect(shown()).toBe(true);
    for (let press = 0; press < 3; press++) tap("down");
    tap("right");
    readStocks();
    expect(stocks).toBe(4);
    tap("special");
    expect(shown()).toBe(false);
    readStocks();
    expect(stocks).toBe(4);
  } finally {
    session.close();
  }
}, 120_000);
