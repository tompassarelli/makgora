


import { Character } from "../sim/codes";
import type { StageTile } from "../menu/stageCatalog";
import { BossKind } from "./runState";

export interface ClassicRivalFight {

  readonly rivals: readonly Character[];
  readonly stage: StageTile;

  readonly line: string;
}

export interface ClassicRoute {
  readonly fighter: Character;

  readonly story: string;

  readonly fights: readonly ClassicRivalFight[];
  readonly boss: BossKind;

  readonly ending: readonly string[];
}

const C = Character;
const fight = (rivals: Character | readonly Character[], stage: StageTile, line: string): ClassicRivalFight =>
  ({ rivals: typeof rivals === "number" ? [rivals] : rivals, stage, line });

export const CLASSIC_ROUTES: readonly ClassicRoute[] = [
  {
    fighter: C.demonHunter, boss: BossKind.lichKing,
    story: "Kil'jaeden's deadline runs short: Illidan takes Outland, then races Arthas up Icecrown.",
    fights: [
      fight(C.dreadlord, 6, "The Skull of Gul'dan was never yours to drink from, betrayer."),
      fight(C.murloc, 7, "Mrglglgl! The Broken Isles are ours!"),
      fight(C.kaelthas, 14, "Prove you can feed my people's hunger, and the sin'dorei will follow."),
      fight([C.warden, C.sylvanas], 7, "Ten thousand years I guarded you. I will not lose you now."),
      fight(C.pitLord, 14, "Hellfire Citadel belongs to Magtheridon!"),
    ],
    ending: ["The Frozen Throne is shattered and Kil'jaeden's bargain kept.", "I am Illidan Stormrage, and I answer to no one. Not even this tournament."],
  },
  {
    fighter: C.blademaster, boss: BossKind.archimonde,
    story: "A Burning Blade swordsman cuts across Kalimdor to repay the demon blood of Mannoroth.",
    fights: [
      fight(C.uther, 11, "Lay down that blade, orc, and the camps will be merciful."),
      fight(C.jaina, 11, "Theramore wants peace, but I will not let you burn the coast."),
      fight(C.mountainKing, 12, "A blade's no use against a hammer, lad."),
      fight([C.sylvanas, C.warden], 10, "Your blade will serve me better after death."),
      fight(C.pitLord, 3, "Mannoroth's blood still runs in your veins, orc."),
    ],
    ending: ["Archimonde fell to a thousand cuts, and the last one was mine.", "The Burning Blade is no longer the Legion's blade."],
  },
  {
    fighter: C.mountainKing, boss: BossKind.lichKing,
    story: "Muradin Bronzebeard sails to Northrend after Mal'Ganis, toward the sword that betrays him.",
    fights: [
      fight(C.shadowHunter, 3, "Wildhammer and troll, together again in the dirt, mon."),
      fight(C.blademaster, 3, "Your hammer is slow, dwarf."),
      fight(C.dreadlord, 6, "Northrend will be your tomb, Bronzebeard."),
      fight([C.lich, C.sylvanas], 4, "The plague has come for the mountain too."),
      fight(C.uther, 12, "Ironforge and the Silver Hand always spar before a war, old friend."),
    ],
    ending: ["Frostmourne is broken, and this time it didn't take me with it.", "Pour me a stout. Make it two: one for the lad Arthas used to be."],
  },
  {
    fighter: C.warden, boss: BossKind.kiljaeden,
    story: "Maiev hunts her prisoner from the Broken Isles into the Tomb, where his master Kil'jaeden waits.",
    fights: [
      fight(C.murloc, 7, "Mrrrgl! The tide hides us, the tide hides him!"),
      fight(C.sylvanas, 10, "Your justice means nothing to the Forsaken, Warden."),
      fight(C.kaelthas, 14, "My people chose Illidan. Choose another quarry."),
      fight([C.pitLord, C.dreadlord], 14, "The betrayer's allies guard his trail."),
      fight(C.demonHunter, 7, "You are not prepared, jailor."),
    ],
    ending: ["Kil'jaeden fled the Tomb. His servant is back in his cell.", "Justice is patient. So am I."],
  },
  {
    fighter: C.lich, boss: BossKind.archimonde,
    story: "Kel'Thuzad spreads the plague and opens Dalaran's gate for Archimonde, who has no further use for him.",
    fights: [
      fight(C.mountainKing, 11, "That's no farmer, that's a necromancer! Hammers up!"),
      fight(C.uther, 6, "The Light still burns in Lordaeron, Kel'Thuzad."),
      fight(C.jaina, 11, "You will not open Dalaran to the Legion."),
      fight([C.sylvanas, C.thrall], 10, "The living and the dead both want your master gone, lich."),
      fight(C.sylvanas, 4, "You took my life, lich. I will take your citadel."),
    ],
    ending: ["Archimonde thought his summoner expendable. Naxxramas disagrees.", "The Cult of the Damned will toast my victory. Silently, of course."],
  },
  {
    fighter: C.uther, boss: BossKind.lichKing,
    story: "Uther the Lightbringer holds Lordaeron together as the plague spreads, then goes north to face the prince he trained.",
    fights: [
      fight(C.peon, 3, "Me no go back to the camps! Me fight the hammer man!"),
      fight(C.blademaster, 3, "Your Silver Hand built the camps, paladin. Now face a free orc."),
      fight(C.lich, 4, "The plague is already in your granaries, Lightbringer."),
      fight([C.dreadlord, C.lich], 4, "The Scourge's masters march on Lordaeron, old man. Your prince opened the way."),
      fight(C.mountainKing, 6, "Arthas went north without ye, Uther. I'll not let ye follow him blind."),
    ],
    ending: ["The Lich King fell, and the boy I trained is free of him at last.", "The Light asks for patience. Today it also asked for a hammer."],
  },
  {
    fighter: C.dreadlord, boss: BossKind.kiljaeden,
    story: "Mal'Ganis plays every side of the tournament, until Kil'jaeden comes to collect.",
    fights: [
      fight(C.uther, 6, "I refused the Culling, dreadlord. I will not refuse you."),
      fight(C.mountainKing, 12, "I'll knock the horns off ye!"),
      fight(C.demonHunter, 14, "Tichondrius fell to me. You are smaller."),
      fight([C.sylvanas, C.lichKing], 4, "The Forsaken and the Scourge agree on one thing: your exile."),
      fight(C.lich, 6, "The nathrezim no longer command the Scourge."),
    ],
    ending: ["Kil'jaeden retreats, and owes me a favour he will never repay.", "Every side lost the tournament except mine."],
  },
  {
    fighter: C.shadowHunter, boss: BossKind.archimonde,
    story: "A Darkspear shadow hunter carries the voodoo of the Echo Isles to the summit of Hyjal.",
    fights: [
      fight(C.murloc, 7, "Mrgl! The Echo Isles' shore is ours!"),
      fight(C.mountainKing, 12, "The Wildhammer clan owes your kind a beating."),
      fight(C.jaina, 11, "Durotar's trolls are welcome. Their hexes are not."),
      fight([C.lich, C.dreadlord], 4, "The loa cannot protect you from the plague."),
      fight(C.blademaster, 3, "Prove the Darkspear belong in Thrall's Horde."),
    ],
    ending: ["Archimonde was hexed into a frog for one second. It was enough.", "The loa be laughin' tonight, mon."],
  },
  {
    fighter: C.pitLord, boss: BossKind.kiljaeden,
    story: "Magtheridon holds Hellfire Citadel for the Legion until Kil'jaeden judges him a failure.",
    fights: [
      fight(C.peon, 3, "Me quit! Me quit! ...After this fight."),
      fight(C.cairne, 3, "The Earth Mother does not welcome the burning ones."),
      fight(C.kaelthas, 14, "Your citadel is our new home, demon."),
      fight([C.warden, C.sylvanas], 7, "This world belongs to its living and dead. The Legion gets nothing."),
      fight(C.demonHunter, 14, "Hellfire Citadel is mine, Magtheridon."),
    ],
    ending: ["Kil'jaeden came to punish his warden of Outland and left without his horns.", "Hellfire Citadel answers to me."],
  },
  {
    fighter: C.beastmaster, boss: BossKind.kiljaeden,
    story: "Rexxar wanders from Durotar to the Broken Isles, where the Legion's master meddles with the beasts.",
    fights: [
      fight(C.peon, 3, "Me not hungry. Me promise bear not hungry."),
      fight(C.chen, 3, "A brew for a traveller, then a friendly scrap!"),
      fight(C.cairne, 3, "Prove to the tauren that the wilds still trust you."),
      fight([C.jaina, C.mountainKing], 11, "Admiral Proudmoore's soldiers want Durotar's coast."),
      fight(C.thrall, 3, "Champion of the Horde, show me your strength."),
    ],
    ending: ["Misha took a bite out of Kil'jaeden. She says he tasted of sulfur.", "The wilds are quiet again. I like them quiet."],
  },
  {
    fighter: C.lichKing, boss: BossKind.kiljaeden,
    story: "Arthas takes the Frozen Throne, then turns its power on the demon who forged the first Lich King.",
    fights: [
      fight(C.mountainKing, 12, "Leave this cursed blade, lad. It's not too late."),
      fight(C.jaina, 11, "Arthas, I still believe there's something left of you."),
      fight(C.sylvanas, 4, "You made me this. Now you face what you made."),
      fight([C.demonHunter, C.kaelthas], 14, "Kil'jaeden's servants race you to the Throne."),
      fight(C.uther, 2, "You are no son of Lordaeron, Arthas."),
    ],
    ending: ["Kil'jaeden made the Lich King to serve him. The Lich King had other plans.", "Every champion of this tournament will kneel. Eventually."],
  },
  {
    fighter: C.thrall, boss: BossKind.archimonde,
    story: "The Warchief leads the Horde to Kalimdor and makes an old enemy an ally at Hyjal.",
    fights: [
      fight(C.uther, 11, "No orc escapes Lordaeron's internment camps twice!"),
      fight(C.blademaster, 3, "The Warchief must still prove he can hold a blade."),
      fight(C.cairne, 3, "The tauren will follow you, young Warchief, once I see your strength."),
      fight([C.jaina, C.warden], 10, "Humans and night elves do not trust the Horde. Yet."),
      fight(C.beastmaster, 3, "Durotar's wilds answer to no Warchief."),
    ],
    ending: ["Archimonde fell, and the Horde stood beside the Alliance to see it.", "For the Horde. And this once, for everyone."],
  },
  {
    fighter: C.jaina, boss: BossKind.archimonde,
    story: "Jaina leads Lordaeron's survivors west and forges a truce at the foot of the World Tree.",
    fights: [
      fight(C.peon, 3, "Me not see human lady. Me just chopping."),
      fight(C.lich, 4, "Dalaran's magi will join the Scourge, apprentice."),
      fight(C.lichKing, 2, "Jaina. You should not have come north."),
      fight([C.thrall, C.blademaster], 3, "The Horde will not bow to a human sorceress."),
      fight(C.mountainKing, 12, "Ironforge stands guard for Theramore, lass. Show me ye can hold it!"),
    ],
    ending: ["Archimonde is ash beneath Nordrassil. Theramore will have its peace.", "And the tournament will have its champion, if the paperwork clears."],
  },
  {
    fighter: C.sylvanas, boss: BossKind.lichKing,
    story: "The Banshee Queen wins her body back and goes north for her murderer.",
    fights: [
      fight(C.kaelthas, 14, "Ranger-General, Quel'Thalas fell on your watch."),
      fight(C.dreadlord, 6, "The Forsaken will serve the nathrezim, banshee."),
      fight(C.lich, 4, "Kel'Thuzad remembers your screams."),
      fight([C.uther, C.mountainKing], 6, "Lordaeron's old guard does not trust the Forsaken."),
      fight(C.warden, 4, "Your old prison cannot hold all of Lordaeron's dead."),
    ],
    ending: ["The Lich King lies on his own ice. I let him feel the cold.", "Remember who freed Lordaeron, tournament."],
  },
  {
    fighter: C.cairne, boss: BossKind.archimonde,
    story: "The chieftain of the Bloodhoof leads his tribe from Mulgore to the battle for the World Tree.",
    fights: [
      fight(C.peon, 3, "Big cow! Me run!"),
      fight(C.beastmaster, 3, "The beasts of the Barrens follow the strongest."),
      fight(C.pitLord, 14, "Mannoroth's kin will trample your plains."),
      fight([C.lich, C.dreadlord], 4, "The plague crosses the sea to Kalimdor."),
      fight(C.thrall, 3, "Spar with me, old friend. The Earth Mother is watching."),
    ],
    ending: ["Archimonde fell as the Earth Mother asked.", "The tauren walk home to Mulgore with their heads high."],
  },
  {
    fighter: C.chen, boss: BossKind.kiljaeden,
    story: "Chen Stormstout travels the world for the perfect brew, and the Legion spills his last keg.",
    fights: [
      fight(C.peon, 3, "Me want brew! Me fight for brew!"),
      fight(C.beastmaster, 3, "A wanderer's fight first, then a wanderer's drink."),
      fight(C.mountainKing, 12, "Ironforge stout beats panda brew, and I'll prove it!"),
      fight([C.murloc, C.warden], 7, "The Broken Isles keep their secrets."),
      fight(C.thrall, 3, "Durotar welcomes you, brewmaster, once you show your skill."),
    ],
    ending: ["Kil'jaeden had never tasted Thunder Ale. Now he never will.", "A toast to every fighter here. Just one more barrel, and the journey continues."],
  },
  {
    fighter: C.peon, boss: BossKind.archimonde,
    story: "One peon just wanted to chop trees and somehow ended up at the end of the world.",
    fights: [
      fight(C.tinker, 3, "Union rules, pal: goblins get the good jobs."),
      fight(C.mountainKing, 12, "Look lads, a lumber thief!"),
      fight(C.warden, 10, "That tree is sacred, orc!"),
      fight([C.blademaster, C.thrall], 3, "Peon! Back to work!"),
      fight(C.shadowHunter, 3, "Even a peon must earn his place in Durotar, mon."),
    ],
    ending: ["Me beat big demon. Me... still have to chop wood?", "Zug zug."],
  },
  {
    fighter: C.tinker, boss: BossKind.archimonde,
    story: "A goblin engineer sells to every side, then tests his best invention on the Legion's master.",
    fights: [
      fight(C.peon, 3, "Me no pay for robot!"),
      fight(C.mountainKing, 12, "Ironforge engineers don't need goblin junk."),
      fight(C.jaina, 11, "Theramore bans unlicensed contraptions, goblin."),
      fight([C.pitLord, C.dreadlord], 14, "The Legion pays in fire, goblin."),
      fight(C.chen, 3, "Your gadget leaks worse than my keg!"),
    ],
    ending: ["Archimonde: field-tested and defeated. Patent pending.", "Time is money, friend, and I just made a fortune."],
  },
  {
    fighter: C.kaelthas, boss: BossKind.lichKing,
    story: "The prince of Quel'Thalas avenges his father and his homeland on the one who burned the Sunwell.",
    fights: [
      fight(C.lich, 4, "Your Sunwell fed my master well, prince."),
      fight(C.jaina, 11, "Kael, Dalaran still has a place for you."),
      fight(C.warden, 7, "You chose the betrayer. Now you share his cell."),
      fight([C.dreadlord, C.sylvanas], 6, "Lordaeron's dead do not welcome elves."),
      fight(C.demonHunter, 14, "Show me the power you crave, Kael'thas."),
    ],
    ending: ["Arthas burned the Sunwell. Today, the sin'dorei burned his throne.", "Quel'Thalas will remember this victory."],
  },
  {
    fighter: C.murloc, boss: BossKind.kiljaeden,
    story: "A Broken Isles murloc defends its tide pools from everyone, then from the Legion itself.",
    fights: [
      fight(C.peon, 3, "Fish man scary. Me fight anyway."),
      fight(C.warden, 10, "Stay out of the moonwells, little one."),
      fight(C.kaelthas, 14, "The naga's servants should know their place."),
      fight([C.warden, C.demonHunter], 7, "Even the hunter and her prey agree: clear the shore."),
      fight(C.shadowHunter, 7, "The sea be no place for a frog to win, mon."),
    ],
    ending: ["Mrglglglgl! MRGLGLGL!", "(The murloc has claimed the Tomb of Sargeras as its tide pool.)"],
  },
  {
    fighter: C.grom, boss: BossKind.archimonde,
    story: "Grom Hellscream wrestles with the blood curse, then turns Gorehowl on the Legion that enslaved his clan.",
    fights: [
      fight(C.jaina, 11, "The Warsong broke our truce. Lower that axe, Hellscream!"),
      fight(C.warden, 10, "Your lumber camps bleed Ashenvale. The forest remembers."),
      fight(C.blademaster, 3, "Warsong or Burning Blade, an orc must master his own rage."),
      fight([C.dreadlord, C.pitLord], 14, "Drink again, Hellscream. Your clan's strength belongs to us."),
      fight(C.thrall, 3, "The demons stole your freedom, Grom. Fight beside me and take it back!"),
    ],
    ending: ["Gorehowl broke the Legion's grip. No demon commands the Warsong now.", "Thrall, tell our people: we are free.", "And if another demon comes looking for us, let him hear my name."],
  },
  {
    fighter: C.malfurion, boss: BossKind.archimonde,
    story: "Malfurion wakes to a wounded Ashenvale, rallies unlikely allies, and calls the forest against Archimonde.",
    fights: [
      fight(C.peon, 3, "Me chop only little sacred tree!"),
      fight(C.pitLord, 14, "Your forests will feed the Legion's fires, druid."),
      fight(C.dreadlord, 6, "Sleep again, Stormrage. This time the nightmare will keep you."),
      fight([C.thrall, C.jaina], 10, "Our armies need time, Malfurion. Show us the forest can hold."),
      fight(C.demonHunter, 7, "You would banish your own brother to save your precious trees?"),
    ],
    ending: ["Nordrassil's spirits answered. Archimonde heard them too late.", "Our immortality is gone, but the forest lives. That is enough.", "Illidan, if you are listening: stay out of my moonwells."],
  },
  {
    fighter: C.medivh, boss: BossKind.archimonde,
    story: "The returned Guardian gathers Azeroth's divided champions at Hyjal to undo the ruin he once invited.",
    fights: [
      fight(C.lich, 4, "Your book opened Dalaran to the Legion, Guardian. Your warnings come too late."),
      fight(C.jaina, 11, "I followed your warning west. Now show me why I should trust the Horde."),
      fight(C.thrall, 3, "You led us to Kalimdor, prophet. I will not lead my people into another trap."),
      fight([C.dreadlord, C.pitLord], 14, "Sargeras spoke through you once. The Legion has not forgotten its favourite door."),
      fight(C.malfurion, 10, "Nordrassil shelters this world, Medivh. Prove your counsel will not betray it."),
    ],
    ending: ["The Legion's shadow has lifted. Azeroth's children chose to stand together.", "I opened the wrong door once. This time, I showed them the way home.", "My work is finished. Their future belongs to them."],
  },
  {
    fighter: C.ladyVashj, boss: BossKind.kiljaeden,
    story: "Lady Vashj rises from the Broken Isles to serve Illidan's bargain with Kil'jaeden, until the Deceiver comes to judge it.",
    fights: [
      fight(C.murloc, 7, "Mrrrgl! The deep queen calls the tide, the tide takes us!"),
      fight(C.warden, 7, "Stand aside, sea witch. Your master's cell is waiting."),
      fight(C.malfurion, 10, "You were Highborne once, Vashj. Is this all Azshara left you?"),
      fight(C.kaelthas, 14, "My people and yours serve one master now. Prove the naga are worth the alliance."),
      fight(C.lichKing, 2, "The Frozen Throne will not fall to a serpent of the deep."),
    ],
    ending: ["The Deceiver withdrew, his bargain unpaid.", "My people endured ten thousand years beneath the waves. A tournament is nothing."],
  },
  {
    fighter: C.archimonde, boss: BossKind.kiljaeden,
    story: "Archimonde marches the Burning Legion up Mount Hyjal to drain the World Tree, and every champion on his road learns what defiance costs.",
    fights: [
      fight(C.thrall, 3, "The blood pact is broken, Defiler. The Horde will never drink from your cup again."),
      fight(C.jaina, 11, "The Kirin Tor wrote of you in their oldest books. They never wrote how you fall."),
      fight(C.dreadlord, 6, "Tichondrius failed you, my lord. Let me prove the nathrezim still have their uses."),
      fight(C.medivh, 10, "I opened the door for your master once. I have come to close it on you."),
      fight([C.malfurion, C.demonHunter], 10, "Nordrassil's roots run deep, demon. You will not drink its strength."),
    ],
    ending: ["Kil'jaeden thought to take my place. The Legion answers to one master.", "Hyjal is quiet now. The World Tree's strength flows into me.", "Kneel, little world. Your gods have abandoned you."],
  },
  {
    fighter: C.butcher, boss: BossKind.lichKing,
    story: "The Butcher lumbers out of the Naxxramas flesh-works with a fresh hook and an empty larder, and Lordaeron is full of meat.",
    fights: [
      fight(C.peon, 3, "Work work? No. Not for you. Never for you."),
      fight(C.uther, 6, "The Light will cleanse what Kel'Thuzad stitched together, abomination."),
      fight(C.dreadlord, 6, "Mind the hook, butcher. The nathrezim are not on your menu."),
      fight(C.lich, 4, "Back to the workshop with you. Your master has other uses for that hook."),
      fight(C.sylvanas, 2, "The Forsaken were never your larder. Turn around, or lose the other arm."),
    ],
    ending: ["Fresh meat, all of it. The workshop will be busy for a year.", "The Lich King wanted a servant. He got a butcher.", "Hook, reel, carve. Simple work for a simple soul."],
  },
  {
    fighter: C.tyrande, boss: BossKind.archimonde,
    story: "Tyrande leads the Sentinels from Ashenvale to Mount Hyjal, holding every pass until the World Tree's trap can close on the Legion.",
    fights: [
      fight(C.thrall, 3, "Your people cut our forest, orc. Give me one reason not to answer them with arrows."),
      fight(C.jaina, 11, "The humans have come a long way to die in our woods, priestess. Let me prove we came to fight."),
      fight(C.demonHunter, 10, "You freed me, Tyrande. Do not expect me to thank you with obedience."),
      fight([C.dreadlord, C.lich], 14, "The Scourge has drawn first blood in your forest. Your goddess sleeps tonight."),
      fight(C.malfurion, 10, "Hyjal will need every arrow you have, my love. Show me you are ready."),
    ],
    ending: ["Archimonde fell at the World Tree's roots, and Elune's light did not falter.", "Hyjal stands. Ashenvale will grow back.", "The Sentinels return to the shadows of the forest. Watch the treeline."],
  },
];

export const CLASSIC_CHARACTERS: readonly Character[] = CLASSIC_ROUTES.map(route => route.fighter);


export function classicRoute(fighter: number): ClassicRoute | undefined {
  for (const route of CLASSIC_ROUTES) if (route.fighter === fighter) return route;
  return undefined;
}
