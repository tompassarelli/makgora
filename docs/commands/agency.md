# Agency

- Agency sweep: `bun wisp agency [--attacker NAME] [--starter NAME]`
  replays every fighter's throws, jab resets, normals and specials (or only
  the named starters) against every fighter with every victim input class and
  prints the stretches the victim can't act in and the loops follow-ups make
  (smashcraft:docs/typescript.md); 11-28 minutes an attacker, inside the
  capacity scope.

- Branch a string: `bun scripts/agencyMeasure.ts --first N --count M --max-strings K --out FILE`
  branches the sim at each hit of the recorded strings over every victim option
  and records per-link escape; `bun scripts/agencyTable.ts [--e PERCENT] [--t SECONDS] FILE...`
  flags those strings (true-chain, low-agency-link, long-no-control, loop)
  under the agency rule, E 10% and T 3 s by default (#63; smashcraft:docs/gameplay-design.md,
  "Combo structure"), counts them, and prints how many each candidate (E, T)
  pair flags (smashcraft#10 C12). The playtester (smashcraft:ts/scripts/playtest.ts)
  uses the same defaults.
