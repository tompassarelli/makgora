const types: oskeytype[] = [];

export function osKeyType(key: number): oskeytype {
  const known = types[key];
  if (known !== undefined) return known;
  const type = ConvertOsKeyType(key);
  types[key] = type;
  return type;
}

export const osKeyDown = (key: number): boolean => BlzIsKeyPressed(osKeyType(key));
