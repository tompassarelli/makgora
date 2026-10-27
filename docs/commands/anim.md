# Animation scorecard

`bun wisp anim score [--fighter F]... [--assets DIR]`
writes measured move rows and prints worst first. `bun wisp anim judge fetch`,
`anim judge prepare --out PRIVATE_DIR [--move FIGHTER:MOVE]... [--facing right|left]`
(right by default; `left` turns the fighter to check the other facing), and
`anim judge record SCORES.jsonl...` prepare and store independent visual scores;
smashcraft:docs/animation-scorecard.md describes calibration and the pass bar.
