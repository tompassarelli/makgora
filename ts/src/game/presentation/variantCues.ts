export const variantAt = <T>(variants: readonly T[] | undefined, variant: number): T | undefined => variant > 0 ? variants?.[variant - 1] : undefined;

export const joined = <T>(...lists: readonly (readonly T[] | undefined)[]): readonly T[] => lists.flatMap((list) => list ?? []);
