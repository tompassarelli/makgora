import { f32 } from "wisp/src/sim/f32";
import { DuoRole, LAST_ATTACK_STYLE } from "../../sim/codes";
import type { AuthoredMove, FighterMoves, MoveRegion, PartnerBody } from "../../sim/heroMoves";
import type { FighterHurtboxes, HurtPart, HurtPose } from "../../sim/hurtboxes";

export const MURLOC_PARTNER = {
  bodyScale: f32(0.9),
  weight: f32(0.80),
  partnerDamage: 0.75,
  soloDamage: f32(0.9),
} as const;

const scaled = (value: number, scale: number): number => f32(value * scale);

function scaleRegion(region: MoveRegion): MoveRegion {
  const { hit } = region;
  const size = MURLOC_PARTNER.bodyScale;
  const strike = hit.strike;
  return {
    firstFrame: region.firstFrame,
    lastFrame: region.lastFrame,
    hit: {
      ...hit,
      minX: scaled(hit.minX, size), maxX: scaled(hit.maxX, size), minZ: scaled(hit.minZ, size), maxZ: scaled(hit.maxZ, size),
      strike: strike === undefined ? undefined : {
        ...strike, x1: scaled(strike.x1, size), z1: scaled(strike.z1, size), x2: scaled(strike.x2, size), z2: scaled(strike.z2, size), radius: scaled(strike.radius, size),
      },
    },
  };
}

function scaleMove(move: AuthoredMove): AuthoredMove {
  return { ...move, regions: move.regions.map((region) => scaleRegion(region)) };
}

function scalePart(part: HurtPart): HurtPart {
  const size = MURLOC_PARTNER.bodyScale;
  return { ...part, x1: scaled(part.x1, size), z1: scaled(part.z1, size), x2: scaled(part.x2, size), z2: scaled(part.z2, size), radius: scaled(part.radius, size) };
}

const scaleParts = (parts: readonly HurtPart[]): readonly HurtPart[] => parts.map((part) => scalePart(part));

function scaleHurtboxes(hurtboxes: FighterHurtboxes): FighterHurtboxes {
  const attacks: { [style: number]: readonly HurtPose[] | undefined } = {};
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    const poses = hurtboxes.attacks[style];
    if (poses !== undefined) attacks[style] = poses.map((pose): HurtPose => ({ firstFrame: pose.firstFrame, lastFrame: pose.lastFrame, parts: scaleParts(pose.parts) }));
  }
  return { stand: scaleParts(hurtboxes.stand), crouch: hurtboxes.crouch === undefined ? undefined : scaleParts(hurtboxes.crouch), attacks };
}

function scaleMoves(moves: FighterMoves): FighterMoves {
  const normals: { [style: number]: AuthoredMove | undefined } = {};
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    const move = moves.normals[style];
    if (move !== undefined) normals[style] = scaleMove(move);
  }
  return {
    ...moves,
    normals,
    grabRegion: moves.grabRegion === undefined ? undefined : scaleRegion({ firstFrame: 0, lastFrame: 0, hit: moves.grabRegion }).hit,
    hurtboxes: moves.hurtboxes === undefined ? undefined : scaleHurtboxes(moves.hurtboxes),
  };
}

let partnerMoves: { readonly source: FighterMoves; readonly scaled: FighterMoves } | undefined;

function partnerOf(moves: FighterMoves): FighterMoves {
  if (partnerMoves === undefined || partnerMoves.source !== moves) partnerMoves = { source: moves, scaled: scaleMoves(moves) };
  return partnerMoves.scaled;
}

export const MURLOC_PARTNER_BODY: PartnerBody = { weight: MURLOC_PARTNER.weight, moves: (base) => partnerOf(base) };

export function murlocDamageScale(role: number, partnerLive: boolean): number {
  if (role === DuoRole.partner) return MURLOC_PARTNER.partnerDamage;
  return partnerLive ? 1.0 : MURLOC_PARTNER.soloDamage;
}
