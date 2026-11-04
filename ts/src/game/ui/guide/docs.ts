import { Action } from "../../input/actions";
import { type BindingPreset, keyFor, keyLabel, presetBindings } from "../../input/keyBindings";
import { LESSONS } from "../../match/tutorial";
import { SELECTABLE_CHARACTERS } from "../../roster/kits";
import { isFeatured } from "../../roster/forge";
import type { Character } from "../../sim/codes";
import { CONTROLS_CAPTURE_HINT, CONTROLS_PANEL_KEY, CONTROLS_REBIND_HINT, HELP_KEY, MATCH_RULE_HELP, WARCRAFT_MENU_KEY } from "./text";

export interface GuideSection { readonly title: string; readonly paragraphs: readonly string[] }

/** The fighters the guide and move list show; fighter status filtering (Forge) belongs here. */
export const guideFighters = (characters: readonly Character[] = SELECTABLE_CHARACTERS): readonly Character[] => characters.filter(character => isFeatured(character));

const k = (preset: BindingPreset, action: Action): string => keyLabel(keyFor(presetBindings(preset), action, 0));
const w = (action: Action): string => k("wasd", action);

export const GUIDE_INTRO: readonly string[] = [
  "Requires Warcraft III 3.0 and a keyboard; nothing else to install. Download the map from [Hive Workshop](https://www.hiveworkshop.com/threads/makgora.375492/), put it in the Warcraft III Maps folder and open it from Custom Games. Mak'gora uses the Classic look. Set Graphics to Classic and restart Warcraft III after changing it.",
  `A controller is optional: the Mak'gora controller helper turns its buttons and sticks into its own pad keys, which work with any Controls layout. The default Melee pad layout uses A to attack, B for specials, X/Y to jump, RB to grab and LB for Strong; Tom's pad layout uses A to attack, X for specials, Y to jump, B to grab, LB to short hop and RB for Strong. In both, either trigger shields or air-dodges and Start pauses.`,
  `The game has character and stage selection, ${guideFighters().length} fighters, computer opponents, floating platforms, blast zones, stocks, rematches and configurable controls. Every fighter's specials and ultimate are listed by name in the [move list](move-list.md). More fighters are in the Forge, still in development: turn on Show the Forge on the Controls screen to see them.`,
];

export const GUIDE_SECTIONS: readonly GuideSection[] = [
  { title: "Getting started", paragraphs: [
    "For solo practice, place only your own fighter chip and press Y, then choose a stage and press Y again. Leave the CPU chip unplaced. Practice has no timer or opponent, and falling off the stage respawns you without ending the session. Place the CPU chip before starting when you want a match against the computer.",
    "Below each CPU card, Opponent settings lets you choose Rook, Ember, Flint, Vale, Kite or Wren, then Rookie, Beginner, Intermediate, Advanced or Expert difficulty. Each opponent has recognizable tendencies and improves several skills as difficulty rises. The preview describes that exact opponent and difficulty, including an opening to watch for. New CPU slots start with Wren at Intermediate. The first player or the slot owner can change the choices; everyone else can read the preview. Random chooses an opponent each match and keeps your difficulty. Choices stay through fighter or stage changes, New Match and automatic rematches.",
    `New players can open the Tutorial at fighter select: ${LESSONS.length} short lessons with a training partner (${LESSONS.map(({ name }) => name).join(", ")}). Pick any lesson to play it again.`,
  ] },
  { title: "Rules", paragraphs: [
    "At fighter selection, the rules pill in the middle of the top bar shows the rules; click it (or move the menu focus to it and press Attack) to open the rules drawer, where any player can change Stocks, Time, Ultimates, Items, Endless and Automatic rematch, pick a preset (Tourney, Party, Endless) or Reset default. Hover a rule to read what it does.",
    ...Object.values(MATCH_RULE_HELP).filter((text, at, all) => all.indexOf(text) === at),
  ] },
  { title: "Training", paragraphs: [
    "Training (the mode list at the top left) turns the match into practice against computer partners: no clock and no lost stocks. Choose what the partner does (Stand, Shield, Crouch, Jump, Attack or Fight), which way it drifts when hit, how it techs, its damage, whether hit areas show (bodies green, attacks red) and the speed (Full, Half or Quarter). Fight uses the partner's chosen opponent and difficulty.",
    `The top-left readout gives your last attack's frames, how many frames ahead (+) or behind (-) you were after it hit or was shielded, and the combo. Hold both shields and press Attack (${w(Action.leftTrigger)} + ${w(Action.rightTrigger)} + ${w(Action.attack)} on WASD) to put everyone back at the start.`,
    "An orange halo means your fighter is locked and no current input can help. A green halo means moving the stick can change the hit or throw, while buttons cannot. The halo disappears as soon as a button can matter, including an attack you can queue before recovery or a tech you can press before landing.",
  ] },
  { title: "Menus", paragraphs: [
    `Mouse buttons and your left/right keys + ${w(Action.attack)} (your Attack key) select a fighter or stage; ${w(Action.special)} (Special) goes back. Menus always follow your own bindings, and the arrow keys work too. Drag a character chip from the active player card onto the roster. New Match keeps selections. On the selection screens Y confirms and chooses the next match after a result. While the Warcraft chat box is open, typing never pauses, moves or attacks. Enter is reserved for Warcraft chat.`,
    "At fighter selection, up/down moves focus between fighter cards and CPU Opponent settings. Left/right changes the focused fighter; Attack opens focused settings. Inside the panel, up/down visits Opponent, Difficulty and Done; left/right changes the value. Attack advances to the next row or chooses Done, and Special or Close returns while keeping choices. Controller menus use the left stick to move the pointer, A to choose and B to go back.",
    "The title screen opens from fighter selection with the < MENU button at the top left, Esc, or by moving the menu focus down to it and pressing Attack.",
  ] },
  { title: "Pause", paragraphs: [
    "Esc or Backspace pauses or resumes an active match (Start on a controller). Pausing freezes combat and match time. The pause screen keeps the frozen match in view: the stick (your movement keys on a keyboard) pans the camera and the C-stick zooms, on your own screen only, and the view snaps back when the match resumes.",
    "To leave, hold two shield buttons and Attack, then press Start (Esc or Backspace), or click the RESET MATCH plate at the bottom right. The player who paused can also hold Esc for one second to fill the bar above the plate; a tap still resumes. Leaving a match always goes to fighter selection.",
    `The pause screen lists its keys: ${CONTROLS_PANEL_KEY} shows or hides the in-game controls, and ${WARCRAFT_MENU_KEY} opens the Warcraft menu.`,
  ] },
  { title: "The Controls screen", paragraphs: [
    "Every game opens on the Controls screen, one for each player, before fighter select. The top row holds WASD (recommended if you're new), Box (the leverless controller style) and, once you customize a layout, your selected Custom slot; picking one saves it as your profile. Rebinding a key on WASD or Box copies that layout into a new Custom profile (WASD - custom1, Box - custom1, and so on), selects it and saves it.",
    `${CONTROLS_REBIND_HINT} ${CONTROLS_CAPTURE_HINT} If another action already held that key, the two swap; Save keeps the layout. Rename names the Custom slot; Reset brings back the Custom defaults. The bottom row holds Show controls in game, Stick Jump (off by default: when on, pressing Up jumps) and C-Stick Tilt Attack (on by default: when off, the C-stick gives uncharged smashes on the ground and aerials in the air), with Save and Done on the right.`,
    `Done (or Escape) closes the screen; each player confirms their own. ${CONTROLS_PANEL_KEY} opens it again before a match. Type -save in chat to save your controls and delay, or -load to bring them back. Backspace and Escape are reserved for pause; F1, ${CONTROLS_PANEL_KEY}, F5, F6 and F7 are reserved too, and the screen names why if you try one.`,
    `In a match, a CONTROLS panel between the player panels lists every action with its key and lights a row while you hold it. Press ${CONTROLS_PANEL_KEY} in a match to hide or show it; the choice is saved with your controls.`,
  ] },
  { title: "Help and bug reports", paragraphs: [
    `Type -help (or -commands) in chat for every player command, or press ${HELP_KEY} for the quest log's Controls, How to play and Commands entries (listed below).`,
    "Saw something wrong? Type -clip in chat, or hold View on a controller for a second: the last ten seconds of the match are saved in Warcraft III's CustomMapData folder as makgora-repro-*.txt, and \"Moment saved\" appears. The match goes on undisturbed.",
    "Use Warcraft's ordinary Quit Mission to leave and recreate a custom game. The Ctrl+R restart path is unreliable, and F5 has hung the client when returning to the menu.",
  ] },
  { title: "Moving, attacking and grabbing", paragraphs: [
    `Shield + Attack, or Grab (${w(Action.grab)} on WASD), grabs. While holding an opponent, tap Attack to pummel or push a direction to throw. Mash buttons and alternate directions to escape a grab; holding one button does not count. The bar above a held fighter drains as the hold runs out.`,
    `Short hop (${w(Action.shortHop)} on every keyboard layout; LB in Tom's pad layout) always short hops, however long you hold it. The ordinary jump keys full hop when held and short hop when released during startup. In the air, Short hop uses your second jump.`,
    "Attacks buffer for six frames, including through jump squat. Two modifiers shape the stick (Tom's design, 2026-10-30). Walk (Mod X) reduces the horizontal value only: it walks, gives forward tilts, and with up and a side sends a steep up-diagonal. Tilt (Mod Y) reduces the vertical value only: it gives up and down tilts and shallow diagonals. Hold both for the all-purpose tilt.",
    "Attack with a direction performs a tilt when standing, walking or crouching; out of a dash or a run it is the dash attack. The C-stick keys always give the tilt they name on the ground, even out of a dash or a run, and the aerials in the air.",
    `Strong (${w(Action.strong)} on WASD and Box, ${k("custom", Action.strong)} on Custom, LB or RB on a pad) gives the smashes, after Rivals of Aether's strong button. Strong never attacks on its own: Strong + a direction is that direction's smash, and Strong + Attack on the ground is always the up smash. Keep holding to charge it. In the air, Strong + Attack with a direction gives that aerial.`,
    "Hold down while rising into a platform without an aerial to stand on it at once. Release down, then press it hard again to drop through a platform. Press down again in the air to fast-fall.",
    "To moonwalk, dash and then tilt the stick lightly backward: your fighter keeps facing forward while it slides back. On a keyboard, hold down together with the back key.",
    "After a landing with landing lag, a direction you kept holding walks out when the lag ends; pressing a direction fresh buffers a dash that way.",
  ] },
  { title: "Specials and ultimates", paragraphs: [
    `Specials use Special (${w(Action.special)} on WASD) with a direction. Strong + Special with a direction is the same special. At a full ultimate meter, Attack + Special together is your fighter's ultimate (A + B in the Melee pad layout, A + X in Tom's); below a full meter it is the plain special. The Ultimates rule above explains how the meter fills.`,
  ] },
];
