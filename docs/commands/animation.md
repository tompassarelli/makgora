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
  `--replace-pose POSE` replaces only an existing gesture and refreshes its
  dependent sequence indices.
  `bun tools/animations/dreadlord-pounce-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` authors Dreadlord’s horizontal corkscrew, bite and recovery; `bun tools/animations/dreadlord-pounce-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT` captures their production phase selection in both facings.
  `bun tools/animations/jump-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID] [--no-preview]` appends
  movement-only jump gestures, including Blademaster's front flip
  (smashcraft:docs/fighter-animation-work.md). `--character` authors one selected
  fighter's double jump in the style smashcraft:docs/design/animation-reference.md picks (Blademaster keeps his #230 flip) and retains other jump bindings; `--no-preview`
  skips silhouette sheets. Store the changed model family and refresh both body
  timelines and clip metadata before using the generated bindings.
  `bun tools/animations/movement-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID --pose crouch|ledgeHang [--pose ...]`
  authors a fighter's crouch or ledge hang on its shipped model through the
  canonical rig (#40): each mapped joint turns about the side-view axis, one root
  helper, reused by every later run rather than nested again, plants the ankles (or the lowest point of a legless body) on the floor
  for the crouch and puts one wrist (Thrall: the wolf's front paws) on the ledge
  corner for the hang, and a coordinate search over the joint angles keeps the
  pose scoring best on `anim score`'s crouch or ledge line, measured against the
  standing pose the sampler shows; a crouch keeps its chest within 40 degrees of upright,
  so it lowers by bending the legs rather than tipping into a lunge, and fails if it
  sinks a non-weapon vertex more than 3% of its height below the stand's lowest
  (a robe or tabard hem may dip into the deck). For a fighter with a Definitive body it then
  refines that pose against the worse of the two looks, retargeting only the
  stand and the authored clip onto the stock Definitive model
  (smashcraft:tools/animations/movement-definitive.ts), and keeps the refinement
  only when both looks pass, never trading a passing Classic line for a failing one. Pit Lord's tail and every legged body's fold are
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
  smashcraft:tools/animations/movement-space.ts plus named bones, refined
  against Definitive like every other space. A pose chosen by measurement rather
  than search (Chen's hang) is pinned in `PINNED`.
  `bun tools/animations/blademaster-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  appends a distinct gesture for each Blademaster normal and his back throw,
  preserving the shipped plunge and double-jump flip.
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
  renders held and recovery frames in Classic and Definitive, and prints a per-fighter table.
  `bun tools/animations/stand-captures.ts PRIVATE_OUTPUT` checks each selectable
  fighter's shipped timeline against its source geosets at every Stand/move frame
  and renders both-facing Stand frames in Classic and Definitive.
  `bun tools/animations/victory-captures.ts PRIVATE_OUTPUT` (through the capacity helper) wins a
  headless match with each selectable fighter, checks the winner's victory clip starts at its first
  frame, prints each sampled pose and renders a six-frame Classic results-screen strip per winner,
  with the UI (`classic`) and, for cold readers, without the UI or the winner's level-up burst (`classic-poses`).
  `bun tools/animations/grab-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]` appends
  coordinated expansion-hero reach, hold, pummel and four-direction holder/victim
  gestures or reauthors their existing indices. `--character` limits reauthoring
  to one expansion fighter (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/pit-lord-specials.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  authors Pit Lord's four special gestures while preserving all earlier clips.
  `bun tools/animations/kaelthas-clips.ts STOCK_BLOOD_MAGE.mdx PRIVATE_OUTPUT [--look definitive]`
  appends Kael’thas’s normal, special, paired throw, recovery and nine pain
  gestures, preserves all eleven stock sequences, and writes both-facing sheets.
  `--look definitive` applies the Definitive recovery overrides (robe and cape
  add travel) to a model that is only the input for the Definitive body transfer.
  `bun tools/animations/murloc-clips.ts STOCK_MURLOC.mdx PRIVATE_OUTPUT` appends the
  Murloc's normal, special, paired throw, recovery and nine pain gestures to the
  stock Tiderunner, preserves its nine sequences and writes both-facing sheets;
  run it twice for a fresh clip table, since its reach search reads the table.
  Add `--kobold` with the stock Kobold input to author Kobold's pick, candle,
  recovery, throw and nine pain gestures and refresh only his clip/stride rows.
  `bun tools/animations/kobold-clips.ts AUTHORED_KOBOLD.mdx PRIVATE_OUTPUT` then
  re-authors Kobold's ground normals, smash charge and crouch in place on that
  model (hero-models/kobold.mdx) with per-move strike beats: prep, contact with
  the pick head on the hit region's far end, follow-through past it, and a
  settle into the idle pose; it adds a root step, lean and rise, grounds the
  body every frame and keeps the candle upright. Every other sequence stays
  byte-identical, and Murloc's generator output does not change.
  `bun tools/animations/anubarak-clips.ts STOCK_CRYPT_LORD.mdx PRIVATE_OUTPUT` authors
  Anub'arak's insect gestures, floor burrow, paired throws and nine pain poses,
  preserving all seventeen stock clips and writing both-facing pose sheets.
  `bun tools/animations/grab-pads.ts` generates the #180 mirror and unlike-height capture batch:
  every selectable fighter, four throws, both facings, with ordinary catch/pummel
  inputs and contact-frame captures in smashcraft:ts/test/native/pads/180/.
  `-dev quick pair FIRST / SECOND` selects different named fighters in the two human slots.

- Original strike authoring (from the repository root):
  `bun tools/animations/grom-clips.ts STOCK_GROM.mdx PRIVATE_OUTPUT` authors
  Grom's axe attacks, war cry, rush, leap, throws, recovery and nine pain
  poses on his stock campaign rig and writes both-facing sheets.
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

- Illidan locomotion authoring (from the repository root): run Blender with
  `--python tools/animations/illidan-locomotion.py -- PRIVATE_FIGHTER.blend PRIVATE_AUTHORED`,
  then `bun tools/animations/illidan-locomotion.ts PRIVATE_ASSETS PRIVATE_AUTHORED PRIVATE_OUTPUT`.
  Package with `bun tools/animations/package-illidan.ts PRIVATE_OUTPUT --metadata-only`,
  store `illidan-animation`, and refresh the original clip pool.

- Malfurion stock-rig authoring: `bun tools/animations/malfurion-clips.ts STOCK_FURION.mdx PRIVATE_OUTPUT` appends staff, nature-spell, recovery, paired-throw and nine pain gestures while preserving the eight campaign sequences.

- Medivh animation authoring (from the repository root):
  `bun tools/animations/medivh-clips.ts STOCK_MEDIVH.mdx PRIVATE_OUTPUT`
  appends staff, blink, raven, grab, recovery and nine pain clips, preserving the
  22 stock sequences. Store `hero-models`, export only Medivh, then timeline it.

- Jaina animation authoring (from the repository root):
  `bun tools/animations/jaina-clips.ts STOCK_JAINA.mdx PRIVATE_OUTPUT`
  appends her staff strikes, spell gestures, movement and nine contact reactions;
  store the generated model in `hero-models` and refresh the original clip pool.

- Tinker animation authoring (from the repository root):
  `bun tools/animations/tinker-clips.ts PRIVATE_CLASSIC_HEROTINKER.mdx PRIVATE_OUTPUT [--no-pool]`
  preserves the 23 classic sequences and authors the claw-pack, Laser aim,
  recovery, paired throws and nine pain reactions. It writes the private
  model, both-facing silhouette sheets, clip metadata and measured stride;
  `--no-pool` leaves pooled export to the combined roster pass
  (smashcraft:docs/fighter-animation-work.md, "Goblin Tinker").

- Lich King animation authoring (from the repository root):
  `tools/smashcraft-tools/target/release/smashcraft-tools build-lichking [PRIVATE_INPUTS] [IMMUTABLE_EXISTING_MODEL] [--replace NAME]...`
  authors clips through Blender; the optional existing model preserves shipped
  sequences and appends only new clips; `--replace NAME`, repeatable, reauthors an existing clip at its same index, in place when its length is unchanged and otherwise after the last clip, dropping its old keys (smashcraft:docs/fighter-animation-work.md).

- Derived fighter art (from ts/): `bun wisp inputs derive [--fighter NAME]... [--rebuild]`
  runs the clip export, both bodies and the white flashes below for each fighter, fighters in
  parallel, redoes only the steps whose inputs changed and pins the result
  (smashcraft:docs/build-inputs.md, "Change art"). Run the single tools below to debug one step.

- Both fighter bodies (from the repository root):
  `bun tools/animations/timeline-models.ts PRIVATE_ASSETS PRIVATE_POOL FIGHTER`
  writes the fighter's Classic timeline body from its canonical motion into a writable copy
  of `original-clips-static-lights` and, for fighters in `DEFINITIVE_FIGHTERS`, its Definitive
  body under the same path in `_de.w3mod`, checked within 0.5 units / 0.5 degrees
  (smashcraft:docs/design/hd-fighters.md, "Canonical rig"). It removes the fighter's older
  bodies and refreshes its clip table and timeline model facts; it compares every played pose
  with the pool it reads, so export a fighter whose played clips changed with
  `export-original-clips.ts --only FIGHTER` first. A map build fails when a fighter in
  `DEFINITIVE_FIGHTERS` has no Definitive body.
  Store the family with `bun wisp inputs add original-clips-static-lights PRIVATE_POOL`.

- Key jitter (from ts/): `bun wisp anim jitter [--fighter NAME]... [--graphics classic|definitive]...`
  fails when a curved key segment between keys at most 50 ms apart leaves its keys (#479);
  pre-push runs it when the clip pool or its tools change. The 1.0-unit translation limit is
  calibrated on Shadow Hunter's 0.0.145 bodies (smashcraft#4): his 14 shaking clips, forward smash
  and angled-up forward tilt among them, scored 1.10 to 6.23, and his 54 clean clips, stock ones
  included, at most 0.59. `thinKeys` writes clamped slopes
  for generator-broken handles, and for every key of a close-key segment that would still leave
  its keys past the limit, and flat handles on held axes, so regenerating through it fixes
  an offender. `JITTER_EXEMPTIONS` in smashcraft:ts/scripts/wisp/animJitter.ts names a fighter
  that cannot yet be regenerated, with its issue; the check fails once that fighter stops jittering.

- White body flashes (from the repository root):
  `bun tools/animations/white-flash-models.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID | --definitive]`
  authors white body-only copies with the original meshes and keys for selectable gameplay poses, removing unused sequences, repeated constant keys, glow cards and team-glow ground planes for charge and heavy-hit flashes (the pre-push stored-model check fails a white copy that keeps a ground plane, #346); store PRIVATE_OUTPUT as `impact-assets`, which lists each fighter's white bodies and the textures they draw in white-flash-imports/NAME.txt and drops textures no list names. Each fighter whose Definitive body ships (`DEFINITIVE_FIGHTERS`, #366) also gets a light white copy of that body under the same path in `_de.w3mod`, so Definitive flashes the drawn body (#378): level of detail 0 only, hidden geosets dropped, meshes halved with meshoptimizer, keys kept only on nodes that move drawn vertices, near-linear keys pruned, and vertices, normals, tangents, texture coordinates and key values rounded to 10 mantissa bits so they compress (the engine still shades the copy, so flattening those attributes darkens it). The flash draws 8 units toward the camera and shrinks to keep the body's on-screen silhouette without z-fighting; `--definitive` rebuilds only those, and a map build fails when a shipped Definitive body has none or a fighter drawing Classic in Definitive has one.
  `--character` refreshes one fighter in an existing PRIVATE_OUTPUT family and its own files in smashcraft:ts/src/generated/assets/white-models/ and white-facts/ (named by fighter slug; the indexes change only when a fighter is added).

- Sylvanas animation authoring (from the repository root):
  `bun tools/animations/sylvanas-clips.ts STOCK_SYLVANAS.mdx PRIVATE_OUTPUT`
  appends bow attacks, casts, recovery, paired grabs and nine damage reactions
  to the classic undead Sylvanas rig, preserving its stock sequences.

- Cairne animation authoring (from the repository root):
  `bun tools/animations/cairne-clips.ts STOCK_TAUREN.mdx PRIVATE_OUTPUT`
  appends the complete totem kit, recovery, paired grabs and nine pain clips
  to the private classic Tauren Chieftain model, preserving its stock clips.

- Forsaken Paladin animation authoring (from the repository root):
  `bun tools/animations/forsaken-paladin-clips.ts STOCK_FORSAKEN_PALADIN.mdx PRIVATE_OUTPUT`
  keeps the stock Forsaken body, sword and rig, and
  authors his strikes, recovery, paired throws and nine pain poses.
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

- Chen animation authoring (from the repository root):
  `bun tools/animations/chen-clips.ts STOCK_CHEN.mdx PRIVATE_OUTPUT` authors
  Chen's staff, footwork, special, recovery, paired throw and nine pain clips
  from his private stock model and regenerates his clip table
  (smashcraft:docs/design/chen.md).

- Damage reactions (from the repository root):
  `bun tools/animations/damage-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  appends all fighters' nine articulated contact reactions, checks their
  drawn first poses, and preserves old sequences. Store changed model families
  and refresh the clip pool (smashcraft:docs/fighter-animation-work.md).

Fighter portraits: `bun scripts/fighterPortraits.ts PRIVATE_OUTPUT` (from ts/, through the
capacity helper) renders the Classic and Definitive portrait sets, neutral and the four slot
outfits, with Wisp's headless renderer; store PRIVATE_OUTPUT/fighter-renders as `fighter-renders`.
See smashcraft:docs/design/fighter-portraits.md.
