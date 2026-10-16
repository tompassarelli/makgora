# Aerial down specials

Every fighter's down special works in the air (#448). The table records each
fighter's aerial choice and what one press does from four airborne starts on
stage 0, holding down throughout. From ts/, `bun scripts/aerialDownSpecials.ts`
regenerates it; `test/aerial-down-specials.test.ts` fails on any dead input.

Starts `(x, z, vz)`: Rising `(100, 240, +8)`, Falling `(100, 240, -4)`, Near
ground `(100, 40, -1)`, Offstage `(900, 240, -4)`. A neutral opponent stands at
x = -480. **S0/S1** is the down special's ground or air form; **A8** is
Rifleman's Freeze Trap and **A12** Illidan's air Immolate. **Wn** is the first
frame with a strike window, projectile, placement, trap, grab, guard or armor;
**Ln/En** the first grounded frame and the first frame the special is over
(— for none). A dead input is a refusal (**R**) or **W—**. An aerial down
special that lands before its effect continues as the grounded form instead of
cancelling.

| Fighter | Aerial choice | Rising | Falling | Near ground | Offstage |
|---|---|---|---|---|---|
| Rifleman | Freeze Trap tossed in the air falls and arms on deck contact | A8 W22 L31/E38 | A8 W22 L13/E38 | A8 W22 L3/E38 | A8 W22 L—/E38 |
| Illidan | Immolate in the air, a shine-like stall that a jump cancels | A12 W4 L47/E27 | A12 W4 L45/E27 | A12 W4 L18/E27 | A12 W4 L—/E27 |
| Blademaster | Mirror Image placed in the air, then a backward step | S1 W8 L34/E24 | S1 W8 L25/E24 | S1 W8 L3/E24 | S1 W8 L—/E24 |
| Mountain King | aerial Thunder Clap; lands into the grounded clap | S1 W17 L27/E27 | S1 W52 L15/E81 | S1 W52 L3/E81 | S1 W17 L—/E53 |
| Warden | Fan of Knives, same fan in the air | S1 W8 L27/E38 | S1 W8 L15/E38 | S1 W8 L3/E38 | S1 W8 L—/E38 |
| Lich | Frost Armor cast in the air; lands into the grounded cast | S0 W21 L27/E27 | S0 W21 L15/E45 | S0 W21 L3/E45 | S0 W21 L—/E45 |
| Forsaken Paladin | downward holy pulse with the Consecration hit | S1 W16 L27/E27 | S1 W16 L15/E42 | S1 W16 L3/E42 | S1 W16 L—/E42 |
| Dreadlord | aerial Sleep orb; lands into the grounded cast | S1 W26 L27/E27 | S1 W26 L15/E58 | S1 W26 L3/E58 | S1 W26 L—/E58 |
| Shadow Hunter | aerial Hex orb; lands into the grounded cast | S1 W24 L27/E27 | S1 W24 L15/E40 | S1 W24 L3/E40 | S1 W24 L—/E40 |
| Pit Lord | aerial Rain of Fire; lands into the grounded cast | S1 W25 L27/E27 | S1 W25 L15/E60 | S1 W25 L3/E60 | S1 W25 L—/E60 |
| Beastmaster | downward quill volley; commands a deployed Quilbeast | S1 W18 L27/E27 | S1 W18 L15/E32 | S1 W18 L3/E32 | S1 W18 L—/E32 |
| Lich King | downward shadow pulse with the Defile hit | S1 W20 L27/E27 | S1 W20 L15/E50 | S1 W20 L3/E50 | S1 W20 L—/E50 |
| Thrall | falling two-sided Doomhammer Slam | S1 W17 L27/E27 | S1 W17 L15/E50 | S1 W17 L3/E50 | S1 W17 L—/E50 |
| Jaina Proudmoore | downward water bolt; recall works while falling | S1 W27 L27/E52 | S1 W27 L15/E52 | S1 W27 L3/E52 | S1 W27 L—/E52 |
| Sylvanas Windrunner | Life Drain grab while falling | S1 W16 L27/E52 | S1 W16 L15/E52 | S1 W16 L3/E52 | S1 W16 L—/E52 |
| Cairne Bloodhoof | War Stomp: Endurance armor while falling, two-sided stomp, 26 landing frames | S1 W5 L27/E27 | S1 W5 L15/E15 | S1 W5 L3/E54 | S1 W5 L—/E54 |
| Chen Stormstout | Earth stance armor in the air; lands into the grounded stance | S1 W4 L27/E27 | S1 W4 L15/E15 | S1 W4 L3/E33 | S1 W4 L—/E33 |
| Peon | Rest in the air: the frame-2 jolt, then he sleeps while falling and keeps sleeping after landing | S0 W1 L27/E— | S0 W1 L15/E— | S0 W1 L3/E— | S0 W1 L—/E65 |
| Goblin Tinker | drops one Clockwerk Goblin; lands into the grounded factory build | S1 W10 L27/E27 | S1 W10 L15/E15 | S1 W24 L3/E48 | S1 W10 L—/E36 |
| Kael'thas Sunstrider | Banish curse in the air; lands into the grounded cast | S1 W11 L27/E27 | S1 W11 L15/E15 | S1 W11 L3/E36 | S1 W11 L—/E36 |
| Murloc | small plague cloud at the cast point | S1 W14 L27/E27 | S1 W14 L15/E15 | S1 W14 L3/E38 | S1 W14 L—/E38 |
| Grom Hellscream | aerial chop; lands into the grounded chop | S1 W19 L27/E27 | S1 W19 L15/E50 | S1 W19 L3/E50 | S1 W19 L—/E50 |
| Kobold | aerial ankle sweep; lands into the grounded sweep | S1 W9 L27/E27 | S1 W9 L15/E15 | S1 W9 L3/E34 | S1 W9 L—/E34 |
| Malfurion Stormrage | downward branch; recall works while falling | S1 W26 L27/E27 | S1 W26 L15/E80 | S1 W26 L3/E80 | S1 W26 L—/E65 |
| Medivh | Last Word holds height, blinks back and bursts | S0 W12 L59/E38 | S0 W12 L57/E38 | S0 W12 L43/E38 | S0 W12 L—/E38 |
| Anub'arak | downward beetle; recall works while falling | S1 W22 L27/E27 | S1 W22 L15/E46 | S1 W22 L3/E46 | S1 W22 L—/E46 |

26 fighters, 104 presses, 0 dead inputs.
