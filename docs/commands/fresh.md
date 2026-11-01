# Fresh

After a preceding match ends, fresh observes its score screen before waiting
for the menus. It retries Escape up to three times, ten seconds apart and
only while the score screen remains visible, then lets doctor recover a
client that still cannot leave it.

- Fresh match: `bun wisp fresh MAP.w3x [--rebuild] [--no-quick]` starts a new game, sends
  `-dev quick`, and waits until every signed-in client writes its receipt.
  A build whose fighter-selection record reads `CONSOLE off` (the playable
  map) has no dev console, so fresh leaves it at fighter selection;
  `--no-quick` does the same for any build. `--rebuild` replaces the map script first. Other quick starts for `--chat`
  and pad scripts: `-dev quick hero NAME [stocks N]` (one stock unless N is 1 to 9), `-dev quick recovery hero NAME`
  (starts tumbling above the floor for recovery captures), and `-dev quick cpu OPPONENT DIFFICULTY [hero NAME]`,
  a quick match against a named computer at the selected difficulty over three stocks.
  `-dev quick promo stage N pair FIRST / SECOND` starts two Wren Expert computers over three stocks with match HUD, hints and developer receipts hidden (for example `-dev quick promo stage 0 pair rifleman / illidan`). `-dev reset` restores the normal UI.
  `-dev quick stage N [lighting stock|stage] [backdrop on|off] [view near|far|off] [fog on|off]`
  applies the stage look before the first match draw, avoiding midmatch chat.
  Omitted options keep current defaults.
  Ending any quick-start command with ` |cine off` hides the KO wash's cine filter in that match (local presentation; `-dev reset` restores it), for wisp#75's cine on/off fidelity captures.
  `-dev classic NAME` starts that fighter's Classic run and `-dev classic boss NAME` its boss battle (smashcraft:docs/design/classic-mode.md).
  `-dev lore N` starts Lore Battle N (1-20, smashcraft:ts/src/game/classic/loreBattles.ts) for the first player.
  `-dev lore win` during a Lore Battle knocks out every opponent (a boss's health to zero), so the battle ends and is saved as cleared through the normal result.
  `-dev quick offstage hero NAME` starts the #189 recovery check at x=700, z=300 on Frozen Throne with jumps spent.
  The named variant uses the normal CPU selection rule.
  `-dev pain HEIGHT STRENGTH FIGHTER` starts the #181 mirror capture fixture:
  low/middle/high and small/medium/large, with ordinary projectile contacts at
  frame 150 after both players' scripted jab. `bun tools/animations/pain-pads.ts`
  from the repository root generates its 117 native parity scripts.

- Warm capture stage, in a match on a development map: `-dev capture FIGHTER MOVE left|right [SLOT]`
  hides the match fighters and stands FIGHTER (a `fighterSlug`, or its first word when unique,
  such as `jaina`) in SLOT 0-3 (default 0) at x = -450, -150, 150 or 450, looping MOVE (an anim score
  sample name such as `forward-air`, `up-tilt` or `side-special`) with a 30-frame hold between plays;
  aerials hover 220 units up and every slot keeps its x, so each sheet crops by slot. Several slots
  stand side by side without a reload; `-dev capture clear` removes them all and shows the match
  fighters again. Each accepted command writes the dev command receipt; an unknown fighter or move,
  or a move the fighter lacks, writes none. The staged fighters run a private presentation-only copy
  of the move (smashcraft:ts/src/platform/captureStage.ts), never the match, rollback or hit state.
  `bun wisp accept --only '614-*'` is its native check.
- Item setup at fighter selection: `-dev items on|off` controls whether pickups appear;
  `-dev item speed|heavy on|off` controls each kind. The normal selection
  buttons show Items (off by default) and, once Items is on, Speed item and
  Heavy item. In a match, `-dev item drop speed|heavy` starts the 10 s
  warning for that item at centre stage.

- Orb setup at fighter or stage selection: `-dev orbs on|off` controls
  whether centre-stage orbs appear (off by default since 2026-11-02, when the meter fills from the clock); the stage menu's "Orbs: On/Off" button does
  the same (smashcraft:docs/gameplay-design.md, "Centre-stage orbs").
- Meter setup: `-dev meter N` sets the ultimate meter to N percent.
