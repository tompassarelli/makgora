# Blademaster

The kit is in [roster](roster.md#blademaster) and [kit review 1](kit-review-1.md); this page holds the rules that need a place of their own.

## Mirror Image (side B)

- Facing: the side-B input sets it, turning him first when it points behind him.
- Step direction: during the aim frames (1–11) a held left or right sets the side he steps, separate from his facing. Side-B right then hold left steps him left while he stays facing right. Holding nothing, the same side or only up or down steps him the side-B way.
- Mechanism: the move's `aimFrames` window with `aimsSideways`, which reads the held side through the same `steerHeroSpecial` path as the charged aims and keeps it in `special.aimX`, so snapshots and rollback carry it.
- Unchanged: the image stays where he stood on frame 12, the step is 1.0H over frames 12–15, the air step is sideways only and once per airtime, and the action ends on frame 28.
- Computer: its recovery holds toward the stage through the aim frames, so side-B steps it in.
