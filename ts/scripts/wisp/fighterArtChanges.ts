import { fighterSlug } from "../../src/game/sim/heroes/registry";
import { fighters } from "../heroModelSource";

const ROSTER = [...fighters].map(([character, { name, source }]) => ({ name, source, slug: fighterSlug(character) }));

const SLUG_FILES = [
  /^build-inputs\/(?:original-clips-static-lights|impact-assets|hero-models)\/([^/]+)$/,
  /^ts\/src\/generated\/clips\/([^/]+)\.ts$/,
  /^ts\/src\/generated\/fighter-art\/([^/]+)\.ts$/,
  /^ts\/src\/generated\/assets\/white-(?:models|facts)\/([^/]+)\.ts$/,
];

const FACTS_FILE = /^ts\/scripts\/wisp\/model-facts\/war3mapImported_([A-Za-z]+?)(?:TimelineBody|White|OriginalClip\d*|OriginalLight)-/;

const WHOLE_SOURCE_FAMILY = /^build-inputs\/(animation-assets|illidan-animation)$/;

const EVERY_KEY = /^build-inputs\/(?:hero-models(?:\/shared)?|imported-models)$/;

export function changedFighters(paths: readonly string[], stepCode: ReadonlySet<string>): string[] {
  if (paths.some((path) => stepCode.has(path) || EVERY_KEY.test(path))) return ROSTER.map(({ slug }) => slug).sort();
  const slugs = new Set<string>();
  for (const path of paths) {
    const slug = SLUG_FILES.map((pattern) => pattern.exec(path)?.[1]).find((match) => match !== undefined);
    if (slug !== undefined && ROSTER.some((fighter) => fighter.slug === slug)) slugs.add(slug);
    const facts = FACTS_FILE.exec(path)?.[1];
    const named = facts === undefined ? undefined : ROSTER.find((fighter) => fighter.name === facts);
    if (named !== undefined) slugs.add(named.slug);
    const family = WHOLE_SOURCE_FAMILY.exec(path)?.[1];
    if (family !== undefined) for (const fighter of ROSTER) if (fighter.source.startsWith(`${family}/`)) slugs.add(fighter.slug);
  }
  return [...slugs].sort();
}
