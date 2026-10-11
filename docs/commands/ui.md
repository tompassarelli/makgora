# Ui

- Generated menus: smashcraft:ts/scripts/wisp/uiFrames.ts defines menu panels as Wisp
  frame definitions (wisp:docs/ui.md); `bun install`, `bun run check`, the test
  runners and `wisp map build` write its FDF/TOC in smashcraft:tools/selection/art/
  and its bindings in smashcraft:ts/src/game/ui/ whenever a definition's sources
  change (smashcraft:ts/scripts/generated.ts; untracked, #401).
