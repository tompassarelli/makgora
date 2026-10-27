# Move sound table

Generated from smashcraft:ts/src/game/presentation/moveSounds.ts by
`bun scripts/soundTable.ts` (from smashcraft:ts/); edit the table there, never here.
The model and its reasons are in [sound.md](sound.md). Names are Warcraft III sound
labels (AnimSounds, AbilitySounds, UnitCombatSounds) or file names; `A / B` is
alternatives a serial picks among, `A + B` layers. A whiff plays the perform column
alone. Voice plays on two of three uses. A normal's fire, electric, ice, dark, holy,
poison or arcane hit also layers that element's sound. Normals sharing every sound share a row.

## Rifleman

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + FlakCannonHit | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + FlakCannonHit | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + FlakCannonHit | WoodMediumBashMetal |  |
| Neutral special: Blaster | RiflemanAttack1 | GyrocopterAttack | GyrocopterAttack + FlakCannonHit | WoodMediumBashMetal |  |
| Side special: Summon Bear | BattleRoar | MetalMediumChopFlesh | MetalMediumChopFlesh + FlakCannonHit | WoodMediumBashMetal |  |
| Up special: Recoil Shot | RiflemanAttack1 | GyrocopterAttack | GyrocopterAttack + FlakCannonHit | WoodMediumBashMetal |  |
| Down special: Frost Trap | MetalMediumBashMetal | MetalHeavyChopFlesh | MetalHeavyChopFlesh + FlakCannonHit | WoodMediumBashMetal |  |

## Illidan

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalHeavySliceFlesh + DemonHunterMissileHit | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavySliceFlesh | MetalHeavySliceFlesh + DemonHunterMissileHit | MetalHeavySliceMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalMediumSliceFlesh | MetalHeavySliceFlesh + DemonHunterMissileHit | MetalMediumSliceMetal |  |
| Neutral special: Eye Beam | DemonHunterMissileLaunch | DemonHunterMissileHit | DemonHunterMissileHit + DemonHunterMissileHit | MetalMediumSliceMetal |  |
| Side special: Fel Rush | DemonHunterMissileLaunch | MetalHeavySliceFlesh | MetalHeavySliceFlesh + DemonHunterMissileHit | MetalMediumSliceMetal |  |
| Up special: Wing Ascent | DemonHunterMissileHit | MetalMediumSliceFlesh | MetalMediumSliceFlesh + DemonHunterMissileHit | MetalMediumSliceMetal |  |
| Down special: Immolate | FireballLaunch | Fireball | Fireball + DemonHunterMissileHit | MetalMediumSliceMetal |  |

## Blademaster

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalHeavySliceFlesh + CriticalStrike | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 + HeroBladeMasterAttack1 / HeroBladeMasterAttack2 | MetalHeavySliceFlesh | MetalHeavySliceFlesh + CriticalStrike | MetalHeavySliceMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 + HeroBladeMasterAttack1 / HeroBladeMasterAttack2 | MetalMediumSliceFlesh | MetalHeavySliceFlesh + CriticalStrike | MetalMediumSliceMetal |  |
| Neutral special: Wind Cutter | HeroBladeMasterAttack2 | MetalMediumSliceFlesh | MetalMediumSliceFlesh + CriticalStrike | MetalMediumSliceMetal |  |
| Side special: Wind Walk | WindWalk | CriticalStrike | CriticalStrike + CriticalStrike | MetalMediumSliceMetal |  |
| Up special: Rising Whirlwind | HeroBladeMasterAttack1 | MetalMediumSliceFlesh | MetalMediumSliceFlesh + CriticalStrike | MetalMediumSliceMetal |  |
| Down special: Mirror Image | MirrorImage | MetalMediumSliceFlesh | MetalMediumSliceFlesh + CriticalStrike | MetalMediumSliceMetal |  |

## Muradin Bronzebeard

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodMediumBashFlesh | MetalHeavyBashFlesh + StormBolt | WoodMediumBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 + HeroMountainKingAttack1 | MetalHeavyBashFlesh | MetalHeavyBashFlesh + StormBolt | MetalHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 + HeroMountainKingAttack1 | MetalMediumBashFlesh | MetalHeavyBashFlesh + StormBolt | MetalMediumBashMetal |  |
| Neutral special: Storm Bolt | StormBoltLaunch | StormBolt | StormBolt + StormBolt | MetalMediumBashMetal |  |
| Side special: Storm Rush | HeroMountainKingAttack1 | MetalHeavyBashFlesh | MetalHeavyBashFlesh + StormBolt | MetalMediumBashMetal |  |
| Up special: Thunder Leap | HeroMountainKingAttack1 | RockHeavyBashFlesh | RockHeavyBashFlesh + StormBolt | MetalMediumBashMetal |  |
| Down special: Thunder Clap | Taunt | ThunderClap | ThunderClap + StormBolt | MetalMediumBashMetal |  |

## Maiev Shadowsong

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Down tilt, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalHeavySliceFlesh + FanOfKnivesHit | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavySliceFlesh | MetalHeavySliceFlesh + FanOfKnivesHit | MetalHeavySliceMetal | WardenAttack |
| Forward tilt, Up tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalMediumSliceFlesh | MetalHeavySliceFlesh + FanOfKnivesHit | MetalMediumSliceMetal |  |
| Neutral special: Shadow Strike | ShadowStrikeMissileBirth | ShadowStrikeBirth | ShadowStrikeBirth + FanOfKnivesHit | MetalMediumSliceMetal |  |
| Side special: Shadow Pursuit | BlinkCaster | MetalHeavySliceFlesh | MetalHeavySliceFlesh + FanOfKnivesHit | MetalMediumSliceMetal |  |
| Up special: Blink | BlinkTarget | MetalLightSliceFlesh | MetalLightSliceFlesh + FanOfKnivesHit | MetalMediumSliceMetal |  |
| Down special: Fan of Knives | FanOfKnives | FanOfKnivesHit | FanOfKnivesHit + FanOfKnivesHit | MetalMediumSliceMetal |  |

## Kel'Thuzad

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + LichMissile | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + LichMissile | WoodHeavyBashMetal | HeroLichAttack1 |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + LichMissile | WoodMediumBashMetal |  |
| Neutral special: Frost Nova | ZigguratFrostMissileLaunch | FrostNova | FrostNova + LichMissile | WoodMediumBashMetal |  |
| Side special: Death and Decay | DeathAndDecayTarget | DeathAndDecayTarget | DeathAndDecayTarget + LichMissile | WoodMediumBashMetal |  |
| Up special: Spectral Ascent | DarkRitual | LichMissile | LichMissile + LichMissile | WoodMediumBashMetal |  |
| Down special: Frost Armor | FrostArmor | FrostBoltHit | FrostBoltHit + LichMissile | WoodMediumBashMetal |  |

## Forsaken Paladin

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab |  | MetalLightSliceFlesh | MetalHeavySliceFlesh + MetalHeavySliceMetal | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash, Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Up air, Down air, Dash attack |  | MetalHeavySliceFlesh | MetalHeavySliceFlesh + MetalHeavySliceMetal | MetalHeavySliceMetal |  |
| Back air |  | MetalMediumSliceFlesh | MetalHeavySliceFlesh + MetalHeavySliceMetal | MetalMediumSliceMetal |  |
| Neutral special: Cleansing Sword |  | MetalHeavySliceFlesh | MetalHeavySliceFlesh + MetalHeavySliceMetal | MetalMediumSliceMetal |  |
| Side special: Righteous Fury |  | MetalHeavySliceFlesh | MetalHeavySliceFlesh + MetalHeavySliceMetal | MetalMediumSliceMetal |  |
| Up special: Ascension |  | MetalMediumSliceFlesh | MetalMediumSliceFlesh + MetalHeavySliceMetal | MetalMediumSliceMetal |  |
| Down special: Consecration |  | WoodLightBashFlesh | WoodLightBashFlesh + MetalHeavySliceMetal | MetalMediumSliceMetal |  |

## Mal'Ganis

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalMediumChopFlesh + CarrionSwarmDamage | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalMediumChopFlesh + CarrionSwarmDamage | MetalMediumChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalMediumChopFlesh + CarrionSwarmDamage | MetalLightChopMetal |  |
| Neutral special: Carrion Swarm | CarrionSwarmLaunch | CarrionSwarmDamage | CarrionSwarmDamage + CarrionSwarmDamage | MetalLightChopMetal |  |
| Side special: Vampiric Pounce | CarrionSwarmLaunch | MetalMediumChopFlesh | MetalMediumChopFlesh + CarrionSwarmDamage | MetalLightChopMetal |  |
| Up special: Bat Ascension | CarrionSwarmLaunch | MetalLightChopFlesh | MetalLightChopFlesh + CarrionSwarmDamage | MetalLightChopMetal |  |
| Down special: Sleep | Sleep | CreepSleep | CreepSleep + CarrionSwarmDamage | MetalLightChopMetal |  |

## Shadow Hunter

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + HunterMissileHit | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + HunterMissileHit | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + HunterMissileHit | MetalMediumChopMetal |  |
| Neutral special: Spirit Glaive | ShadowHunterMissileLaunch | ShadowHunterMissileHit | ShadowHunterMissileHit + HunterMissileHit | MetalMediumChopMetal |  |
| Side special: Serpent Ward | WardBirth | PoisonArrowHit | PoisonArrowHit + HunterMissileHit | MetalMediumChopMetal |  |
| Up special: Loa Vault | VoodooBirth | MetalMediumChopFlesh | MetalMediumChopFlesh + HunterMissileHit | MetalMediumChopMetal |  |
| Down special: Hex | WitchDoctorMissileLaunch | Polymorph | Polymorph + HunterMissileHit | MetalMediumChopMetal |  |

## Pit Lord

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + PitLordAttackSlam1 | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 + PitLordAttack1 / PitLordAttack2 / PitLordAttack3 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + PitLordAttackSlam1 | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air | BattleNetWooshStereo1 + PitLordAttack1 / PitLordAttack2 / PitLordAttack3 | MetalMediumChopFlesh | MetalHeavyChopFlesh + PitLordAttackSlam1 | MetalMediumChopMetal |  |
| Dash attack | BattleNetWooshStereo1 + PitLordAttackSlam1 | RockHeavyBashFlesh | RockHeavyBashFlesh + PitLordAttackSlam1 | MetalHeavyChopMetal |  |
| Neutral special: Howl of Terror | HowlOfTerror | CrushingWaveDamage | CrushingWaveDamage + PitLordAttackSlam1 | MetalMediumChopMetal |  |
| Side special: Ruin Charge | BalrogAttack1 | RockHeavyBashFlesh | RockHeavyBashFlesh + PitLordAttackSlam1 | MetalMediumChopMetal |  |
| Up special: Abyssal Leap | PitLordAttackSlam1 | RockHeavyBashFlesh | RockHeavyBashFlesh + PitLordAttackSlam1 | MetalMediumChopMetal |  |
| Down special: Rain of Fire | RainOfFireWave | Fireball | Fireball + PitLordAttackSlam1 | MetalMediumChopMetal |  |

## Rexxar

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + AxeMissileHit | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + AxeMissileHit | MetalHeavyChopMetal | BeastmasterAttack |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + AxeMissileHit | MetalMediumChopMetal |  |
| Neutral special: Wild Axes | AxeMissileLaunch | AxeMissileHit | AxeMissileHit + AxeMissileHit | MetalMediumChopMetal |  |
| Side special: Summon Bear | BattleRoar | StampedeHit | StampedeHit + AxeMissileHit | MetalMediumChopMetal |  |
| Up special: Summon Hawk | HawkReady1 | DruidOfTheTalonMissileHit | DruidOfTheTalonMissileHit + AxeMissileHit | MetalMediumChopMetal |  |
| Down special: Summon Quilbeast | QuillBoarReady1 | BristleBackMissileHit | BristleBackMissileHit + AxeMissileHit | MetalMediumChopMetal |  |

## Lich King

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalHeavySliceFlesh + FrostWyrmAttack1 | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 + HeroDeathKnightAttack1 | MetalHeavySliceFlesh | MetalHeavySliceFlesh + FrostWyrmAttack1 | MetalHeavySliceMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 + HeroDeathKnightAttack1 | MetalMediumSliceFlesh | MetalHeavySliceFlesh + FrostWyrmAttack1 | MetalMediumSliceMetal |  |
| Neutral special: Howling Blast | BreathOfFrost | FrostBoltHit | FrostBoltHit + FrostWyrmAttack1 | MetalMediumSliceMetal |  |
| Side special: Val'kyr Shadowguard | DarkSummoningMissileLaunch | DarkSummoningTarget | DarkSummoningTarget + FrostWyrmAttack1 | MetalMediumSliceMetal |  |
| Up special: Ascension of the Damned | FrostArmor | FrostBoltHit | FrostBoltHit + FrostWyrmAttack1 | MetalMediumSliceMetal |  |
| Down special: Defile | DeathPactTarget | FrostWyrmAttack1 | FrostWyrmAttack1 + FrostWyrmAttack1 | MetalMediumSliceMetal |  |

## Thrall

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodMediumBashFlesh | MetalHeavyBashFlesh + LightningBolt | WoodMediumBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyBashFlesh | MetalHeavyBashFlesh + LightningBolt | MetalHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalMediumBashFlesh | MetalHeavyBashFlesh + LightningBolt | MetalMediumBashMetal |  |
| Neutral special: Chain Lightning | HeroFarSeerAttack1 | LightningBolt | LightningBolt + LightningBolt | MetalMediumBashMetal |  |
| Side special: Feral Spirit | FeralSpiritTarget | MetalMediumChopFlesh | MetalMediumChopFlesh + LightningBolt | MetalMediumBashMetal |  |
| Up special: Far Sight | RevealMap | MetalMediumBashFlesh | MetalMediumBashFlesh + LightningBolt | MetalMediumBashMetal |  |
| Down special: Doomhammer Slam | RockHeavyBashFlesh | MetalHeavyBashFlesh | MetalHeavyBashFlesh + LightningBolt | MetalMediumBashMetal |  |

## Jaina Proudmoore

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + FrostBoltHit | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + FrostBoltHit | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + FrostBoltHit | WoodMediumBashMetal |  |
| Neutral special: Frostbolt | FrostBoltLaunch | FrostBoltHit | FrostBoltHit + FrostBoltHit | WoodMediumBashMetal |  |
| Side special: Blizzard | BlizzardTarget1 | FrostBoltHit | FrostBoltHit + FrostBoltHit | WoodMediumBashMetal |  |
| Up special: Blink | BlinkCaster | BlinkTarget | BlinkTarget + FrostBoltHit | WoodMediumBashMetal |  |
| Down special: Summon Water Elemental | WaterElementalBirth | WaterElementalMissile | WaterElementalMissile + FrostBoltHit | WoodMediumBashMetal |  |

## Sylvanas Windrunner

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + BlackArrowHit | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + BlackArrowHit | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + BlackArrowHit | WoodMediumBashMetal |  |
| Neutral special: Black Arrow | ArrowLaunch | BlackArrowHit | BlackArrowHit + BlackArrowHit | WoodMediumBashMetal |  |
| Side special: Silence | Silence | Curse | Curse + BlackArrowHit | WoodMediumBashMetal |  |
| Up special: Banshee Flight | BansheeMissileLaunch | BansheeMissileHit | BansheeMissileHit + BlackArrowHit | WoodMediumBashMetal |  |
| Down special: Life Drain | BansheeMissileLaunch | BansheeMissileHit | BansheeMissileHit + BlackArrowHit | WoodMediumBashMetal |  |

## Cairne Bloodhoof

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodMediumBashFlesh | RockHeavyBashFlesh + Pulverize | WoodMediumBashMetal |  |
| Up smash, Down smash, Forward smash, Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 + HeroTaurenChieftainAttack1 / HeroTaurenChieftainAttack2 | RockHeavyBashFlesh | RockHeavyBashFlesh + Pulverize | RockHeavyBashMetal |  |
| Neutral special: Shockwave | ShockWave | RockHeavyBashFlesh | RockHeavyBashFlesh + Pulverize | RockHeavyBashMetal |  |
| Side special: Bloodhoof Gore | HeroTaurenChieftainAttack2 | RockHeavyBashFlesh | RockHeavyBashFlesh + Pulverize | RockHeavyBashMetal |  |
| Up special: Spirit Lift | AncestralSpirit | WoodMediumBashFlesh | WoodMediumBashFlesh + Pulverize | RockHeavyBashMetal |  |
| Down special: War Stomp | HeroTaurenChieftainAttack2 | Pulverize | Pulverize + Pulverize | RockHeavyBashMetal |  |

## Chen Stormstout

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + WoodHeavyBashMetal | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + WoodHeavyBashMetal | WoodHeavyBashMetal | BrewmasterAttack1 / BrewmasterAttack2 |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + WoodHeavyBashMetal | WoodMediumBashMetal |  |
| Neutral special: Breath of Fire | BreathOfFire | Fireball | Fireball + WoodHeavyBashMetal | WoodMediumBashMetal |  |
| Side special: Drunken Haze | StrongDrinkMissile | StrongDrink | StrongDrink + WoodHeavyBashMetal | WoodMediumBashMetal |  |
| Up special: Storm Rise | CycloneBirth | WoodMediumBashFlesh | WoodMediumBashFlesh + WoodHeavyBashMetal | WoodMediumBashMetal |  |
| Down special: Threefold Stance | Taunt | Fireball | Fireball + WoodHeavyBashMetal | WoodMediumBashMetal |  |

## Peon

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + AxeMediumChopWood | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + AxeMediumChopWood | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + AxeMediumChopWood | MetalMediumChopMetal |  |
| Neutral special: Gold Sack |  | WoodHeavyBashFlesh | WoodHeavyBashFlesh + AxeMediumChopWood | MetalMediumChopMetal |  |
| Side special: Log Heave | AxeMediumChopWood | WoodHeavyBashFlesh | WoodHeavyBashFlesh + AxeMediumChopWood | MetalMediumChopMetal |  |
| Up special: Worksite Launch | CatapultAttack1 | WoodMediumBashFlesh | WoodMediumBashFlesh + AxeMediumChopWood | MetalMediumChopMetal |  |
| Down special: Rest | CreepSleep | WoodHeavyBashFlesh | WoodHeavyBashFlesh + AxeMediumChopWood | MetalMediumChopMetal |  |

## Goblin Tinker

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | WoodMediumBashFlesh | MetalHeavyBashFlesh + ClusterRocketsImpact | WoodMediumBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyBashFlesh | MetalHeavyBashFlesh + ClusterRocketsImpact | MetalHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalMediumBashFlesh | MetalHeavyBashFlesh + ClusterRocketsImpact | MetalMediumBashMetal |  |
| Neutral special: Cluster Rockets | ClusterRocketsLaunch | ClusterRocketsImpact | ClusterRocketsImpact + ClusterRocketsImpact | MetalMediumBashMetal |  |
| Side special: Laser | HeroTinkerMorph | SearingArrowHit | SearingArrowHit + ClusterRocketsImpact | MetalMediumBashMetal |  |
| Up special: Rocket Boots | ClusterRocketsLaunch | MetalMediumBashFlesh | MetalMediumBashFlesh + ClusterRocketsImpact | MetalMediumBashMetal |  |
| Down special: Pocket Factory | PocketFactoryBirth | GoblinSapperExplode | GoblinSapperExplode + ClusterRocketsImpact | MetalMediumBashMetal |  |

## Kael'thas Sunstrider

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + Fireball | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + Fireball | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + Fireball | WoodMediumBashMetal |  |
| Neutral special: Fireball | FireballLaunch | FlameStrike | FlameStrike + Fireball | WoodMediumBashMetal |  |
| Side special: Flame Strike | FlameStrikeTarget | FlameStrike | FlameStrike + Fireball | WoodMediumBashMetal |  |
| Up special: Phoenix | PhoenixMissileLaunch | Fireball | Fireball + Fireball | WoodMediumBashMetal |  |
| Down special: Banish | BanishCaster | BanishCaster | BanishCaster + Fireball | WoodMediumBashMetal |  |

## Murloc

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalMediumChopFlesh + CrushingWaveDamage | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalMediumChopFlesh + CrushingWaveDamage | MetalMediumChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalMediumChopFlesh + CrushingWaveDamage | MetalLightChopMetal |  |
| Neutral special: Ensnare | EnsnareMissile | Ensnare | Ensnare + CrushingWaveDamage | MetalLightChopMetal |  |
| Side special: Tidal Rush | BigWaterStep | CrushingWaveDamage | CrushingWaveDamage + CrushingWaveDamage | MetalLightChopMetal |  |
| Up special: Tide Spout | CrushingWave | WaterElementalMissile | WaterElementalMissile + CrushingWaveDamage | MetalLightChopMetal |  |
| Down special: Disease Cloud | Parasite | PoisonArrowHit | PoisonArrowHit + CrushingWaveDamage | MetalLightChopMetal |  |

## Grom Hellscream

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalMediumChopMetal |  |
| Neutral special: Warsong Cry | GromWarcry1 | MetalMediumChopFlesh | MetalMediumChopFlesh + CriticalStrike | MetalMediumChopMetal |  |
| Side special: Gorehowl Rush | DeepFootstep2 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalMediumChopMetal |  |
| Up special: Blood Leap |  | MetalMediumChopFlesh | MetalMediumChopFlesh + CriticalStrike | MetalMediumChopMetal |  |
| Down special: Mannoroth's Bane |  | MetalHeavyChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalMediumChopMetal |  |

## Kobold

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + MetalHeavyChopMetal | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + MetalHeavyChopMetal | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + MetalHeavyChopMetal | MetalMediumChopMetal |  |
| Neutral special: Wick Flick | SearingArrowLaunch | SearingArrowHit | SearingArrowHit + MetalHeavyChopMetal | MetalMediumChopMetal |  |
| Side special: Panic Dig | Burrow | MetalLightChopFlesh | MetalLightChopFlesh + MetalHeavyChopMetal | MetalMediumChopMetal |  |
| Up special: Candle Escape | FireballLaunch | WoodLightBashFlesh | WoodLightBashFlesh + MetalHeavyChopMetal | MetalMediumChopMetal |  |
| Down special: Mine! | AxeMediumChopWood | GoblinLandMineDeath | GoblinLandMineDeath + MetalHeavyChopMetal | MetalMediumChopMetal |  |

## Malfurion Stormrage

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + KeeperOfTheGroveMissileHit | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + KeeperOfTheGroveMissileHit | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |
| Neutral special: Entangling Roots | KeeperOfTheGroveMissileLaunch | EntanglingRoots | EntanglingRoots + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |
| Side special: Stag Charge | KeeperOfTheGroveMissileLaunch | WoodHeavyBashFlesh | WoodHeavyBashFlesh + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |
| Up special: Dream Ascent | DruidOfTheTalonMorph | DruidOfTheTalonMissileHit | DruidOfTheTalonMissileHit + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |
| Down special: Force of Nature | ForceOfNatureBirth | WoodHeavyBashFlesh | WoodHeavyBashFlesh + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |

## Medivh

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + ManaFlareMissile | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + ManaFlareMissile | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + ManaFlareMissile | WoodMediumBashMetal |  |
| Neutral special: Arcane Omen | SorceressMissileLaunch | SorceressMissileHit | SorceressMissileHit + ManaFlareMissile | WoodMediumBashMetal |  |
| Side special: Vanishing Act | BlinkCaster | BlinkTarget | BlinkTarget + ManaFlareMissile | WoodMediumBashMetal |  |
| Up special: Raven Flight | DruidOfTheTalonMorph | DruidOfTheTalonMissileHit | DruidOfTheTalonMissileHit + ManaFlareMissile | WoodMediumBashMetal |  |
| Down special: Last Word | SorceressMissileLaunch | ManaFlareMissile | ManaFlareMissile + ManaFlareMissile | WoodMediumBashMetal |  |

## Anub'arak

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalMediumChopFlesh + ImpaleHit | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalMediumChopFlesh + ImpaleHit | MetalMediumChopMetal | CryptLordAttack1 / CryptLordAttack2 |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalMediumChopFlesh + ImpaleHit | MetalLightChopMetal |  |
| Neutral special: Impale | Impale | ImpaleHit | ImpaleHit + ImpaleHit | MetalLightChopMetal |  |
| Side special: Burrow Hunt | Burrow | ImpaleLand | ImpaleLand + ImpaleHit | MetalLightChopMetal |  |
| Up special: Crypt Eruption | ImpaleLand | RockHeavyBashFlesh | RockHeavyBashFlesh + ImpaleHit | MetalLightChopMetal |  |
| Down special: Carrion Beetle | ScarabBirth | CryptFiendMissileHit | CryptFiendMissileHit + ImpaleHit | MetalLightChopMetal |  |
