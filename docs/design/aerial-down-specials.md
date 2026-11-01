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
| Illidan | Immolate in the air, a Falco-style shine that holds him in place and a jump cancels | A12 W1 L37/E15 | A12 W1 L36/E15 | A12 W1 L21/E15 | A12 W1 L—/E15 |
| Blademaster | Wind Walk's counter guard in the air, with no travel | S1 W5 L16/E16 | S1 W5 L21/E21 | S1 W5 L7/E7 | S1 W5 L—/E59 |
| Muradin Bronzebeard | aerial Thunder Clap; lands into the grounded clap | S1 W15 L27/E27 | S1 W— L15/E15 | S1 W50 L3/E78 | S1 W15 L—/E50 |
| Maiev Shadowsong | Fan of Knives in the air, a ring of knives with a shine-like semi-spike that nearly stops her fall and a jump cancels | S1 W4 L46/E27 | S1 W4 L44/E27 | S1 W4 L16/E27 | S1 W4 L—/E27 |
| Kel'Thuzad | Frost Armor cast in the air; lands into the grounded cast | S0 W21 L27/E27 | S0 W21 L15/E45 | S0 W21 L3/E45 | S0 W21 L—/E45 |
| Uther | Divine Shield in the air; lands into the grounded bubble | S1 W4 L27/E27 | S1 W4 L15/E15 | S1 W4 L3/E50 | S1 W4 L—/E50 |
| Mal'Ganis | aerial Sleep orb; lands into the grounded cast | S1 W26 L27/E27 | S1 W26 L15/E58 | S1 W26 L3/E58 | S1 W26 L—/E58 |
| Shadow Hunter | aerial Hex orb; lands into the grounded cast | S1 W24 L27/E27 | S1 W24 L15/E40 | S1 W24 L3/E40 | S1 W24 L—/E40 |
| Pit Lord | aerial Rain of Fire; lands into the grounded cast | S1 W25 L31/E31 | S1 W25 L15/E60 | S1 W25 L3/E60 | S1 W25 L—/E60 |
| Rexxar | downward quill volley; commands a deployed Quilbeast | S1 W18 L27/E27 | S1 W18 L15/E32 | S1 W18 L3/E32 | S1 W18 L—/E32 |
| Lich King | Harvest Soul channel while falling, a hold move (a tap ends it); raises the Ghoul at a full meter | S1 W— L27/E15 | S1 W— L15/E15 | S1 W— L3/E3 | S1 W— L—/E15 |
| Thrall | Feral Spirit: the wolf pounces ahead, falls and runs on along the floor | S1 W18 L27/E27 | S1 W18 L15/E44 | S1 W18 L3/E44 | S1 W18 L—/E44 |
| Jaina Proudmoore | downward water bolt; recall works while falling | S1 W27 L27/E52 | S1 W27 L15/E52 | S1 W27 L3/E52 | S1 W27 L—/E52 |
| Sylvanas Windrunner | Life Drain grab while falling | S1 W16 L27/E52 | S1 W16 L15/E52 | S1 W16 L3/E52 | S1 W16 L—/E52 |
| Cairne Bloodhoof | War Stomp: Endurance armor while falling, two-sided stomp, 26 landing frames | S1 W1 L31/E31 | S1 W1 L15/E15 | S1 W1 L3/E3 | S1 W1 L—/E62 |
| Chen Stormstout | Earth stance armor in the air; lands into the grounded stance | S1 W62 L27/E80 | S1 W62 L15/E80 | S1 W62 L3/E80 | S1 W62 L—/E65 |
| Peon | Rest in the air: the frame-2 jolt, then he sleeps while falling and keeps sleeping after landing | S0 W2 L27/E— | S0 W2 L15/E— | S0 W2 L3/E— | S0 W2 L—/E65 |
| Gazlowe | drops one Clockwerk Goblin; lands into the grounded factory build | S1 W10 L27/E27 | S1 W10 L15/E15 | S1 W24 L3/E48 | S1 W10 L—/E36 |
| Kael'thas Sunstrider | Banish curse in the air; lands into the grounded cast | S1 W12 L57/E36 | S1 W12 L26/E26 | S1 W12 L4/E36 | S1 W12 L—/E36 |
| Mrgl & Grgl | Mrglglgl! revives Grgl on the ground; refused in the air | R | R | R | R |
| Grom Hellscream | aerial chop; lands into the grounded chop | S1 W20 L27/E27 | S1 W20 L15/E50 | S1 W20 L3/E50 | S1 W20 L—/E50 |
| Malfurion Stormrage | downward branch; recall works while falling | S1 W26 L27/E27 | S1 W26 L15/E80 | S1 W26 L3/E80 | S1 W26 L—/E65 |
| Medivh | Last Word holds height, blinks back and bursts | S0 W13 L59/E38 | S0 W13 L57/E38 | S0 W13 L43/E38 | S0 W13 L—/E38 |
| Anub'arak | downward beetle; recall works while falling | S1 W22 L27/E27 | S1 W22 L15/E46 | S1 W22 L3/E46 | S1 W22 L—/E46 |
| Lady Vashj | Mana Shield toggles in the air as on the ground | S0 W— L27/E12 | S0 W— L15/E12 | S0 W— L3/E12 | S0 W— L—/E12 |
| Archimonde the Defiler | aerial Bash, a hammer-fist that drives a foe below him down | S1 W16 L27/E27 | S1 W16 L15/E46 | S1 W16 L3/E46 | S1 W16 L—/E46 |

26 fighters, 104 presses, 5 dead inputs.

26 fighters, 104 presses, 1 dead inputs.
