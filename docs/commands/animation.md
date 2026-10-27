# Animation

For fighter animation quality and action coverage, use the source-owned
`smashcraft` skill (`agents path smashcraft`, references/animation.md): its
reference library supplies Sakurai's impact/attack principles and the Fox
drill example; its procedure routes the existing motion audit, paired throws,
recovery clips and nine-way pain reactions. The project index of sources,
with URLs, verified timestamps and rights, is
smashcraft:docs/design/animation-reference.md. Reference pixels remain private.

`bun tools/animations/recovery-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` from
  the repository root appends fighter recovery and transition clips before
  storing their families and refreshing the clip pool (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/drill-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  Blademaster, Warden and Shadow Hunter down-air drills, preserving earlier
  clips and writing both-facing silhouette sheets for the native review.
  `bun tools/animations/down-air-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  downward contact poses for the seven stock heroes whose casts/swings pointed forward.
  `bun tools/animations/attack-gesture-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]`
  appends distinct roster attack gestures without changing combat data or old clips;
  `--character` regenerates one fighter while retaining other generated bindings;
  `--pose POSE` appends only that missing gesture, preserving existing clips;
  `--replace-pose POSE` re-authors only an existing gesture at its own sequence
  index, so later clips and their bindings keep their indices. Warden's side
  special is authored in Blender (#487): `... --character 5 --replace-pose sideSpecial --rig RIG.json`
  writes her skeleton, glaive tip and the move's timing, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/warden-pursuit-lunge.py -- RIG.json KEYS.json`
  bakes one key per frame: a crouched hold with the glaive ring kept face-on to the camera, a lunge on the first
  active frame and a downward cut, and `... --replace-pose sideSpecial --keys KEYS.json` splices the keys in place.
  Warden's back air is authored in Blender too (#550): `... --character 5 --replace-pose backAir --rig RIG.json`
  writes her skeleton and timing, `blender ... --python tools/animations/warden-back-air.py -- RIG.json KEYS.json`
  bakes a tucked windup, the glaive thrown over her shoulder and whipped down behind her through the three active
  frames with her legs off the floor, and `... --replace-pose backAir --keys KEYS.json` splices the keys in place.
  Its three hit capsules run along the drawn glaive on frames 7 to 9.
  Muradin's back air is authored the same way (#569): `... --character 4 --replace-pose backAir --rig RIG.json`,
  then `blender ... --python tools/animations/mountain-king-back-air.py -- RIG.json KEYS.json` bakes the axe wound
  across his front with his chest kept toward his facing, lifted overhead through a mid-arc frame and whipped
  back and down behind him through the three active frames as his chest opens to profile, carried on under his
  hip and settled, and
  `... --replace-pose backAir --keys KEYS.json` splices the keys in place.
  `bun tools/animations/dreadlord-pounce-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` authors Dreadlord’s horizontal corkscrew, bite and recovery; `bun tools/animations/dreadlord-pounce-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT` captures their production phase selection in both facings.
  `bun tools/animations/jump-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID] [--no-preview]` appends
  movement-only jump gestures, including Blademaster's front flip
  (smashcraft:docs/fighter-animation-work.md). `--character` authors one selected
  fighter's double jump in the style smashcraft:docs/design/animation-reference.md picks (Blademaster keeps his #230 flip) and retains other jump bindings; `--no-preview`
  skips silhouette sheets. Store the changed model family and refresh both body
  timelines and clip metadata before using the generated bindings.
  `bun tools/animations/tumble-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` authors the
  tumble (Melee's DamageFall, played once hitstun ends while still airborne) for
  Blademaster, Mountain King, Lich, Shadow Hunter, Pit Lord and Beastmaster, whose
  tumble had been a stand or Death clip (#359): a looping 24-frame back flip about the
  body centre through the model's existing root helper, limbs flung through the
  canonical rig. A rerun re-authors `Tumble Motion damageTumble` in place; every
  other clip stays identical. It binds the clips in the generated
  smashcraft:ts/src/game/presentation/tumbleClipInfo.ts and writes both-facing
  sheets; store the family and run `bun wisp inputs derive --fighter NAME`.
  `bun tools/animations/movement-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID --pose crouch|ledgeHang [--pose ...]`
  authors a fighter's crouch or ledge hang on its shipped model through the
  canonical rig (#40): each mapped joint turns about the side-view axis, one root
  helper, reused by every later run rather than nested again, plants the ankles (or the lowest point of a legless body) on the floor
  for the crouch and puts one wrist (Thrall: the wolf's front paws) on the ledge
  corner for the hang, and a coordinate search over the joint angles keeps the
  pose scoring best on `anim score`'s crouch or ledge line, measured against the
  standing pose the sampler shows, and that keeps every held weapon's blade 4 units clear of
  the grip audit's limb capsules and its grip within 4 units of the wrist on every frame (smashcraft:tools/animations/weapon-clearance.ts, #451, #450); a crouch keeps its chest within 40 degrees of upright,
  so it lowers by bending the legs rather than tipping into a lunge, and fails if it
  sinks a non-weapon vertex more than 3% of its height below the stand's lowest
  (a robe or tabard hem may dip into the deck). Pit Lord's tail and every legged body's fold are
  searched for the hang as well. A clip already named
  for the pose is re-authored in place, and Illidan's Ledge Catch then eases into
  the new hang over its first 60%; otherwise it appends `Movement POSE` and
  binds it in the generated smashcraft:ts/src/game/presentation/movementClipInfo.ts;
  run fighters one at a time, since each run rewrites that table. Every other clip stays
  identical. Run it after the fighter's own generator, which rebuilds from stock,
  and before `jump-clips.ts --character`; then store the family and run
  `bun wisp inputs derive --fighter NAME`. A body the shared joints can't pose (Thrall's
  mount, Goblin Tinker's backpack claws, Mountain King's left-hand hammer, Anub'arak's
  carapace and squash, Sylvanas's dress, which sinks into the deck unless she squashes) keeps its own search space in
  `tools/animations/movement-poses/FIGHTER.ts`, usually the shared space of
  smashcraft:tools/animations/movement-space.ts plus named bones. A pose chosen by measurement rather
  than search (Chen's hang) is pinned in `PINNED`; Chen's hang turns his left wrist rather than the staff, since the staff's own pivot is off the grip and turning it pulls the shaft out of his fist (#525).
  `bun tools/animations/blademaster-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--replace down-air|up-air|forward-air]`
  appends a distinct gesture for each Blademaster normal and his back throw,
  preserving the double-jump flip, and re-authors the Down Air Sword Plunge clip
  in place as one alternating downward swipe per airborne hit, then the plunge and
  landing pop (#256). `--replace down-air` or `--replace up-air` re-authors only that clip on the shipped
  model, checking every other clip is unchanged. `--replace forward-air` plays the stock
  Attack Slam as the forward air, retimed so its level cut lands on the first active frame,
  under the airborne legs and root of the clip it replaces (#502).
  `bun tools/animations/peon-clips.ts STOCK_PEON.mdx PRIVATE_OUTPUT` appends
  Peon's tool strikes, movement, recovery, paired grabs and nine pain poses,
  preserves the 22 stock sequences and writes both-facing silhouette sheets.
  `bun tools/animations/peon-pool.ts AUTHORED_PEON.mdx PRIVATE_OUTPUT` prepares
  Peon's checked pooled clips and a retained record for the final roster export.
  `bun tools/animations/warden-fan-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` authors
  Warden's ground and air Fan of Knives casts, preserving other clips
  (smashcraft:docs/design/warden-fan-of-knives.md).
  `bun tools/animations/down-air-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT` writes
  both-facing down-air sheets from production pose selection and the roster's
  strike-height inventory (smashcraft:docs/down-airs.md).
  `bun tools/animations/pain-captures.ts PRIVATE_OUTPUT [FIRST_FIGHTER_SLUG]` plays accepted hits through
  the Wisp map, checks held hitstun and recovery, validates the bound pain models,
  and renders interruption, entry, held and recovery frames for the remaining roster.
  `bun tools/animations/pain-zoom-captures.ts PRIVATE_OUTPUT [FIGHTER_SLUG...]` plays the
  #181 nine-category scripts at gameplay zoom, checks each contact's category and clip,
  counts each fighter's drawn pool bodies every frame (two only inside a pose blend),
  renders held and recovery frames in Classic, and prints a per-fighter table.
  `bun tools/animations/stand-captures.ts PRIVATE_OUTPUT` checks each selectable
  fighter's shipped timeline against its source geosets at every Stand/move frame
  and renders both-facing Stand frames in Classic.
  `bun tools/animations/victory-captures.ts PRIVATE_OUTPUT [FIGHTER_NAME...] [--against LOSER_NAME...] [--views classic|classic-poses...]` (through the capacity helper) wins a
  headless match with each selectable fighter, or only the named ones, checks the winner's victory clip starts at its first
  frame, prints each sampled pose and renders a six-frame Classic results-screen strip per winner against the next fighter, or against each `--against` loser,
  with the UI (`classic`) and, for cold readers, without the UI or the winner's level-up burst (`classic-poses`).
  `--views` renders only the listed views; `--views classic-poses` skips the UI view, which under software GL is what keeps a full 26-fighter round inside five minutes.
  `bun tools/animations/victory-anatomy.ts` (from ts/) samples every selectable fighter's shipped victory every third frame,
  prints each frame and joint that breaks the anatomy rules in smashcraft:ts/scripts/wisp/victoryAnatomy.ts (an elbow bent
  backward, folded past its range or off its hinge, a bone stretched, an elbow or hand inside the torso) and rewrites the
  joint record ts/test/fixtures/victory-anatomy.json that `bun run test` checks (#496). Rerun it after storing a changed hero model;
  `victory-clips.ts` refuses any cheer pose that breaks the same rules.
  Both `jump-clips.ts` and `victory-clips.ts` key a free weapon (Cairne's `Bone_Axe_Free`, listed in smashcraft:ts/scripts/wisp/victoryJoints.ts) to its hand on every frame of the clip they author, from its Stand Ready or Stand grip, so it cannot drift off the hand between beats (#540).
  Illidan's victory is his own cheer (#590): arms out in a V, the right glaive tipped 75 degrees outward, both sleeve flaps hung from the forearm so no red shard points sideways, and a lowered-arm start so the stock stand pose's glaive disc is not on screen at frame 1;
  re-author it with `victory-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character 2`, store `illidan-animation` and run `inputs derive --fighter Illidan`.
  `bun tools/animations/grab-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]` appends
  coordinated expansion-hero reach, hold, pummel and four-direction holder/victim
  gestures or reauthors their existing indices. `--character` limits reauthoring
  to one expansion fighter (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/pit-lord-specials.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  authors Pit Lord's four special gestures while preserving all earlier clips.
  `bun tools/animations/kaelthas-clips.ts STOCK_BLOOD_MAGE.mdx PRIVATE_OUTPUT`
  appends Kael’thas’s normal, special, paired throw, recovery and nine pain
  gestures, preserves all eleven stock sequences, and writes both-facing sheets.
  Given the shipped model and `pain` or pose names (`dashAttack`) instead, it
  re-authors only those clips in place at their indices, fits a retimed clip
  before the next sequence, rewrites its binding and checks every other pose is unchanged.
  `bun tools/animations/murloc-clips.ts STOCK_MURLOC.mdx PRIVATE_OUTPUT` appends the
  Murloc's normal, special, paired throw, recovery and nine pain gestures to the
  stock Tiderunner, preserves its nine sequences and writes both-facing sheets;
  run it twice for a fresh clip table, since its reach search reads the table.
  Given the shipped model and `pain` instead, it re-authors only the nine pain
  clips in place at their indices and lengths and checks every other pose is unchanged.
  His dash attack is authored in Blender (#345): `... SHIPPED_MURLOC.mdx PRIVATE_OUTPUT dashAttack --rig RIG.json`
  writes his skeleton and stand pose, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/murloc-dash-attack.py -- RIG.json KEYS.json`
  pitches each joint about the side-view axis, squashes and stretches his body, aims the spear by its blade and bakes one key per attack frame,
  and `... dashAttack --keys KEYS.json` splices them, adds rotation or scaling tracks to nodes that lack one
  (or appends to such a track another clip added), and sets every frame on his feet.
  His jabs and forward tilts are point-first stabs (#497): `tools/animations/murloc-stabs.py -- POSE RIG.json KEYS.json`
  takes `jab`, `jab2`, `forwardTilt` or `forwardTiltDown`, solves his shoulder and elbow each
  startup and active frame so the spear tip rides a straight line along the hit direction, and splices the same way.
  Both scripts share the rig, pose vocabulary and bake in `tools/animations/murloc_rig.py`.
  Illidan's and Maiev's down tilts are leg sweeps authored in Blender (#517):
  `bun tools/animations/rekey-clip.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID --pose downTilt --limb R --rig RIG.json`
  writes the fighter's skeleton, canonical joints and per-frame hit regions, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/leg-sweep.py -- RIG.json KEYS.json FIGHTER`
  poses the beats in `tools/animations/leg-sweeps/FIGHTER.json` (planted support foot, swept ankle on a floor arc,
  hip twist, listed cloth folded clear of the floor), and `... --keys KEYS.json` re-keys the clip production plays
  for the move in place, refusing an unrelated clip change, a frame below the stand or a lower leg outside the hit region.
  Add `--kobold` with the stock Kobold input to author Kobold's pick, candle,
  recovery, throw and nine pain gestures and refresh only his clip/stride rows.
  `bun tools/animations/kobold-clips.ts AUTHORED_KOBOLD.mdx PRIVATE_OUTPUT` then
  re-authors Kobold's ground normals, smash charge and crouch in place on that
  model (hero-models/kobold.mdx) with per-move strike beats: prep, contact with
  the pick head on the hit region's far end, follow-through past it, and a
  settle into the idle pose; it adds a root step, lean and rise, grounds the
  body every frame and keeps the candle upright. Every other sequence stays
  byte-identical, and Murloc's generator output does not change.
  `--only=ultimate` appends his ultimate's own burrow clip (#404): a pick chop
  into the floor, a dig with only the pick and candle above the dirt, a coil and
  a burst up through the hit, independent of Panic Dig's sequences.
  Every clip it authors ends with a pick-clearance pass, and
  `bun tools/animations/weapon-clear.ts SHIPPED.mdx FIGHTER PRIVATE_OUTPUT SEQUENCE...`
  runs the same pass on named clips of any shipped model with a held weapon: on each
  run of 60 Hz frames where the weapon comes within 2 units of the grip audit's limb
  capsules (smashcraft:tools/animations/limb-capsules.ts), it keys the smallest hand
  turn that clears them, eased in and out over 4 frames, and leaves every other clip
  unchanged (#453).
  `bun tools/animations/anubarak-clips.ts STOCK_CRYPT_LORD.mdx PRIVATE_OUTPUT` authors
  Anub'arak's insect gestures, floor burrow, paired throws and nine pain poses,
  preserving all seventeen stock clips and writing both-facing pose sheets.
  Given the shipped model instead, `... SHIPPED_CRYPT_LORD.mdx PRIVATE_OUTPUT --rekey POSE...`
  authors the named clips and splices their keys in at their shipped intervals, refusing a
  changed length; every other clip, and the `... Motion` roots later passes added, stays
  byte-identical, so a move whose sim timing is unchanged is reworked without regenerating the
  clips that later passes edited (#459).
  A Blender take of his dash attack (#339, judged but not yet shipped): `... STOCK_CRYPT_LORD.mdx PRIVATE_OUTPUT --rig RIG.json`
  writes his skeleton, stand pose and the move's timing, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/anubarak-dash-attack.py -- RIG.json KEYS.json`
  bakes one key per attack frame, and `... STOCK_CRYPT_LORD.mdx PRIVATE_OUTPUT --keys KEYS.json` authors every clip with
  those keys spliced into the dash attack, set on the floor each frame (`tools/animations/blender-keys.ts`).
  `bun tools/animations/grab-pads.ts` generates the #180 mirror and unlike-height capture batch:
  every selectable fighter, four throws, both facings, with ordinary catch/pummel
  inputs and contact-frame captures in smashcraft:ts/test/native/pads/180/.
  `-dev quick pair FIRST / SECOND` selects different named fighters in the two human slots.

- Original strike authoring (from the repository root):
  `bun tools/animations/grom-clips.ts STOCK_GROM.mdx PRIVATE_OUTPUT` authors
  Grom's axe attacks, war cry, rush, leap, throws, recovery and nine pain
  poses on his stock campaign rig and writes both-facing sheets.
  His dash attack has a Blender path (#344): `... SHIPPED_GROM.mdx PRIVATE_OUTPUT dashAttack --rig RIG.json` writes his skeleton and stand pose, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/grom-dash-attack.py -- RIG.json KEYS.json`
  bakes one key per attack frame, turning every joint in the side-view plane and solving the axe arm onto each key's hand and axe-head aim,
  and `... dashAttack --keys KEYS.json` splices them and sets every frame on the floor.
  `blender --background --python tools/animations/strikes.py -- rifleman|illidan`.
  `SMASHCRAFT_ANIMATION_ASSETS=PRIVATE_DIR` selects the editable inputs;
  `SMASHCRAFT_STRIKE_CLIP='Attack Jab'` reauthors only the jab.
  Run Blender commands inside `nix develop`; its shell pins Blender and sets
  `WC3_MDL_ADDON` to the private exporter tree named by
  `tools/animations/mdl-exporter4.pin`. Its archived source revision is recorded
  in `tools/animations/mdl-exporter4.source`.

- Thrall stock-rig animation authoring (from the repository root):
  `bun tools/animations/thrall-clips.ts STOCK_THRALL.mdx PRIVATE_OUTPUT [POSE...]` appends
  mounted hammer, casting, recovery, grab and nine contact-reaction clips,
  writes both-facing side-view sheets, and refreshes Thrall clip and stride
  metadata. Store the generated model in `hero-models` and refresh the
  original clip pool before building. With pose names, reauthor only those clips
  from the existing `PRIVATE_OUTPUT/thrall.mdx`, preserving every other clip.
  Exact `Thrall Damage HEIGHT STRENGTH` names (each number 0–2) replace only
  the selected held pain poses; the generator requires nine distinct first poses.
  `bun tools/animations/thrall-victory.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  his victory, or re-authors it in place, on the shipped model: his rider arm is
  one bone, so victory-clips.ts cannot solve it; the hammer and free fist rise
  out to his sides so the front-on results view keeps them off his face (#514).
  His back air is authored in Blender (#260): `... STOCK_THRALL.mdx PRIVATE_OUTPUT backAir --rig RIG.json`
  writes his skeleton, stand pose, hammer head and both hits' frames, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/thrall-back-air.py -- RIG.json KEYS.json`
  bakes one key per attack frame, and `... backAir --keys KEYS.json` splices them into the existing `PRIVATE_OUTPUT/thrall.mdx`.

- Illidan locomotion authoring (from the repository root): run Blender with
  `--python tools/animations/illidan-locomotion.py -- PRIVATE_FIGHTER.blend PRIVATE_AUTHORED`,
  then `bun tools/animations/illidan-locomotion.ts PRIVATE_ASSETS PRIVATE_AUTHORED PRIVATE_OUTPUT`.
  Package with `bun tools/animations/package-illidan.ts PRIVATE_OUTPUT --metadata-only`,
  store `illidan-animation`, and refresh the original clip pool.

- Malfurion stock-rig authoring: `bun tools/animations/malfurion-clips.ts STOCK_FURION.mdx PRIVATE_OUTPUT` appends staff, nature-spell, recovery, paired-throw and nine pain gestures while preserving the eight campaign sequences.
  `bun tools/animations/malfurion-clips.ts SHIPPED_FURION.mdx PRIVATE_OUTPUT POSE...` re-authors only the named clips of the shipped model in place, checking every other clip is unchanged; `pain` does the same for the nine pain clips.
  His dash attack is authored in Blender (#342): `... SHIPPED_FURION.mdx PRIVATE_OUTPUT dashAttack --rig RIG.json` writes his skeleton and stand pose, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/malfurion-dash-attack.py -- RIG.json KEYS.json`
  bakes one key per attack frame on an identity-rest armature (no MDL exporter), and `... dashAttack --keys KEYS.json` splices them and sets every frame on the floor.
  His victory is authored in Blender too (#545), because his cloak is skinned to both upper arms and stretches when either rises (#514), so `victory-clips.ts` refuses him:
  `bun tools/animations/malfurion-victory.ts PRIVATE_ASSETS PRIVATE_OUTPUT --rig RIG.json` writes his skeleton and stand pose, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/malfurion-victory.py -- RIG.json KEYS.json`
  bakes the cheer (staff hand at the hip, the free fist pumped from the elbow beside his shoulder), and `... --keys KEYS.json` splices it into his victory in place,
  sets every frame on the floor, and refuses a cheer that stretches any cloak edge past twice its stand length or breaks the anatomy rules.

- Medivh animation authoring (from the repository root):
  `bun tools/animations/medivh-clips.ts STOCK_MEDIVH.mdx PRIVATE_OUTPUT`
  appends staff, blink, raven, grab, recovery and nine pain clips, preserving the
  22 stock sequences. Store `hero-models`, export only Medivh, then timeline it.
  Given the shipped model and pose names (`dashAttack`) instead, it re-authors only
  those clips in place at their indices, fits a retimed clip before the next sequence,
  rewrites its binding and checks every other clip is unchanged.
  His dash attack is authored in Blender (#343): `... SHIPPED_MEDIVH.mdx PRIVATE_OUTPUT dashAttack --rig RIG.json`
  writes his skeleton, stand pose and staff tip, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/medivh-dash-attack.py -- RIG.json KEYS.json`
  bakes one key per attack frame, and `... dashAttack --keys KEYS.json` splices them and sets every frame on the floor.

- Jaina animation authoring (from the repository root):
  `bun tools/animations/jaina-clips.ts STOCK_JAINA.mdx PRIVATE_OUTPUT`
  appends her staff strikes, spell gestures, movement and nine contact reactions;
  store the generated model in `hero-models` and refresh the original clip pool.
  Given the shipped model and pose names instead, it re-authors only those clips in
  place at their indices, rewrites their bindings and checks every other clip is unchanged.
  Every authored clip ends with a staff-clearance pass: on any 60 Hz frame where her staff
  comes within 7 units of the grip audit's limb capsules (smashcraft:tools/animations/limb-capsules.ts),
  it keys the smallest hand turn that clears it (#522).

- Tinker animation authoring (from the repository root):
  `bun tools/animations/tinker-clips.ts PRIVATE_CLASSIC_HEROTINKER.mdx PRIVATE_OUTPUT [--no-pool]`
  preserves the 23 classic sequences and authors the claw-pack, Laser aim,
  recovery, paired throws and nine pain reactions. It writes the private
  model, both-facing silhouette sheets, clip metadata and measured stride;
  `--no-pool` leaves pooled export to the combined roster pass
  (smashcraft:docs/fighter-animation-work.md, "Goblin Tinker"). Given the shipped
  model instead, `pain` re-keys the nine pain cells and `rekey POSE...` re-keys the
  named clips in place at their shipped indices and lengths, leaving every other
  sequence unchanged. A phase's `travel` moves the whole drawn body forward by that
  many model units through the floor-planting helper, so a lunge carries its mass
  toward the target instead of tipping in place.
  His dash attack is authored in Blender (#340): `... SHIPPED_HEROTINKER.mdx PRIVATE_OUTPUT rekey dashAttack --rig RIG.json`
  writes his skeleton, stand pose and the move's timing, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/tinker-dash-attack.py -- RIG.json KEYS.json`
  bakes one key per attack frame, pitching each joint about the side-view axis, and `... rekey dashAttack --keys KEYS.json` splices them and sets every frame on the floor.

- Lich King animation authoring (from the repository root):
  `tools/smashcraft-tools/target/release/smashcraft-tools build-lichking [PRIVATE_INPUTS] [IMMUTABLE_EXISTING_MODEL] [--replace NAME]...`
  authors clips through Blender; the optional existing model preserves shipped
  sequences and appends only new clips; `--replace NAME`, repeatable, reauthors an existing clip at its same index, in place when its length is unchanged and otherwise after the last clip, dropping its old keys (smashcraft:docs/fighter-animation-work.md).

- Derived fighter art (from ts/): `bun wisp inputs derive [--fighter NAME]... [--rebuild]`
  runs the clip export, the timeline body and the white flashes below for each fighter, fighters in
  parallel, redoes only the steps whose inputs changed and pins the result
  (smashcraft:docs/build-inputs.md, "Change art"). Run the single tools below to debug one step.

- Fighter body (from the repository root):
  `bun tools/animations/timeline-models.ts PRIVATE_ASSETS PRIVATE_POOL FIGHTER`
  writes the fighter's Classic timeline body from its canonical motion into a writable copy
  of `original-clips-static-lights`. It removes the fighter's older
  bodies and refreshes its clip table and timeline model facts; it compares every played pose
  with the pool it reads, so export a fighter whose played clips changed with
  `export-original-clips.ts --only FIGHTER` first.
  Store the family with `bun wisp inputs add original-clips-static-lights PRIVATE_POOL --all`.

- Weapon grip (from the repository root): `bun tools/animations/grip-audit.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  counts, per Classic sequence, frames whose weapon sits more than 4 units from the hand it is
  calibrated to in Stand Ready or crosses a body capsule, and records each row's worst grip-gap and
  worst-clearance moments (#373). It measures one hand, so a two-handed weapon the other hand holds
  reads as detached; its detached-by-prop column splits the count by rig joint, so one prop reads apart from another the same fighter holds (#525). From ts/, `bun scripts/gripStrips.ts PRIVATE_OUTPUT/grip-audit.json FIGHTER STRIP_OUTPUT ASSETS [SEQUENCE]...`
  renders those moments for every nonzero row in side, far-side and three-quarter Classic views,
  which is how a row is accepted as a measurement artifact or found to be a real defect (#436);
  named sequences instead render at six evenly spaced moments whatever their counts, to show a
  weapon held through a whole clip (#505).
  A stock sequence that lets a weapon leave the hand is re-keyed with
  `bun tools/animations/carry-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID --sequence NAME...`:
  in each named sequence every rig weapon (`weapon`, `weapon.L` in tools/animations/rigs/) stays
  where its hand held it in Stand Ready, at its Stand Ready scale, each geoset keeps its Stand Ready
  visibility, so a thrown or dropped prop geoset stays hidden, and every other sequence stays
  identical. A weapon under a wrist follows that wrist; one hanging from the root follows the
  weapon side's wrist. Store the family and run `bun wisp inputs derive --fighter NAME`.
  Rifleman's Knockdown, Down Damage, Get Up and Get Up Attack (#436) and Mountain King's
  Stand - 4 and Death (#505) were carried this way.
  `bun tools/animations/grip-zoom-strips.ts PRIVATE_OUTPUT/grip-audit.json FIGHTER STRIP_OUTPUT PRIVATE_ASSETS [SEQUENCE]...`
  settles what those fixed-crop strips cannot: it draws the posed Classic mesh centred on the pelvis
  in side, far-side, front and top views, body grey, arms pale, each held weapon in a flat colour,
  depth-tested, with every line where a blade crosses the body surface in yellow. For every 60 Hz
  frame it also measures how deep a blade point lies inside the body (behind the body surface from
  all six axis directions), and draws the deepest frame. A blade more than 1 unit inside is
  contact, not a measurement artifact; Blizzard's own Illidan Attack reaches 8.8 (#437).
- Weapon against hit regions (from the repository root): `bun tools/animations/weapon-trace.ts [--fighter SLUG]... [--assets DIR] [--shift FIGHTER:MOVE:DX | --fit]`
  traces each armed fighter's weapon (its rig's weapon bone) through every active frame of every
  move and fails a move whose weapon tip leaves that frame's hit regions, or whose region's far end
  lies away from everywhere the weapon goes during the move, by more than 20 units; a weapon held
  more than 20 units from the hand on both sides (a staff) counts as its full length; limb strikes and
  spell effects (`nonWeaponStrikes` `limb` and `spell` in each fighter's ts/src/game/fighters/<folder>/kit.ts; Illidan's in ts/src/game/sim/heroes/groundNormals.ts: strikes made by
  a foot, a leg, thrown knives or a spell, not the weapon) are reported, not failed, and a pass-through
  body region (marked path) is left out of the far-end check. It writes build/anim-score/classic-weapons.tsv worst first.
  `--shift` moves one region of one move by DX units for a mutant run (#508).
  `--fit` refits every failing weapon move: each active frame's capsules move onto the traced grip-to-tip segment
  (radius, frames, damage and knockback kept; several capsules on one frame keep their order along the blade),
  written as literal numbers to the generated ts/src/game/fighters/<folder>/weaponRegions.ts, which the fighter's kit.ts
  applies with fitMoves and fitSpecials (an ultimate with fitUltimate in ts/src/game/sim/ultimates.ts). It regenerates
  the strike-moment table (`bun wisp view strikes`) before each round and repeats until no move fails, at most 6 rounds,
  then prints the trace; a move it cannot map is printed as `not fitted` with its reason (#614).

- Key jitter (from ts/): `bun wisp anim jitter [--fighter NAME]...`
  fails when a curved key segment between keys at most 50 ms apart leaves its keys (#479);
  pre-push runs it when the clip pool or its tools change. The 1.0-unit translation limit is
  calibrated on Shadow Hunter's 0.0.145 bodies (smashcraft#4): his 14 shaking clips, forward smash
  and angled-up forward tilt among them, scored 1.10 to 6.23, and his 54 clean clips, stock ones
  included, at most 0.59. `thinKeys` writes clamped slopes
  for generator-broken handles, and for every key of a close-key segment that would still leave
  its keys past the limit, and flat handles on held axes, so regenerating through it fixes
  an offender. `JITTER_EXEMPTIONS` in smashcraft:ts/scripts/wisp/animJitter.ts names a fighter
  that cannot yet be regenerated, with its issue; the check fails once that fighter stops jittering.
  It also fails when a root node's translation keys turn back twice in a row by more than
  `BOB_LIMIT` (2 units): the whole body bobbing every frame. Cairne's grounding read his soles
  through the Main key it had just written, so each frame's height mirrored the last and his
  forward smash bobbed 19.5 units (#277); every other fighter stays under 0.8. `BOB_EXEMPTIONS`
  names a clip still bobbing from a tracked cause, and the check fails once it stops.
- Drawn path (from ts/): `bun scripts/wisp/drawnPath.ts PAD FRAMES` plays a pad script headless
  through the predicted pool presentation and prints, per frame and fighter, the clip, its time,
  the placed x/z and the drawn x/z (placement plus the clip's bone centroid sampled from the
  model). It flags and exits nonzero when a drawn axis turns back twice in a row by more than
  2 units outside hitlag, a clip returns to the one it left within two frames outside hitlag
  (`clip-flap`, a pose flickering between two states), or a non-looping clip's time stops rising
  before its end. The #277 pads in smashcraft:ts/test/native/captures/277/ run through it
  unchanged; crouch-release-analog.pad releases over 2–6 frames and rests the stick with noise
  inside Melee's 0.625–0.6875 crouch band.

- White body flashes (from the repository root):
  `bun tools/animations/white-flash-models.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]`
  authors white body-only copies with the original meshes and keys for selectable gameplay poses, removing unused sequences, repeated constant keys, glow cards and team-glow ground planes for charge and heavy-hit flashes (the pre-push stored-model check fails a white copy that keeps a ground plane, #346); store PRIVATE_OUTPUT as `impact-assets`, which lists each fighter's white bodies and the textures they draw in white-flash-imports/NAME.txt and drops textures no list names. The flash draws 8 units toward the camera and shrinks to keep the body's on-screen silhouette without z-fighting.
  `--character` refreshes one fighter in an existing PRIVATE_OUTPUT family and its own files in smashcraft:ts/src/generated/assets/white-models/ and white-facts/ (named by fighter slug; the indexes change only when a fighter is added).

- Sylvanas animation authoring (from the repository root):
  `bun tools/animations/sylvanas-clips.ts STOCK_SYLVANAS.mdx PRIVATE_OUTPUT`
  appends bow attacks, casts, recovery, paired grabs and nine damage reactions
  to the classic undead Sylvanas rig, preserving its stock sequences.
  `bun tools/animations/sylvanas-clips.ts SHIPPED_SYLVANAS.mdx PRIVATE_OUTPUT CLIP...`
  re-authors only the named timed clips of the shipped model in place (`pain` names
  the nine pain clips, set on the floor by her body without the bow under the pain
  gate; other ground clips are set on the floor by their lowest vertex), requires
  every other clip unchanged, and writes `evilsylvanas.mdx` for the `hero-models` shard.

- Cairne animation authoring (from the repository root):
  `bun tools/animations/cairne-clips.ts STOCK_TAUREN.mdx PRIVATE_OUTPUT`
  appends the complete halberd kit, recovery, paired grabs and nine pain clips
  to the private classic Tauren Chieftain model, preserving its stock clips.
  It rebuilds from stock, so follow it with `jump-clips.ts --character 16` and
  `victory-clips.ts --character 16` to re-append his double jump (96) and victory (97);
  `bun run check` (smashcraft:ts/scripts/clipBindingsCheck.ts) refuses a clip binding
  past the end of a fighter's model (#278).
  His down air is authored in Blender (#96): `... SHIPPED_TAUREN.mdx PRIVATE_OUTPUT downAir --rig RIG.json`
  writes his skeleton, stand pose and halberd grip, then
  `nix shell --inputs-from . nixpkgs#blender --command blender --background --factory-startup --python tools/animations/cairne-down-air.py -- RIG.json KEYS.json`
  bakes one key per attack frame, and `... downAir --keys KEYS.json` splices them into the shipped
  model in place, keys the halberd to his hand and checks every other clip is unchanged.
  Each clip eases the halberd from its Stand Ready grip to his idle grip, turned 179 degrees
  apart, about his right hand (#447). `... SHIPPED_TAUREN.mdx PRIVATE_OUTPUT grip` re-keys only
  the halberd in the shipped clips whose ease had swung it about the model origin, up to 54 units off his hand.

- Forsaken Paladin animation authoring (from the repository root):
  `bun tools/animations/forsaken-paladin-clips.ts STOCK_FORSAKEN_PALADIN.mdx PRIVATE_OUTPUT`
  keeps the stock Forsaken body, sword and rig, and
  authors his strikes, recovery, paired throws and nine pain poses.
  Given the shipped model and pose names (or `pain` for the nine pain cells)
  instead, it re-authors only those clips in place at their indices and lengths.
  `bun tools/animations/stock-forsaken-model.ts STOCK_CLASSIC_FORSAKEN.mdx AUTHORED_FORSAKEN.mdx PRIVATE_OUTPUT.mdx`
  restores the stock Classic mesh and version-1800 skin while retaining the shipped motion.
  `bun tools/animations/forsaken-paladin-weapon-clips.ts STOCK_FORSAKEN.mdx AUTHORED_FORSAKEN.mdx PRIVATE_OUTPUT`
  replaces normal and special motion at the canonical indices with the stock Attack 1,
  Attack Slam and Spell Slam sequences. It remaps their wind-up, strike and recovery
  to the existing move frames, keeps the pummel's held left arm, and writes measured
  weapon contact geometry through `forsakenPaladinWeaponGeometry.ts`. The authoring
  move tables provide the contact targets; shipped collision follows the measured
  grip and blade. Run the original clip export, timeline export
  and Character 7 white-copy export afterward. Other fighter inputs stay unchanged.
  His sword joint hangs from the root rather than his hand, so later arm passes left it
  up to 64 units out of his fist (#515).
  `bun tools/animations/weapon-grip.ts SHIPPED.mdx PRIVATE_OUTPUT CHARACTER FIRST_AUTHORED_SEQUENCE`
  re-keys only the weapon joint, at 60 Hz, in each authored clip whose grip strays more than
  2.5 units from the wrist, sliding the weapon back to 2.5 units without turning it, and
  checks every other track and clip is unchanged; run it with `7 28` on his shipped model.

- Chen animation authoring (from the repository root):
  `bun tools/animations/chen-clips.ts STOCK_CHEN.mdx PRIVATE_OUTPUT` authors
  Chen's staff, footwork, special, recovery, paired throw and nine pain clips
  from his private stock model and regenerates his clip table
  (smashcraft:docs/design/chen.md). With `pain` and his shipped model it re-authors
  only the nine pain clips in place and gates them with pain-gate.ts.

- Damage reactions (from the repository root):
  `bun tools/animations/damage-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --fighter NAME...`
  re-keys the named fighters' nine Damage Grid pain clips in place, gates them
  with pain-gate.ts and proves every other sequence unchanged. Store changed model families
  and refresh the clip pool (smashcraft:docs/fighter-animation-work.md).

Fighter portraits: `bun scripts/fighterPortraits.ts PRIVATE_OUTPUT` (from ts/, through the
capacity helper) renders the Classic portrait set, neutral and the four slot
outfits, with Wisp's headless renderer; store PRIVATE_OUTPUT/fighter-renders as `fighter-renders`.
See smashcraft:docs/design/fighter-portraits.md.
