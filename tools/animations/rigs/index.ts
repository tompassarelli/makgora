import type { Character } from "../../../ts/src/game/sim/codes";
import type { FighterRig } from '../canonical-rig';
import * as rifleman from './rifleman';
import * as illidan from './illidan';
import * as blademaster from './blademaster';
import * as mountainking from './mountainking';
import * as warden from './warden';
import * as lich from './lich';
import * as uther from './uther';
import * as dreadlord from './dreadlord';
import * as shadowhunter from './shadowhunter';
import * as pitlord from './pitlord';
import * as beastmaster from './beastmaster';
import * as lichking from './lichking';
import * as thrall from './thrall';
import * as jaina from './jaina';
import * as sylvanas from './sylvanas';
import * as cairne from './cairne';
import * as chen from './chen';
import * as peon from './peon';
import * as tinker from './tinker';
import * as kaelthas from './kaelthas';
import * as murloc from './murloc';
import * as grom from './grom';
import * as malfurion from './malfurion';
import * as medivh from './medivh';
import * as ladyvashj from './ladyvashj';
import * as archimonde from './archimonde';
import * as butcher from './butcher';
import * as tyrande from './tyrande';

/** Every fighter's Classic mapping onto the canonical rig, by character (#366). */
export const FIGHTER_RIGS: ReadonlyMap<Character, FighterRig> = new Map([
    rifleman, illidan, blademaster, mountainking, warden, lich, uther, dreadlord, shadowhunter, pitlord, beastmaster, lichking, thrall,
    jaina, sylvanas, cairne, chen, peon, tinker, kaelthas, murloc, grom, malfurion, medivh, ladyvashj, archimonde, tyrande, butcher,
].map(rig => [rig.character, rig as FighterRig]));
