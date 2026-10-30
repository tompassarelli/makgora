# Player guide

Requires Warcraft III 3.0 and a keyboard; nothing else to install. Download
the map from [Hive Workshop](https://www.hiveworkshop.com/threads/smashcraft-0-1-0.375492/),
put it in the Warcraft III Maps folder
and open it from Custom Games. Public 0.1 uses the Classic look. Set Graphics
to Classic and restart Warcraft III after changing it. A
controller is optional: the Smashcraft controller helper turns its buttons
and sticks into its own pad keys, which work with any Controls layout, so
pad players keep whichever layout they like (the Controls screen that opens each game, or F1, changes it; it saves straight away).
The default Melee layout uses A to
attack, B for specials, X/Y to jump, RB to grab and LB for Strong;
Tom's layout uses A to attack, X for specials, Y to jump, B to grab, LB to
short hop and RB for Strong. In both layouts, either trigger shields or air-dodges and
Start pauses. The current prototype includes character and stage
selection, 27 fighters, a bot opponent, floating platforms, blast zones,
stocks, rematches, and configurable controls.

For solo practice, place only your own fighter chip and press Y, then choose
a stage and press Y again. Leave the CPU chip unplaced. Practice has no timer
or opponent, and falling off the stage respawns you without ending the session.
Press Backspace to pause, then Escape to return to fighter selection. Place the CPU
chip before starting when you want a bot match instead. Below each CPU card,
Opponent settings lets you choose Rook, Ember, Flint, Vale, Kite or Wren,
then Rookie, Beginner, Intermediate, Advanced or Expert difficulty. Each
opponent has recognizable tendencies and improves several skills as difficulty
rises. The preview describes that exact opponent and difficulty, including
an opening to watch for. New CPU slots start with Wren at Intermediate.
The first player or the slot owner can change the choices; everyone else can
read the preview. Random chooses an opponent each match and keeps your
difficulty; countdown and results show who you face. Choices stay through
fighter or stage changes, New Match and automatic rematches.

At fighter selection, any player can change Stocks, Time, Endless and
Automatic rematch. No time limit removes the clock. Endless also removes
the stock limit; pause and press Escape to leave. Automatic rematch keeps
the same fighters, stage and rules, with a visible five-second countdown
after the result. A player can stop it with a menu control, then choose the
next match. It starts off.

Training (top of the rules) turns the match into practice against computer
partners: no clock and no lost stocks. Choose what the partner does (Stand,
Shield, Crouch, Jump, Attack or Fight), which way it drifts when hit, how it
techs, its damage, whether hit areas show (bodies green, attacks red) and the
speed (Full, Half or Quarter).
Fight uses the partner's chosen opponent and difficulty; the other partner
behaviors keep their explicit actions.
The top-left readout gives your last attack's frames, how many frames ahead
(+) or behind (-) you were after it hit or was shielded, and the combo. Hold
both shields and press Attack to put everyone back at the start.

An orange halo means your fighter is locked and no current input can help.
A green halo means moving the stick can change the hit or throw, while buttons
cannot. The halo disappears as soon as a button can matter, including an attack
you can queue before recovery or a tech you can press before landing. The
fighter keeps the usual hit and ice colours inside the halo.

## Menus and controls

Mouse buttons and your left/right keys (A/D on WASD, W/R on Box) + N select a
fighter or stage; U goes back. Menus always follow your own bindings, and the
arrow keys work too. Drag a
character chip from the active player card onto the roster. New Match retains
selections. On the selection screens Y confirms character/stage selection and chooses the next match after
a result. Backspace pauses or resumes an active match (Start on a controller); while
the Warcraft chat box is open, typing never pauses, moves or attacks. Pausing freezes combat and
match time while keeping input handling live. Enter is reserved for Warcraft
chat.

At fighter selection, up/down (W/S on WASD, Space/E on Box) moves focus
between fighter cards and CPU Opponent settings. Left/right changes the focused
fighter; N opens focused settings. Inside the panel, up/down visits Opponent,
Difficulty and Done; left/right changes the value. N advances to the next row or chooses Done, and U or Close returns
to Opponent settings while retaining choices. Start closes the panel; release
and press it again to continue. Controller menus use the left stick to move
the pointer, A to choose and B to go back. The panel shows your current control bindings.

Every game opens on the Controls screen, one for each player, before fighter
select. Pick a layout at the top: WASD (recommended if you're new), Box
(the leverless controller style, with Space as up) or Custom; picking one saves it as
your profile. WASD and Box never change: rebinding a key on either copies that
layout into Custom with your edit, selects Custom and saves it, and the Customize
button copies the selected layout into Custom without an edit, replacing what
Custom held. Load profile brings back your saved setup: when you have one it
is already loaded and selected, and the screen says so; without one the button
reads "No saved profile". Below, the keyboard lights every bound key with its
action; click a lit key, press the key you want instead, then Save. If another
action already held that key, the two swap and the screen says "Swapped with"
that action. Press Delete instead of a key to clear the slot, or click the small x
on a lit key's corner; an action left with no key is listed as Unbound, and a Bind button captures a key for it. Escape cancels a
rebind. On Custom the bottom row adds Rename, which names the selected slot, and Reset, which brings back the Custom defaults, and Delete profile above Load profile empties the selected slot back to the Custom defaults with no name.
Done (or Escape) closes the screen and goes on to fighter
select; each player confirms their own. F1 opens it again before a match.
Type -save in chat to save your current controls and delay, or -load to
bring back your saved ones. Y binds to any action and stays Start on fighter and stage select; Backspace (Pause) is reserved for rebinding; F6 and F7
remain reserved for Warcraft shortcuts. Pressing a reserved key during a rebind
is refused and the screen names what it is reserved for. Ctrl+T starts a developer input trace.

Help: type -help (or -commands) in chat for every player command, one line
each, or press F9 for the quest log's Controls (your current layout and how to
change it), How to play (stocks, shield, recovery) and Commands entries; F9 on
the Controls screen closes it so the quest log shows. A line at the start of
each game says so.

Saw something wrong? Type -clip in chat, or hold View on a controller for a second: the
last ten seconds of the match are saved for a bug report on your computer, in
Warcraft III's CustomMapData folder as smashcraft-repro-*.txt, and "Moment
saved" appears. The match goes on undisturbed.

WASD, the default, uses A/D to move, W to aim up, S to fast-fall or drop
through platforms, 8 to jump, Q to shield or air-dodge, E for light
shield, O to grab, 9 for Strong, 0 for C-up, N to attack, and U for a special. Box moves with W/R,
aims up with Space and down with E, jumps with 8 and shields with Q (light
shield A, Strong 9, C-up 0). Custom is Box with 9 to jump, Q/8 to shield, A for light shield, - for C-up and 0 for Strong. Shield + N or O
grabs. While holding an
opponent, tap N to pummel once or a movement/C-stick direction to throw forward,
backward, up, or down; after the pummel, throw or the opponent goes free. Mash
action buttons and alternate movement directions to escape a grab; holding one
button does not count as mashing. The bar above a held fighter drains as the
hold runs out and faster with mashing; the mark on it shows when a pummel would
land.

I always gives the existing short hop, however long you hold it; in Tom's pad
layout, press LB. In Melee, tap X or Y to short hop. The ordinary jump keys still full hop when held and
short hop when released during startup. In the air, I uses your second jump.

Fighters grip the ground differently. Jaina is the most slippery and slides
furthest on a wavedash; Malfurion, Medivh, Kael'thas and Murloc slide
further than most after a run, a dash or a moonwalk; Thrall, Mannoroth, Cairne
and Anub'arak stop shortest. Landing slides, wavedashes included, brake hard
until the fighter is down to walking speed, then glide to a stop.

After any landing with landing lag, an aerial, an air dodge or a helpless landing, the stick decides
the exit. A direction you were already holding as you touched down and keep holding walks out when the
lag ends. Releasing the stick and pressing a direction again, or crossing straight to the other side,
at any moment of the lag buffers a dash that way (forward or back), which starts on the first frame you
can act. Landings with no lag are unchanged.

To moonwalk, dash and then tilt the stick lightly backward without smashing
it: your fighter keeps facing forward in its dash while it slows and slides back. Hold
the light tilt for three frames, after which you can push the stick fully
back; a quick smash back turns you around instead (a dash dance). The slide
lasts until the dash would become a run. On keyboard, hold down together with
the back key: the diagonal counts as a light tilt (on a platform, a fresh down
press drops you through it).

Attacks buffer for six frames, including through jump squat. Two modifiers shape the stick (Tom's design, 2026-10-30). Mod X, labelled Walk in the controls (K, renamed for clarity on 2026-10-30), reduces the horizontal value only: it walks, gives forward tilts, and with up and a side sends a steep up-diagonal about 67 degrees above horizontal. Mod Y (;) reduces the vertical value only: it gives up and down tilts, and with a side and up or down sends a shallow diagonal about 23 degrees from horizontal for wall rides. Hold both for the all-purpose tilt, which shields tilt with. Demon Hunter's Wing Ascent launches along either diagonal and steered flights such as Kael'thas's phoenix turn toward it, while the eight-way aimed specials still read it as a diagonal;
Hold down while rising into a platform without an aerial to stand on it
instantly, with a small landing puff. Without down, or during an aerial, you
pass through; so does down with Mod Y held. Held down keeps you crouching; attack gives down tilt and special
gives down-B. Release down, then hard-press it to drop immediately. Analog
inputs need a quick flick; keyboard inputs need a fresh down-key press. The
drop consumes that press: held down never fast-falls. Return toward neutral
(or release the key), then press down again to fast-fall.
N with a direction performs a tilt when standing, walking or crouching; out of a dash or a run N is the dash attack, a fresh flick included. The C-stick keys always give the tilt they name on the ground, even out of a dash or a run: you stop and tilt at once. Strong (9 on WASD and Box; 0 on Custom; LB or RB on a pad) gives the smashes, after Rivals of Aether's strong button. Strong is a modifier and never attacks on its own. Strong + a direction is that direction's smash, with no N press: up, down, or forward for a side, turning to face it. Press a direction while holding Strong, or press Strong with a direction held (or just after pressing one). It works standing, walking (hold the walk modifier), crouching, in a dash's first three frames, and out of jump squat for the up smash; Strong + up is the up smash at any point of a dash or a run. Where your state allows no smash (forward or down in a run, or later in a dash), Strong + a direction does nothing and you keep moving as you would without Strong, so down in a run still crouches and a fresh direction from that crouch smashes. While Strong is held standing still, the directions aim smashes and do not move you; release Strong to move again. Strong + N on the ground is always the up smash, with no direction held or any direction held, in a run or late in a dash too (Tom's rule of 2026-10-30). Keep holding Strong or N to charge it. The Strong + N up smash charges while either button is held and fires when both are released (Tom's rule of 2026-10-30); the Strong + direction smashes charge while Strong and their direction are held. Strong has to be held on the same frame as the direction or earlier: tap it and let go, and a direction pressed after that does nothing special. In the air, Strong + N with a direction gives that aerial, as N does. On the ground the C-stick keys give tilts, never smashes: C-left and C-right are the forward tilt (turning to face that side first), C-up the up tilt and C-down the down tilt; out of a dash or a run they give the dash attack, and in the air they give the aerials. J is
C-left; P is C-down; - is C-up; L is C-right. C-down air preserves
normal aerial momentum. WASD and Box use 7 for right trigger;
Custom uses 8. T is unbound by default.

Specials use U with a direction; every fighter's specials and
ultimate are listed by name in the [move list](move-list.md). Strong + U
with a direction is the same ordinary special (press U with the direction or before it, since Strong and a direction alone smash). Each fighter has one ultimate meter, filled only by the orb that appears above centre stage every 30 s (0:30, 1:00, 1:30 and so on): touch it with your body or hit it with a normal attack, but not from a special, an ultimate or an air dodge, which pass through it. Each orb gives half a meter, so two make an ultimate. At a full ultimate meter,
N + U together (A + B in Melee or A + X in Tom's controller layout) is the fighter's ultimate, Strong held or not (below a full ultimate meter it is the plain special); the
Ultimates rule at fighter selection turns them off.

Use Warcraft's ordinary Quit Mission to leave and recreate a custom game.
The map's Ctrl+R restart path is unreliable, and F5 has previously hung the
client when returning to the menu.
