import { floorMod } from "wisp/src/sim/intMath";

export const REPLAY_CHECKSUM_MODULUS = 1_000_003;

export interface ChecksumLanes {
  valid: boolean;
  first: number;
  second: number;
}

function foldChecksum(lanes: ChecksumLanes, fragment: string): void {
  foldChecksumRange(lanes, fragment, 0, fragment.length);
}


export function foldChecksumRange(lanes: ChecksumLanes, text: string, start: number, end: number): void {
  if (!lanes.valid) return;
  let { first, second } = lanes;
  for (let index = start; index < end; index++) {
    const byte = text.charCodeAt(index);
    if (byte < 32 || byte > 126) {
      lanes.valid = false;
      return;
    }

    first = floorMod(first * 257 + byte + 1, REPLAY_CHECKSUM_MODULUS);
    second = floorMod(second * 263 + byte + 1, REPLAY_CHECKSUM_MODULUS);
  }
  lanes.first = first;
  lanes.second = second;
}

export const checksumText = ({ valid, first, second }: Readonly<ChecksumLanes>): string => (valid ? `${first}:${second}` : "invalid-ascii");

export function canonicalChecksum(text: string): string {
  const lanes: ChecksumLanes = { valid: true, first: 0, second: 0 };
  foldChecksum(lanes, text);
  return checksumText(lanes);
}
