import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { HOME_STAGES } from "../menu/homeStages";
import { STAGE_CATALOG, type StageTile } from "../menu/stageCatalog";
import { isFeatured, isFeaturedStage } from "../roster/forge";
import type { Character } from "../sim/codes";
import { ARCADE_CHARACTERS, arcadeTable, type ArcadeTable, type EliteDuo } from "./tables";
import { ARCADE_STAGES, ARCADE_SPINE, StageKind } from "./spine";

export interface StagePlan {
  readonly kind: StageKind;
  readonly opponents: readonly Character[];
  readonly arena: StageTile;
  readonly line: string;
}

const MODULUS = 46337;
const MULTIPLIER = 21107;
const INCREMENT = 12345;

/** A modular generator whose products stay inside Warcraft's 32-bit integers. */
class RunDraws {
  private state: number;

  constructor(seed: number) {
    this.state = floorMod(seed, MODULUS);
  }

  below(count: number): number {
    this.state = floorMod(this.state * MULTIPLIER + INCREMENT, MODULUS);
    return floorMod(this.state, count);
  }

  pick<T>(pool: readonly T[]): T {
    return at(pool, this.below(pool.length));
  }
}

const shares = (a: EliteDuo, b: EliteDuo): boolean => a.members.some(member => b.members.includes(member));

function drawDuos(table: Readonly<ArcadeTable>, draws: RunDraws): readonly [EliteDuo, EliteDuo] {
  const first = draws.pick(table.elites);
  const others = table.elites.filter(duo => duo !== first);
  const apart = others.filter(duo => !shares(first, duo));
  return [first, draws.pick(apart.length > 0 ? apart : others)];
}

const featuredArenas = (): readonly StageTile[] => STAGE_CATALOG.filter(info => isFeaturedStage(info.id)).map(info => info.id);

function drawArena(draws: RunDraws, previous: StageTile | undefined): StageTile {
  const arenas = featuredArenas();
  const fresh = arenas.filter(arena => arena !== previous);
  return draws.pick(fresh.length > 0 ? fresh : arenas);
}

export function homeArena(character: Character): StageTile {
  const home = HOME_STAGES.find(entry => entry.character === character)?.stage;
  return featuredArenas().find(arena => arena === home) ?? at(featuredArenas(), 0);
}

/**
 * The eight stages of a run for one fighter, all drawn from the run seed: no fighter appears twice,
 * and the hallways skip the player, the ally, the rival and both elite duos.
 */
export function arcadePlan(fighter: Character, seed: number): readonly StagePlan[] {
  const table = arcadeTable(fighter);
  if (table === undefined) return [];
  const draws = new RunDraws(seed);
  const duos = drawDuos(table, draws);
  const taken: Character[] = [fighter, table.ally, table.rival, ...duos.flatMap(duo => duo.members)];
  let hallway = ARCADE_CHARACTERS.filter(character => isFeatured(character) && !taken.includes(character));
  const plans: StagePlan[] = [];
  let arena: StageTile | undefined;
  let elites = 0;
  for (let index = 0; index < ARCADE_STAGES; index++) {
    const kind = at(ARCADE_SPINE, index).kind;
    if (kind === StageKind.rival) {
      plans.push({ kind, opponents: [table.rival], arena: homeArena(table.rival), line: table.line });
      continue;
    }
    if (kind !== StageKind.bonus) arena = drawArena(draws, arena);
    let opponents: readonly Character[] = [];
    if (kind === StageKind.hallway) {
      const chosen = draws.pick(hallway);
      hallway = hallway.filter(character => character !== chosen);
      opponents = [chosen];
    } else if (kind === StageKind.elite) opponents = at(duos, elites++).members;
    plans.push({ kind, opponents, arena: arena ?? homeArena(fighter), line: "" });
  }
  return plans;
}

/** The one fighter a stage plays against until the elites field a whole duo: the first of its members not met earlier in the run. */
export function stageOpponent(plans: readonly StagePlan[], stage: number): Character | undefined {
  const here = plans[stage]?.opponents ?? [];
  const earlier = plans.slice(0, stage).flatMap(plan => plan.opponents);
  return here.find(character => !earlier.includes(character)) ?? here[0];
}
