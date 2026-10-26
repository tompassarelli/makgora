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
    id: "434-chat-fighter-select", closes: "smashcraft#434", map: "fighter-select", session: "434-chat-select",
    setup: [
      { waitMs: 8000 }, { chat: "-dev fighter 1 Illidan", client: "a" }, { chat: "-dev fighter 2 Rifleman", client: "b" },
      { waitMs: 1500 }, { chat: "Chat stays readable over fighter select", client: "b" }, { waitMs: 500 },
    ],
    capture: [{ kind: "frames", name: "chat-fighter-select", client: "a" }, { kind: "frames", name: "chat-fighter-select", client: "b" }],
    pass,
    look: "On both clients the line Chat stays readable over fighter select, sent from client b, is drawn whole above the roster, cards and buttons, with no select frame covering any of its letters.",
  },
  {
    id: "434-chat-stage-select", closes: "smashcraft#434", map: "fighter-select", session: "434-chat-select",
    setup: [{ keys: ["y"], client: "a" }, { waitMs: 1500 }, { chat: "Chat stays readable over stage select", client: "a" }, { waitMs: 500 }],
    capture: [{ kind: "frames", name: "chat-stage-select", client: "a" }, { kind: "frames", name: "chat-stage-select", client: "b" }],
    pass,
    look: "Both clients show STAGE SELECT, and the line Chat stays readable over stage select, sent from client a, is drawn whole above the stage tiles and buttons, with no select frame covering any of its letters.",
  },
];
