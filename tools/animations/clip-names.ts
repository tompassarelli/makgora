/** Each original sequence's index by lower-case name, then by its family name (the name without a trailing number) for the first sequence in that family; the game's originalClipNamed reads this table. */
export function clipNames(sequences: readonly { readonly Name: string }[]): Map<string, number> {
    const names = new Map<string, number>();
    sequences.forEach((sequence, index) => names.set(sequence.Name.toLowerCase(), index));
    sequences.forEach((sequence, index) => {
        const family = sequence.Name.toLowerCase().replace(/\s*-?\s*\d+$/, '').trim();
        if (!names.has(family)) names.set(family, index);
    });
    return names;
}
