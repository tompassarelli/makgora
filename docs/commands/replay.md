# Replay

- Replays: every client records each match as `makgora-replay-N.txt` (a
  manifest written at its end) and `makgora-replay-N-K.txt` parts written
  during it. `LUA=<32-bit lua> bun wisp replay FILE [--out JOINED]` replays a
  manifest with its parts, or a joined replay, in Bun and 32-bit Lua to every
  recorded checksum; `--out` writes the joined replay to share
  (makgora:docs/design/client.md, "Full-match replays").
