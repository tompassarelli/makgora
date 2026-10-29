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
  ...felGromChecks(pass),
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

const felGromChecks = (pass: readonly Rule[]): NativeCheck[] => [
  {
    id: "726-fel-select", closes: "smashcraft#726", map: "fighter-select", session: "726-fel-select",
    setup: [
      { waitMs: 8000 }, { keys: ["Escape"], client: "a" }, { keys: ["Escape"], client: "b" }, { waitMs: 500 },
      { chat: "-dev fighter 1 Grom", client: "a" }, { chat: "-dev fighter 2 Grom", client: "b" }, { chat: "-dev costume 1 fel", client: "a" }, { waitMs: 1500 },
    ],
    capture: [{ kind: "frames", name: "fel-select", client: "a" }, { kind: "frames", name: "fel-select", client: "b" }],
    pass,
    look: "On both clients player 1's Grom card shows the red-skinned fel portrait and player 2's card the green default Grom; the roster grid tile may stay default.",
  },
  {
    id: "726-fel-match", closes: "smashcraft#726", map: "fighter-select", session: "726-fel-select",
    setup: [{ keys: ["Return"], client: "a" }, { waitMs: 300 }, { keys: ["y"], client: "a" }, { waitMs: 1500 }, { chat: "-dev stocks 3", client: "a" }, { keys: ["y"], client: "a" }, { waitMs: 9000 }],
    capture: [{ kind: "frames", name: "fel-match", client: "a" }, { kind: "frames", name: "fel-match", client: "b" }],
    pass,
    look: "Both clients draw player 1's Grom red-skinned on stage and as the HUD plate bust and stock icons, beside a green default Grom for player 2: the same fel body from both clients.",
  },
  {
    id: "726-fel-ko", closes: "smashcraft#726", map: "presentation", session: "726-fel-ko",
    setup: [
      { chat: "-dev reset" }, { chat: "-dev quick pair Grom in fel / Grom" }, { waitMs: 4000 }, { chat: "-dev percent 1 999" }, { chat: "-dev beside 1 2" }, { waitMs: 300 },
      { keys: ["space+n"], client: "b" },
    ],
    capture: [{ kind: "frames", name: "fel-ko", client: "a", count: 40, everyMs: 60 }],
    pass,
    look: "Player 1's red Fel Grom is knocked off the top by player 2's default Grom and the flying KO body is red-skinned, not green.",
  },
];
