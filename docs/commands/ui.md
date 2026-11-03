# Ui

- Generated menus: makgora:ts/scripts/wisp/uiFrames.ts defines menu panels as Wisp
  frame definitions (wisp:docs/ui.md); after changing one or its layout, `bun
  scripts/wisp/uiFrames.ts` rewrites its FDF/TOC in makgora:tools/selection/art/
  and its bindings in makgora:ts/src/game/ui/ (test/ui-frames.test.ts holds them current).
