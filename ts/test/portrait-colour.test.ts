import { expect, test } from 'bun:test';
import { judgeColour } from '../scripts/portraitLight';

test('Classic select tiles preserve roster-relative colour and contrast [k3 measure docs/design/fighter-portraits.md]', () => {
  const roster = new Map([
    ['Rifleman', { saturation: 0.303, contrast: 192.5 }],
    ['Kobold', { saturation: 0.448, contrast: 214.9 }],
    ['Malfurion', { saturation: 0.285, contrast: 242.5 }],
    ['Medivh', { saturation: 0.304, contrast: 211.4 }],
    ['Dreadlord', { saturation: 0.135, contrast: 216.0 }],
    ["Anub'arak", { saturation: 0.129, contrast: 106.7 }],
  ]);
  expect(judgeColour(roster)).toHaveLength(1);
  expect(judgeColour(roster)[0]).toContain("Anub'arak");
  roster.set("Anub'arak", { saturation: 0.251, contrast: 194.9 });
  expect(judgeColour(roster)).toEqual([]);
});
