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

Rule: at startup `releaseStockClicks` (smashcraft:ts/src/game/ui/stockClicks.ts)
hides and disables those three subtrees, and `hideStockOriginFrames`
(smashcraft:ts/src/host/loop/stockFrames.ts) hides and disables each stock
command, item, hero, minimap and system-button origin frame by name, both
beside `BlzHideOriginFrames(true)`. A new panel
button is clicked natively across its width; headless tests cannot show this.

## The frame tree our frames hang off

| Warcraft frame | What hangs off it | Hiding it as a group |
| --- | --- | --- |
| `ConsoleUIBackdrop` | our full-window backdrops, the pause screen, the fighter markers | removes all of them |
| game UI (`ORIGIN_FRAME_GAME_UI`) | panel content in the 4:3 area, the status text | removes the panels |
| world frame (`ORIGIN_FRAME_WORLD_FRAME`) | the 3D view | blacks the world |
| chat box (`ORIGIN_FRAME_CHAT_MSG`) | Warcraft's chat lines and entry box | chat stops working; its level and place must not change either (smashcraft:ts/test/engineFrames.test.ts) |

Rule: never hide, disable or destroy a stock frame as a group, only a named
frame, and test the all-hidden state before shipping. The first draft of this
fix hid every stock child; it would have broken chat and blacked the world,
and was caught only because the worker tried it first.

`smashcraft:ts/test/stockFrames.test.ts` pins the hide list and fails when a
hidden stock frame is the parent of any frame the map made.
