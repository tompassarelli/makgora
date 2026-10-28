# Physics reference and implementation

## Moving platforms

Smashcraft's moving decks follow closed paths of timed linear legs, including
stationary legs for waits. The match frame chooses a binary32 pose directly;
rollback and prediction use that same frame, with no accumulated stage timer.
The main deck stays fixed. Hidden test stages 3 and 4 provide a Smashville-style
back-and-forth platform and independent loop/lift patterns.

Grounded fighters ride their floor before their own motion, hitlag included,
and grounded traps and bears ride the same way. Landing remaps the previous
endpoint by the floor's displacement, so an already carried fighter is not
shifted twice. Down presses keep the pass-through gate, and floor tech recovery
rides the platform. Moving raised platforms have no ledge; main-deck ledges keep their usual
catch rules. Path dimensions and schedules are authored
here; they are inspired by Ultimate's layouts, without claiming Ultimate's
exact timing.

The live simulation is smashcraft:ts/src/game/sim/; native precision commands
are in smashcraft:docs/native-physics-precision.md.

## Launch, hitstun and stacking

A launch's speed is its knockback × 0.03 Melee units a frame, and airborne it
decays by 0.051 a frame (SmashWiki "Knockback"). Hitstun is knockback × 0.4
frames (SmashWiki "Hitstun"; smashcraft:docs/melee-hitstun-boundaries.md), and a
hit that would give 32 frames of hitstun or more, 80 knockback, tumbles
(SmashWiki "Tumble"). Hitlag follows SmashWiki "Hitlag"
(smashcraft:docs/melee-hitlag-scalars.md). The simulation resumes physics,
input gates and countdowns on the frame hitlag reaches zero; release DI and
ASDI happen before that frame's physics.

Two launches stack only when the second comes 10 or more frames after the
first and leaves the fighter airborne; otherwise the second replaces the first,
so a hit that keeps its target on the floor always replaces (SmashWiki
"Knockback", In Melee; smashcraft#536). From frame ten Smashcraft merges each axis: opposite
components add and same-direction components keep the greater magnitude. The
launch age freezes during hitlag. The contact batch first chooses its strongest
launch, then merges it once with residual motion; hitstun and reaction level
belong to the winning hit. Replay copying and exact comparison include the age,
ground tangent velocity and damage level, and reset and stock loss clear them.

A grounded hit below tumble strength that sends the fighter down or sideways
keeps it on the floor and projects the launch onto it, and DI cannot steer it
off; an upward or tumble-strength hit leaves the ground. Grounded knockback
decays by the fighter's ground friction (Captain Falcon, Fox and Falco 0.08,
Jigglypuff 0.09; smashcraft:references/melee-frame-data/character-attributes.csv)
and never reverses. A tumble-strength hit steeply into the floor bounces off it;
the angle and the bounce's speed are Smashcraft's, in
smashcraft:ts/src/game/sim/knockback.ts, as no public page states Melee's.

DI rotates the actual launch vector by at most 18° (SmashWiki "Directional
influence"), normalizing against the vector rather than the pre-direction
speed, so attacks with nonunit direction vectors keep the full rotation.

## Shield contact motion

A shield hit gives the defender pushback of (damage × 0.09 + 0.4) × shield, at
most 2, and the attacker recoil of damage × 0.07 + 0.02 (SmashWiki "Shield",
section "Shield pushback"). Shieldstun truncates the hit's damage to an integer first;
shield damage stays fractional. Defender pushback and grounded attacker recoil
are separate motion channels from held movement and launch. Both freeze during
hitlag and resume on its zero frame; defender pushback decays by the fighter's
ground friction. A later clean hit, shield break or respawn clears them, and
replay snapshots copy and compare them with the shield-drain transition.
Attacker recoil in the air keeps its own decaying vector
(smashcraft:docs/melee-air-cutoff.md), and its direction uses the shared scalar
approximation (smashcraft:docs/melee-scalar-math.md). The grounded recoil
friction factor, the airborne recoil decay and the airborne relative-motion
weight are Smashcraft's, in smashcraft:ts/src/game/sim/shield.ts and
smashcraft:ts/src/game/sim/motion.ts. A broken shield launches the fighter at
its shield-break initial velocity: Rifleman's is Fox and Falco's 3.3 Melee
units a frame (character-attributes.csv), Illidan keeps 24 world units.

Analog pressure and powershields are in smashcraft:docs/melee-analog-shield.md
and smashcraft:docs/melee-powershield.md.

## Arithmetic order

Positions add self velocity, then launch, then attacker recoil, rounding each
addition to binary32 in Melee units, on the ground
(smashcraft:docs/melee-ground-motion.md) and in the air alike. Gravity
subtraction rounds both operands and the result. Airborne launch converts its
velocity to binary32 Melee units, rounds the vertical square, fuses the
horizontal square-plus-sum, and compares the speed with the decay through the
derived boundary of smashcraft:docs/melee-air-cutoff.md. Above the cutoff it
takes the direction from the shared scalar approximation and subtracts each
decay component with one fused rounding, keeping tiny cardinal-axis residues
rather than forcing those axes to zero. Zero displacement keeps authored
stationary surface coordinates exactly. These orders are Smashcraft's
determinism rules.

## Fighter parameters

Smashcraft's fighters are original characters, and Melee verification concerns
shared equations and state rules (smashcraft:docs/gameplay-design.md,
"Principles"). Each fighter carries its own weight, gravity, fall and fast-fall
speeds, drift, friction and caps, ground speeds, jump parameters and
shield-break speed; shared physics reads those, and replay snapshots copy and
compare them. Reference fighters exist only as test rigs, assigned their
values from smashcraft:references/melee-frame-data/character-attributes.csv.
Illidan keeps his original tuning; the digital dodge and fast-fall controls
and the absence of stale moves are owner decisions in
smashcraft:docs/gameplay-design.md. The frame-data corpus at
smashcraft:references/melee-frame-data/README.md supports move research; it
supplies no hitbox geometry beyond libmelee's recorded positions, its raw
`gravity` field is not gravity and `stun` means shieldstun (its README has
the traps).

## Simultaneous damage contacts — 2026-10-02

SmashWiki "Knockback" states that Melee's percent term is the floored pre-hit
percent plus the sum of the hitbox damage dealt that frame. Smashcraft selects
the greatest knockback among a frame's contacts, keeping the earlier entry on a
tie, while attack power belongs to the individual hit.

smashcraft:wurst/MatchStep.wurst now opens one synchronous contact batch before
grab actions and resolves it after melee, specials, summons and projectiles.
Every current damage path participates: throws, pummel, ordinary attacks,
Illidan's direct special, bear swipes, hippogryph strikes, flinching lasers,
damage-only arrows, recoil shots and mana burn. Eligible contacts are collected
before ordinary damage can cancel another same-frame action. Each launch uses
the whole unblocked damage total and its own power, growth, base, direction and
sampled victim context; only the strongest installs launch, hitstun, tumble,
SDI and pending DI. Throw DI resolves immediately when the throw wins. Equal
launches use stable contact order, not an assertion of arbitrary order parity.

Damage-only arrows retain their lack of flinch and hitlag. Lasers retain their
existing no-launch flinch when no launching contact exists; they cannot erase
a simultaneous stronger launch's DI or replace its hitstun. Pummel retains its
hold and shared hitlag. Direct attacks still freeze their attacker, detached
sources do not, and hitlag takes the maximum applicable pause. Contacts caught
by a shield all damage that shield, including on a frame that breaks it;
shield damage is excluded from the victim's damage total. Catch priority,
parry, trap capture and per-window contact memory remain separate rules.

The batch uses reusable value-array scratch and allocates no objects while
stepping or replaying. It is empty at every completed frame boundary, so it
adds no persistent snapshot fields. Standalone pair operations also collect
and resolve a complete batch when called outside the match step.

The integrated `bash test.sh Tests` run passes 423/423 with zero compiler
errors; evidence is smashcraft:build/two-clients/contact-batch-aggregate.log.
Six new tests exercise reversed collection order and fractional pre-hit
percent, mixed projectile kinds, shield depletion, direct-special trades,
both summons, throw/pummel damage, and exact match-step snapshot restoration.
The throw-release trap counterexample initially consumed an armed trap after
the victim had been thrown; releasing grounding immediately repairs that
boundary while retaining deferred launch selection. The new assertion and
existing grab, freeze-trap, special, hit-timing and replay checks pass together.
These checks establish numerical behavior, not native presentation or pacing;
this change has not been built into or installed as a map.

This correction does not implement launch stacking across different frames,
whose common-data time gate remains unverified. Ground launch/friction,
bounce and shield pushback data gaps remain unchanged; fighter tuning and the
decisions in smashcraft:docs/gameplay-design.md are unchanged.

## Roll-facing correction — 2026-10-02

The pinned libmelee empirical data in smashcraft:build/ref-libmelee-framedata.csv
matches SHA256 8e0d811290b511902076c0011db1a0116356a7ddaa68dfa369ea4f5dcdc93777
at revision ef679270ff95f0d42339dcdf1608282a35023349. Fox (character 1) and
Falco (22), forward roll (action 233), first report `facing_changed=True` on
one-based frame 20; frame 19 is false. Backward roll (234) remains false.
Only these factual observations are used; no LGPL library helper implementation
or third-party gameplay expression is incorporated.

Rifleman logical facing turns on that event. A stored entry facing selects
the movement profile, animation clip/rate and pose orientation for the whole
dodge. The authored clips perform a somersault without a horizontal turn;
rendered orientation therefore stays at entry facing until the clip ends.
Authored hurt volumes use the same orientation. Snapshots, exact comparisons
and canonical state include entry facing; interruption, reset and completion
clear it. Illidan has no adopted Melee profile and retains his original
completion-time turn and 128-unit travel. Durations and intangibility stay
unchanged for all fighters, and backward rolls/spot dodges retain facing.

The focused `bash test.sh rollFacing` run passes 5/5 with zero compiler errors;
evidence is smashcraft:build/two-clients/roll-facing-tests.log. It exercises both
facings, frame 19/20, hitlag freeze, snapshot restore across the turn, canonical
state sensitivity, travel totals, platform clamps, and unchanged backward/spot
orientation. These numerical checks do not prove native clip playback. This
change has not been built into or installed as a map; native presentation still
needs a parent-owned build and observation.

## Initial implementation choices

Use a fixed logical frame step; frame counters drive jump squat, air dodge,
hitlag, hitstun, shield stun, and landing recovery. Warcraft schedules the
simulation and renders its result; wall-clock jitter does not alter a single
step's physics. Record the actual implemented rate with the simulation tests.

The simulation uses 60 logical frames/second and six Warcraft world units per
Melee distance unit. Movement, gravity, shield energy and ordinary knockback
use the numerical baseline below. Ground-jump launch speeds use Fox and Falco's
attributes (smashcraft:references/melee-frame-data/character-attributes.csv), and aerial jumps multiply the full-jump attribute by
the published aerial multiplier. The first ground-jump tick preserves launch
velocity; subsequent ticks apply gravity. The six reference-table apex targets
remain checked below. Digital direction input, simplified collision shapes and
Warcraft animation differ from Melee.

Minimum mechanics checks: press edges; short/full jump; air-jump budget; landing
from above only; air-dodge landing momentum; shield drain/regeneration/break and
stun; hitlag freeze then knockback/hitstun; one stock per blast-zone crossing;
respawn and final-stock result. Tests must call the simulation used by the map.

## Documented numerical baseline (Melee)

Ordinary empty landings now apply four recovery ticks for either fighter.
The independent implementation starts this only on an airborne-to-ground
contact, so standing on a surface does not restart recovery. Air-dodge,
aerial-attack, tumble/tech and ASDI contacts keep their separate rules.
Landing recovery counts down before input eligibility is evaluated: jumping,
moving and starting an attack can resume on the same expiration tick.
Hitlag freezes the countdown. Early attack presses now use the six-frame
live command window described below. The reference fact that normal landing uses a
character-specific interruption threshold is a design target taken from public
frame data (SmashWiki, Smashboards). The four-frame values come from the table
sources below. Light/heavy landing selection by fall speed is not modeled;
ordinary airborne contacts use this one recovery duration.

Retrieved 2026-09-29 from SmashWiki's character Stats tables. These are reported
reference values, not measurements of our map.
Sources: https://www.ssbwiki.com/Fox_(SSBM) and
https://www.ssbwiki.com/Falco_(SSBM). Only factual parameters are recorded here;
no article prose or implementation is reused. Cached pages are build artifacts.

| Parameter | Fox reference target | Falco / Rifleman target |
| --- | ---: | ---: |
| Weight | 75 | 80 |
| Initial dash speed | 1.9 | 1.9 |
| Run speed | 2.2 | 1.5 |
| Walk speed | 1.6 | 1.4 |
| Ground traction | 0.08 | 0.08 |
| Air friction | 0.02 | 0.02 |
| Air speed | 0.83 | 0.83 |
| Separate maximum air velocity | 3.0 | 4.0 |
| Air acceleration base + additional | 0.02 + 0.06 | 0.02 + 0.05 |
| Jump horizontal initial contribution | 0.72 | 0.70 |
| Ground-jump horizontal momentum multiplier | 0.83 | 1.0 |
| Ground-jump horizontal maximum | 1.70 | 1.70 |
| Aerial-jump horizontal replacement | 0.90 | 0.94 |
| Gravity | 0.23 | 0.17 |
| Terminal fall speed | 2.8 | 3.1 |
| Fast-fall speed | 3.4 | 3.5 |
| Jump squat frames | 3 | 5 |
| Full-jump height | 31.28 | 51.5 |
| Short-hop height | 10.65 | 11.58 |
| Double-jump height | 40.204 | 41.778 |
| Empty landing frames | 4 | 4 |

The horizontal attributes agree with SuperCombo Wiki's table in
smashcraft:references/melee-frame-data/character-attributes.csv. Ground takeoff scales prior
self velocity, adds held-direction momentum, then caps it. Aerial jump replaces
horizontal self velocity, including zero for neutral input. Countersteering
preserves overspeed; matching input above the drift target brakes by air friction
and obeys the separate maximum. Ground takeoff does not apply drift or air
friction until the following tick. The vertical launch and first-tick ordering
are described in the jump checkpoint below; all six isolated jump-height
targets remain unchanged.

Distances and velocities are Melee units and units/frame; do not insert them
into a seconds-based Warcraft velocity without converting. Prefer simulation
units with rendering scale at the boundary. Report jump heights are trajectory
targets, not initial velocities; verify discrete integration before choosing
launch velocities. We target 60 logical frames per second independently of
render cadence.

Historical fixture before #339: The `completeJumpTrajectoriesMatchReferenceHeights` test advances each complete
trajectory for 120 ticks, starting jumps through input and measuring height
above takeoff. The six expectations remain Archer full/short/double
31.28/10.65/40.204 and Rifleman 51.5/11.58/41.778 Melee units, within 0.02
world units. The airborne double-jump fixture starts 100 world units above
the platform with one jump remaining. This checks simulation trajectories and
landing, not native timing, animated pose height, or disc-revision parity.

Walking/running off a floor or dropping through a platform leaves at most one
aerial jump. This transition removes the grounded jump once; subsequent falling
ticks do not consume the remaining jump. Landing still restores the normal budget.

Additional factual rules from https://www.ssbwiki.com/Hitstun,
https://www.ssbwiki.com/Knockback and https://www.ssbwiki.com/Shield:

- Melee hitstun uses 0.4 times knockback. Rounding and start/end frame accounting
  need explicit tests; the multiplier alone does not settle boundary timing.
- Launch speed is knockback times 0.03; knockback speed decays by 0.051 per frame.
- Melee shield maximum health is 60, ordinary damage multiplier 0.7, held drain
  0.28/frame, and regeneration 0.07/frame. Shield release lag is 15 frames and
  minimum hold is 8 frames. Analog light-shield behavior is a later difference.
- Air dodge leads to helpless fall, or special landing on ground contact;
  landing with horizontal momentum is the basis for wavelanding/wavedashing
  (https://www.ssbwiki.com/Air_dodge). Numerical dodge parameters remain unsourced.

Adoption is mechanic-specific. A test passing against provisional constants
is not proof that the entire table has been adopted or that feel matches.

## Top blast-zone eligibility checkpoint

Production top-boundary death requires position strictly above the boundary
and either grounded state, an active frozen state, or upward knockback above
Smashcraft's launch threshold in smashcraft:ts/src/game/sim/, which no public
page states for Melee. Ordinary jump velocity does not meet it. Production tests
cover jump-only ascent, the exact launch threshold, a qualifying launch, and
contact exactly at the top boundary. Star and screen KO selection, camera
constraints and death/respawn phase clocks remain open. Side and bottom
comparisons now also require strict crossing; the six-test blast-zone group
passes boundary-adjacent cases and the existing stock/ASDI cases. Frozen-state
release ordering is still unverified.

## Initial dash and dash dance

Grounded directional entry still assigns the authored initial dash speed of
1.9 Melee units/frame (11.4 world units/frame). Each following held-direction
tick now updates velocity instead of holding that value for the entire
authored thirteen-tick phase. Velocity above the fighter's run target brakes by
that fighter's traction. Velocity below the target accelerates by the
fighter-owned ground acceleration multiplier plus base, then clamps at the run
target and ground speed cap. The original roster currently shares authored
defaults of 0.1, 0.02 and 3 Melee units/frame for those three values; these are
Smashcraft tuning choices and are not imported Falco/Fox character stats.

The test-only Falco rig injects Falco's dash and run accelerations 0.1 and
0.02 and ground maximum 3 (character-attributes.csv). A frame-by-frame test checks the walk-to-dash entry, where the dash's initial
velocity 1.9 (character-attributes.csv) replaces the walk velocity, and the next
five overspeed-braking positions and velocities on both Rifleman hosts;
deliberately perturbed starting velocities are detected at the first sample.

Holding the stick backward during the initial dash without a fresh smash is a
moonwalk, as in Melee. The fighter stays in Dash, keeps its dash direction and
facing, and the dash animation keeps playing forward. Each tick moves velocity
toward the backward run target scaled by the stick, with the forward dash's
ground acceleration multiplier and base times a moonwalk factor of 2.25, so the
fighter slows, reverses and slides backward while still facing forward.
A backward tilt below 0.8 counts, and so does a full backward stick once the
tilt has been held for the three-sample smash window (Melee needs two frames);
a fresh smash back is still a dash-dance turn. The first two samples of a tilt
hold velocity while a smash can still arrive. The moonwalk ends at the dash's
run-enable frame; a stick still held back then turns the fighter as before.
Released, the dash slides on by the fighter's traction, so lower traction
slides farther back. Dash entry replaces earlier velocity (the Falco
entry above); SmashWiki's moonwalk reverses most fighters from a standstill
without carrying them past their start, and the 2.25 factor is set to that.
Blademaster at traction 0.06, tilting back for three frames and then holding
full back, goes from 11.9 world units per tick forward to reversing on dash
frame 11, leaves the dash at -5.3 and comes to rest 19 units ahead of where
the dash began.

The authored dash window and three-sample stick reversal policy are specified
in [gameplay design](gameplay-design.md#dash-dancing). Run-turn braking remains
an explicit authored action rule, and the authored phase no longer holds dash
speed. The simulation keeps separate Dash, Run, TurnRun and RunBrake ground
actions with an actor-owned command clock; Dash entry consumes its first
animation update before movement. TurnRun holds its facing step until velocity
along its entry-facing direction is at most 0.01 Melee units (0.06 world
units); the next action update flips facing, then the remaining animation
frames run before the action returns to Run. RunBrake's command check does not
make forward input enter Run; opposite input can enter TurnRun at RunBrake's
current frame. RunBrake ends when its clip ends or its fighter countdown
expires, whichever comes first; Fox and Falco's countdown is 30 frames
(character-attributes.csv, "Maximum RunBrake Frames"). TurnRun completion enters
Run only while forward input remains held; otherwise it returns to Wait.
Smashcraft fighters keep authored timing (currently 14/9/20/15). The command
frames of Melee's dash, run, turn and brake actions are not on a public page,
so test rigs use the same authored timing. Replay capture and equality include
all ground-action clocks, the RunBrake countdown and actor rule values.

The walk modifier immediately selects the existing 1.6/1.4 walk speeds and
clears the dash phase; releasing it starts a fresh initial dash. Jumps, shields,
attacks, dodge actions, hitstun, ground departure, landing and stock loss/reset
clear that phase while retaining their existing eligibility and momentum rules.
Hitlag freezes the phase and displacement. Grounded recovery still gates motion;
held direction starts a fresh dash on its expiration tick. Digital input has no
analog tilt or stick-smash threshold, and initial facing changes have no separate
turn startup. Dash attacks, crouch cancels and animation changes are outside
this movement slice.

The focused `initialDash` simulation filter passes 6/6 tests, the under-target
acceleration/cap check passes 1/1, and the aggregate suite passes 430/430. The
independent recorded-dash comparison passes on both host identities and the
perturbed-input case fails at the expected first frame. The aggregate output is
smashcraft:build/wurst-tests/shared-dash-full.log. Native dash-dance feel and
keyboard delivery timing have not been validated for this change.

A later S/F short-tap report exposed an adapter loss: a press and release
between service ticks left `directionX()` neutral, so no initial dash ever
started. `PlayerInputState.consumeMovementX()` commits that horizontal press
once when neither direction remains held, then returns neutral on following
ticks. Opposing held directions and opposing taps in the same commit remain
neutral. Both players use this sampler; committed input rows retain the result
for replay. Existing dash speed and neutral traction are unchanged. A dash starts with an initial velocity and then accelerates or brakes by
ground acceleration and friction (character-attributes.csv), which supports
preserving a short tap.

Grounded Shield + normal Attack now chooses the same grab command as O for
both fighters, including pressing shield and Attack within one frame. The
existing shield-stun/action locks still decide when the grab may begin. O
remains the dedicated grab binding. Neither path introduces an aerial grab.

## Hit timing and knockback

For a normal non-electric, non-crouching hit, the Melee hitlag baseline is
floor(floor(damage) / 3 + 3), so a 15-damage hit yields 8 frames. Electric and
crouching modifiers have separate truncation stages in `victimHitlagFrames`.
Source: https://www.ssbwiki.com/Hitlag. Digital shieldstun's documented expression
is (damage * 0.45 + 2) * 200 / 201; determine integer frame accounting explicitly
when implementing rather than treating a real-valued duration as exact frames.

For ordinary percent-based hits, the documented knockback baseline is:

    K = (((p / 10 + p * d / 20) * 200 / (w + 100) * 1.4 + 18) * g + b) * r

Here p is post-hit percent (Melee floors the pre-hit percentage before adding
this frame's fractional damage), d is integer attack power, w is victim weight,
g is growth divided by 100, b is base knockback, and r is contextual scaling.
Raw magnitude is capped at 2500 before crouch (2/3) or interrupted-smash-charge
(1.2) scaling. The state is sampled before interruption clears it. With no
staling queue, attack power is truncated scaled move damage, with a minimum
of one for positive damage below one. Zero damage retains zero power. The fixed-power
helper substitutes percent 10 and the declared fixed power; no current move
declares fixed knockback. DI and special launch angles remain distinct rules.
For a 12-damage hit on weight 80 at 0 pre-hit percent, growth 100,
base 20 and ratio 1, K is 51.0666667, launch speed 1.532 and floor(0.4*K) is 20.
These are useful independent arithmetic expectations for our Wurst tests.

Our design target for the percent timing is that accumulated percent is cast to
an integer before the ordinary branch adds a fractional temporary component. The
same path has a separate fixed-knockback branch and caps its result. The
numerical cap of 2500 comes from the published Knockback reference
(SmashWiki); no growth/base values are inferred beyond the published tables.

`ordinaryHitKnockback` now receives pre-hit percent, this hit's damage, victim
weight, growth percent, base knockback, and context scale independently. The
map supplies growth and base from the selected hit region, with defaults of
100 and 20 for unchanged moves and contextual scaling of 1.
`ordinaryHitlagFrames` and `ordinaryHitstunFrames` make the normal
hit frame conversions testable at their integer boundaries. These helpers
include the corrected integer-power boundary, raw cap and sampled motion
modifiers. Hitstun has a minimum of one tick for an ordinary flinching hit.

The fractional-power boundary is our design target: the contact counters
convert damage to an integer power. The damage percentage
itself is not rounded up. `integerHitPower` owns this conversion for knockback,
hitlag and digital shieldstun. A 0.25-damage hit at 12.75 pre-hit percent on
weight 80, growth 100 and base 20 produces 40.8583333333 knockback and two
shieldstun ticks. Previously the zero-power conversion produced a different
launch and only one shieldstun tick. The focused timing check passed **5/5**
with zero compiler errors (smashcraft:build/physics-fractional-power.log).
These checks establish the conversion and existing formula behavior, not
independent frame-trace or native-game parity.

Stale moves and freshness bonuses are omitted (smashcraft:docs/gameplay-design.md,
“Stale moves and freshness bonuses”): there is no staling queue or projectile
staleness snapshot.

SmashWiki's Hitstun article identifies the unconditional subtraction of one
frame with Ultimate, not Melee. Smashcraft keeps floor(0.4*K) and decrements
the counter before the damage state's input transitions, so jump and attack
become eligible on the same expiry tick. The focused test exposed
and corrected our jump check occurring before the hitstun decrement.

SmashWiki's Hitlag article gives separate truncation stages for base
duration, effect multiplier and crouch multiplier, and the cap of 20. Normal hits now
derive hitlag from damage (zero damage gives zero), including tip/weak regions;
shield contacts pause the victim's shieldstun during hitlag, and detached
projectiles/summons do not freeze the summoner. Numerical crouch state is
replay-safe and clears on incompatible actions. The victim formula is
floor(c * floor(e * floor(3+floor(d)/3))), capped at 20;
the attacker's e and c remain 1. No later-game tipper hitlag multiplier applies.
No current move is electric; testing its math does not invent an electric move.

Electric effects now travel in the production `hitEffect` contact data. The
largest eligible hurt-contact damage supplies integer hitlag power, while the
strongest launch selects its electric effect. Strictly greater knockback wins;
equal-strength launches retain the first effect. Shields and the direct
attacker keep ordinary hitlag, and detached contacts leave their source
unfrozen. Existing move definitions remain ordinary. The sampled crouch state
continues to apply after the electric truncation stage. Contact scratch is
consumed synchronously and introduces no persistent snapshot state.

These selection rules are our own design targets, set from public frame data
(SmashWiki, Smashboards). Four focused production-contact tests
cover direct/detached contacts, shield timing, crouch/electric truncation,
strongest-element versus largest-damage selection, reversed batches and ties.
The assembled aggregate with fractional-power correction passed **409/409**,
zero compiler errors and one existing warning
(smashcraft:build/physics-electric-aggregate.log). Numeric common-table
confirmation and original-game hitlag traces remain outstanding.

## Recorded neutral-fall comparison

the recorded design targets retains ten
recorded Falco positions, neutral inputs and source identity from the public
Slippi fixture `ntsc.slp` at repository revision
ff815345e641836a331191320c0f6eae21542a5f. Original frames -59 through -50 are
compared through the production `advance` path, starting at the recorded
position on frame -60 with the declared zero-velocity fall-entry condition.
Expected positions are directly transcribed from the recording. The comparison
returns the first differing original frame; a deliberately altered initial
velocity must be detected on frame -59.

The source records `isPAL = false`, but does not identify the NTSC disc revision.
Its old protocol does not export velocities, grounded flags, hitlag or hitstun
counters. Zero initial self velocity is a declared entry condition tested by
the next recorded displacement, not a sampled oracle field. The comparison
covers neutral airborne gravity and position integration before floor contact.
Landing, terminal speed, knockback, action startup and full revision-specific
parity remain outside this trace. The position tolerance is 0.0001 world units
(about 0.0000167 Melee units), accounting for recorded per-frame binary32
rounding versus test/runtime arithmetic.

The LGPL-3.0-or-later Slippi parser 9.1.3 was executed unmodified only as a local
intake tool. No parser implementation or binary recording is included in the
map or these references; the retained excerpt is numerical telemetry.
Both comparison tests passed, including first-frame detection of the deliberately
perturbed velocity. The existing `recorded` filter passed **5/5**, with zero
compiler errors and one existing warning (smashcraft:build/physics-slippi-fall.log).

The second independent recording excerpt,
the recorded design targets, captures
neutral held jump on original frames 25 through 30 in `wavedash-1.slp`.
Frames 25–29 are grounded squat; frame 30 is airborne, with recorded self
velocity 4.099999904632568 Melee units/frame. The test starts from the recorded
grounded position and zero velocity on frame 24, presses jump on frame 25,
holds it throughout and runs the production `advance` path. Height is measured
above the recorded grounded origin, subtracting its collision epsilon. This
preserves displacement and velocity while using the simulation's floor origin.
No unexported jump-squat countdown is treated as an observed field.

The comparison returns the first differing original frame; moving the input
one frame later must report frame 25. The source's protocol 3.19.0 exports
grounded flags and velocities, but its NTSC flag does not establish disc
revision or an unmodified gameplay build. The next recorded frame introduces
analog steering and trigger input, outside this neutral-entry fixture. Whole
jump trajectories, short hops, dodge/landing and native Warcraft execution
remain unverified by this excerpt.
The `recorded` filter passed **7/7**, including the jump comparison and the
delayed-input counterexample, with zero compiler errors and the existing
unused-import warning (smashcraft:build/physics-slippi-jump.log).

Launch speed already uses 0.03*K, converted by the six-world-units scale.
A hit tumbles when knockback × 0.4 reaches 32 frames of hitstun (SmashWiki
"Tumble"), grounded or airborne. Only tumbling landings tech or knock down; a
weaker airborne hit lands, or keeps its stun below launch speed 0.5 (SmashWiki
"Hitstun"), because its launch never reaches Smashcraft's knockdown speed in
smashcraft:ts/src/game/sim/knockback.ts.
smashcraft:ts/src/game/sim/tumbleLandings.tests.ts checks every authored move
of each fighter at 10, 50 and 100 percent, grounded and airborne.

## Frame-authored hit regions

The match selects a facing-mirrored capsule for each active move region and a
separate capsule for each target body. Strike direction follows move identity:
jabs and horizontal attacks have horizontal centerlines, angled tilts follow
diagonal paths, and up/down aerials have vertical centerlines. Grounded upward
strikes use rising diagonals. The custom reach envelopes calibrate the strike
span; they are no longer victim-origin rectangles. Radii range from 10 to 40
world units according to the authored strike. Rifleman and Demon Hunter
use body capsules with radii 24, 26 and 25, extending from local z=4 to
88, 96 and 102. These are provisional, pose-independent custom tuning values,
not Melee hitbox or hurtbox measurements. Contact reach changes with this
explicit replacement; damage, active frames, recovery, and fighter stats do not.

An ordinary move connects when its capsule reaches either the body capsule or
the active shield circle. The shield query uses the move capsule's finite
radius, the fighter's authored shield center and radius, and the current shield
size multiplier. A contact covered by the shield enters the existing shield
damage/stun/pushback path; a contact outside the shield circle can hit the body
while guard is held. A capsule can also reach the shield before the body. The
first overlapping move region retains priority, and a shield intersection on
that selected region blocks its body intersection. Both fighters' selected
effects and facing are copied before applying either hit, so trades retain
their original regions. Hit application retains the maximum of existing and
incoming hitlag. Normal grabs and dash grabs keep their origin-range query and
shield bypass; projectiles keep their independent swept query. Multi-hit
specials still use their prior broad contact checks.

Flat forward tilt (style 6) has an inner reach envelope at local x=0–110 and a
higher-priority tip at x=90–145, both at local z=-130–130. The selected
horizontal centerlines end at x=76 (inner) and x=111 (tip), at z=45. Facing mirrors x. Its active frames remain 5–6, total duration 28;
the angled forward tilts retain their existing single regions and effects.
Damage and reach envelopes are independently authored provisional values, not
Melee measurements:

| Move / region / attack frames | Damage | Growth % | Base knockback | Hitlag ticks | Local launch direction (x,z) |
| --- | ---: | ---: | ---: | ---: | --- |
| Forward tilt tip / 5 | 10 | 110 | 24 | 6 | (0.8, 0.6) |
| Forward tilt inner / 5 | 7 | 80 | 16 | 5 | (0.7071, 0.7071) |
| Forward tilt tip / 6 | 8 | 90 | 18 | 5 | (0.8, 0.6) |
| Forward tilt inner / 6 | 5 | 70 | 12 | 4 | (0.7071, 0.7071) |
| Up aerial opening / 5–6 | 4 | 60 | 14 | 4 | (0.25, 0.9682458) |
| Up aerial finisher / 7 | 8 | 110 | 24 | 5 | (0.25, 0.9682458) |

Ordinary moves share window 1 across all their regions and active frames.
A victim records the opposing fighter, attack serial and latest contact
window; changing regions, leaving/re-entering the region, hitlag, and continued
overlap cannot repeat that hit. Shield contact consumes the same window. This
record is scoped to the current two-fighter match, not a history for multiple
concurrent opponents. Starting another attack increments its serial. Respawn
reset clears the victim's record.

Up aerial explicitly advances from window 1 on frames 5–6 to window 2 on
frame 7, permitting one opening hit and one finisher if the target remains
in range. Missing the opening does not prevent a finisher. Its old bounds
(x=-105–105, z=20–190), three active frames, total duration 34 and authored
landing lag 15 (landing with 7) are retained. Hitlag freezes the authored attack clock, so the second
window is reached after those frozen ticks rather than after a wall-clock
delay. Each window can connect once; it does not reset every active frame.

Ordinary strikes now test the capsules described above. Grab and special
queries remain simplified, and the capsules are not pose-derived hurtboxes.
Animation alignment, character-specific tuning, and native combat feel remain
open. Existing clip frame clocks and recovery durations are preserved.

The `SimulationTests` filter passes 146/146 tests, including nine added
resolution tests for overlap priority, mirrored launch, early/late effects,
frame/geometry boundaries, per-target contact memory, shield contact, re-hit
windows and trades. The compiler reports zero errors and warnings. Evidence:
smashcraft:build/wurst-tests/hit-regions-20260930-final.log. Integration passed
211/211 tests in smashcraft:build/wurst-tests/hit-regions-integrated.log. Map build
`hit-regions` succeeded with the four existing warnings and was installed;
the running client has not loaded it and native combat feel is unverified.

## Grounded knockdown and jab resets

Our design target, from public frame data (SmashWiki "Get-up attack" and
"Tech"), is separate bound, wait, down-damage, stand, get-up attack and
directional-roll states. The input thresholds and the down-wait timeout below
are Smashcraft's, held in smashcraft:ts/src/game/sim/down.ts; no public page
states Melee's.

- DownBound's entry forgets earlier A/B presses. As the bound ends, a get-up
  attack pressed during it starts (presses stay live longer than any bound),
  else a get-up roll from the held stick, else DownWait, which stands once its
  timeout runs out. DownWait reads that same frame's input.
- DownWait counts down, then stands. Each frame it takes, in order: an A or B
  press (get-up attack), the stick tilted sideways below the roll angle (roll
  forward or back relative to facing), and the stick tilted up at the roll
  angle or more, or an L/R press (stand).
- A C-stick flick does the same on the frame it crosses its threshold: an up
  crossing attacks and a sideways crossing within the roll angle rolls,
  preferring it to the left stick. The roll is forward or back by the flick's
  side. The C-stick is digital here, so a press of its smash direction is the
  crossing; held through the wait it does nothing.
- Smashcraft also stands on Jump and treats a sideways press released within
  its input row as a roll, for keyboards.

smashcraft:ts/src/game/match/knockdownInputContracts.tests.ts drives these
through helper rows, journal packets and synchronized input messages after
low-, medium- and high-percent knockdowns.

FightCore gives Sheik 49 frames for each get-up attack and 35 for each
directional get-up roll (smashcraft:references/melee-frame-data/fightcore.csv,
"Getups/Techs"); other characters' lengths vary by one or more frames.
Smashcraft uses one shared profile (smashcraft:docs/gameplay-design.md,
"Controls"): 26 bound, 13 down-damage, 30 stand, 49 get-up attack and 35 get-up
roll ticks. The bound, down-damage and stand lengths and the get-up
intangibility (20 frames for stand and forward roll, 23 for a backward roll
face-up, 20 face-down, 27 and 22 for the Up and Down get-up attacks) are
Smashcraft's timing; no public page states Melee's. Animation frame 0 is shown
on simulation recovery frame 1, so protection through animation frame N covers
simulation frames 1 through N.

A frame whose contacts sum to 7 damage or less on a fighter in DownBound,
DownWait or DownDamage is a jab reset (SmashWiki "Lock": the hit "can only deal
a maximum of 7%") and enters the 13-tick DownDamage reaction. Its hitstun is
retained; after the animation, remaining hitstun sets the down-wait timeout,
and an expired timer forces stand. Damage above 7 interrupts the grounded
recovery and follows ordinary launch
resolution. Damage-only arrows do not enter DownDamage.

The numerical face-up/down choice follows the sign of the launch's vertical
component. This stable approximation selects the two reference action families;
it does not simulate Melee's joint rotation. The update pins downed fighters to
their selected stage surface. The prototype omits physical rebound and uses an immediate grounded bound.

Get-up attack damage, hit shape, knockback, and startup remain Smashcraft move
tuning, not character move data from Melee. The implementation now records
down-wait remainder and face selection in replay snapshots so jab-reset and
recovery frames restore with the same future outcome.

## Floor bounces

Melee is the design target here, from public sources only:

- A tumble-strength downward hit on a grounded target bounces it off the floor
  with 20% less knockback ([SmashWiki, Meteor smash](https://www.ssbwiki.com/Meteor_smash)).
  Smashcraft reflects the vertical launch upward at 0.800000011920929 when the
  hit points more than Smashcraft's 10° below the floor
  ("Launch, hitstun and stacking"); at high percent this carries the
  target off the top blast zone.
- Meteor smashes on grounded targets cannot be teched up to Brawl
  ([SmashWiki, Tech](https://www.ssbwiki.com/Tech)), so the bounce happens
  at contact and a held tech does not stop it. The later landing techs as usual.
- Before Smash 4 a midair target driven into the floor gets no bounce and stops
  its fall ([SmashWiki, Meteor smash](https://www.ssbwiki.com/Meteor_smash)).
  Smashcraft instead follows Smash 4 and Ultimate, where floors "no longer halt
  the momentum" and the fighter rebounds "much like a stage spike with the
  floor instead of a wall" ([SmashWiki, Floor](https://www.ssbwiki.com/Floor)),
  so a meteor can carry a midair target off the top blast zone (a deliberate
  divergence, ledger row `floor-rebound` in smashcraft:docs/design/melee-parity.md).
  A tumbling airborne fighter with no tech in the window whose downward
  knockback exceeds the wall reflect threshold (1 Melee unit a frame) rebounds:
  its knockback plus own velocity reflects upward at 0.800000011920929, it stays
  tumbling with its hitstun, and the 3-frame reflect cooldown applies, the same
  rule walls and ceilings use. A tech pressed in the window still techs, and a
  slower arrival enters the bound.

A reset also needs knockback below tumble, under 80 units
([SmashWiki, Lock](https://www.ssbwiki.com/Lock)). A weak hit with tumble
knockback on a bound or lying fighter launches it. A reset hit with 13 or more
frames of hitstun is a half-reset: after the 13-frame reaction, the remaining
hitstun runs as a down wait with get-up options, then the forced stand.

smashcraft:ts/src/game/sim/knockdownBounce.tests.ts checks these rules.

## Directional influence

Melee reads the control stick on the last hitlag frame. A direction perpendicular
to the launch path can rotate it by about 18 degrees; partial stick tilt weakens
the change, and a parallel direction produces none. Source: the Melee section of
SmashWiki's Directional influence article, retrieved 2026-09-29
(cached at `build/ref-Directional_influence.html`).

The simulation samples the keyboard's left/right/up/down axes exactly once on
the last frozen tick. It normalizes diagonal digital input, computes the signed
cross product against the launch direction, and squares its signed magnitude to
set the rotation up to 18 degrees while preserving launch speed. The smooth
keyboard approximation cannot represent analog tilt, and this response curve
is an independent approximation of SmashWiki's "Directional influence". A neutral or
parallel input does not change the path.

## Smash DI and ASDI

The Melee reference reports a six-unit shift for each SDI pulse and a
three-unit shift for ASDI; attacks with fewer than two hitlag frames cannot be
SDI'd. Source: SmashWiki contributors, “Smash directional influence,” article
revision dated 2026-09-17, retrieved 2026-09-30,
https://www.ssbwiki.com/Smash_directional_influence (CC BY-SA 4.0). These
mechanics and numeric facts are used as reference only; no article text or game
code is copied.

Keyboard callbacks retain the newest digital SDI pulse until the next simulation
tick, separately from held directions. Entering a nonzero horizontal or vertical
component, including reversing its sign, captures the complete direction vector.
A press and release delivered together therefore retains its pulse without
pretending the direction is still held. At most one pulse is used per tick;
adding a diagonal component creates one, removing a component does not, and a
held direction does not repeat. Every tick expires the pulse, including menus
and ticks outside victim hitlag, so it cannot wait for a future hit. During
victim hitlag the pulse shifts the fighter once by 36 world units. SDI is
unavailable during a one-frame freeze. On the
last hitlag tick, ASDI shifts once by 18 world units in the held left-stick
direction, unless a C-stick direction is held; C-stick never changes DI, which
continues to use left-stick input. Shifts use a swept top-surface check, so ASDI
can land without tunneling through a platform. An ASDI landing cancels
non-tumble hitstun; tumble uses the existing tech window or knockdown recovery.
SDI cannot move down through a platform or up off a grounded, non-lifting hit.

This prototype uses keyboard axes instead of analog stick thresholds and does
not model grounded launch eligibility fully: ordinary hits currently send the
target airborne. Shield SDI is not implemented. Native held ASDI and tapped
SDI were observed in build 003040. Native callback tracing subsequently showed
short press/release pairs delivered together in roughly 100 ms batches. Retaining
the pulse fixes loss between simulation ticks; it does not remove that engine
delivery latency. See smashcraft:evidence/development-plan.md for the recorded input sequences.

## Separated launch velocity

Ordinary movement (`vx`, `vz`) and launch momentum (`knockbackX`, `knockbackZ`)
are stored separately. Position uses their sum. The factual Melee baseline is
launch speed `0.03 * knockback`, decaying by `0.051` per frame independently
of ordinary self-velocity friction; falling speed still takes effect. This simulation applies
the `0.051 * 6 = 0.306` world-unit decay to the launch vector's magnitude,
preserving its direction, while ordinary gravity and terminal speed affect
only `vz`. Decay occurs before displacement and freezes during hitlag. Launch
decay continues after hitstun expires, and the player can
steer ordinary movement again when hitstun reaches zero. This keeps a downward
launch above the ordinary terminal-fall cap. The additional gravity-based
launch adjustment introduced in Brawl is not part of this Melee target.

A new ordinary hit resets movement velocity; how its launch combines with an
earlier one is described in "Launch, hitstun and stacking" above. Landing removes vertical launch
momentum and retains horizontal carry. A tumble landing that enters tech or
knockdown recovery clears both launch components. Bounce momentum loss and
Melee's low-knockback grounded launch rules remain unimplemented.

## Air-dodge protection checkpoint

The locally cached SmashWiki Air_dodge table reports Fox and Falco intangible
on frames 4–29 inclusive, with a 49-frame animation. The simulation now tracks
the dodge frame separately from motion, blocks both strikes and grabs during
that interval, and ends dodge protection on landing or interruption by a hit.
Respawn protection is independent. The renderer lowers fighter opacity using
the same protection query used by hit detection.

The frame sweep test checks both characters at each frame 1–30. Additional
tests cover damage interrupting startup and landing ending dodge protection.
Neutral and directional dodge force and its decay are Smashcraft's, in
smashcraft:ts/src/game/sim/, since SmashWiki "Air dodge" gives no speed. The
simulation applies the decay for 29 moving ticks and ordinary gravity plus air
drift from tick 30, inside the 49-frame animation of SmashWiki's table. Entry
reaches animation frame one before the first physics step, so this is 29 decay
steps, not 30. Hitlag freezes the action clock and resumes this boundary on
expiry; snapshot fields preserve the phase. Tests exercise neutral and both
diagonal vertical directions, all three steering inputs, the exact 29/30
boundary, hitlag, and restore/replay through the boundary. The original
roster and the 18-degree horizontal air dodge
(smashcraft:docs/gameplay-design.md) are unchanged.

An accepted air dodge replaces prior ordinary movement and clears both launch
momentum components, including for neutral input. This follows the momentum
halt described in the Melee section of https://www.ssbwiki.com/Air_dodge.
During each airborne motion tick, the simulation multiplies both dodge velocity
components by the dodge decay before either displacement. A 45-degree input therefore
travels along a 45-degree line until contact; neutral input stays still during
the motion period. This integration order is our implementation choice, not a
claim of frame-exact Melee motion. Ordinary gravity and launch decay keep their
existing order outside dodge motion.

The Landing Lag tables at https://www.ssbwiki.com/Fox_(SSBM)/Air_dodge and
https://www.ssbwiki.com/Falco_(SSBM)/Air_dodge report 10-frame landing animations
(retrieved 2026-09-30). Both characters now receive 10 ticks of landing recovery.
The contact tick starts the counter at 10; each subsequent tick reduces it,
and actions become available when it reaches zero. Landing retains horizontal
dodge velocity; subsequent grounded ticks apply traction, even if the airborne
motion timer has not expired. Tests cover cleared launch momentum, neutral and
diagonal motion, fast swept platform contact, sliding, and the exact recovery
boundary. Numerical speed, decay, motion duration and native feel remain
separate calibration work.

### What the wavedash landing flows into

The wavedash landing flows into a dash or a walk depending on whether the stick made a fresh
press during the 10 ticks of air-dodge landing lag (smashcraft:ts/src/game/sim/groundMovement.ts). The
landing records the side the stick held as it touched down. Releasing that
side, or crossing to the other, frees the stick; a press past the 0.8 dash
threshold within three ticks of crossing the smash deadzone, at any tick of
the lag, buffers a dash on that side (`landing.dashBuffer`), and the dash
starts on the first actionable tick if the stick is still on that side, then
runs on as any dash does. A stick held through the whole lag never counts as
fresh: a full keyboard or analog press on the landing side walks out instead
(`landing.heldSide`, cleared when the stick leaves that side). The walk starts
from the slide's speed and uses the ordinary walk acceleration and taper: a
slide slower than walk speed ramps up toward it, a faster one sheds speed at
traction down to it. As in Melee, a held stick gives a walk because no smash
input happened. Before 28 Oct a full stick (every keyboard press) held through
the lag dashed on the first actionable tick, and an analog re-press below full
during the lag walked unless it landed in the last three ticks. The buffer
fields are rollback state (`landing.wavedash`, `landing.dashBuffer`,
`landing.heldSide`).

The 18-world-unit speed is an independently chosen research tuning value
(3 times the rendering scale of 6), not a sourced Melee parameter. At the former
speed 8, a regression starting jump from grounded, advancing six ticks total,
then requesting a downward diagonal dodge fails to reach the ground during
dodge motion. The same unchanged regression passes at speed 18 for both
characters, short and full jumps, and both horizontal directions; it also
checks retained horizontal speed and sliding during landing recovery. This
sequence represents the approximately six-tick keyboard callback spacing
observed in Warcraft. It adds no input buffering and does not establish native
timing, multiplayer behavior, or numerical Melee parity.

## Jump calibration checkpoint

Full, short and double jumps are tested through complete 120-frame trajectories,
including landing. Fox full/short vertical launch attributes are
3.680000066757202 / 2.0999999046325684 Melee units per frame; Falco uses
4.099999904632568 / 1.899999976158142. Aerial launch is the full-jump attribute
times 1.2000000476837158 for Fox or 0.9399999976158142 for Falco. These values
are SuperCombo Wiki's (smashcraft:references/melee-frame-data/character-attributes.csv).

Historical fixture before #339: design targets set from public frame data
(SmashWiki, Smashboards) for independently authored Wurst. Ground takeoff skips ordinary air
physics on its first tick, so launch velocity supplies the first displacement.
Aerial jump applies ordinary gravity and drift immediately. Ground jump spends
three grounded ticks for Archer or five for Rifleman before takeoff, including
the input tick. Release during those grounded ticks latches short hop; release
on takeoff does not. Hitlag freezes that decision. Repeated presses during
squat do not restart it or spend the aerial jump. Illidan retains its custom
launch speeds and squat timing; since #190 its takeoff momentum and drift follow
the shared rules ([gameplay design](gameplay-design.md#air-drift-and-jump-momentum)).

The focused checks assert the grounded startup ticks, first two airborne
positions and velocities, aerial launch, takeoff release, and hitlag. The full
trajectory assertions still cover all six previous apexes and landing.
This corrects the previously fitted ground launch speeds without claiming
complete movement parity. Initial-dash duration, acceleration, run-turn braking,
walk acceleration, and ordinary friction still need their complete source
parameters and transitions. Fast-fall persistence was subsequently corrected
as described below. Those other movement gaps remain open.

## Fast-fall persistence

The aggregate passed **404/404**, with zero compiler errors and one existing
unused-import warning (smashcraft:build/physics-fastfall.log). Tests cover
release, steering, aerial startup, landing, accepted jump/air dodge, self
velocity versus knockback, and snapshot restoration. Native behavior remains
unobserved.

Fast-fall activates while airborne with descending self velocity, before the
ordinary gravity step. Once active, releasing Down or steering horizontally
does not cancel it; aerial attack startup preserves it. Landing, an accepted
jump or air dodge, a flinching hit, ledge catch and reset clear it. Snapshots
capture and compare the flag. Fox uses his fast-fall velocity
3.4 Melee units/frame and Rifleman uses Falco's 3.5 (character-attributes.csv).

These state rules, including preserving the fast-fall flag across motion states,
are our own design targets from public frame data (SmashWiki, Smashboards). The
Wurst implementation is independently authored.

Fast fall needs neutral horizontal input (smashcraft:docs/gameplay-design.md,
"Controls"). The downward stick threshold is 0.6625 and the press must be under four frames old; both are Smashcraft's, as no public page states Melee's. Digital Down has
magnitude one. The input tick has age zero; three further held ticks remain
eligible, while the fifth tick is too late. Freshness ages during hitlag and
is tested on the expiry tick. A diagonal Down hold ages the same input, so
releasing horizontal movement does not create a new Down press. Acceptance
consumes the window; release followed by another press refreshes it. The saved
held state and age are copied and compared in replay, and reset clears both.
The age saturates at four because larger values have identical eligibility. Descending knockback alone cannot trigger
fast-fall while self velocity is rising; rising knockback does not prevent
activation while self velocity is descending. This separates knockback motion
from the character's gravity-driven fall.

The aerial checks use the explicit Falco rig through the production engine. They cover early versus fresh Down at the apex, the age
three/four boundary during hitlag, diagonal-to-neutral input, replay restoration,
and every digital dodge direction with frozen and resumed motion. Existing
air-dodge displacement expectations follow the dodge force; the neutral vector
remains zero and the original roster attributes are unchanged. These checks do
not establish native behavior.
These are numerical and behavioral design targets.

## Raw movement parameter precision

Gravity, terminal speeds, drift speed/acceleration/friction, ground traction,
initial dash speed and aerial-jump horizontal velocity now retain the complete
published binary32 values in source, alongside the already sourced jump and
fast-fall values. Their source is
smashcraft:references/melee-frame-data/character-attributes.csv. This avoids relying on shortened decimal spellings
when emitting Lua, whose number arithmetic differs from the Wurst headless
interpreter's binary32 arithmetic. It does not establish complete movement transitions.
The aggregate passed **404/404**, zero compiler errors and the existing
unused-import warning (smashcraft:build/physics-raw-movement.log).

## Attack recovery checkpoint

Provisional attack cooldown prevents another attack, jump, air dodge, shield
startup, ground steering and facing changes. Air drift remains available.
Attack time freezes during hitlag. Recovery expires before action eligibility
checks; the frame that reaches zero accepts input. Ground steering waits for
recovery to finish. Tests exercise these rules through the shared advance
function.

## Jump out of shield

A jump from a held shield clears it and enters ordinary jump squat without requiring
shield release first. Holding the trigger cannot re-raise shield during squat.
Shieldstun still blocks the jump. Tests cover both characters and the complete
shield → jump → downward diagonal air dodge → sliding landing sequence.
Ground jumps also cancel shield-release recovery: the transition clears release lag and enters the ordinary
character-specific squat; it does not bypass shieldstun, hitlag, hitstun,
landing recovery or attack recovery. Tests release a real held shield and
check every remaining release-lag tick for both characters, then take off.
Other release cancels and analog shield behavior remain outside this pass.
Ground dodge behavior is described below; this is not a complete
implementation of Melee's shield options.

## Prototype attack phases

Each accepted attack starts at frame zero. Its clock advances on subsequent
simulation ticks and pauses during hitlag. Collision is checked during the
active window, using the current fighter positions; startup and recovery do
not deal damage. Each move can connect once with the opponent, including when
the opponent shields. These are independently chosen prototype timings for
both characters, not sourced Melee move data:

| Attack | Startup ticks | Active ticks | Total ticks, excluding hitlag |
| --- | ---: | ---: | ---: |
| Neutral | 4 | 2 | 36 |
| Ground blaster | 2 | 1 | 24 |
| Air blaster | 2 | 1 | 15 |
| Up/down directional | 8 | 3 | 42 |
| Left/right directional | 6 | 3 | 36 |
| Grab | 5 | 2 | 36 |
| Forward tilt (flat/up-angled/down-angled), down tilt | 5 | 2 | 28 |
| Up tilt | 6 | 2 | 29 |

Warcraft's stock attack animation begins on accepted attack startup; it is
paused during hitlag. It does not yet align its contact pose to the active
window. Authored clips and move-specific damage, shapes and launch angles
remain required. The blaster is now a moving projectile emitted during its
active frame, rather than an instantaneous long-range hit check.

Neutral N is jab, N plus direction smash, and N plus direction while holding
the walk modifier tilt: the owner's input scheme (smashcraft:docs/gameplay-design.md,
"Controls"). C-stick bindings request
smashes directly. Walking uses the character baseline of 1.6/1.4 Melee units
per frame (Rifleman), independently of run speed. Walking changes
directly to the requested walk speed rather than modeling analog walk
acceleration. Tilt damage is 10 side / 8 up / 8 down; Rifleman's down tilt
deals 10 (smashcraft:docs/move-comparisons.md). These damage values
and the ground/air blaster timing
difference are provisional tuning. Blaster duration is captured at attack
start, so landing cannot rewrite its recovery. Aerial normals are now separate
simulation styles: neutral, forward, back, up, and down. Ground normals and grab
are rejected in the air, aerial normals are rejected on the ground, and blaster
remains usable in either state. Air steering changes horizontal velocity while
preserving facing, allowing a back aerial to hit and launch behind the fighter.
Landing cancels an aerial's remaining active/recovery animation and starts its
move-specific landing lag. Aerial hit geometry and damage remain prototype values:
strong damage 7/8/8/8/9; startup 3/5/3/5/7; active 28/2/16/3/3;
total 41/31/37/34/38 ticks; authored landing lag 10/14/16/15/18 ticks, which
they land with halved (see "Aerial landing lag"), in neutral, forward, back,
up, down order. Forward and back hit only on their respective
sides; back launches away from facing, up launches mostly upward, and down
launches downward. Hit regions are simple rectangles around the fighter rather
than authored hitboxes. Neutral/back timing and weak damage are detailed below.

Neutral and back aerials use a shared Falco-inspired timing baseline for both
fighters. The factual tables at https://www.ssbwiki.com/Falco_(SSBM)/Neutral_aerial
(revision 1930482) and https://www.ssbwiki.com/Falco_(SSBM)/Back_aerial
(revision 1651640), retrieved 2026-09-30, report clean contact on frames 4–7,
late contact on 8–31 / 8–19, and interruption on 42 / 38. Cached pages are
smashcraft:build/multiplayer-setup/falco-neutral-air.html and
smashcraft:build/multiplayer-setup/falco-back-air.html. Only these factual numbers
are used; no article prose is copied.

The start tick is attackFrame 0, corresponding to reference frame 1. Thus both
moves have strong contact at indices 3–6; neutral lingers at 7–30 and back at
7–18. Completion at indices 41 / 37 permits the next action on reference
frames 42 / 38. The authored animation recovers over this actionable duration;
it does not reproduce the reference's longer full animation lengths (49 / 39).
Strong damage stays 7 / 8, while late damage is provisionally 5 for either move;
ordinary knockback and hitlag use that lower damage. Both phases retain hit
window 1, so a strong hit cannot rehit as weak after hitlag or target reentry.
A missed strong phase can still connect late. Up aerial's separate
finisher window remains unchanged. This is rough shared timing, not a claim of
character-specific Fox/Falco parity; autocancel and current landing lag remain
separate unfinished tuning.

Holding Walk with horizontal input selects forward tilt; adding Up or Down
selects its angled variant. Vertical input alone keeps up/down tilt, and
a same-frame Strong smash outranks a tilt, and the C-stick gives a tilt on the ground.
All three forward tilts deal 10 damage with 145 horizontal reach. Their
vertical hit coverage is centered at 0 / +65 / -65 relative to the fighter,
with the existing 130-unit vertical tolerance. These are prototype hit shapes,
not measured Melee hitboxes. Launch direction still uses the shared diagonal
knockback calculation. Headless tests cover selection, queue acceptance,
timing, damage, vertical hits/misses, facing and the horizontal range edge.

## Moving blaster shots

Historical fixture before #339: Projectile tuning is 36 Warcraft units per frame and 60 ticks of life
(2,160 units of travel), emitted 35 units ahead and 75 units above the fighter's
feet. The simplified target center is 45 units above the feet, with 24 units
of horizontal radius and 36 units of vertical tolerance. These are prototype
collision dimensions, not reconstructed Melee hitboxes. The increased range
lets a shot cross the arena rather than expire halfway through a long shot.
Archer's arrow effect and Rifleman's beam read simulation positions and are
removed when the simulation consumes or expires the shot; neither visual
determines contact. The Archer fighter asset excludes its separately animated
traveling arrow so that only the simulated projectile appears in flight.

## Ground dodge controls

The sampled ordinary/get-up/tech travel uses numerical observations from
libmelee revision ef679270ff95f0d42339dcdf1608282a35023349,
https://raw.githubusercontent.com/altf4/libmelee/ef679270ff95f0d42339dcdf1608282a35023349/melee/framedata.csv,
SHA256 8e0d811290b511902076c0011db1a0116356a7ddaa68dfa369ea4f5dcdc93777.
The associated library is LGPL-3.0; only factual numerical samples are used,
with no library implementation copied or translated. Signed reversals are
preserved. These are empirical paths, not binary-exact Melee parity. Get-up
paths depend on face-up/down and forward/backward action. Actual displacement,
both facings, stage-edge clamping, hitlag and replay are covered by
smashcraft:wurst/PhysicsTests.wurst.

While holding shield, a fresh left/right press requests a roll; a fresh down
press requests a spot dodge. Input callbacks collect edges and the frame step
resolves them against held shield state, so shield/direction callback order
within that frame does not change the result. Holding direction cannot repeat
rolls; pressing shield while direction was already held does not roll. Two
opposite horizontal press edges cancel, and down takes priority if several
directions arrive in one frame. These are Smashcraft's digital-input rules.

Melee's forward roll turns the fighter around partway through; our
simulation owns that transition instead of Warcraft's animation. Ground-dodge
frame counts are in smashcraft:references/melee-frame-data/records.jsonl
(`dodges`); the initial ground-dodge parameters are provisional rather than a
Melee parity claim.

Historical fixture before #339: Roll lasts 31 frames and is intangible on frames 4–19 inclusive. Archer and
Rifleman use character/action-specific per-frame translation samples from
smashcraft:wurst/RollTravel.wurst, clamped to the platform edge. Ordinary roll
totals are approximately 201.6 and 231 world units respectively. Illidan keeps
the original 8-unit travel on frames 4–19 (128 units). Spot dodge lasts 22 frames and is intangible on frames
2–15 inclusive. The start tick is frame 1. Archer/Rifleman forward rolls reverse
logical facing on frame 20; Illidan retains his completion-time turn. Backward
rolls preserve facing. Neither move permits attacks, jumps, steering or shielding
during its recovery. Jump takes priority over a simultaneous dodge request.
Spot dodge does not drop through a platform. Intangibility and recovery clocks
pause in hitlag. Every character uses the owner's common dodge profile
(ledger row `dodge-timing`, smashcraft:docs/design/melee-parity.md): spot dodge
22 / protection 2–15, both rolls 31 / protection 4–19, and air dodge 49 /
protection 4–29 with 10 landing frames for every character. Air dodge is
available once per airtime and ends actionable after its 49-frame animation;
landing, a ledge catch or a hit refreshes it (#100).
Both fighters have authored ground-dodge clips. See smashcraft:docs/fighter-animation-work.md
for playback and art limits.

## Knockdown reference observations

Melee distinguishes ground impact, down wait, stand-up, directional get-up
rolls and get-up attack (SmashWiki "Get-up attack"). Timing values for our first
recovery pass are provisional Smashcraft tuning.

Historical fixture before #339: Tumble starts at knockback 80 (damage level 3). After hitstun it ends on an
accepted air jump, air dodge or attack, or on a sideways stick flick: at least 0.8 on the frame the stick crosses 0.25 (Smashcraft's thresholds).
A full keyboard diagonal reads 0.707 and does not flick. Landing while still
tumbling techs or starts the 26-tick bound, then the 220-tick wait and its
options listed under "Grounded knockdown and jab resets".
Stand-up lasts 30 ticks; roll lasts 31 and covers 128 world units, clamped to
the current platform. Their first 8 ticks are intangible. Get-up attack lasts
45 ticks, has 16 startup/3 active ticks, deals 7 damage once, covers both sides,
and is intangible during startup. Its hit region uses the ordinary hit formula
with provisional base knockback 75, rather than the generic base 20. At zero
pre-hit damage this yields knockback 98.04 against weight 75 and 97.9 against
weight 80, or 39 hitstun ticks under the current floor(0.4 × knockback) rule.
This move-specific value is intended to make a clean low-percent hit cause a
knockdown and leave the attacker time to act before normal attack eligibility
returns; it is original tuning, not a Melee move-data value. The focused test
checks actual action eligibility for both fighters in both facing directions,
including a successful neutral tech, plus shield and whiff outcomes. In the
clean missed-tech case the attacker can act 34 ticks after contact and its jab
becomes active at tick 38; the defender's earliest get-up attack becomes active
at tick 54 (Rifleman defender) or 50 (Archer defender). These are measured
headless simulation results with neutral DI, not a guarantee against every
defensive input or a native-runtime measurement. Recovery and hitstun clocks
pause together during hitlag.

All these recovery timings, threshold and hit shapes are provisional.
Instant surface impact replaces a physical bounce; face-up/down
variants, jab resets, and character-specific get-up data remain unfinished.
Jump also stands a downed fighter up, for keyboards. Both fighters
have authored recovery clips; get-up rolls reuse ordinary roll clips.

Impact presentation uses three distinct cues: a nine-frame white contact
star for damage, a fifteen-frame floor glint for successful techs, and a
twelve-frame green/white floor burst plus thirty-two-frame spreading dust for
missed techs. The latter stays at the landing point as the fighter recovers.
These are original procedural models based on the owner's visual direction;
their display lifetimes do not alter hitlag, tech windows, or recovery timing.
smashcraft:wurst/ImpactEvents.wurst derives one frame's cues from numerical
before/after state, including both fighters in a trade. The live adapter uses
40 preallocated effects and presents each completed frame once; headless
replay creates no effects. Reconciliation of changed speculative journals is
still part of the unimplemented visible-rollback milestone.

Spot dodges emit two small outward-moving dust puffs. Ordinary, get-up and
tech rolls emit a compact blue-white star and one smaller puff moving opposite
the roll. These use frame-entry events, so sustained invulnerability does not
repeatedly create the cue.

Historical fixture before #339: Archer's down-air uses seven startup ticks and 20 active ticks (indices
7–26), with 38 total ticks. Its first three active ticks deal 9 damage and
the lingering kick deals 6, sharing one hit registry window. Its collision
region remains ±55 horizontally and −180..−10 vertically. Landing cancels
into 9-frame recovery, half its authored 18. The tucked startup and downward
kick are animation only: down-air preserves ordinary aerial momentum,
gravity, and knockback. C-stick Down does not set movement Down or force
fast-fall; explicit straight-down movement retains separate fast-fall.
These are provisional design values, not Sheik's frame data.

## Floor-tech reference

A tech rolls forward or back by horizontal input relative to facing. The Melee
section of SmashWiki "Tech" (https://www.ssbwiki.com/Tech) reports a
20-frame digital shield-press window and a 40-frame interval between presses.
A repeated press inside that interval cancels the current opportunity. Grounded
shield presses also count. Pressing before the last hitlag frame leaves one
post-hitlag opportunity; pressing on the last hitlag frame leaves 20. The
lockout lasts 40 frames after hitlag. Most characters have six vulnerable frames
at the end of a tech. These are factual parameters from that page. Analog-trigger behavior is outside our
digital keyboard controls.

The first floor-tech implementation counts the press tick as opportunity 1:
contact through +19 ticks succeeds and contact at +20 misses. Every fresh
digital shield edge, including a grounded one, restarts the 40-tick lockout;
a retry inside it cancels the open opportunity. Holding Shield creates no new
edges. Input captured during early hitlag leaves one contact tick after freeze;
an accepted press on the final frozen tick leaves the full window. A window
opened before hitlag simply freezes in our implementation; that case has not
been independently verified against Melee.

An in-place tech lasts 26 ticks with intangibility on 1–20; a directional tech
lasts 40 with intangibility on 1–34. These totals are shared chosen tuning;
both leave six vulnerable recovery ticks. Rifleman use 39 empirical
motion samples and a stationary final tick; Illidan retains the 128-unit path. Direction at
contact chooses the roll when the stick is at least 0.2 sideways (Smashcraft's threshold); its movement is clamped to the current platform.
A tech clears impact hitstun and consumes its input window. Early-hitlag versus
last-hitlag inputs, repeated/grounded presses, window/lockout boundaries,
recovery actions, interruption and reset are tested in the simulation the map
runs. Wall and ceiling techs are in "Wall and ceiling techs and wall jumps"
below; SDI and ASDI shifts meet the main deck's walls and underside as other
movement does (smashcraft:ts/src/game/sim/smashDirectionalInfluence.ts).

## Aerial landing lag

Landing ends an unfinished aerial and starts its landing lag: half the move's
authored lag, at least one frame, which is Melee's L-cancelled lag (SmashWiki "L-canceling": halved,
rounded down). Neutral, forward,
back, up and down aerials land for 5/7/8/7/9 frames, from authored
10/14/16/15/18. No input changes it: Smashcraft omits L-cancelling, see
smashcraft:docs/gameplay-design.md. Empty landings (4 frames) and air-dodge
landings (10) keep their own lag.

## Smash charge

Melee smash attacks can be charged for up to 60 frames while holding attack.
SmashWiki reports a Melee maximum damage multiplier of 1.3671× (the 1.4× figure
is the rounded general-series value). Source: SmashWiki "Charge" (https://www.ssbwiki.com/Charge).

The prototype lets a grounded up, down, or forward smash started through the
normal Attack binding pause just before its active frames. Holding Attack
charges for 60 logical ticks, damage scaling linearly to 1.3671× and feeding
the ordinary knockback calculation. The smash then holds at full charge for up
to 120 more ticks (180 in all) with no further damage or knockback gain;
releasing Attack, reaching tick 180, or leaving the ground resumes the attack.
Every fighter and smash follows this one rule, none with its own charge length,
multiplier or hold.

The extra hold is Tom's deviation from Melee (26 Oct 2026, #328), taken from
Ultimate: SmashWiki's [Smash attack](https://www.ssbwiki.com/Smash_attack) and
[Charge](https://www.ssbwiki.com/Charge) pages give Ultimate 60 frames of
charge, then 120 more frames of hold that add no damage. It is ledger row `smash-charge-hold` in
smashcraft:docs/design/melee-parity.md. Hitlag pauses charge accumulation;
fighter steering and attack/cooldown clocks pause while ordinary world timers,
gravity and platform motion continue. C-stick/direct smash commands are
immediate. These state and input rules are prototype choices, not claims of
complete Melee state-machine parity. Simultaneous hits snapshot both charge
amounts before applying either impact so trades retain both damage values.

## Platform drop priority

Live attack commands remain eligible for six simulation frames after their
assigned frame. They execute once when the action becomes legal, or expire;
this adds no delay to an already legal attack. During jump squat a C-stick
command retains its direction and resolves against airborne state at takeoff,
so an opposite-facing horizontal command begins back-air on the first airborne
frame. Melee has no general input buffer; Smashcraft's six-frame window is
adopted in smashcraft:docs/gameplay-design.md, "Execution and reaction windows".

A current queued attack takes priority over voluntary platform dropping during
the movement step. Action recovery also blocks the drop, so holding Down cannot
drop through during down-smash startup/charge or down-tilt recovery. With no
current attack or action lock, a fresh hard Down drops immediately, with no
descent animation or frames. Analog input must cross the down zone within the
three-sample flick window; a keyboard Down needs a fresh press edge. Holding
Down after an instant mount stays crouched, so release and press again to drop.
The drop consumes that press: continuous Down never fast-falls. Leave the down
zone toward neutral, or release the key, then press again to fast-fall within
the existing window. The synchronized down intent and consumption fields
survive snapshot copy and replay.
The command queue's actual frame window determines whether an attack is current;
expired and future commands do not suppress movement. This is our digital-input
priority rule. The adopted mechanic defaults add no dedicated analog-threshold
shield-drop technique; shielded fighters keep their existing escape choices.

## Melee behaviour oracle

`bun wisp oracle` (from smashcraft:ts/) plays scripted Melee situations for
every fighter through the frame executor, from controller rows, and prints each
outcome beside the design-target value cited from public frame data, with the constant and source path for each scenario, then the counts
per area. The scenarios are in smashcraft:ts/scripts/meleeOracle.ts: jump squat
and hop heights, dash/run/walk speeds, fast-fall, landing lag, floor techs,
get-up options and timings, the tumble threshold, pass-through platforms, the
main deck's walls and underside (where launches meet them, the techs off them,
the push-off and wall jumps), shield release and dodges, and ledge catches, one
from against the wall.
smashcraft:ts/test/melee-oracle.test.ts runs the table in the test suite and
fails on any mismatch not listed in its `KNOWN_MISMATCHES`, and on a listed row
that now passes. A difference from Melee recorded in the deviations table of
smashcraft:docs/gameplay-design.md is reported as a departure under that row's
name and still shows Melee's value; it fails the test only if it stops
differing, and the test checks that every departure names a row of the table.
The aerial landing lag without an L press is such a departure (L-cancelling).

Historical fixture before #339: Character data compares only where a fighter borrows it: Archer's and
Rifleman's movement, landing and action timings are Fox's and Falco's, and
Illidan's are original, so those rows read n/a for him; Illidan's ledge catch
box and wall data are Captain Falcon's, as Archer's and Rifleman's are Fox's
and Falco's. Common rules (input windows, tech gates,
knockback, platforms, ledge boxes) apply to all three. Where Smashcraft
authors a value, such as ground acceleration or aerial landing lag, the
scenario checks Melee's rule applied to it, not the value.

## Pass-through platforms

Stage 1's two raised decks are pass-through platforms, as in Melee: a fighter
rises through them from below and lands on top only while descending onto
them, and Down drops through them. They have no walls or underside, so they
never stop upward motion, bump a fighter's head, rebound a launch or allow a
wall or ceiling tech. The main deck's walls and underside are below.

Tom’s final 14 Oct 2026 rule replaces #103/#392’s climb and descent states.
Rising through a platform while holding Down past the deadzone, without an
aerial, instantly stands on it and emits the ordinary landing puff; the next
frame is actionable. Neutral rising and active aerials pass through. A fresh
hard Down while standing drops immediately; held Down after mounting remains
a crouch and permits down tilt or down-B. Falling with full Down passes through
and cancels the aerial without landing lag. Drops consume Down until a neutral
reset and fresh press, so the drop itself never starts fast fall. Ordinary
falling contact still lands; platforms still have no walls or underside.

## Ground traction by fighter

Each hero grips the ground by its body type, in Melee units a frame
(smashcraft:ts/src/game/sim/heroes/heroBodies.ts): Jaina 0.03, a slow runner
on frost, is the roster's Luigi; the other robed casters 0.04-0.06
(Malfurion 0.04, Medivh 0.05, Kael'thas 0.055, Lich 0.06); Sylvanas and Peon
0.05; Murloc 0.055 on wet feet; the nimble fast runners 0.06 (Blademaster,
Warden, Shadow Hunter, Dreadlord, Kobold, Grom); sturdy fighters 0.065
(Mountain King, Forsaken Paladin, Beastmaster, Lich King, Chen, Tinker);
Thrall 0.07; Pit Lord, Cairne and Anub'arak 0.08. Rifleman and Illidan keep
Fox's and Captain Falcon's 0.08. Melee spans 0.025 (Luigi) to 0.1 (Peach,
Link, Zelda, Pichu) and gives its low traction to slow runners
(smashcraft:docs/design/melee/movement.md); so do we: no hero runs faster than
2.2 with traction under 0.055, which keeps the longest run brake (Murloc's)
at 47 units against Melee's longest, Luigi's 36, and the 32 every fast runner
had before. Every hero is at or below the 0.08 all fighters shared before
15 Oct, so run brakes, dash stops and moonwalks are as long or longer.
The Lich is the light target of the advantage-state targets
(smashcraft:docs/gameplay-design.md, "Advantage state"); below 0.06 it slides
out of Dreadlord's tech chase and Rifleman's DI mix-up, so it stays at 0.06.
Jaina, Malfurion, Medivh and Kael'thas slide further than the targets measure.

Standing, crouching, shielding and landing (landing lag, including a wavedash
or waveland's air-dodge landing) brake by twice the traction while the fighter
moves faster than its walk speed, then by traction, as in Melee
(https://www.ssbwiki.com/Traction), so a shield raised out of a dash, run or
landing slide stops no later than letting go of the stick (#188,
smashcraft:ts/test/native/pads/issue-188-shield-brake/). Dash, run, run brake,
turn-run, attacks, jump squat and knockback brake by traction alone
(`restingTraction`, smashcraft:ts/src/game/sim/groundMovement.ts); shield
pushback from a hit is its own channel and keeps decaying by traction. Only
Jaina's wavedash is still faster than her walk when its landing lag ends, so
hers is the one wavedash-into-shield slide that shortens: 251.1 units over 52
frames before, 203.4 over 44 now, with the shield rising and dropping on the
same frames. With the
air dodge at 3.1 (2.65 units a frame at landing) a wavedash, whole slide,
measured in the headless sim:

| Hero (traction, walk) | Wavedash before (3.4 dodge) | Wavedash now | Run brake before | Run brake now |
| --- | ---: | ---: | ---: | ---: |
| Jaina (0.03, 0.80) | 54.4 | 65.3 | 7.0 | 19.6 |
| Malfurion (0.04, 1.31) | 54.4 | 55.8 | 19.4 | 39.6 |
| Murloc (0.055, 1.60) | 54.4 | 44.3 | 31.9 | 46.9 |
| Blademaster (0.06, 1.60) | 54.4 | 41.0 | 31.6 | 42.6 |
| Chen (0.065, 1.16) | 54.4 | 33.0 | 15.2 | 18.9 |
| Thrall (0.07, 1.09) | 54.4 | 29.9 | 13.2 | 15.2 |
| Cairne (0.08, 1.08) | 54.4 | 26.8 | 13.1 | 13.1 |

Before, every fighter slid 54.4 units on a wavedash. The doubling alone would
have cut that to 29-35; the lower traction spread keeps the median near the
old length for the fast runners while the casters slide much further and
the heaviest less. smashcraft:ts/src/game/sim/floorFriction.tests.ts
reproduces Melee's Fox, Marth and Luigi wavedash lengths (31.0, 41.5, 83.8)
with a 3.1 dodge, and checks that Jaina slides furthest. The computer's slide predictions
(smashcraft:ts/src/game/match/botFooting.ts, botCorner.ts) brake landing and
standing slides by the same doubled rule.

## Slippery floors

A deck can have a floor friction below one; shallow water's, on Tomb of
Sargeras's main deck (its overhanging platforms are dry), is 0.5
(`WATER_FRICTION`, smashcraft:ts/src/game/sim/stage.ts). While a fighter
stands on such a floor, every traction it slides against is multiplied by it:
the run brake and dash/run stop, the neutral ground drag that carries a
wavedash or waveland, the ground knockback slide, and shield pushback and
recoil. Each of those slides is about twice as long on water. Acceleration,
the dash's entry speed and authored travel (rolls, attack movement) are
unchanged, so a fighter starts moving as on ground but stops late. In the air
and on ordinary decks the friction is exactly one and the arithmetic is
unchanged.

Melee has slippery floors too, such as Icicle Mountain's ice, where a fighter
slides further and starts sluggishly; its water only splashes.
Tom decided, 7 Oct (delegated): shallow water uses 0.5, so slides are clearly longer without Icicle Mountain's ice, and only the
slowing is scaled, so water is slippery, not sticky. The computer players'
slide prediction (smashcraft:ts/src/game/match/botFooting.ts) uses the same
friction. smashcraft:ts/src/game/sim/floorFriction.tests.ts compares each
slide on ordinary ground and water with the same fighter and input.

## Main deck walls and underside

Every stage's main deck has side walls and an underside, shaped after Final
Destination's sides as a player sees them: below each ledge the side drops,
slopes in under the ledge and meets a short sloped underside. Smashcraft's
geometry is its own, in smashcraft:ts/src/game/sim/stage.ts: in world units
the walls drop straight from each ledge (x ±600) to z -63, slope in to x ±481.4
at z -122.7, and meet the underside at z -332.33, which spans x ±371.3. The
face under the ledge slopes in but is a wall, so a launch into it can wall
tech. The main deck's model is drawn from these lines on
every stage: smashcraft:ts/scripts/stageDeck.ts extrudes the walking line,
walls and underside 60 units to each side of the fighters' plane, and
smashcraft:tools/stage/package.ts writes it at arena scale, named after its
MDL text. smashcraft:ts/test/stage-model.test.ts checks that the shipped
model is the one drawn from the current lines, that its front faces' outline
is those lines on both shipped stages, and that its model facts' bounds reach
each wall and the underside. Stage 1's raised decks keep the scaled slab.

Historical fixture before #339: A fighter meets a wall with its flank. Smashcraft fighters use a 2-unit half-width
(`BODY_HALF_WIDTH`, smashcraft:ts/src/game/sim/surfaces.ts), so a fighter
stopped against the wall below a ledge stands 12 world units outside it, and
its ledge catch box (which adds the same half-width) still holds the ledge.
Undersides and other ceilings stop the fighter's top, Smashcraft's body top of
11.16 Melee units for Archer, 13.75 for Rifleman and 18.78 for Illidan
(`bodyTop`, smashcraft:ts/src/game/sim/surfaces.ts).
The contact, and the ceiling tech or bounce that starts from it, is on the
ceiling; the fighter stands its top below it. Smashcraft keeps this top fixed through animation. Under the main deck's underside the bottom blast zone (-420) leaves
Archer 20.7 world units and Rifleman 5.2, and Illidan none: his position
would be past it (#80 lowers it). A wall moves the fighter but not its own velocity: launch velocity into the wall stops, or a
tumbling launch rebounds at 0.8, and a fighter that rises past the wall's top
carries on over the stage. An underside stops a rise. A fighter that slips past
a ledge's corner within its half-width of the wall, as when running off the
ledge, is moved out sideways to its flank. A wall tech pushes off along the facing it turns to, away from even a
sloped wall; see "Wall and ceiling techs and wall jumps" below.

Ledge actions don't collide with the body. Climbs, rolls and ledge attacks pass through
it onto the floor. A ledge jump starts beside the wall below the ledge, slides
up its face and carries its inward speed onto the stage. Wall and ceiling
contact tests on raised decks use `SOLID_DECK_TEST_STAGE`
(smashcraft:ts/src/game/sim/stage.ts), stage 1's layout with solid raised
decks, which no match can select.
smashcraft:ts/src/game/sim/surfaces.tests.ts checks the geometry against the
table, smashcraft:ts/src/game/match/wallTechInputContracts.tests.ts launches
each fighter into the side through helper journal rows and techs off it, and
the oracle's wall/ceiling and ledge rows check where launches meet the side and
underside, the techs off them and a catch from against the wall.

## Camera limits, off-screen damage and blast zones

Melee gives each stage three nested regions: the camera range the view stays
inside, the wider blast zone whose crossing is a KO, and between them the
off-screen band where a fighter shows in a magnifying bubble at the screen
edge and slowly takes damage (SmashWiki "Blast zone"). A fighter is KO'd off
the top only when grounded, frozen or launched upward fast enough. Melee's
stage coordinates and its off-screen damage rate are not on a public page, so
Smashcraft's are its own, held in smashcraft:ts/src/game/sim/stageBounds.ts:
on the flat-deck layouts its camera limits are x ±1106.6, z -480 to 684, and
its blast zones x ±1562.6, z -840 and 1128 world units. Every KO comparison is
strict, checked after each frame's movement. The off-screen rule deals 1% every
60 consecutive frames out of view while the fighter is under 150%, resetting
whenever it is back in view; at 150% or more the count neither runs nor resets.
The camera's steps are in smashcraft:docs/melee-camera.md.

Smashcraft stores one **16:9 match view** and each fighter's magnifier timer
in deterministic snapshots. Its subject extents, eye-distance easing and
interest rates are in smashcraft:docs/melee-camera.md. The camera remains a side
view: Warcraft keeps the yaw at 90° and the downward pitch at 10°; the field
of view eases its half-angle tangent between 30° and 38°
by 10% each frame. This is the projection used by
smashcraft:ts/src/game/sim/matchCamera.ts, not Melee's rotating 3D camera.
Local rendering reads that view, adapts it to the monitor's aspect, and never
writes the resulting local view into gameplay. A fighter outside the
canonical current view, including one that briefly outruns it inside the
stage camera limits, counts toward the 60-frame damage rule. Practice disables
that rule. At 150% the counter is retained, even on returning to view.

The current flat deck and two-bridge layout use Final Destination's bounds;
Frozen Throne's Battlefield-style layout has its own bounds. In world units its camera is
x ±1389.6, z -354..1020, and its blast region x ±1869.6, z -816..1500.
smashcraft:ts/src/game/sim/stageBounds.ts owns these conversions.

The unobscured fighting view stops at the camera limits. The part behind
the HUD may extend below the bottom camera limit, but the whole raw frame
stops at least 20 world units above the bottom blast plane. Corner clamping
shapes the eased goal, then runs again after easing and after local aspect
adaptation. Recovery within 100
world units of the main deck underside keeps the fighter and nearby underside
above the HUD; a distant high fighter may then use a bubble. Bubbles project
the fighter's camera point against the actual local view and place its portrait
and directional chevron along the ray from the screen centre, inset from the
edge and staying above the HUD. They receive no input focus.

In a development build, `-dev camera` starts a one-stock match with the first
fighter frozen outside the camera limits for three seconds, then its retained
launch moves it across the side blast plane. It exercises the portrait, arrow,
offscreen damage and an off-camera KO without changing combat completion.

## Wall and ceiling techs and wall jumps

A wall tech holds the fighter on the wall for five frames, then pushes it off
away from the wall, or, when jump was pressed in the last 20 frames or the
stick is up, launches a wall jump sideways and up; then air friction and
gravity act as usual. A wall tech that pushes off holds every action until it
ends: it is actionable on frame 32, counting the wall contact as frame 1
(Fox's Tech-Wall total of 31, fightcore.csv), while the wall tech's jump frees
the fighter once the hang ends. Each fighter takes these from its Melee reference, in
Melee units a frame, from SuperCombo Wiki's attributes
(smashcraft:references/melee-frame-data/character-attributes.csv: "Wall Tech
Bounce Back", "Walljump H/V Velocity", "Ceiling Tech - X momentum"):

| Fighter | Reference | Push-off | Wall jump sideways | Wall jump up | Ceiling impulse |
| --- | --- | --- | --- | --- | --- |
| Rifleman | Falco | 0.5 | 1.3 | 3.6 | 0.7 |
| Illidan | Captain Falcon | 0.5 | 1.4 | 3.1 | 2.0 |

The table lists Captain Falcon's sideways wall jump as 0.4, not the 1.4
Illidan uses; that is a parity question for the ledger. A fighter whose tuning
lacks `canWallJump` never wall jumps. Every hero takes Fox's values (0.5, 1.3,
3.3, 0.7), so every selectable fighter wall techs and wall jumps. The minimum
approach speed of 0.5 is Smashcraft's.

**Intangibility.** The wall tech, the wall tech's jump and the plain wall jump
make the fighter intangible for 14 frames, counted from the frame it meets the
wall. The five-frame hang is inside that window, so the fighter leaves the
wall on frame 6 still intangible through frame 14 and is hittable from frame
15 (`SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES`,
smashcraft:ts/src/game/sim/surfaces.ts). The 14 frames are Smashcraft's; no
public page states Melee's.

A ceiling tech stops the fighter's motion and has no hang: gravity and air
drift go on. Partway through it the fighter's sideways speed becomes the
stick's horizontal value times its ceiling impulse, and it stops being
intangible. That frame's drift follows the ordinary rule for every fighter:
toward the stick it adds the acceleration up to the air speed, and above it
subtracts the air friction instead, no lower than the air speed and no higher
than the maximum air speed (Captain Falcon's 3 for Illidan). Captain Falcon's
own drift turns his 2.0 into 1.99, so Illidan's authored immediate drift cap
does not apply on that frame: with his own friction his 2.0 becomes 1.98. From
the next frame his ordinary drift, capped at 0.88, applies again.

Analog rows retain their raw horizontal axis for air drift, before the
directional-influence stick is normalized diagonally. The target air speed
scales by the horizontal stick magnitude, while acceleration adds the signed
base to the stick times the multiplier. Fox, Falco and Captain Falcon share the
base 0.02 Melee units/frame ("Air Mobility B", character-attributes.csv); Smashcraft's authored full-stick
acceleration stores base plus multiplier. Full horizontal keyboard rows,
including keyboard diagonals, keep the existing full-rate drift. The
input-row fixture is `ts/src/game/sim/analogAirDrift.tests.ts`.

After the frame's collision, a fighter that is falling, jumping, tumbling
past hitstun, or in a wall or ceiling recovery past its hang checks it;
aerials, specials, air dodges, special fall and hitstun don't. Meeting a wall
faster sideways than the minimum approach speed opens a window (Smashcraft's 130 frames) while the fighter stays against that wall, and pushing the
stick at least 0.8 away from it within 3 frames of the stick leaving
the horizontal smash deadzone starts the jump. It enters the wall
tech's state: motion stops, the fighter turns away, it is
intangible for 14 frames, hangs 5, then launches as above. Each
earlier wall jump since the fighter last stood on the ground scales the rise
by 0.975. A fighter moved out of the deck's body (see above) counts
as against that wall.

smashcraft:ts/src/game/match/wallTechInputContracts.tests.ts checks the
push-off, the wall tech's jump, a drift-and-flick wall jump, their 14
intangible frames (an overlapping strike passes through until the 15th) and
the ceiling tech's impulse for every selectable fighter through helper journal rows, and the oracle's
wall/ceiling rows compare the hang, launch speeds, rises and the ceiling
impulse's frame and speed with the reference values.

## Shield presentation boundary

The guard shell and HUD percentage read shieldEnergy/SHIELD_MAX; they do not
resolve collision. The shell shrinks as energy drains, while the current
prototype still blocks eligible contacts through its existing whole-fighter
shield rule. Shield tilting, geometric shield pokes and analog light shielding
remain differences. Shield-break recovery is described below. Green/yellow/red HUD colors
and the Warcraft spell shell are presentation choices, not reference parameters.

## Shield-break recovery

Shield depletion from holding guard, melee contact, and projectile contact now
uses one independently authored forced sequence in smashcraft:wurst/Simulation.wurst:
upward pop, landing, standing up, then dizziness. It replaces the former
40-frame hitstun placeholder. The design targets, from SmashWiki's Shield break
page, are upward launch, forced landing/stand, unavailable normal
actions, shorter dizziness at higher percent, mash recovery, and restored
shield health held fixed while dizzy. The sequence is expressed in our existing fixed-tick
simulation with our existing collision query.

The factual page https://www.ssbwiki.com/Shield, already cached in
smashcraft:build/ref-Shield.txt, independently reports the pop/landing/stand/dizzy
sequence, percent dependence, mashing, termination by flinching attacks, and
30 HP after a Melee shield break. The cached page was consulted for facts only;
no article prose is reused. It does not verify our timings or launch strength.

SmashWiki "Shield" gives the shield maximum 60, held drain 0.28 a frame,
regeneration 0.07 a frame and post-break restoration to 30 (also SmashWiki
"Shield break"). The digital shield-damage and shieldstun rules use integer hit
power. Shieldstun is `(integerDamage * 0.45 + 2) * 200 / 201`, truncated to
action ticks; defender pushback is `min(2, (integerDamage * 0.09 + 0.4) * shield)`
and grounded direct-attacker recoil `integerDamage * 0.07 + 0.02` (SmashWiki
"Shield"). The grounded recoil-friction multiplier and the airborne recoil decay
are Smashcraft's ("Shield contact motion" above).

SmashWiki "Shield break" says the dizzy lasts longer at lower percent and that
mashing shortens it, without numbers; Smashcraft's real-valued duration and
mash step are in smashcraft:ts/src/game/sim/shieldBreak.ts, sampled on entry.
Each unfrozen action tick removes 1. The fractional remainder stays in replayed
state. InputSnapshot.mashPressed admits at most one such edge per tick; held
inputs alone are not mash edges. Mash edges before dizziness or during hitlag
have no effect and are not banked. Analog light-shield interpolation remains
unsupported. The authored 12-tick landing pose and 30-tick stand pose remain
prototype animation lengths.

Shield regeneration runs once after input transitions and contact collection,
before contact damage resolves. An active fighter without guard gains 0.07 per
tick (SmashWiki "Shield"), capped at 60, including hitlag, ledges, grabs, down states and wall-tech
startup. A guard-to-grab input or capture clearing guard therefore permits
regeneration that tick. Continuing guard does not. Smashcraft's custom trap
freeze also retains regeneration; that extension has no Melee counterpart.

Shield-break pop/landing/stand use the same regeneration phase. Dizzy entry and
each unfrozen dizzy animation tick restore 30 before regeneration, leaving
30.07 after the frame, including expiration if no new guard starts. Hitlag
pauses that reset but not regeneration. The shared standalone actor step and
production match step compose the same motion and regeneration phases; the
match delays regeneration until both fighters' contact collection is complete.
Inactive (`out`) fighters do not regenerate. Melee's separate sleeping flag is
not modeled, so this is not a claim of complete sleeping-state parity. These
rules establish logical ordering, not exact binary32 arithmetic parity.

Shield depletion requires health strictly below zero; reaching exactly zero
keeps guard active, including for another hit during hitlag. Continuing drain
can then break it on the next action tick. A drain-caused break sets health to
zero before that frame's regeneration, leaving 0.07. A damage-caused break sets
health to 30 (SmashWiki "Shield break") during contact resolution, after
regeneration has already run; its first later non-guard frame reaches 30.07.
The break transition preserves that caller-selected health.

Held guard drains at the active animation boundary before jump, ground dodge,
release or grab inputs. A resulting break preempts those inputs; reaching
exactly zero instead still permits a legal exit, followed by regeneration.
Ordinary guard input entry initializes guard without draining on that tick;
the following active animation tick supplies its first held drain. Hitlag
pauses drain. Shieldstun and its return-to-guard completion tick do not drain;
guard inputs become available on that completion tick, with drain resuming on
the following tick if guard remains active. These orderings are Smashcraft's. Powershield
and analog light-shield state transitions remain outside this digital-guard
model.

Movement, fast falling, attacks, shielding, jumps, air dodges, ground escapes,
platform drops, ordinary get-up actions and floor techs cannot cancel recovery.
Landing uses the highest crossed eligible surface; it does not enter ordinary
knockdown or gain that system's get-up intangibility. A break grants no
invulnerability and never calls the respawn reset.

Ordinary flinching melee damage, grabs and Falco's flinching laser cancel any
break phase into their normal consequences. Fox's non-flinching laser adds
percent without cancelling recovery or recomputing an already active dizzy
timer. Hitlag freezes phase clocks, vertical movement and mash recovery.
Blast-zone stock loss clears break state; real respawn restores the existing
full shield and 90-tick invulnerability. Reset also clears the break serial.

The adapter contract is FighterState.shieldBreakState (`SHIELD_BREAK_NONE=0`,
`SHIELD_BREAK_AIR=1`, `SHIELD_BREAK_LAND=2`, `SHIELD_BREAK_STAND=3`,
`SHIELD_BREAK_DIZZY=4`), shieldBreakFrame (elapsed unfrozen ticks in the current
phase, zero on entry), and shieldBreakSerial (increments once per break).
shieldBreakRemaining is the real-valued dizzy countdown;
shieldBreakDizzyFrames(percent) exposes its initial sourced duration. Public timing constants are
SHIELD_BREAK_LAND_FRAMES=12, SHIELD_BREAK_STAND_FRAMES=30 and
SHIELD_BREAK_RESTORED_ENERGY=30. LAND begins on contact; each timed phase
transitions after exactly its stated number of later unfrozen ticks. Expiration
clears state/frame/countdown and permits otherwise legal actions on that same
simulation tick.

Eight focused Wurst tests cover all depletion paths, both characters' actual
pop trajectories and forced actions, phase boundaries, percent/mash recovery,
hitlag in every phase, damage/grab interruption, the two laser behaviors,
stock loss/reset, fixed shield health and absence of break invulnerability.
These are simulation checks; native rendering, keyboard synchronization across
two clients, and numerical Melee parity are separate unproven claims.

## Outer ledge recovery

Only the two outer endpoints of solid main surface 0 can be caught. Upper
pass-through platforms have no catchable ledges. Melee's ledge options (climb, jump, roll, attack, drop, with quick and slow
variants by percent) are described on SmashWiki "Ledge"; the rules below are
Smashcraft's.

- **Who catches.** Falling and jumping fighters, helpless fall after an
  up-special, fighters whose air dodge's 49-frame animation has ended, tumble once
  hitstun ends, and fighters recovering from a tech or grab release. Aerial
  attacks (AttackAir), air dodges (EscapeAir), hitstun (Damage/DamageFly),
  shield-break flight, grabs and frozen fighters never catch. Melee's specials
  choose per move; Smashcraft's original specials have no catch window.
- **When.** Only after a frame whose movement went down , never while down is held (Smashcraft's down is the
  digital direction, which the helper raises at about a fifth of stick
  travel), and never during the regrab lock.
- **Which ledge.** Only the ledge ahead of the fighter's facing. A catch turns
  the fighter toward the stage.
- **Grabs.** A fighter hanging on the ledge can't be caught by a standing, dash
  or shield grab, intangible or not. The hang and every
  catch set grab masks that keep a hanging fighter out of grabs, and changing
  action clears the mask, so climbs, rolls, ledge attacks
  and drops are catchable again. `hangsOnLedge` in
  smashcraft:ts/src/game/sim/ledge.ts applies it.
- **The box.** Each fighter's ledge snap x, y and height place it: the
  ledge vertex must lie strictly beyond the fighter's position and strictly
  less than its collision half-width plus snap x ahead, and strictly between
  snap y minus and plus half the height above its feet. Both ranges sweep the
  frame's start and end positions, so a fast fall can't pass through. Smashcraft fighters use a half-width of 2, the flank they also meet
  walls with (see "Main deck walls and underside").

| Fighter | Reach (world) | Ledge above feet (world) |
| --- | --- | --- |
| Rifleman | 78 | 51–105 |
| Illidan | 66 | 69–135 |

These boxes are Smashcraft's, in smashcraft:ts/src/game/sim/ledge.ts; no
public page states Melee's ledge snap boxes.

smashcraft:ts/src/game/match/step.ts resolves catches at the start of each
match tick, before any fighter moves, from each fighter's stored last movement
(`motion.deltaX`/`deltaZ`), so both ledges resolve from one shared snapshot.
A free ledge goes to the nearer eligible fighter by squared distance to the
endpoint; exact ties catch neither. Owners keep the ledge through hanging and
an ongoing climb/roll/attack. Melee catches inside the same frame's collision
step and gives a contested ledge to whichever fighter it updates first.

A catch anchors the feet 24 units outside and 90 below the endpoint, clears
movement and launch velocity, ends a helpless fall or air dodge, and restores
one air jump. Melee anchors the fighter at the ledge vertex plus its
CliffCatch animation's TransN offset, scaled by model scaling: Fox 4.8
outside and 13.44 below on the catch frame, settling to 1.92 and 14.4 while
hanging; Falco 5.5 and 15.4, then 2.2 and 16.5 (Melee units). Smashcraft's
24/90 world units (4/15 Melee units) is that rule with an offset fitted to
these fighters' rigs, which smashcraft:tools/animations/ledges.py bakes into
the hang clips. A catch does not reset percent, shield energy, stocks or
respawn protection. Catch protection lasts 30 unfrozen ticks (including the
catch tick); hanging afterward is vulnerable. Choosing an option never
refreshes that protection. Jump, release, interruption and completed recovery
remove it. Release and interruption start a 30-unfrozen-tick regrab lock
(Melee's  ledge cooldown, 30, set by stick drops, the hang
timeout and damage); a ledge jump and a completed climb, roll or attack don't.
Ordinary flinching damage and grabs interrupt the ledge action;
non-flinching lasers only add damage. Stock loss clears ledge ownership and
protection; reset also clears the catch serial and regrab clock.

Fresh options are prioritized Jump, inward/Up climb, outward/Down release,
Shield roll, then Attack. Held directions alone never choose an option. The
catch tick only anchors, so options start on subsequent ticks. Jump launches
inward at the character's ordinary air-speed cap and full-jump launch speed,
keeping the restored air jump. Release starts outward at 2 world units/tick
and downward at 2. Climb/roll/attack interpolate from the hang point to the
platform over 12 ticks, ending respectively 24/140/64 units inward. Their
whole actions last 25/36/40 ticks after entry; ordinary actions remain locked
until completion. The ledge attack deals 7 damage on action ticks 16–18,
reaches 140 units inward and 90 vertically, and uses ordinary hit/knockback
resolution with one hit per action. Hitlag freezes the action and protection
clocks. These trajectories, speeds, hit regions and durations are provisional;
percent-dependent quick/slow options and animation-specific timing are absent.

The adapter reads FighterState.ledgeState (LEDGE_NONE/HANG/CLIMB/ROLL/ATTACK,
values 0–4), ledgeSide (-1 left, +1 right), ledgeFrame (0 on phase entry),
and ledgeSerial (one increment per catch). InputSnapshot.ledgeVerticalPressed
is a fresh Up (+1) or Down (-1) edge. The simulation reuses jumpPressed,
getupDirectionPressed/getupDirection, airDodgePressed and getupAttackPressed
for the other options. Standalone simulation consumers resolve pair catches
before advancing either fighter, as the match step does.
smashcraft:ts/src/game/sim/ledge.tests.ts covers every fighter and side, the
reference boxes and their strict edges, the swept movement, eligibility,
upper platform exclusion, contention/ownership, option timing and locks,
attack contact, protection expiry, regrab timing, hit/grab interruption and
reset. None of these establish native animation alignment.

The hang dimensions now fit the measured reach of both fighter rigs.
smashcraft:tools/animations/ledges.py reads the simulation's hang offset, depth,
mount duration, climb duration and climb inset directly when baking wrist
contact. smashcraft:wurst/FighterAssets.wurst fixes both model scales at one so
model coordinates and simulation world units agree. The animation adds no
root travel. Packaged-model wrist checks establish contact at the hang point
and through the first five climb ticks; native visual alignment remains a
separate check. These dimensions are prototype art/gameplay tuning, not
measured Melee values.

## Default digital wavedash and fast-fall directions

The owner's digital controls (smashcraft:docs/gameplay-design.md, "Controls"):
a horizontal-only air dodge uses an angle
of 18 degrees below horizontal for either fighter, mirrored for left/right.
Its initial vector uses Melee's 3.1 Melee units (18.6 world units); #347's
3.4 made platform wavelands slide too far (Tom, 17 Oct). Decay is Melee's 0.9.
The 10-frame landing lag and intangibility are unchanged; the slide brakes by the fighter's own traction, doubled above its walk speed ([Ground traction by fighter](#ground-traction-by-fighter)). This is the default,
with no modifier or toggle. Explicit up/down/diagonal input retains its
previous direction and normalized speed; neutral retains zero initial velocity.
A dodge started too high may still expire before reaching the ground. The angle
is not the one for Melee's longest wavedash
(smashcraft:docs/design/melee/movement.md).

Fast-fall now requires down with neutral horizontal input. Down-left/down-right
continue air drift without selecting fast-fall speed. Down held with the tilt
modifier is a tilt input: it neither crouches nor fast-falls, and A gives the
down tilt or down aerial (#187). The modifier also shortens the stick to
x = ±0.6875, up 0.65 and down −0.675, so the platform drop at −0.6875 never
fires either (#282, smashcraft:docs/gameplay-design.md, "Stick zones"). Shield dodges, DI, down
attacks and platform-drop handling retain their separate inputs. Existing
fast-fall descent/actionability rules remain; native feel needs the new build.

Historical fixture before #339: In the air, the latest steerable horizontal direction is remembered without
changing ordinary facing. After releasing that direction, neutral B turns the
fighter and fires Archer's arrow or Rifleman's shot toward that remembered
side, while preserving horizontal momentum. A held horizontal direction still
selects side-B. The remembered side has no timeout and clears on landing or
reset; replay snapshots include it.

## Jump-squat buffered wavedash

A fresh air-dodge/shield press during jump squat queues one air dodge at
takeoff. Subsequent nonzero movement direction during that squat updates its
direction; releasing the direction retains the last choice. Straight left or
right uses the shared shallow downward angle, allowing an 8 then
left/right keyboard sequence without a modifier. The dodge begins before the first
airborne physics step and uses the ordinary special landing lag. Interruption
and reset clear the request. Queue and direction are included in snapshots.
Both fighters and facings, late direction, interruption and snapshot handling
pass the source tests; actual keyboard timing and slide feel remain unverified.

## Up-special aerial recovery

Up-specials consume the aerial jump budget, and an up-special
that finishes while airborne enters helpless fall. During that fall, steering
and fast-fall remain available; jumping, air dodge, attacks and further
specials are locked. Landing or a ledge catch clears the helpless state. A
flinching hit interrupts the recovery or helpless fall, permitting actions again
after hitstun, but does not restore jumps already spent. Rifleman consumes the jump budget when his grounded launch begins. These are shared game rules, not exact Melee frame timings.

An airborne fall-special entry consumes all jumps; its grounded entry uses a
separate transition. Numerical
state is stored in `FighterState.specialFall` and copied by rollback snapshots.
Rendered fall-special pose and input feel still require in-game verification.

## Rifleman freezing trap

When ice expires or a hit breaks it, every trap ignores that fighter until
20 frames after thaw (#84). The thaw frame completes the frozen tick; normal
movement resumes on the next frame. Trap eligibility returns on frame 20,
after that frame's movement, so a jump pressed on frame 15 completes even the
Rifleman's five-frame squat before contact. Other attacks still hit normally.
The immunity timer is replay state and clears on stock loss and respawn.

Down+B places one trap on Rifleman's current grounded surface. Placement is
instant when the next simulation frame accepts the input; airborne placement,
placement while shielded or action-locked, and a second live trap are ignored.
Rifleman plays a 20-frame laying action, then can move and attack again.
The trap arms after 20 match frames, lasts up to 480 frames (8 seconds),
and has a separate 90-frame placement cooldown. It triggers on an opposing grounded
fighter on that same surface within 42 world units. These are provisional
control and range values, not Melee or Warcraft measurements.

Contact consumes the trap and holds the target in an ice state for at most 300
simulation frames (five seconds at 60 Hz). The countdown advances during
hitlag, so hitlag cannot stretch the cap. Movement, attacks, dodges, shield,
jump and other action inputs are ignored while frozen. A damaging unshielded
hit breaks the ice before applying its normal damage and launch; shielded
damage does not break it. A shielded contact consumes the trap without freezing
the defender. Invulnerable targets do not consume it, so it can trigger later
if they remain in range. KO and reset clear both placed and frozen state.

Numerical state lives in `FighterState.freezeTrapLife`, `freezeTrapArming`,
`freezeTrapX/Z`, `freezeTrapSurface`, `freezeTrapSerial`, `freezeTrapCooldown`
and `frozenFrames`/`freezeImmunityFrames`. Snapshot restore copies and compares
these fields exactly.
The trap and ice shell are presentation only; animation, visual timing and
native multiplayer behavior require a loaded Warcraft build to validate.

## Grab, pummel, throw and escape

The capture timer is `floor(90 + 1.75 * damage_at_capture)` frames in integer
math (`grabHoldFrames` in smashcraft:ts/src/game/sim/moves.ts), Ultimate's
formula rather than Melee's equal-ranking `floor(76 + 1.6 * damage)`
(https://www.ssbwiki.com/Grab); Tom chose it on 2026-10-14, and the
`grab-hold` row of smashcraft:docs/design/melee-parity.md records the
deviation. Damage during a hold does not recalculate its initial timer.

The input behavior is our own design target. Any fresh Attack/Special/Jump/Grab/
shield-button edge supplies one mash contribution per frame. Multiple buttons
in that frame still count once. A change to either or both remembered nonneutral
movement-axis signs supplies a separate contribution; neutral does not erase
the remembered sign. Each contribution removes eight frames (`MASH_FRAMES`,
Ultimate's stick value; Melee's is six), in addition to the ordinary
countdown, but no hold ends before its 60th frame (`GRAB_HOLD_MINIMUM_FRAMES`).
C-stick and walk-modifier inputs are not grab-mash buttons.

Fresh Attack has priority over direction when selecting a held action. Each
fresh Attack press in the hold starts a pummel, so pummels repeat as in Melee;
holding Attack does not. Fresh movement or C-stick direction selects a throw
relative to the holder's facing (vertical takes priority on a diagonal). A
throw pressed during a pummel starts when the pummel ends; other commands
during pummel/throw recovery are discarded. Escape is evaluated before a new
pummel/throw selection.
Once a throw begins its victim stays committed until release or interruption.
Ordinary attack requests are cleared throughout both ends of the grab context,
including its final tick. Special input cannot leak through on release.

Contact/release and total frame counts are one-based and owned by
smashcraft:ts/src/game/sim/moves.ts (`grabContactFrame`, `grabActionDuration`).
A pummel lasts 7 frames and connects on frame 3 unless a kit authors its own,
dealing three damage without launch and spending 3 frames of the victim's
remaining hold, never the last one; it freezes both clips and the hold timer
during its normal hitlag. The four throws each deal damage once at
release and use the shared knockback/hitstun formula; throw DI uses the victim's
input on that frame, without adding ordinary hitlag or SDI. Down throw visually
slams to the floor and launches into an upward bounce. Character throw damage,
angles, growth/base knockback, trajectories, action lengths and ten-frame escape
recovery are original starting tuning, not Sheik's values. Simultaneous
grabs clash; Melee resolves them by port priority.

Holder/victim action, frame, serial, mash signs, timer and reciprocal links are
copied and compared in snapshots. Damage, freeze, stock/reset interruptions clear
the pair. The original 20-frame fixtures were updated to the damage-dependent
capture contract; successful capture now exits grab startup into the explicit
hold action rather than retaining the whiff cooldown.

Both fighters have pummel and four throw clips plus matched victim clips in
smashcraft:tools/animations/grab_animations.py. The animation boundary consumes
timing from Wurst; canonical pair state owns translation and release. Native
pose alignment, real-button use and interruption readability require the
installed-build check and are not proved by the numerical tests.

## Demon Hunter combat prototype (original provisional tuning)

Character ID 2 now has explicit simulation mobility and authored contact
regions. It uses the shared movement, shield, grab, knockback, hitlag, hitstun,
landing, ledge, stock and replay systems. These values are a first numerical
combat prototype, not values taken from Melee or Blizzard character data.
Animation clips, pose alignment, HUD/selection, and installed-map behavior are
not established by these source tests.

Ground attack IDs are 0 jab, 2 up smash, 3 down smash, 4 forward smash,
6 forward tilt, 7 up tilt, 8 down tilt, and 9/10 up/down-angled forward tilt.
Neutral Attack during a grounded dash is converted to the dedicated ID 18 dash
attack (4 startup, 2 active, 32 total ticks). Styles 1 and 5 remain the
existing projectile and grab actions. The remaining attacks use shared
`attackStartupFrames`, `attackActiveFrames`, and
`attackDurationFramesForGrounding` tables. The five aerial IDs 12–16 likewise
use shared action clocks. Illidan supplies distinct facing-relative regions and
hit effects for each action; no Rifleman region is used.

| Special ID | Action and provisional timing | Contact/effect |
| --- | --- | --- |
| 9 | Eye Beam: shot on tick 23 of 57 grounded, 13 of 42 airborne (Falco's Blaster); landing ends the airborne form with no landing lag; no cooldown and no cap on beams in flight (Falco's refire) | Fires a beam from his eye line (140) at 48 world units/tick for 15 ticks (720 units); 3%, set knockback 5 at growth 100, Sakurai angle; hits a band from 80 below to 20 above the eye line ([roster](design/roster.md#eye-beam-neutral-special)). |
| 10 | Fel Rush (#147, reworked 2026-10-28): Melee Illusion timing shared with Maiev's side special: tell ticks 1–20, rush 92.4 units/tick on 21–25 (462, 3.5H), acts on 64; a special press on ticks 21–24 stops him there and shortens the move as many ticks; a rush that strikes a fighter, not a shield, skips to its last 14 ticks; once per airtime, level in the air, and a rush ending airborne counts as that airtime's rush even if it started on the ground; a hit earns one more, aimed in 8 directions by the stick on tick 20, which earns no third; an air rush that hits nobody ends helpless until he lands or grabs a ledge, and an air rush landing before tick 64 takes 20 ticks of landing lag (#554) | Strikes each body it passes once, over the stretch crossed each tick, so a shortened rush still strikes (7 fire damage: a grounded foe low at 20 degrees, an airborne foe spiked at 270), and stops short of a raised shield ([Illidan](design/illidan.md#side-special-fel-rush)). |
| 11 | Wing Ascent: 7-tick startup within 32 total ticks; 90-tick cooldown | Holds still through the startup, then launches along the stick held on tick 7 (any analog angle, 8 directions on keys, straight up with none) at 30 units a tick, slowing by his gravity each tick, for the same distance in any direction (#519). Consumes remaining jumps, grants four ticks of protection at launch, and enters helpless fall if still airborne at completion. On tick 19, with no special press, a stick held in a different one of the 8 direction zones from the launch's starts the Wing Dive: a 6-tick backflip, then a 13-tick dive at 30 a tick along the held zone (#279). A stick at rest or in the launch's own zone starts nothing. |
| 12 | Immolate: active on tick 1 only, intangible tick 1, 15 total ticks; 24-tick cooldown, jump-cancellable from tick 4. In the air his speed is held at zero every tick, so he hangs in place, like Falco's shine | Both sides: a foe whose feet are within 116 units to either side, 104 below to 108 above, is launched away at 85 degrees (base 108, growth 18): 7 damage on the ground, 9 in the air. EX reaches 140 ([Illidan](design/illidan.md#down-special-in-the-air-immolate-picked), #272). |

`SPECIAL_DEMONHUNTER_*` constants are the renderer/action IDs for these
specials. Grounded/airborne contact, both facings, parry interruption, jump
consumption, and snapshot restoration have focused Wurst coverage. This does
not certify model animation, local presentation safety, multiplayer behavior,
or final move tuning.

Simultaneous Immolate contacts are collected before either hit is applied,
including the ground/air launch choice. Both fighters therefore trade when
their active volumes overlap on the same tick; changing argument/slot order
does not let the first hit cancel the second contact. The regression failed
before this change and passes for both grounded and airborne mirror contacts.
The focused character suite passes 12/12:
smashcraft:build/wurst-tests/illidan-trade-after-r2.log. Earlier failing evidence:
smashcraft:build/wurst-tests/illidan-trade-before.log.

### Binary32 arithmetic boundary

The historical standard-library pin included the pure Wurst Binary32 package
from the Tom-owned Apache-2.0 fork. The shared engine
rounds grounded knockback decay in Melee units and rounds shield-health updates
to binary32. A generated-Lua production probe, not just the binary32 compiler
interpreter, verifies the recorded first traction subtraction and regeneration
from 20 to 20.06999969482422. These production checks now live in
smashcraft:ts/src/game/sim/physicsPrecisionState.tests.ts.

This is partial precision coverage. Other formulas and their operation
ordering still require migration and comparison. The probe does not establish
Warcraft timing, rendering, or native map startup.

Digital shield damage sums raw contacts before applying the binary32 factor 0.7
once (SmashWiki "Shield"). Shieldstun rounds integer power times 0.30000001192092896 before
the fused multiplication by 1.5 and addition of 2. The standard-library pin now
provides fusedMultiplyAddFloat32 for this single-round operation. Analog shield
input is preserved, and projectile powershield timing/reflection is implemented
separately. Melee perfect contacts now preserve shield health and use the
unmodified defender pushback; post-contact action timing and native verification
remain open. Digital formula precision does not establish those behaviors. See
smashcraft:docs/melee-powershield.md.

## Directional influence arithmetic

The production DI helper reconstructs the launch from its angle and magnitude,
with a signed squared cross-product rotation capped by the supplied unit stick
and the 18-degree maximum (SmashWiki "Directional influence"). It rounds to binary32 and uses the shared
independently authored trig approximations. Nonzero parallel input still passes
through polar reconstruction; neutral input and sufficiently small launch vectors
retain their components. Grounded eligibility is Smashcraft's rule.

The focused directionalInfluence filter passes 5/5 tests, including adapter
magnitude through hitlag release, replay snapshot independence and correction
equality, and existing discrete DI behavior (smashcraft:build/di-connected.log).

Network input preserves DI magnitude by dividing each captured signed byte axis
by 127, then normalizing radially only when length exceeds one. This is
Smashcraft's input boundary, not a claim about original GameCube polling or
quantization. Full keyboard diagonals retain unit length. Explicit DI components
and their validity flag travel with frame snapshots and participate in replay
input equality; directly constructed snapshots retain discrete direction fallback.
No new persistent fighter state is introduced. Movement, SDI and tilt capture
keep their existing input rules. Original Warcraft characters retain authored
statistics; stale moves and freshness bonuses stay omitted
(smashcraft:docs/gameplay-design.md).

Stratholme (6) uses a three-segment main floor: flat from x −420 to 420 at
21 world units, sloping down to its ledges at x ±600, z 0. Ground speed is
travel along the line, so the horizontal step takes the segment's cosine.
Landing, techs, get-ups, projectiles and ledge climbs use the height at the
fighter's x. The generated deck mesh follows those same line endpoints.

Tomb of Sargeras (7) draws a translucent, slowly scrolling water sheet over
its main deck. Water and lava use two triangles per surface, zero particles,
and zero lights. Warcraft's HD water natives configure terrain water;
these floating platforms instead use authored models that also draw in Classic.
