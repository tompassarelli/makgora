import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

const SETUP_COMPUTERS: readonly Rule[] = (["a", "b"] as const).map((client): Rule => ({ kind: "receipt", client, pattern: "^SETUP .* computers=[1-9]", min: 1 }));

export const fighterSelectChecks = (pass: readonly Rule[]): NativeCheck[] => [
  ...(["first", "second"] as const).map((order): NativeCheck => ({
    id: `c40-cpu-startup-${order}`, closes: "smashcraft#7 C40N", map: "cpu-startup", session: `cpu-startup-${order}`,
    setup: [{ waitMs: 8000 }, { chat: "-dev stocks 3" }, { receipt: "^SMASHCRAFT DEV v=1 ", client: "a", seconds: 10 }, { receipt: "^SMASHCRAFT DEV v=1 ", client: "b", seconds: 10 }, { keys: ["Escape"], client: "a" }, { keys: ["Escape"], client: "b" }, { waitMs: 500 }],
    capture: [{ kind: "frames", name: "fighter-select", client: "a" }, { kind: "frames", name: "fighter-select", client: "b" }],
    pass: [...pass, ...SETUP_COMPUTERS],
    look: "With each client's first-run Controls panel closed, the computer's starting fighter in SETUP characters= is the same on both clients and matches both fighter-select frames; it differs between the first and second session.",
  })),
  {
    id: "434-chat-fighter-select", closes: "smashcraft#566", map: "fighter-select", session: "434-chat-select",
    setup: [
      { waitMs: 8000 }, { keys: ["Escape"], client: "a" }, { keys: ["Escape"], client: "b" }, { waitMs: 500 }, { chat: "-dev fighter 1 Illidan", client: "a" }, { chat: "-dev fighter 2 Rifleman", client: "b" },
      { waitMs: 1500 }, { chat: "Chat stays readable over fighter select", client: "b" }, { waitMs: 500 }, { keys: ["Return"], client: "a" }, { waitMs: 400 },
    ],
    capture: [{ kind: "frames", name: "chat-fighter-select", client: "a" }, { kind: "frames", name: "chat-fighter-select", client: "b" }],
    pass,
    look: "On both clients the line Chat stays readable over fighter select, sent from client b, is drawn whole above the roster, cards and buttons, with no select frame covering any of its letters, and client a shows Warcraft's chat entry box that Enter opened.",
  },
  {
    id: "434-chat-stage-select", closes: "smashcraft#566", map: "fighter-select", session: "434-chat-select",
    setup: [
      { keys: ["Return"], client: "a" }, { waitMs: 300 }, { keys: ["y"], client: "a" }, { waitMs: 1500 }, { chat: "Chat stays readable over stage select", client: "a" }, { waitMs: 500 },
      { keys: ["Return"], client: "b" }, { waitMs: 400 },
    ],
    capture: [{ kind: "frames", name: "chat-stage-select", client: "a" }, { kind: "frames", name: "chat-stage-select", client: "b" }],
    pass,
    look: "Both clients show STAGE SELECT, and the line Chat stays readable over stage select, sent from client a, is drawn whole above the stage tiles and buttons, with no select frame covering any of its letters, and client b shows Warcraft's chat entry box that Enter opened.",
  },
];

export const felCostumeChecks = (pass: readonly Rule[]): NativeCheck[] => [
  {
    id: "726-fel-select", closes: "smashcraft#726 box 1", map: "fighter-select", session: "726-fel",
    setup: [
      { waitMs: 8000 }, { keys: ["Escape"], client: "a" }, { keys: ["Escape"], client: "b" }, { waitMs: 500 },
      { chat: "-dev fighter 1 Grom Hellscream", client: "a" }, { chat: "-dev fighter 2 Grom Hellscream", client: "b" }, { waitMs: 1500 },
      { keys: ["8"], client: "a" }, { waitMs: 1000 },
    ],
    capture: [{ kind: "frames", name: "fel-select", client: "a" }, { kind: "frames", name: "fel-select", client: "b" }],
    pass,
    look: "Both clients show player 1's card with the red-skinned Fel Grom portrait and its second costume dot lit, and player 2's card with the default green Grom.",
  },
  {
    id: "726-fel-match", closes: "smashcraft#726 boxes 1 and 3", map: "fighter-select", session: "726-fel",
    setup: [{ keys: ["y"], client: "a" }, { waitMs: 1500 }, { keys: ["y"], client: "a" }, { waitMs: 7000 }],
    capture: [{ kind: "frames", name: "fel-match", client: "a" }, { kind: "frames", name: "fel-match", client: "b" }],
    pass,
    look: "On both clients player 1 is the red-skinned Fel Grom on stage and on the HUD plate bust, and player 2 the default green Grom.",
  },
  {
    id: "726-fel-ko", closes: "smashcraft#726 box 2", map: "fighter-select", session: "726-fel",
    setup: [{ chat: "-dev setup percent 1 999;lives 1 2;beside 2 1", client: "a" }, { receipt: "^SMASHCRAFT DEV v=1 ", client: "a", seconds: 4 }, { waitMs: 500 }],
    capture: [{ kind: "frames", name: "fel-ko", client: "a", count: 40, everyMs: 50, press: { keys: ["0"], client: "b", holdMs: 80 } }],
    pass,
    look: "Player 2's up tilt sends 999% player 1 off the top, and the KO body that flies into the background or against the screen is the red-skinned Fel Grom, not the green default.",
  },
];
