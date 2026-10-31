# Interactions

- Interaction graph: `bun wisp interactions` plays every fighter's
  situations (aerials on shield, neutral, landing, ledge, tech) and writes
  smashcraft:tools/move-data/interactions/, which Git ignores (write it before
  a change); `--check` lists what the change moved and `--move FIGHTER:MOVE` evaluates one move against the graph
  (smashcraft:docs/design/interaction-graph.md).
- Mrgl & Grgl duo: `bun wisp interactions --attacker Murlocs` plays Mrgl and Grgl against every selectable fighter through each duo lock rule and the toss, prints how many fighters reached each rule and met its design, and fails on any unexpected interaction (smashcraft:docs/design/murloc.md, Locks and infinites).
