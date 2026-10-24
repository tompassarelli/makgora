# Production move data

Historical record: the captures, trial tables and asset measurements below describe their named builds before the 9 October 2026 roster cut (#339). They are not the current roster or asset inventory.

For executable contact, punish and follow-up comparisons under named conditions,
see smashcraft:docs/move-comparisons.md.

Run `~/code/smashcraft/worktrees/playable-integration-20261005/tools/move-data/export.sh`
(or the same command in the current owned checkout) to run the pinned Bun
toolchain over Smashcraft's TypeScript simulation and write
smashcraft:build/move-export/moves.jsonl. The script reads timing, hit-region,
capsule, contact-math and motion facts directly from the game modules; it does
not import them into a second data table.

smashcraft:tools/move-data/moves.jsonl is the checked-in snapshot. `--check`
regenerates the export and compares every row to that snapshot at 12-decimal
numeric precision. A production-value change fails until it is inspected and
the snapshot is explicitly regenerated. The snapshot is generated output,
never tuning input. Do not edit numerical values in the snapshot.

```sh
jq 'select(.kind == "move" and .character == 0 and .move == "down-air")' \
  ~/code/smashcraft/worktrees/playable-integration-20261005/tools/move-data/moves.jsonl
jq 'select(.kind == "contact" and .move == "forward-tilt" and .character == 1) | {frame,region,damage,hitCapsule}' \
  ~/code/smashcraft/worktrees/playable-integration-20261005/tools/move-data/moves.jsonl
```

The offline emitter is smashcraft:ts/scripts/moveData.ts. It calls the
production timing, hit-region, capsule, knockback, shield and motion functions;
smashcraft:tools/move-data/export.sh is a small Bun launcher. The generated
facts are not game input and do not change the map build.

Each JSONL row has `kind`: `context`, `move`, `contact`, or `motion`. The join key
is `(character, style, chargeFrames)`. Character IDs are 0 Archer, 1 Rifleman,
2 Demon Hunter. There are 42 jab/tilt/smash/aerial identities, with nine extra
maximum-charge smash variants. Specials, grabs, ledge/get-up and dash attacks
are outside this export. Contact rows include every active frame and every
region considered by production, even identical overlapping regions. Lower
region indices win contact selection. A positive `window` permits one hit per
attacker/attack serial; a later higher window permits another hit. Thus an
early-to-late damage change is not itself permission to rehit.

`frame` is zero-based `attackFrame`: frame zero is the start tick, and startup
4 means first active contact at frame 4 (display frame 5). Timing excludes
hitlag and charge pauses. Recovery uses the character-specific active duration;
Archer down-air has a longer active interval than the other fighters. Smash
contacts show charge 0 and maximum charge; callers can query arbitrary charge
through `authoredHitRegion`. The full charge trajectory is not a motion row.

Damage, knockback growth/base, raw launch vector and eligibility envelope are
authored properties. `angleDegrees` is derived from that vector before facing,
DI and grounded launch adjustments. The vector is retained because it is not
necessarily unit length. `hitCapsule` is the actual facing-relative production
contact geometry; the envelope is its authoring input, not an additional
rectangle contact test. Hurt capsules are production's pose-independent
approximation, not animation hurtboxes or a reference-game parity claim.
Distances use simulation world units (six per Melee reference unit). JSON
numbers retain the TypeScript host's round-trip decimal representation of the
simulation values. Snapshot comparison rounds numeric values to 12 fractional
digits, matching the precision of the earlier exporter.

`derived` calls production math for one explicitly named context: pre-hit
percent 0, victim weight 100, context scale 1, no crouch/electric modifier except
the authored electric flag, digital shield strength 1, and one isolated contact.
These numbers do not establish that the move connects. Shield pushback/recoil
are contact coefficients; weight/motion-dependent recoil and actual separation
require a complete contact simulation. No frame advantage, reachable punish,
combo or balance score is claimed. Reference joins and contextual comparisons
remain in issue #12.

`motion` is a sampled production trajectory after `beginFighterAttack`: stage 0,
facing right, x=0, no input, zero initial velocity, ground z=0 or aerial z=700,
no opponent and no hitlag or charge. Each row is the state after `elapsed`
advances. Aerial gravity and any landing are included; this is not an animation
root-motion curve or all possible steering. The observed landing lag is obtained
by advancing an aerial from z=1, vz=-2 onto stage 0; aerials land with half
their authored lag, as L-cancelling is omitted
(smashcraft:docs/gameplay-design.md). Ground moves report zero landing lag.

Unrepresented autocancel windows and animation hurtboxes are explicitly `null`.
smashcraft:docs/move-reference-join.md records the factual action-family joins
and bounded trade-off analysis; it establishes no fighter equivalence.
Matchup-wide outcomes remain unknown; bounded reachable options are recorded
separately in smashcraft:docs/move-comparisons.md.
These are headless production observations, not native timing, physics-parity,
matchup or balance acceptance. Issue #12 remains open for the remaining work.

## Genre envelope

`bun wisp envelope` (from ts/) lists every move of the 26 fighters outside
its class's genre frame-data envelope, ranked by distance (#426). It is
advisory: `--ranges` prints the envelope, `--json` the outliers. The suite
gates the frame data under the reviewed #427 ruling: every hit move has
nonnegative integral startup, active and end lag that sum to its total; no
frame field exceeds its class range by more than three tier allowances
(9 normal, 30 special, 45 EX frames). Shield advantage and kill percent
remain advisory. A fighter balance-profile block can exempt a frame field
with `envelope: MOVE FIELD REASON`; exemptions fail once that field returns
inside its class range. They never exempt invalid frame structure.

Non-hit specials (movement, guards, buffs, recalls and commands without a hit effect) are outside the genre envelope.

The envelope is smashcraft:tools/move-data/genre-envelope.json plus the Melee
corpus in smashcraft:references/melee-frame-data/. For each move class (jab,
tilt, dash attack, smash, aerial, special, grab, throw, get-up/ledge attack,
spot dodge, roll, shield drop, jump squat), each game's 5th–95th percentile
is computed per field, and the envelope is the union across games. That way
Melee's 26 characters don't outweigh the hand-sampled games. Sources, all
public frame data recorded as facts on 10 October 2026:

- Melee: meleeframedata.com, through the existing corpus (all 26 characters).
  Shield advantage is computed with Melee's digital shieldstun formula
  (multiplier 1, ×200/201), and landing lag is L-cancelled.
- Smash Ultimate: ultimateframedata.com pages for Mario, Fox, Ganondorf, Marth
  and Bowser. Shield drop is 11 frames and jump squat is 3.
- Rivals of Aether: dragdown.wiki for Zetterburn and Kragg (hit endlag).
- Rivals of Aether II: dragdown.wiki for Zetterburn and Etalus.
- Kill percent for smashes: SmashWiki's up smash knockback chart (Mario at
  stage centre: 58–251% in Brawl and 73–194% in 64). The Melee and Ultimate
  charts on SmashWiki are empty.

Our values use production code. Startup is `attackStartupFrames + 1` (the
first active frame counted from 1). End lag is the frames after the last
active frame, and landing lag is the lag actually taken. Shield advantage
and kill percent are the balance feel measurements (smashcraft:ts/scripts/balanceFeel.ts).
The tolerance outside the range is ±3 frames, ±3 on shield and ±15% kill
percent, matching #355's kit bounds. Specials get ±10 / ±10 / ±30%, because
genre specials vary most and ours carry mana. EX specials get ±15 / ±15 / ±40%,
because they are deliberately stronger than any reference move. A smash that
doesn't kill within 300% is an outlier. Distance is the excess over the
allowance; anything above 1 is outside the envelope.

## Fighter strength profiles

`bun wisp strengths FIELD.json` reports per fighter over a balance field:
KO direction share (top, side, bottom), average KO percent, off-stage deaths
a stock (edge-guard kills taken plus self-destructs), edge-guard kills a
match and their conversion from edge-guard hits, and spacing (median hit
distance, plus ranged damage share). It compares these with each fighter's
intended strengths in smashcraft:tools/move-data/fighter-strengths.json.
Those come from the fighter's design doc, or are drafted (`drafted: true`)
from its smashcraft:docs/design/roster.md entry. A contradiction is a
measured roster third opposite to the intent: for example, "strong"
edge-guarding in the bottom third, or a "hard" recovery in the top third of
off-stage deaths.

Fields recorded since #426 carry each KO's blast side, the victim's percent,
whether it was recovering, and hit distances. Older fields estimate KO
direction from each killing move's authored launch angle, and they report
KO percent and hit distance as not recorded. A balance worker runs the
report before and after a change, and confirms that no new contradiction
appears.

## Aerial reach

How far each aerial's hit region reaches past what the fighter draws (#222),
measured with `bun wisp view reachcues --assets "$(bun wisp inputs path assets)"`
(from ts/) on 24 October 2026. For each aerial, played in the air facing right,
the drawn Classic model (body and held weapon, skinned at the clip time the
fighter pool shows) is projected onto the stage plane on every active frame,
and its bounding box over those frames is the drawn swept area. The value is
the hit capsules' furthest reach past that box on any side, in world units,
then in body heights (H = 132 units), then the side. Negative values stay
inside the drawn area. The margin is 0.15 H (20 units), the same one
`view reachcues` uses for reach flares (#481); smashcraft:docs/disjoint-legibility.md
sets no tighter one. **over** marks an aerial past the margin; every one is a
box in #223. Cairne's down air belongs to #96.

| Fighter | Neutral air | Forward air | Back air | Up air | Down air |
| --- | --- | --- | --- | --- | --- |
| rifleman | 28 (0.21) back **over** | 85 (0.65) front **over** | 58 (0.44) back **over** | 66 (0.5) up **over** | 3 (0.02) down |
| illidan | 13 (0.1) back | 60 (0.46) front **over** | 52 (0.39) back **over** | 23 (0.17) up **over** | 18 (0.13) down |
| blademaster | -29 (-0.22) down | -23 (-0.17) front | -25 (-0.19) back | -35 (-0.26) front | 18 (0.14) front |
| mountain-king | 4 (0.03) down | 18 (0.14) front | 8 (0.06) back | -22 (-0.16) front | 17 (0.13) down |
| warden | 12 (0.09) back | 18 (0.14) front | 3 (0.02) back | -32 (-0.24) front | 17 (0.13) down |
| lich | 17 (0.13) front | 13 (0.1) front | 18 (0.13) back | -9 (-0.07) up | 17 (0.13) down |
| forsaken-paladin | 0 (0) back | -3 (-0.02) down | -6 (-0.05) back | -1 (-0.01) back | -15 (-0.12) back |
| dreadlord | 64 (0.48) back **over** | 44 (0.33) front **over** | 67 (0.51) back **over** | -52 (-0.39) front | 108 (0.82) down **over** |
| shadow-hunter | -1 (-0.01) back | 42 (0.32) front **over** | 10 (0.07) down | -41 (-0.31) front | 32 (0.24) front **over** |
| pit-lord | 14 (0.11) back | -25 (-0.19) up | -17 (-0.13) down | -86 (-0.65) front | 86 (0.65) down **over** |
| beastmaster | 50 (0.38) front **over** | 0 (0) down | -5 (-0.04) down | -20 (-0.15) back | 76 (0.57) down **over** |
| lich-king | 14 (0.1) down | 27 (0.2) up **over** | -10 (-0.08) back | 56 (0.42) back **over** | 32 (0.24) down **over** |
| thrall | -2 (-0.01) up | 0 (0) up | -13 (-0.1) back | 2 (0.01) up | 17 (0.13) front |
| jaina-proudmoore | 35 (0.27) back **over** | 56 (0.42) front **over** | 41 (0.31) back **over** | 26 (0.2) up **over** | 88 (0.67) down **over** |
| sylvanas-windrunner | 29 (0.22) back **over** | 48 (0.36) front **over** | 64 (0.48) back **over** | -24 (-0.18) up | 52 (0.39) down **over** |
| cairne-bloodhoof | -22 (-0.17) back | -1 (-0.01) front | -18 (-0.13) down | 14 (0.1) up | -47 (-0.36) back |
| chen-stormstout | 3 (0.02) back | -20 (-0.15) front | -10 (-0.08) back | -23 (-0.18) front | 46 (0.35) down **over** |
| peon | 15 (0.11) back | 0 (0) front | -1 (0) back | 0 (0) back | -4 (-0.03) front |
| goblin-tinker | 47 (0.35) back **over** | 33 (0.25) front **over** | 57 (0.43) back **over** | -4 (-0.03) front | 108 (0.82) down **over** |
| kael'thas-sunstrider | 16 (0.12) front | 66 (0.5) front **over** | 34 (0.26) back **over** | 4 (0.03) front | 60 (0.45) down **over** |
| murloc | 8 (0.06) back | 24 (0.18) front **over** | 27 (0.2) back **over** | 8 (0.06) up | 37 (0.28) down **over** |
| grom-hellscream | 9 (0.07) front | 13 (0.1) front | 63 (0.48) back **over** | -34 (-0.26) up | 49 (0.37) down **over** |
| anub'arak | 16 (0.12) front | 20 (0.15) front | -12 (-0.09) front | -59 (-0.45) front | 59 (0.44) down **over** |
| malfurion-stormrage | 9 (0.07) back | 77 (0.58) front **over** | 55 (0.42) back **over** | 0 (0) front | 112 (0.85) down **over** |
| medivh | 12 (0.09) back | -4 (-0.03) front | -1 (-0.01) back | 20 (0.15) up | 34 (0.26) down **over** |
| kobold | -10 (-0.08) back | 2 (0.02) front | -1 (-0.01) back | 2 (0.01) up | 10 (0.08) down |

Before #222, Illidan's and Rifleman's down airs used the shared vertical down-air capsule and reached 215 (1.63) and 187 (1.42) below the drawn feet; both now sit on the driven leg.
