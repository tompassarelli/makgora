# Finished move: the bar every move meets

Every move and every Tom-facing build meets this bar whether or not its issue says so. Issues state intent; this page states the rest. A move that misses any line is unfinished work, and the Tom-facing gate (test-lean T7) refuses the build.

| # | Every move | How the gate checks it |
| --- | --- | --- |
| 1 | Every special shows a visible effect at game zoom, in both looks, unless it declares a body-only exemption. Its model path resolves (stock in the game data, or imported into the map), and a particle effect advances in time. | Headless property A5; native contact sheet E |
| 2 | The body drives the motion: a special plays a body animation or pose change, not effects alone. | Headless property A3; contact sheet E |
| 3 | Mirror symmetry: facing left and facing right give the same hitboxes, active frames and effects, mirrored. | Headless property A1; left and right contact sheets E |
| 4 | Effects despawn within their declared lifetime; nothing lingers after the move ends. | Headless property A2; native C4; native gate-specials-spot (dev#467) |
| 5 | The weapon stays in the hand that holds it and never passes through the fighter's own body. | Geometric check (wrist-held props, self-gouge) |
| 6 | Idle and stand loops are the stock clip, as smooth as the stock clip: no added jerk. | Headless property A4 |
| 7 | A cold viewer who sees only the contact sheet, with no move name, says what the move does and where it hits, and that matches the move's intent. Fighters stay legible against every stage. | Cold-viewer judge E; contrast per stage (#456) |

| # | Every Tom-facing build | How the gate checks it |
| --- | --- | --- |
| 8 | The cursor is visible on every frame of every menu, through pin pick, drop and sweep. | Native C1 |
| 9 | Pad Start starts the match from any cursor position. | Native C2 |
| 10 | Every binding in the pad contract (controller/) works, with LT and RT both shielding. | Rust property B; native C3 |
| 11 | Every standard keyboard key reaches the game, and every move of every fighter, the ultimate included, starts from its keys. | Headless `bun wisp smoke`; native gate-moves (dev#467) |

Tom's playtest checklist holds only feel, balance and legibility questions. Anything above that reaches Tom is a gate failure, and the gate gets the missing check before the fix lands.
