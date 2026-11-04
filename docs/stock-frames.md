# Warcraft's stock frames and ours

Warcraft's own interface frames sit under and over the frames this map makes.
A panel button can draw, pass every headless test and still take no clicks,
because the headless frame model holds only the frames the map creates and
cannot see a stock frame lying over a button.

## Symptom: a button draws, its clicks are dead or partly live

On 2026-11-03, in a Warcraft Classic client on gex45 at 2880x1920, the
Controls screen's Done button took clicks only on its leftmost ~5% (5 click
points across the button). The first-run Controls panel in Mak'gora's SMOKE-3
(makgora#954) would not close with the pointer resting on Done: the same
defect. It was first diagnosed on 2026-10-10: the stock command buttons in the
bottom-right corner take clicks even when they are not drawn, and
`BlzHideOriginFrames(true)` leaves them in place.

Cause: a stock frame, hidden or not, lies over part of the button and takes
the click first. A native bisect on gex45 on 2026-11-03 found the frames that
did it at 3:2 (2880x1920): children 1, 5 and 7 of `ConsoleUI`, the stock
command bar and two sibling bars, with every other stock group hidden.

Rule: at startup `releaseStockClicks` (makgora:ts/src/game/ui/stockClicks.ts)
hides and disables those three subtrees, and `hideStockOriginFrames`
(makgora:ts/src/host/loop/stockFrames.ts) hides and disables each stock
command, item, hero and minimap origin frame by name, both beside
`BlzHideOriginFrames(true)`. It leaves the four system buttons (Quests, Menu,
Allies, Log) alone: F9 to F12 are their hotkeys, and a disabled Menu button
drops F10, so the Game Menu would not open (makgora#1081). A new panel
button is clicked natively across its width; headless tests cannot show this.

## The frame tree our frames hang off

| Warcraft frame | What hangs off it | Hiding it as a group |
| --- | --- | --- |
| `ConsoleUIBackdrop` | our full-window backdrops, the pause screen, the fighter markers | removes all of them |
| game UI (`ORIGIN_FRAME_GAME_UI`) | panel content in the 4:3 area, the status text | removes the panels |
| world frame (`ORIGIN_FRAME_WORLD_FRAME`) | the 3D view | blacks the world |
| chat box (`ORIGIN_FRAME_CHAT_MSG`) | Warcraft's chat lines and entry box | chat stops working; its level and place must not change either (makgora:ts/test/engineFrames.test.ts) |

Rule: never hide, disable or destroy a stock frame as a group, only a named
frame, and test the all-hidden state before shipping. The first draft of this
fix hid every stock child; it would have broken chat and blacked the world,
and was caught only because the worker tried it first.

`makgora:ts/test/stockFrames.test.ts` pins the hide list and fails when a
hidden stock frame is the parent of any frame the map made.

## The native button sweep

Every `ButtonClicks.add` registers its frame and click box (makgora:ts/src/game/ui/buttonSweep.ts).
`-dev buttons` lists the registered buttons with their visibility and box in
`makgora-dev-buttons-pSLOT.txt` and turns click logging on: from then on a
click on any registered button is appended to
`makgora-dev-button-clicks-pSLOT.txt` and its handler does not run, so a
panel stays open while it is swept. The accept check `gate-panel-buttons`
(makgora:ts/scripts/wisp/gateButtons.ts) clicks each visible button at 5
points across its width and fails, naming the button and the point, when a
point produces no click or another button's click, or when a visible
registered button has no click box. It sweeps the buttons shown when it runs,
the first-run Controls screen, and its receipt carries the window size. The
playable build has no dev console, so the check runs on `candidate-dev`, the
development map rebuilt from the candidate's own commit, which a given
`--map` does not replace; the panels and the stock-frame startup are the same
code in both builds. It is one of the green gate's required checks
(`GREEN_GATE_CHECKS`, makgora:ts/scripts/wisp/greenBuilds.ts).

On 2026-11-03 on gex45 it passed at 1920x1080 (`capture-classic-1080`) and at
2880x1920 (Wisp's `capture-classic-3x2` pool profile): 71 visible buttons,
355 of 355 points clicked. On a build with the two startup calls removed it
failed at 2880x1920 naming Done (`ui.settings.0.click#561:close`) at points 2
to 5 of 5 (makgora#1047).

## The mouse wheel on the info popups

Warcraft delivers `FRAMEEVENT_MOUSE_WHEEL` only to a mouse-enabled frame type
under the cursor. On 2026-11-04 the accept check `gate-popup-wheel`
(makgora:ts/scripts/wisp/gateWheel.ts, map `candidate-dev`) opened the Credits
popup through `-dev popup credits` on a Classic pair and sent real wheel events
with xdotool: over the popup's plain FRAME the map's own wheel log
(`makgora-dev-wheel-pSLOT.txt`, written only after that command) counted 0 of 5
turns, while over its Close button, a button type, it counted both turns. Each
popup therefore carries an invisible BUTTON over its panel, below Close, and
registers the wheel on that button and on Close; the check then passed with
five turns over the body logged as first lines 1,2,3,2,1 (makgora#1117). The
headless backend routes a wheel to any frame that registered it, so
`test/credits-wheel.test.ts` asserts the registered frame's type instead.
