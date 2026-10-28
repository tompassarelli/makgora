# Fighter movement and recovery clips

Generated from the packaged models by `bun wisp view motion --assets DIR` (#171). Each row follows production pose selection over the state's completed frames. Motion is the greatest local vertex travel; body is the mean of each vertex's greatest travel, in world units. The direction column measures vertex travel toward/against the action's direction (vertical for standing up or crouching, horizontal otherwise). Local measurements exclude the simulation's movement across the stage. Clip numbers and names identify sequences of the fighter's model. A zero reveals a held pose. These measurements expose gaps; a stock Walk in a roll row still needs a roll clip.

| Fighter | State | Clip | Motion | Body | Direction; toward/against |
| --- | --- | --- | ---: | ---: | --- |
| Rifleman | walk | 54: Walk | 75.6 | 23.6 | forward; 66.5/74.8 |
| Rifleman | dash | 54: Walk | 75.6 | 23.4 | forward; 66.5/74.2 |
| Rifleman | run | 54: Walk | 86.4 | 18.4 | forward; 85.8/83.8 |
| Rifleman | turn | 55: Recovery turn | 143.6 | 27.5 | back; 60.1/143.6 |
| Rifleman | brake | 56: Recovery stop | 23.4 | 9.3 | in place; 10.6/17.1 |
| Rifleman | jump-squat | 57: Recovery jumpSquat | 29.8 | 13.5 | down; 29.6/21.8 |
| Rifleman | roll-forward | 32: Roll Forward | 116.6 | 45.3 | forward; 71.9/116.5 |
| Rifleman | roll-back | 31: Roll Backward | 116.6 | 45.3 | back; 116.5/71.9 |
| Rifleman | spot-dodge | 39: Spot Dodge | 20.3 | 7.9 | in place; 10.3/10.7 |
| Rifleman | air-dodge | 58: Recovery airDodge | 40.8 | 13.6 | in place; 17.2/20.0 |
| Rifleman | tech | 59: Recovery tech | 94.0 | 37.7 | in place; 68.1/48.1 |
| Rifleman | tech-forward | 60: Recovery techForward | 124.8 | 55.8 | forward; 86.3/74.5 |
| Rifleman | tech-back | 61: Recovery techBackward | 115.1 | 64.9 | back; 85.2/74.5 |
| Rifleman | get-up | 21: Get Up | 77.7 | 34.5 | up; 62.1/50.4 |
| Rifleman | get-up-forward | 62: Recovery getUpRollForward | 124.7 | 55.6 | forward; 86.2/74.5 |
| Rifleman | get-up-back | 63: Recovery getUpRollBackward | 115.0 | 64.9 | back; 85.4/74.5 |
| Rifleman | get-up-attack | 22: Get Up Attack | 95.0 | 37.4 | both; 67.3/61.4 |
| Rifleman | ledge-get-up | 28: Ledge Climb | 64.7 | 7.9 | up; 27.7/64.2 |
| Rifleman | ledge-roll | 32: Roll Forward | 116.8 | 45.4 | forward; 72.0/116.4 |
| Rifleman | ledge-attack | 22: Get Up Attack | 95.3 | 37.4 | both; 67.3/61.4 |
| Illidan | walk | 119: Locomotion Walk | 139.2 | 20.8 | forward; 129.1/139.0 |
| Illidan | dash | 121: Locomotion Initial Dash Burst | 81.1 | 19.7 | forward; 72.9/57.8 |
| Illidan | run | 120: Locomotion Run | 111.4 | 23.8 | forward; 108.7/95.2 |
| Illidan | turn | 97: Turnaround | 95.2 | 23.1 | back; 77.5/83.4 |
| Illidan | brake | 89: Stop | 22.3 | 9.4 | in place; 22.3/10.4 |
| Illidan | jump-squat | 47: Jump Squat | 73.7 | 11.1 | down; 36.1/26.9 |
| Illidan | roll-forward | 63: Roll Forward | 148.5 | 70.0 | forward; 118.7/96.8 |
| Illidan | roll-back | 62: Roll Backward | 147.7 | 70.5 | back; 95.4/118.7 |
| Illidan | spot-dodge | 80: Spot Dodge | 140.4 | 30.0 | in place; 53.8/78.4 |
| Illidan | air-dodge | 5: Air Dodge | 111.2 | 20.9 | in place; 34.1/56.4 |
| Illidan | tech | 92: Tech Neutral | 162.1 | 88.5 | in place; 104.9/143.6 |
| Illidan | tech-forward | 91: Tech Forward | 148.4 | 69.9 | forward; 118.5/104.1 |
| Illidan | tech-back | 90: Tech Back | 155.7 | 71.9 | back; 96.1/118.5 |
| Illidan | get-up | 38: Get Up | 155.7 | 87.9 | up; 133.1/72.0 |
| Illidan | get-up-forward | 41: Get Up Roll Forward | 148.9 | 69.8 | forward; 118.6/98.8 |
| Illidan | get-up-back | 40: Get Up Roll Back | 148.5 | 70.2 | back; 95.9/118.5 |
| Illidan | get-up-attack | 39: Get Up Attack | 158.6 | 89.4 | both; 141.9/115.7 |
| Illidan | ledge-get-up | 54: Ledge Climb | 158.4 | 47.7 | up; 40.8/127.3 |
| Illidan | ledge-roll | 57: Ledge Roll | 149.0 | 69.9 | forward; 118.7/93.9 |
| Illidan | ledge-attack | 52: Ledge Attack | 146.8 | 28.2 | both; 130.6/126.0 |
| Blademaster | walk | 6: Walk | 117.9 | 47.6 | forward; 112.1/115.9 |
| Blademaster | dash | 6: Walk | 114.9 | 46.1 | forward; 110.8/112.2 |
| Blademaster | run | 6: Walk | 94.0 | 40.3 | forward; 92.6/85.2 |
| Blademaster | turn | 14: Recovery turn | 137.4 | 31.9 | back; 137.2/96.1 |
| Blademaster | brake | 15: Recovery stop | 148.3 | 28.1 | in place; 143.0/56.9 |
| Blademaster | jump-squat | 16: Recovery jumpSquat | 165.2 | 29.7 | down; 111.1/28.0 |
| Blademaster | roll-forward | 23: Recovery rollForward | 226.6 | 79.7 | forward; 158.8/118.2 |
| Blademaster | roll-back | 24: Recovery rollBackward | 227.0 | 80.9 | back; 118.5/160.4 |
| Blademaster | spot-dodge | 25: Recovery spotDodge | 115.2 | 37.9 | in place; 106.3/45.0 |
| Blademaster | air-dodge | 17: Recovery airDodge | 116.1 | 27.3 | in place; 111.8/45.6 |
| Blademaster | tech | 18: Recovery tech | 150.1 | 65.9 | in place; 125.9/144.4 |
| Blademaster | tech-forward | 19: Recovery techForward | 194.1 | 65.3 | forward; 149.1/143.0 |
| Blademaster | tech-back | 20: Recovery techBackward | 184.2 | 82.2 | back; 163.2/147.8 |
| Blademaster | get-up | 26: Recovery getUp | 175.3 | 73.7 | up; 114.7/76.5 |
| Blademaster | get-up-forward | 21: Recovery getUpRollForward | 193.5 | 65.8 | forward; 148.7/143.0 |
| Blademaster | get-up-back | 22: Recovery getUpRollBackward | 183.5 | 81.8 | back; 163.3/147.7 |
| Blademaster | get-up-attack | 27: Recovery getUpAttack | 227.8 | 90.7 | both; 155.0/217.0 |
| Blademaster | ledge-get-up | 28: Recovery ledgeClimb | 136.7 | 86.3 | up; 122.8/60.7 |
| Blademaster | ledge-roll | 29: Recovery ledgeRoll | 194.1 | 64.8 | forward; 149.2/142.8 |
| Blademaster | ledge-attack | 30: Recovery ledgeAttack | 194.6 | 92.1 | both; 114.1/194.2 |
| Muradin Bronzebeard | walk | 7: Walk | 84.3 | 28.2 | forward; 71.0/79.3 |
| Muradin Bronzebeard | dash | 7: Walk | 82.9 | 27.6 | forward; 70.9/77.8 |
| Muradin Bronzebeard | run | 7: Walk | 77.4 | 23.8 | forward; 69.7/59.5 |
| Muradin Bronzebeard | turn | 27: Recovery turn | 87.0 | 23.1 | back; 84.1/87.0 |
| Muradin Bronzebeard | brake | 28: Recovery stop | 20.9 | 8.6 | in place; 13.4/15.7 |
| Muradin Bronzebeard | jump-squat | 29: Recovery jumpSquat | 30.4 | 11.6 | down; 30.4/13.7 |
| Muradin Bronzebeard | roll-forward | 36: Recovery rollForward | 114.3 | 49.0 | forward; 97.0/105.8 |
| Muradin Bronzebeard | roll-back | 37: Recovery rollBackward | 114.5 | 49.5 | back; 105.7/97.4 |
| Muradin Bronzebeard | spot-dodge | 38: Recovery spotDodge | 38.3 | 14.1 | in place; 25.1/24.0 |
| Muradin Bronzebeard | air-dodge | 30: Recovery airDodge | 37.8 | 12.6 | in place; 23.0/21.5 |
| Muradin Bronzebeard | tech | 31: Recovery tech | 87.5 | 32.0 | in place; 75.0/48.3 |
| Muradin Bronzebeard | tech-forward | 32: Recovery techForward | 109.9 | 43.5 | forward; 71.1/83.5 |
| Muradin Bronzebeard | tech-back | 33: Recovery techBackward | 110.8 | 44.1 | back; 69.7/85.8 |
| Muradin Bronzebeard | get-up | 39: Recovery getUp | 81.5 | 31.3 | up; 59.0/78.2 |
| Muradin Bronzebeard | get-up-forward | 34: Recovery getUpRollForward | 110.0 | 42.8 | forward; 70.9/83.4 |
| Muradin Bronzebeard | get-up-back | 35: Recovery getUpRollBackward | 110.9 | 44.1 | back; 69.7/85.8 |
| Muradin Bronzebeard | get-up-attack | 40: Recovery getUpAttack | 124.6 | 56.8 | both; 106.3/109.5 |
| Muradin Bronzebeard | ledge-get-up | 41: Recovery ledgeClimb | 112.3 | 64.2 | up; 110.7/0.0 |
| Muradin Bronzebeard | ledge-roll | 42: Recovery ledgeRoll | 109.9 | 43.3 | forward; 71.0/83.6 |
| Muradin Bronzebeard | ledge-attack | 43: Recovery ledgeAttack | 185.5 | 83.0 | both; 110.7/106.4 |
| Maiev Shadowsong | walk | 2: Walk | 89.2 | 21.5 | forward; 88.6/85.0 |
| Maiev Shadowsong | dash | 2: Walk | 82.3 | 21.1 | forward; 76.2/82.3 |
| Maiev Shadowsong | run | 2: Walk | 66.4 | 26.4 | forward; 55.6/58.6 |
| Maiev Shadowsong | turn | 12: Recovery turn | 128.1 | 27.2 | back; 128.1/90.5 |
| Maiev Shadowsong | brake | 13: Recovery stop | 25.9 | 13.8 | in place; 18.8/20.4 |
| Maiev Shadowsong | jump-squat | 14: Recovery jumpSquat | 42.8 | 19.4 | down; 41.8/22.1 |
| Maiev Shadowsong | roll-forward | 21: Recovery rollForward | 165.5 | 69.1 | forward; 151.6/88.5 |
| Maiev Shadowsong | roll-back | 22: Recovery rollBackward | 165.5 | 68.9 | back; 88.8/151.8 |
| Maiev Shadowsong | spot-dodge | 23: Recovery spotDodge | 62.8 | 20.1 | in place; 50.1/36.3 |
| Maiev Shadowsong | air-dodge | 15: Recovery airDodge | 52.9 | 18.6 | in place; 46.1/32.9 |
| Maiev Shadowsong | tech | 16: Recovery tech | 120.3 | 52.0 | in place; 93.9/71.4 |
| Maiev Shadowsong | tech-forward | 17: Recovery techForward | 157.1 | 61.6 | forward; 105.6/138.9 |
| Maiev Shadowsong | tech-back | 18: Recovery techBackward | 165.6 | 69.6 | back; 105.9/137.5 |
| Maiev Shadowsong | get-up | 24: Recovery getUp | 129.0 | 52.0 | up; 108.2/99.9 |
| Maiev Shadowsong | get-up-forward | 19: Recovery getUpRollForward | 157.4 | 62.1 | forward; 105.5/139.0 |
| Maiev Shadowsong | get-up-back | 20: Recovery getUpRollBackward | 165.6 | 69.6 | back; 106.1/137.5 |
| Maiev Shadowsong | get-up-attack | 25: Recovery getUpAttack | 185.3 | 81.1 | both; 171.8/148.7 |
| Maiev Shadowsong | ledge-get-up | 26: Recovery ledgeClimb | 135.3 | 75.0 | up; 120.3/23.3 |
| Maiev Shadowsong | ledge-roll | 27: Recovery ledgeRoll | 157.1 | 61.0 | forward; 105.5/138.6 |
| Maiev Shadowsong | ledge-attack | 28: Recovery ledgeAttack | 192.7 | 94.7 | both; 170.1/88.9 |
| Kel'Thuzad | walk | 4: Walk | 70.7 | 11.0 | forward; 49.7/20.6 |
| Kel'Thuzad | dash | 4: Walk | 57.3 | 9.2 | forward; 45.0/19.5 |
| Kel'Thuzad | run | 4: Walk | 78.3 | 14.1 | forward; 29.3/35.9 |
| Kel'Thuzad | turn | 10: Recovery turn | 216.3 | 43.1 | back; 216.1/88.4 |
| Kel'Thuzad | brake | 11: Recovery stop | 51.6 | 20.2 | in place; 51.4/27.6 |
| Kel'Thuzad | jump-squat | 12: Recovery jumpSquat | 59.8 | 36.6 | down; 57.1/40.5 |
| Kel'Thuzad | roll-forward | 19: Recovery rollForward | 205.5 | 102.6 | forward; 195.4/96.8 |
| Kel'Thuzad | roll-back | 20: Recovery rollBackward | 207.0 | 103.7 | back; 92.9/204.8 |
| Kel'Thuzad | spot-dodge | 21: Recovery spotDodge | 106.7 | 35.4 | in place; 106.4/39.3 |
| Kel'Thuzad | air-dodge | 13: Recovery airDodge | 101.5 | 27.0 | in place; 96.7/34.6 |
| Kel'Thuzad | tech | 14: Recovery tech | 153.6 | 97.2 | in place; 102.4/65.5 |
| Kel'Thuzad | tech-forward | 15: Recovery techForward | 179.2 | 119.3 | forward; 118.7/164.0 |
| Kel'Thuzad | tech-back | 16: Recovery techBackward | 205.4 | 120.8 | back; 117.9/144.2 |
| Kel'Thuzad | get-up | 22: Recovery getUp | 152.5 | 89.1 | up; 136.7/146.6 |
| Kel'Thuzad | get-up-forward | 17: Recovery getUpRollForward | 179.4 | 119.2 | forward; 118.9/164.1 |
| Kel'Thuzad | get-up-back | 18: Recovery getUpRollBackward | 205.3 | 120.7 | back; 117.8/144.2 |
| Kel'Thuzad | get-up-attack | 23: Recovery getUpAttack | 215.1 | 129.6 | both; 180.8/144.1 |
| Kel'Thuzad | ledge-get-up | 24: Recovery ledgeClimb | 147.3 | 101.3 | up; 136.9/82.2 |
| Kel'Thuzad | ledge-roll | 25: Recovery ledgeRoll | 179.3 | 121.3 | forward; 118.8/164.2 |
| Kel'Thuzad | ledge-attack | 26: Recovery ledgeAttack | 175.6 | 125.6 | both; 110.6/108.8 |
| Forsaken Paladin | walk | 12: Walk 1 | 85.8 | 20.7 | forward; 82.9/75.0 |
| Forsaken Paladin | dash | 12: Walk 1 | 85.6 | 20.0 | forward; 82.7/74.3 |
| Forsaken Paladin | run | 12: Walk 1 | 70.6 | 17.0 | forward; 66.1/66.1 |
| Forsaken Paladin | turn | 50: Forsaken Paladin turn | 130.3 | 29.1 | back; 128.8/65.5 |
| Forsaken Paladin | brake | 51: Forsaken Paladin stop | 41.9 | 10.5 | in place; 27.6/16.1 |
| Forsaken Paladin | jump-squat | 52: Forsaken Paladin jumpSquat | 50.3 | 9.5 | down; 44.7/19.2 |
| Forsaken Paladin | roll-forward | 85: Forsaken Paladin rollForward | 212.3 | 92.3 | forward; 86.5/205.4 |
| Forsaken Paladin | roll-back | 86: Forsaken Paladin rollBackward | 212.4 | 92.1 | back; 205.7/86.4 |
| Forsaken Paladin | spot-dodge | 66: Forsaken Paladin spotDodge | 39.8 | 13.2 | in place; 30.6/14.5 |
| Forsaken Paladin | air-dodge | 48: Forsaken Paladin airDodge | 46.6 | 14.7 | in place; 33.6/16.1 |
| Forsaken Paladin | tech | 67: Forsaken Paladin tech | 139.2 | 28.7 | in place; 64.2/115.3 |
| Forsaken Paladin | tech-forward | 87: Forsaken Paladin techForward | 212.3 | 92.9 | forward; 86.6/205.6 |
| Forsaken Paladin | tech-back | 88: Forsaken Paladin techBackward | 212.4 | 92.9 | back; 205.6/86.6 |
| Forsaken Paladin | get-up | 64: Forsaken Paladin getUp | 180.3 | 48.7 | up; 93.5/81.3 |
| Forsaken Paladin | get-up-forward | 89: Forsaken Paladin getUpRollForward | 212.8 | 92.6 | forward; 86.4/205.6 |
| Forsaken Paladin | get-up-back | 90: Forsaken Paladin getUpRollBackward | 212.7 | 92.4 | back; 205.4/86.5 |
| Forsaken Paladin | get-up-attack | 65: Forsaken Paladin getUpAttack | 242.0 | 64.8 | both; 210.3/90.5 |
| Forsaken Paladin | ledge-get-up | 60: Forsaken Paladin ledgeClimb | 124.5 | 27.0 | up; 64.5/77.6 |
| Forsaken Paladin | ledge-roll | 91: Forsaken Paladin ledgeRoll | 212.7 | 92.6 | forward; 86.5/205.6 |
| Forsaken Paladin | ledge-attack | 61: Forsaken Paladin ledgeAttack | 49.7 | 11.2 | both; 38.0/19.1 |
| Mal'Ganis | walk | 5: Walk | 117.4 | 38.1 | forward; 107.5/105.7 |
| Mal'Ganis | dash | 5: Walk | 114.4 | 36.3 | forward; 106.7/105.0 |
| Mal'Ganis | run | 5: Walk | 128.5 | 45.2 | forward; 124.4/110.5 |
| Mal'Ganis | turn | 12: Recovery turn | 115.8 | 48.2 | back; 75.0/115.3 |
| Mal'Ganis | brake | 13: Recovery stop | 32.6 | 12.6 | in place; 23.7/32.1 |
| Mal'Ganis | jump-squat | 14: Recovery jumpSquat | 56.2 | 22.7 | down; 54.5/16.7 |
| Mal'Ganis | roll-forward | 21: Recovery rollForward | 171.6 | 82.8 | forward; 100.3/125.2 |
| Mal'Ganis | roll-back | 22: Recovery rollBackward | 171.9 | 83.3 | back; 126.4/97.3 |
| Mal'Ganis | spot-dodge | 23: Recovery spotDodge | 59.0 | 25.0 | in place; 47.8/39.2 |
| Mal'Ganis | air-dodge | 15: Recovery airDodge | 58.8 | 22.9 | in place; 42.6/35.1 |
| Mal'Ganis | tech | 16: Recovery tech | 122.4 | 60.8 | in place; 114.7/77.9 |
| Mal'Ganis | tech-forward | 17: Recovery techForward | 146.3 | 71.0 | forward; 124.9/130.9 |
| Mal'Ganis | tech-back | 18: Recovery techBackward | 146.8 | 72.1 | back; 118.7/134.9 |
| Mal'Ganis | get-up | 24: Recovery getUp | 134.0 | 64.9 | up; 125.3/94.8 |
| Mal'Ganis | get-up-forward | 19: Recovery getUpRollForward | 146.3 | 70.8 | forward; 124.7/130.8 |
| Mal'Ganis | get-up-back | 20: Recovery getUpRollBackward | 147.4 | 71.9 | back; 118.7/134.9 |
| Mal'Ganis | get-up-attack | 25: Recovery getUpAttack | 197.7 | 97.0 | both; 193.7/170.3 |
| Mal'Ganis | ledge-get-up | 26: Recovery ledgeClimb | 146.1 | 90.2 | up; 136.5/12.4 |
| Mal'Ganis | ledge-roll | 27: Recovery ledgeRoll | 146.5 | 70.8 | forward; 124.9/130.7 |
| Mal'Ganis | ledge-attack | 28: Recovery ledgeAttack | 209.7 | 109.2 | both; 203.6/81.6 |
| Shadow Hunter | walk | 0: Walk | 173.0 | 44.3 | forward; 157.4/166.5 |
| Shadow Hunter | dash | 0: Walk | 171.9 | 35.9 | forward; 157.1/164.3 |
| Shadow Hunter | run | 0: Walk | 142.8 | 38.4 | forward; 130.1/138.5 |
| Shadow Hunter | turn | 14: Recovery turn | 133.2 | 48.2 | back; 128.1/133.2 |
| Shadow Hunter | brake | 15: Recovery stop | 26.6 | 10.8 | in place; 15.0/18.5 |
| Shadow Hunter | jump-squat | 16: Recovery jumpSquat | 30.3 | 13.5 | down; 28.6/18.6 |
| Shadow Hunter | roll-forward | 23: Recovery rollForward | 156.4 | 70.5 | forward; 130.9/147.0 |
| Shadow Hunter | roll-back | 24: Recovery rollBackward | 156.5 | 70.7 | back; 147.2/130.8 |
| Shadow Hunter | spot-dodge | 25: Recovery spotDodge | 64.1 | 20.2 | in place; 35.9/34.6 |
| Shadow Hunter | air-dodge | 17: Recovery airDodge | 57.3 | 20.0 | in place; 31.8/31.9 |
| Shadow Hunter | tech | 18: Recovery tech | 118.1 | 48.2 | in place; 110.1/101.8 |
| Shadow Hunter | tech-forward | 19: Recovery techForward | 161.6 | 71.4 | forward; 114.2/120.4 |
| Shadow Hunter | tech-back | 20: Recovery techBackward | 147.7 | 62.4 | back; 115.9/127.1 |
| Shadow Hunter | get-up | 26: Recovery getUp | 125.7 | 48.6 | up; 68.4/105.4 |
| Shadow Hunter | get-up-forward | 21: Recovery getUpRollForward | 161.6 | 71.4 | forward; 114.4/120.2 |
| Shadow Hunter | get-up-back | 22: Recovery getUpRollBackward | 148.0 | 62.2 | back; 115.8/127.1 |
| Shadow Hunter | get-up-attack | 27: Recovery getUpAttack | 262.8 | 105.0 | both; 222.4/138.1 |
| Shadow Hunter | ledge-get-up | 28: Recovery ledgeClimb | 114.2 | 64.6 | up; 95.6/30.7 |
| Shadow Hunter | ledge-roll | 29: Recovery ledgeRoll | 160.8 | 71.5 | forward; 114.4/120.6 |
| Shadow Hunter | ledge-attack | 30: Recovery ledgeAttack | 265.1 | 117.2 | both; 184.2/115.4 |
| Pit Lord | walk | 1: Walk | 103.7 | 21.6 | forward; 99.4/98.7 |
| Pit Lord | dash | 3: Walk Fast | 149.6 | 39.7 | forward; 145.9/91.5 |
| Pit Lord | run | 3: Walk Fast | 129.0 | 45.3 | forward; 110.7/121.8 |
| Pit Lord | turn | 17: Recovery turn | 355.7 | 95.8 | back; 347.8/298.0 |
| Pit Lord | brake | 18: Recovery stop | 158.7 | 43.6 | in place; 59.0/91.4 |
| Pit Lord | jump-squat | 19: Recovery jumpSquat | 160.1 | 40.0 | down; 159.8/111.8 |
| Pit Lord | roll-forward | 26: Recovery rollForward | 355.9 | 162.4 | forward; 288.0/341.3 |
| Pit Lord | roll-back | 27: Recovery rollBackward | 364.5 | 169.6 | back; 344.8/282.3 |
| Pit Lord | spot-dodge | 28: Recovery spotDodge | 152.1 | 76.0 | in place; 96.9/56.0 |
| Pit Lord | air-dodge | 20: Recovery airDodge | 122.0 | 39.4 | in place; 89.6/54.2 |
| Pit Lord | tech | 21: Recovery tech | 313.1 | 91.0 | in place; 153.7/77.6 |
| Pit Lord | tech-forward | 22: Recovery techForward | 385.6 | 161.6 | forward; 251.6/222.9 |
| Pit Lord | tech-back | 23: Recovery techBackward | 359.6 | 157.1 | back; 240.2/197.4 |
| Pit Lord | get-up | 29: Recovery getUp | 305.9 | 92.5 | up; 168.9/297.3 |
| Pit Lord | get-up-forward | 24: Recovery getUpRollForward | 384.7 | 162.0 | forward; 252.3/223.0 |
| Pit Lord | get-up-back | 25: Recovery getUpRollBackward | 359.6 | 156.8 | back; 240.1/196.7 |
| Pit Lord | get-up-attack | 30: Recovery getUpAttack | 336.6 | 160.5 | both; 231.3/332.0 |
| Pit Lord | ledge-get-up | 31: Recovery ledgeClimb | 227.5 | 95.5 | up; 226.6/141.8 |
| Pit Lord | ledge-roll | 32: Recovery ledgeRoll | 383.6 | 161.1 | forward; 252.3/222.9 |
| Pit Lord | ledge-attack | 33: Recovery ledgeAttack | 231.9 | 118.7 | both; 152.7/83.3 |
| Rexxar | walk | 0: walk | 181.5 | 54.1 | forward; 149.1/180.8 |
| Rexxar | dash | 0: walk | 181.5 | 53.6 | forward; 148.2/180.8 |
| Rexxar | run | 0: walk | 166.8 | 47.1 | forward; 126.0/162.1 |
| Rexxar | turn | 10: Recovery turn | 164.7 | 41.7 | back; 103.9/164.7 |
| Rexxar | brake | 11: Recovery stop | 33.4 | 23.5 | in place; 21.8/24.2 |
| Rexxar | jump-squat | 12: Recovery jumpSquat | 57.7 | 34.0 | down; 57.7/13.4 |
| Rexxar | roll-forward | 19: Recovery rollForward | 187.0 | 91.2 | forward; 101.0/165.1 |
| Rexxar | roll-back | 20: Recovery rollBackward | 186.8 | 91.4 | back; 165.1/100.8 |
| Rexxar | spot-dodge | 21: Recovery spotDodge | 74.4 | 37.9 | in place; 41.0/36.9 |
| Rexxar | air-dodge | 13: Recovery airDodge | 58.6 | 25.4 | in place; 36.7/33.2 |
| Rexxar | tech | 14: Recovery tech | 123.8 | 60.7 | in place; 106.2/93.5 |
| Rexxar | tech-forward | 15: Recovery techForward | 146.2 | 80.8 | forward; 120.4/130.3 |
| Rexxar | tech-back | 16: Recovery techBackward | 150.6 | 75.6 | back; 120.7/126.2 |
| Rexxar | get-up | 22: Recovery getUp | 123.8 | 61.8 | up; 114.2/103.9 |
| Rexxar | get-up-forward | 17: Recovery getUpRollForward | 146.3 | 80.4 | forward; 120.3/130.2 |
| Rexxar | get-up-back | 18: Recovery getUpRollBackward | 150.9 | 75.4 | back; 120.9/126.1 |
| Rexxar | get-up-attack | 23: Recovery getUpAttack | 271.9 | 97.0 | both; 192.0/164.1 |
| Rexxar | ledge-get-up | 24: Recovery ledgeClimb | 146.7 | 77.7 | up; 145.7/12.9 |
| Rexxar | ledge-roll | 25: Recovery ledgeRoll | 146.2 | 80.6 | forward; 120.2/130.2 |
| Rexxar | ledge-attack | 26: Recovery ledgeAttack | 279.6 | 95.6 | both; 171.8/113.6 |
| Lich King | walk | 2: Walk | 90.9 | 24.8 | forward; 89.3/85.8 |
| Lich King | dash | 10: Walk Fast | 98.4 | 35.4 | forward; 83.5/89.3 |
| Lich King | run | 10: Walk Fast | 116.9 | 31.8 | forward; 112.7/101.1 |
| Lich King | turn | 66: Turn | 72.8 | 19.5 | back; 68.1/40.5 |
| Lich King | brake | 67: Stop | 96.4 | 20.0 | in place; 47.6/69.3 |
| Lich King | jump-squat | 68: Jump Squat | 75.6 | 12.9 | down; 68.0/15.2 |
| Lich King | roll-forward | 33: Roll Forward | 253.1 | 58.7 | forward; 50.7/58.8 |
| Lich King | roll-back | 34: Roll Backward | 75.1 | 30.6 | back; 57.3/63.1 |
| Lich King | spot-dodge | 32: Spot Dodge | 73.5 | 30.6 | in place; 16.7/73.5 |
| Lich King | air-dodge | 35: Air Dodge | 162.1 | 20.4 | in place; 44.9/94.2 |
| Lich King | tech | 69: Tech | 222.7 | 64.2 | in place; 101.6/70.8 |
| Lich King | tech-forward | 70: Tech Forward | 221.9 | 64.9 | forward; 101.5/79.0 |
| Lich King | tech-back | 71: Tech Backward | 224.0 | 68.2 | back; 101.0/118.1 |
| Lich King | get-up | 54: Get Up | 193.2 | 96.9 | up; 185.1/60.1 |
| Lich King | get-up-forward | 72: Get Up Roll Forward | 181.7 | 98.6 | forward; 62.9/149.4 |
| Lich King | get-up-back | 73: Get Up Roll Backward | 183.8 | 103.3 | back; 133.5/68.0 |
| Lich King | get-up-attack | 55: Get Up Attack | 226.1 | 99.6 | both; 80.6/213.9 |
| Lich King | ledge-get-up | 57: Ledge Climb | 249.9 | 43.8 | up; 248.9/72.8 |
| Lich King | ledge-roll | 58: Ledge Roll | 244.7 | 53.5 | forward; 79.4/80.3 |
| Lich King | ledge-attack | 59: Ledge Attack | 283.7 | 51.2 | both; 150.1/170.1 |
| Thrall | walk | 2: Walk | 159.2 | 34.4 | forward; 157.1/139.3 |
| Thrall | dash | 2: Walk | 159.1 | 30.4 | forward; 156.9/100.0 |
| Thrall | run | 2: Walk | 107.1 | 37.5 | forward; 94.8/84.4 |
| Thrall | turn | 29: Thrall turn | 85.9 | 21.5 | back; 85.7/77.8 |
| Thrall | brake | 30: Thrall stop | 45.3 | 16.6 | in place; 14.2/21.9 |
| Thrall | jump-squat | 31: Thrall jumpSquat | 55.7 | 19.0 | down; 7.7/42.5 |
| Thrall | roll-forward | 64: Thrall rollForward | 212.4 | 114.4 | forward; 143.7/201.5 |
| Thrall | roll-back | 68: Thrall rollBackward | 197.4 | 112.2 | back; 180.9/180.4 |
| Thrall | spot-dodge | 45: Thrall spotDodge | 66.4 | 21.2 | in place; 31.7/21.6 |
| Thrall | air-dodge | 26: Thrall airDodge | 45.9 | 14.6 | in place; 24.0/21.2 |
| Thrall | tech | 46: Thrall tech | 131.4 | 52.2 | in place; 61.3/125.5 |
| Thrall | tech-forward | 65: Thrall techForward | 204.9 | 112.4 | forward; 98.4/190.8 |
| Thrall | tech-back | 69: Thrall techBackward | 173.5 | 101.2 | back; 129.2/173.5 |
| Thrall | get-up | 43: Thrall getUp | 108.9 | 41.2 | up; 97.7/26.0 |
| Thrall | get-up-forward | 66: Thrall getUpRollForward | 212.4 | 114.3 | forward; 141.3/201.6 |
| Thrall | get-up-back | 70: Thrall getUpRollBackward | 196.6 | 111.8 | back; 179.2/180.4 |
| Thrall | get-up-attack | 44: Thrall getUpAttack | 96.4 | 20.6 | both; 76.8/92.8 |
| Thrall | ledge-get-up | 39: Thrall ledgeClimb | 131.7 | 37.2 | up; 130.7/32.4 |
| Thrall | ledge-roll | 67: Thrall ledgeRoll | 212.4 | 114.3 | forward; 140.9/201.6 |
| Thrall | ledge-attack | 40: Thrall ledgeAttack | 51.5 | 6.8 | both; 45.8/13.1 |
| Jaina Proudmoore | walk | 6: Walk | 104.8 | 21.9 | forward; 95.9/103.1 |
| Jaina Proudmoore | dash | 6: Walk | 103.4 | 21.3 | forward; 94.9/101.4 |
| Jaina Proudmoore | run | 6: Walk | 99.4 | 19.8 | forward; 97.1/93.7 |
| Jaina Proudmoore | turn | 31: Jaina turn | 69.5 | 14.7 | back; 69.4/56.9 |
| Jaina Proudmoore | brake | 32: Jaina stop | 33.1 | 4.1 | in place; 29.3/19.2 |
| Jaina Proudmoore | jump-squat | 33: Jaina jumpSquat | 59.0 | 9.3 | down; 21.2/42.9 |
| Jaina Proudmoore | roll-forward | 66: Jaina rollForward | 130.2 | 76.0 | forward; 86.9/87.9 |
| Jaina Proudmoore | roll-back | 70: Jaina rollBackward | 129.6 | 76.3 | back; 87.8/86.8 |
| Jaina Proudmoore | spot-dodge | 47: Jaina spotDodge | 39.0 | 9.5 | in place; 37.0/15.5 |
| Jaina Proudmoore | air-dodge | 28: Jaina airDodge | 35.5 | 6.5 | in place; 31.7/11.2 |
| Jaina Proudmoore | tech | 48: Jaina tech | 83.1 | 43.3 | in place; 41.3/82.6 |
| Jaina Proudmoore | tech-forward | 67: Jaina techForward | 129.6 | 74.7 | forward; 87.1/87.9 |
| Jaina Proudmoore | tech-back | 71: Jaina techBackward | 132.0 | 77.4 | back; 88.0/86.9 |
| Jaina Proudmoore | get-up | 45: Jaina getUp | 102.7 | 62.4 | up; 100.6/46.2 |
| Jaina Proudmoore | get-up-forward | 68: Jaina getUpRollForward | 130.4 | 76.1 | forward; 86.8/87.8 |
| Jaina Proudmoore | get-up-back | 72: Jaina getUpRollBackward | 130.0 | 77.6 | back; 87.8/86.6 |
| Jaina Proudmoore | get-up-attack | 46: Jaina getUpAttack | 116.0 | 66.0 | both; 101.0/107.8 |
| Jaina Proudmoore | ledge-get-up | 41: Jaina ledgeClimb | 176.4 | 20.1 | up; 176.0/78.2 |
| Jaina Proudmoore | ledge-roll | 69: Jaina ledgeRoll | 128.9 | 74.8 | forward; 87.0/87.8 |
| Jaina Proudmoore | ledge-attack | 42: Jaina ledgeAttack | 76.6 | 11.1 | both; 55.2/26.2 |
| Sylvanas Windrunner | walk | 8: Walk | 100.5 | 32.0 | forward; 99.8/82.5 |
| Sylvanas Windrunner | dash | 8: Walk | 99.8 | 31.2 | forward; 99.7/81.5 |
| Sylvanas Windrunner | run | 8: Walk | 97.3 | 25.5 | forward; 91.5/93.2 |
| Sylvanas Windrunner | turn | 32: Sylvanas turn | 98.9 | 27.2 | back; 55.2/98.9 |
| Sylvanas Windrunner | brake | 33: Sylvanas stop | 21.7 | 8.5 | in place; 21.3/13.0 |
| Sylvanas Windrunner | jump-squat | 34: Sylvanas jumpSquat | 63.9 | 27.0 | down; 56.7/18.8 |
| Sylvanas Windrunner | roll-forward | 42: Sylvanas rollForward | 142.4 | 66.7 | forward; 70.4/99.2 |
| Sylvanas Windrunner | roll-back | 43: Sylvanas rollBackward | 139.6 | 67.4 | back; 99.7/70.8 |
| Sylvanas Windrunner | spot-dodge | 49: Sylvanas spotDodge | 100.8 | 26.3 | in place; 29.9/78.0 |
| Sylvanas Windrunner | air-dodge | 40: Sylvanas airDodge | 100.9 | 24.6 | in place; 42.2/76.2 |
| Sylvanas Windrunner | tech | 41: Sylvanas tech | 124.8 | 47.5 | in place; 83.7/82.8 |
| Sylvanas Windrunner | tech-forward | 44: Sylvanas techForward | 134.6 | 66.3 | forward; 126.2/99.0 |
| Sylvanas Windrunner | tech-back | 45: Sylvanas techBackward | 143.3 | 59.8 | back; 126.7/107.0 |
| Sylvanas Windrunner | get-up | 51: Sylvanas getUp | 118.5 | 45.3 | up; 112.6/72.3 |
| Sylvanas Windrunner | get-up-forward | 46: Sylvanas getUpRollForward | 134.5 | 66.2 | forward; 126.2/99.2 |
| Sylvanas Windrunner | get-up-back | 47: Sylvanas getUpRollBackward | 143.8 | 59.8 | back; 126.3/106.9 |
| Sylvanas Windrunner | get-up-attack | 52: Sylvanas getUpAttack | 167.8 | 63.5 | both; 118.5/131.5 |
| Sylvanas Windrunner | ledge-get-up | 54: Sylvanas ledgeClimb | 136.1 | 75.8 | up; 128.5/23.9 |
| Sylvanas Windrunner | ledge-roll | 48: Sylvanas ledgeRoll | 135.1 | 66.2 | forward; 126.3/99.3 |
| Sylvanas Windrunner | ledge-attack | 55: Sylvanas ledgeAttack | 167.2 | 81.4 | both; 99.3/134.8 |
| Cairne Bloodhoof | walk | 3: Walk | 109.3 | 40.8 | forward; 100.9/109.1 |
| Cairne Bloodhoof | dash | 3: Walk | 105.1 | 35.3 | forward; 100.3/75.0 |
| Cairne Bloodhoof | run | 3: Walk | 106.4 | 35.9 | forward; 106.3/89.1 |
| Cairne Bloodhoof | turn | 34: Cairne turn | 289.4 | 78.0 | back; 289.3/163.5 |
| Cairne Bloodhoof | brake | 35: Cairne stop | 121.0 | 43.2 | in place; 28.8/15.2 |
| Cairne Bloodhoof | jump-squat | 36: Cairne jumpSquat | 64.3 | 17.5 | down; 26.1/43.2 |
| Cairne Bloodhoof | roll-forward | 69: Cairne rollForward | 284.7 | 130.8 | forward; 275.2/193.7 |
| Cairne Bloodhoof | roll-back | 70: Cairne rollBackward | 285.2 | 131.2 | back; 193.9/275.2 |
| Cairne Bloodhoof | spot-dodge | 50: Cairne spotDodge | 134.8 | 53.5 | in place; 31.5/17.0 |
| Cairne Bloodhoof | air-dodge | 32: Cairne airDodge | 88.1 | 17.5 | in place; 33.5/18.8 |
| Cairne Bloodhoof | tech | 51: Cairne tech | 135.2 | 53.5 | in place; 88.2/98.0 |
| Cairne Bloodhoof | tech-forward | 71: Cairne techForward | 285.3 | 131.4 | forward; 274.8/193.9 |
| Cairne Bloodhoof | tech-back | 72: Cairne techBackward | 285.3 | 131.4 | back; 193.9/274.8 |
| Cairne Bloodhoof | get-up | 48: Cairne getUp | 199.0 | 87.8 | up; 166.6/199.0 |
| Cairne Bloodhoof | get-up-forward | 73: Cairne getUpRollForward | 285.3 | 131.4 | forward; 275.3/193.8 |
| Cairne Bloodhoof | get-up-back | 74: Cairne getUpRollBackward | 285.6 | 131.1 | back; 193.7/275.3 |
| Cairne Bloodhoof | get-up-attack | 49: Cairne getUpAttack | 357.5 | 115.0 | both; 297.6/167.4 |
| Cairne Bloodhoof | ledge-get-up | 44: Cairne ledgeClimb | 113.1 | 45.4 | up; 110.9/59.8 |
| Cairne Bloodhoof | ledge-roll | 75: Cairne ledgeRoll | 285.5 | 131.1 | forward; 275.0/193.8 |
| Cairne Bloodhoof | ledge-attack | 45: Cairne ledgeAttack | 355.0 | 88.7 | both; 352.5/105.4 |
| Chen Stormstout | walk | 0: walk | 116.8 | 40.1 | forward; 116.4/112.8 |
| Chen Stormstout | dash | 0: walk | 116.6 | 39.0 | forward; 116.2/112.4 |
| Chen Stormstout | run | 0: walk | 124.6 | 34.2 | forward; 124.5/109.4 |
| Chen Stormstout | turn | 35: Chen turn | 284.9 | 63.8 | back; 274.9/157.3 |
| Chen Stormstout | brake | 36: Chen stop | 57.0 | 25.0 | in place; 36.2/11.0 |
| Chen Stormstout | jump-squat | 37: Chen jumpSquat | 39.1 | 17.6 | down; 31.1/34.0 |
| Chen Stormstout | roll-forward | 59: Chen rollForward | 305.7 | 123.3 | forward; 143.7/305.6 |
| Chen Stormstout | roll-back | 63: Chen rollBackward | 305.5 | 123.2 | back; 305.1/142.3 |
| Chen Stormstout | spot-dodge | 51: Chen spotDodge | 87.7 | 31.3 | in place; 54.7/33.8 |
| Chen Stormstout | air-dodge | 32: Chen airDodge | 59.9 | 16.9 | in place; 49.0/25.8 |
| Chen Stormstout | tech | 52: Chen tech | 131.3 | 62.5 | in place; 90.3/59.9 |
| Chen Stormstout | tech-forward | 60: Chen techForward | 304.9 | 123.4 | forward; 144.7/304.5 |
| Chen Stormstout | tech-back | 64: Chen techBackward | 304.8 | 123.2 | back; 304.5/143.4 |
| Chen Stormstout | get-up | 49: Chen getUp | 88.2 | 44.2 | up; 87.5/71.0 |
| Chen Stormstout | get-up-forward | 61: Chen getUpRollForward | 305.8 | 123.4 | forward; 143.7/305.7 |
| Chen Stormstout | get-up-back | 65: Chen getUpRollBackward | 305.6 | 123.2 | back; 305.2/142.5 |
| Chen Stormstout | get-up-attack | 50: Chen getUpAttack | 277.9 | 58.2 | both; 152.6/277.8 |
| Chen Stormstout | ledge-get-up | 45: Chen ledgeClimb | 296.6 | 43.8 | up; 209.7/165.1 |
| Chen Stormstout | ledge-roll | 62: Chen ledgeRoll | 305.9 | 123.4 | forward; 143.7/305.5 |
| Chen Stormstout | ledge-attack | 46: Chen ledgeAttack | 64.0 | 16.6 | both; 52.8/18.0 |
| Peon | walk | 1: Walk | 81.6 | 32.3 | forward; 73.3/81.5 |
| Peon | dash | 1: Walk | 81.2 | 32.0 | forward; 71.5/81.1 |
| Peon | run | 1: Walk | 61.4 | 26.0 | forward; 61.3/60.5 |
| Peon | turn | 42: Peon turn | 104.2 | 26.8 | back; 60.5/104.2 |
| Peon | brake | 43: Peon stop | 17.2 | 7.5 | in place; 8.7/13.6 |
| Peon | jump-squat | 44: Peon jumpSquat | 39.0 | 19.5 | down; 34.9/9.3 |
| Peon | roll-forward | 52: Peon rollForward | 107.5 | 58.3 | forward; 51.0/105.9 |
| Peon | roll-back | 53: Peon rollBackward | 108.6 | 57.9 | back; 107.3/51.4 |
| Peon | spot-dodge | 59: Peon spotDodge | 72.4 | 21.9 | in place; 25.9/46.7 |
| Peon | air-dodge | 50: Peon airDodge | 91.7 | 22.0 | in place; 27.1/53.1 |
| Peon | tech | 51: Peon tech | 81.8 | 36.3 | in place; 78.1/39.0 |
| Peon | tech-forward | 54: Peon techForward | 109.4 | 60.4 | forward; 58.2/98.5 |
| Peon | tech-back | 55: Peon techBackward | 110.9 | 55.8 | back; 57.5/100.4 |
| Peon | get-up | 61: Peon getUp | 78.5 | 34.8 | up; 48.4/73.0 |
| Peon | get-up-forward | 56: Peon getUpRollForward | 109.5 | 60.5 | forward; 58.2/98.7 |
| Peon | get-up-back | 57: Peon getUpRollBackward | 111.3 | 55.8 | back; 57.2/100.6 |
| Peon | get-up-attack | 62: Peon getUpAttack | 113.6 | 50.5 | both; 95.2/61.5 |
| Peon | ledge-get-up | 64: Peon ledgeClimb | 103.6 | 63.9 | up; 98.9/1.0 |
| Peon | ledge-roll | 58: Peon ledgeRoll | 109.1 | 60.4 | forward; 58.2/98.8 |
| Peon | ledge-attack | 65: Peon ledgeAttack | 171.7 | 70.6 | both; 71.1/44.3 |
| Goblin Tinker | walk | 0: Walk | 97.4 | 30.3 | forward; 94.3/94.7 |
| Goblin Tinker | dash | 0: Walk | 97.5 | 29.8 | forward; 94.2/93.8 |
| Goblin Tinker | run | 0: Walk | 99.8 | 27.3 | forward; 99.6/78.7 |
| Goblin Tinker | turn | 53: Tinker turn | 152.7 | 41.2 | back; 116.5/152.7 |
| Goblin Tinker | brake | 54: Tinker stop | 32.8 | 14.9 | in place; 25.1/10.6 |
| Goblin Tinker | jump-squat | 55: Tinker jumpSquat | 60.7 | 16.6 | down; 40.5/54.9 |
| Goblin Tinker | roll-forward | 65: Tinker rollForward | 172.0 | 81.7 | forward; 128.7/163.0 |
| Goblin Tinker | roll-back | 66: Tinker rollBackward | 172.0 | 81.4 | back; 162.9/127.8 |
| Goblin Tinker | spot-dodge | 63: Tinker spotDodge | 92.1 | 28.8 | in place; 14.4/60.0 |
| Goblin Tinker | air-dodge | 64: Tinker airDodge | 90.7 | 21.4 | in place; 11.3/64.9 |
| Goblin Tinker | tech | 75: Tinker tech | 137.8 | 57.1 | in place; 90.1/105.0 |
| Goblin Tinker | tech-forward | 67: Tinker techForward | 199.5 | 86.0 | forward; 94.9/191.2 |
| Goblin Tinker | tech-back | 68: Tinker techBackward | 199.0 | 86.0 | back; 191.7/95.7 |
| Goblin Tinker | get-up | 74: Tinker getUp | 126.1 | 58.1 | up; 125.5/92.8 |
| Goblin Tinker | get-up-forward | 69: Tinker getUpRollForward | 199.7 | 85.9 | forward; 95.1/191.2 |
| Goblin Tinker | get-up-back | 70: Tinker getUpRollBackward | 198.8 | 86.0 | back; 191.7/95.7 |
| Goblin Tinker | get-up-attack | 76: Tinker getUpAttack | 208.3 | 77.3 | both; 96.5/175.0 |
| Goblin Tinker | ledge-get-up | 78: Tinker ledgeClimb | 149.0 | 75.6 | up; 125.2/9.4 |
| Goblin Tinker | ledge-roll | 71: Tinker ledgeRoll | 199.7 | 85.9 | forward; 95.1/191.2 |
| Goblin Tinker | ledge-attack | 79: Tinker ledgeAttack | 153.4 | 79.3 | both; 124.5/22.6 |
| Kael'thas Sunstrider | walk | 2: Walk | 92.3 | 25.1 | forward; 90.7/92.2 |
| Kael'thas Sunstrider | dash | 2: Walk | 86.9 | 24.2 | forward; 75.2/86.5 |
| Kael'thas Sunstrider | run | 2: Walk | 76.8 | 20.2 | forward; 68.1/76.4 |
| Kael'thas Sunstrider | turn | 33: Kaelthas turn | 119.5 | 28.3 | back; 68.2/117.4 |
| Kael'thas Sunstrider | brake | 34: Kaelthas stop | 83.3 | 10.3 | in place; 74.9/27.1 |
| Kael'thas Sunstrider | jump-squat | 35: Kaelthas jumpSquat | 55.2 | 13.5 | down; 7.1/41.5 |
| Kael'thas Sunstrider | roll-forward | 68: Kaelthas rollForward | 173.0 | 80.4 | forward; 138.4/96.5 |
| Kael'thas Sunstrider | roll-back | 72: Kaelthas rollBackward | 173.6 | 79.4 | back; 102.5/138.4 |
| Kael'thas Sunstrider | spot-dodge | 49: Kaelthas spotDodge | 92.8 | 11.7 | in place; 79.6/29.8 |
| Kael'thas Sunstrider | air-dodge | 30: Kaelthas airDodge | 87.3 | 9.0 | in place; 77.9/28.3 |
| Kael'thas Sunstrider | tech | 50: Kaelthas tech | 94.2 | 40.3 | in place; 75.8/83.0 |
| Kael'thas Sunstrider | tech-forward | 69: Kaelthas techForward | 172.7 | 78.5 | forward; 138.4/102.6 |
| Kael'thas Sunstrider | tech-back | 73: Kaelthas techBackward | 173.6 | 78.9 | back; 102.6/138.4 |
| Kael'thas Sunstrider | get-up | 47: Kaelthas getUp | 128.7 | 63.4 | up; 104.7/86.2 |
| Kael'thas Sunstrider | get-up-forward | 70: Kaelthas getUpRollForward | 166.4 | 90.6 | forward; 145.9/155.9 |
| Kael'thas Sunstrider | get-up-back | 74: Kaelthas getUpRollBackward | 165.8 | 88.1 | back; 158.1/145.8 |
| Kael'thas Sunstrider | get-up-attack | 48: Kaelthas getUpAttack | 160.8 | 76.6 | both; 141.2/136.0 |
| Kael'thas Sunstrider | ledge-get-up | 43: Kaelthas ledgeClimb | 114.3 | 20.7 | up; 108.5/8.9 |
| Kael'thas Sunstrider | ledge-roll | 71: Kaelthas ledgeRoll | 173.0 | 78.2 | forward; 138.3/102.3 |
| Kael'thas Sunstrider | ledge-attack | 44: Kaelthas ledgeAttack | 68.1 | 11.1 | both; 55.2/19.3 |
| Murloc | walk | 1: Walk | 126.7 | 32.7 | forward; 117.6/125.3 |
| Murloc | dash | 1: Walk | 126.8 | 30.7 | forward; 110.1/125.1 |
| Murloc | run | 1: Walk | 106.0 | 32.6 | forward; 101.1/88.5 |
| Murloc | turn | 31: Murloc turn | 165.1 | 44.8 | back; 149.2/32.1 |
| Murloc | brake | 32: Murloc stop | 67.8 | 15.4 | in place; 43.8/49.8 |
| Murloc | jump-squat | 33: Murloc jumpSquat | 36.8 | 13.0 | down; 22.0/33.3 |
| Murloc | roll-forward | 66: Murloc rollForward | 167.4 | 71.9 | forward; 71.6/157.4 |
| Murloc | roll-back | 70: Murloc rollBackward | 166.3 | 71.1 | back; 157.3/71.6 |
| Murloc | spot-dodge | 47: Murloc spotDodge | 77.2 | 23.0 | in place; 46.2/59.5 |
| Murloc | air-dodge | 28: Murloc airDodge | 65.4 | 13.9 | in place; 45.5/55.4 |
| Murloc | tech | 48: Murloc tech | 75.3 | 31.5 | in place; 24.5/47.5 |
| Murloc | tech-forward | 67: Murloc techForward | 167.5 | 71.5 | forward; 71.5/157.5 |
| Murloc | tech-back | 71: Murloc techBackward | 167.5 | 71.4 | back; 157.5/71.6 |
| Murloc | get-up | 45: Murloc getUp | 111.1 | 44.9 | up; 73.6/77.5 |
| Murloc | get-up-forward | 68: Murloc getUpRollForward | 147.7 | 60.7 | forward; 123.7/94.2 |
| Murloc | get-up-back | 72: Murloc getUpRollBackward | 128.4 | 60.6 | back; 98.8/121.6 |
| Murloc | get-up-attack | 46: Murloc getUpAttack | 134.6 | 49.8 | both; 133.3/39.7 |
| Murloc | ledge-get-up | 41: Murloc ledgeClimb | 107.1 | 26.3 | up; 76.0/89.8 |
| Murloc | ledge-roll | 69: Murloc ledgeRoll | 167.3 | 71.7 | forward; 71.6/157.2 |
| Murloc | ledge-attack | 42: Murloc ledgeAttack | 77.2 | 15.7 | both; 22.0/75.7 |
| Grom Hellscream | walk | 5: Walk | 121.9 | 50.4 | forward; 118.7/111.2 |
| Grom Hellscream | dash | 5: Walk | 121.9 | 49.0 | forward; 118.7/109.6 |
| Grom Hellscream | run | 5: Walk | 135.2 | 46.2 | forward; 134.4/132.1 |
| Grom Hellscream | turn | 38: Grom turn | 138.7 | 28.0 | back; 66.8/137.9 |
| Grom Hellscream | brake | 39: Grom stop | 107.4 | 18.9 | in place; 104.3/28.8 |
| Grom Hellscream | jump-squat | 40: Grom jumpSquat | 70.9 | 20.1 | down; 12.7/49.3 |
| Grom Hellscream | roll-forward | 73: Grom rollForward | 252.1 | 108.6 | forward; 182.0/114.2 |
| Grom Hellscream | roll-back | 77: Grom rollBackward | 251.3 | 99.7 | back; 110.7/187.9 |
| Grom Hellscream | spot-dodge | 54: Grom spotDodge | 116.7 | 18.1 | in place; 111.9/42.8 |
| Grom Hellscream | air-dodge | 35: Grom airDodge | 113.2 | 15.8 | in place; 109.1/37.0 |
| Grom Hellscream | tech | 55: Grom tech | 157.0 | 48.5 | in place; 155.3/54.9 |
| Grom Hellscream | tech-forward | 74: Grom techForward | 251.1 | 104.1 | forward; 188.1/110.8 |
| Grom Hellscream | tech-back | 78: Grom techBackward | 250.8 | 104.0 | back; 110.9/188.0 |
| Grom Hellscream | get-up | 52: Grom getUp | 194.8 | 77.7 | up; 101.4/87.4 |
| Grom Hellscream | get-up-forward | 75: Grom getUpRollForward | 258.9 | 113.1 | forward; 146.9/253.8 |
| Grom Hellscream | get-up-back | 79: Grom getUpRollBackward | 258.4 | 110.2 | back; 253.1/138.5 |
| Grom Hellscream | get-up-attack | 53: Grom getUpAttack | 204.7 | 85.4 | both; 103.0/188.5 |
| Grom Hellscream | ledge-get-up | 48: Grom ledgeClimb | 112.9 | 31.5 | up; 112.9/61.4 |
| Grom Hellscream | ledge-roll | 76: Grom ledgeRoll | 253.0 | 106.6 | forward; 187.6/117.0 |
| Grom Hellscream | ledge-attack | 49: Grom ledgeAttack | 86.3 | 20.0 | both; 33.0/13.0 |
| Kobold | walk | 1: Walk | 71.6 | 23.8 | forward; 60.8/62.6 |
| Kobold | dash | 91: Kobold dash | 24.1 | 2.7 | forward; 19.0/17.7 |
| Kobold | run | 90: Kobold run | 23.8 | 3.8 | forward; 20.5/18.0 |
| Kobold | turn | 31: Kobold turn | 79.4 | 25.8 | back; 79.0/58.8 |
| Kobold | brake | 32: Kobold stop | 96.1 | 25.9 | in place; 27.3/35.2 |
| Kobold | jump-squat | 33: Kobold jumpSquat | 19.1 | 7.7 | down; 10.4/14.0 |
| Kobold | roll-forward | 66: Kobold rollForward | 129.3 | 53.0 | forward; 103.6/88.9 |
| Kobold | roll-back | 70: Kobold rollBackward | 129.8 | 50.5 | back; 88.9/103.5 |
| Kobold | spot-dodge | 47: Kobold spotDodge | 74.1 | 24.7 | in place; 39.9/31.9 |
| Kobold | air-dodge | 28: Kobold airDodge | 58.4 | 12.7 | in place; 38.8/27.1 |
| Kobold | tech | 48: Kobold tech | 62.4 | 24.9 | in place; 48.0/32.5 |
| Kobold | tech-forward | 67: Kobold techForward | 129.5 | 53.2 | forward; 103.6/89.1 |
| Kobold | tech-back | 71: Kobold techBackward | 128.9 | 52.2 | back; 89.1/103.6 |
| Kobold | get-up | 45: Kobold getUp | 77.8 | 33.1 | up; 57.1/75.7 |
| Kobold | get-up-forward | 68: Kobold getUpRollForward | 107.7 | 54.8 | forward; 87.6/87.6 |
| Kobold | get-up-back | 72: Kobold getUpRollBackward | 107.4 | 50.7 | back; 90.5/87.6 |
| Kobold | get-up-attack | 46: Kobold getUpAttack | 97.6 | 40.0 | both; 57.3/72.5 |
| Kobold | ledge-get-up | 41: Kobold ledgeClimb | 110.5 | 26.1 | up; 110.4/40.4 |
| Kobold | ledge-roll | 69: Kobold ledgeRoll | 129.2 | 52.9 | forward; 103.6/89.1 |
| Kobold | ledge-attack | 42: Kobold ledgeAttack | 76.2 | 14.8 | both; 28.0/30.0 |
| Malfurion Stormrage | walk | 7: Walk | 126.8 | 28.0 | forward; 117.7/126.1 |
| Malfurion Stormrage | dash | 7: Walk | 126.6 | 26.6 | forward; 117.7/125.8 |
| Malfurion Stormrage | run | 7: Walk | 123.8 | 22.9 | forward; 82.3/120.3 |
| Malfurion Stormrage | turn | 30: Malfurion turn | 135.9 | 35.5 | back; 135.7/91.3 |
| Malfurion Stormrage | brake | 31: Malfurion stop | 61.8 | 8.8 | in place; 58.0/27.9 |
| Malfurion Stormrage | jump-squat | 32: Malfurion jumpSquat | 81.1 | 13.7 | down; 11.8/56.5 |
| Malfurion Stormrage | roll-forward | 65: Malfurion rollForward | 194.6 | 94.9 | forward; 112.0/134.9 |
| Malfurion Stormrage | roll-back | 69: Malfurion rollBackward | 201.8 | 96.8 | back; 134.9/111.9 |
| Malfurion Stormrage | spot-dodge | 46: Malfurion spotDodge | 70.7 | 14.4 | in place; 61.6/31.7 |
| Malfurion Stormrage | air-dodge | 27: Malfurion airDodge | 65.8 | 10.7 | in place; 60.5/22.9 |
| Malfurion Stormrage | tech | 47: Malfurion tech | 112.9 | 54.2 | in place; 67.7/112.0 |
| Malfurion Stormrage | tech-forward | 66: Malfurion techForward | 191.9 | 92.2 | forward; 112.1/134.9 |
| Malfurion Stormrage | tech-back | 70: Malfurion techBackward | 195.5 | 94.6 | back; 134.9/111.9 |
| Malfurion Stormrage | get-up | 44: Malfurion getUp | 152.7 | 77.0 | up; 140.9/70.8 |
| Malfurion Stormrage | get-up-forward | 67: Malfurion getUpRollForward | 194.4 | 94.6 | forward; 112.0/134.8 |
| Malfurion Stormrage | get-up-back | 71: Malfurion getUpRollBackward | 198.0 | 96.4 | back; 134.7/111.8 |
| Malfurion Stormrage | get-up-attack | 45: Malfurion getUpAttack | 173.5 | 86.2 | both; 150.5/129.0 |
| Malfurion Stormrage | ledge-get-up | 40: Malfurion ledgeClimb | 245.8 | 36.4 | up; 245.6/115.5 |
| Malfurion Stormrage | ledge-roll | 68: Malfurion ledgeRoll | 191.2 | 92.9 | forward; 111.9/134.8 |
| Malfurion Stormrage | ledge-attack | 41: Malfurion ledgeAttack | 74.0 | 16.1 | both; 68.2/25.6 |
| Medivh | walk | 1: Walk | 102.3 | 25.6 | forward; 98.7/82.2 |
| Medivh | dash | 1: Walk | 101.2 | 25.4 | forward; 98.8/81.1 |
| Medivh | run | 1: Walk | 106.6 | 23.1 | forward; 106.0/106.0 |
| Medivh | turn | 44: Medivh turn | 80.0 | 28.5 | back; 79.2/67.6 |
| Medivh | brake | 45: Medivh stop | 58.1 | 9.4 | in place; 51.9/43.3 |
| Medivh | jump-squat | 46: Medivh jumpSquat | 72.6 | 15.3 | down; 8.8/66.0 |
| Medivh | roll-forward | 79: Medivh rollForward | 174.1 | 86.3 | forward; 105.5/107.2 |
| Medivh | roll-back | 83: Medivh rollBackward | 175.5 | 87.8 | back; 107.2/105.5 |
| Medivh | spot-dodge | 60: Medivh spotDodge | 67.5 | 12.2 | in place; 60.4/61.6 |
| Medivh | air-dodge | 41: Medivh airDodge | 62.3 | 9.1 | in place; 57.0/54.2 |
| Medivh | tech | 61: Medivh tech | 89.2 | 43.0 | in place; 56.3/85.3 |
| Medivh | tech-forward | 80: Medivh techForward | 175.5 | 86.0 | forward; 105.5/107.3 |
| Medivh | tech-back | 84: Medivh techBackward | 175.5 | 87.0 | back; 107.2/105.6 |
| Medivh | get-up | 58: Medivh getUp | 129.2 | 65.9 | up; 119.8/58.9 |
| Medivh | get-up-forward | 81: Medivh getUpRollForward | 174.3 | 86.1 | forward; 105.6/107.3 |
| Medivh | get-up-back | 85: Medivh getUpRollBackward | 175.6 | 87.6 | back; 107.3/105.6 |
| Medivh | get-up-attack | 59: Medivh getUpAttack | 200.1 | 83.7 | both; 120.9/197.6 |
| Medivh | ledge-get-up | 54: Medivh ledgeClimb | 99.7 | 21.8 | up; 68.6/19.8 |
| Medivh | ledge-roll | 82: Medivh ledgeRoll | 175.5 | 85.4 | forward; 105.5/107.3 |
| Medivh | ledge-attack | 55: Medivh ledgeAttack | 120.8 | 22.3 | both; 111.0/33.0 |
| Anub'arak | walk | 2: Walk | 131.4 | 21.7 | forward; 129.5/74.1 |
| Anub'arak | dash | 2: Walk | 130.0 | 21.3 | forward; 128.4/74.0 |
| Anub'arak | run | 2: Walk | 120.9 | 20.4 | forward; 118.7/86.3 |
| Anub'arak | turn | 39: Anubarak turn | 177.1 | 44.6 | back; 140.6/176.6 |
| Anub'arak | brake | 40: Anubarak stop | 110.4 | 19.1 | in place; 108.3/31.7 |
| Anub'arak | jump-squat | 41: Anubarak jumpSquat | 67.9 | 14.2 | down; 39.9/30.1 |
| Anub'arak | roll-forward | 74: Anubarak rollForward | 248.0 | 120.5 | forward; 186.0/245.1 |
| Anub'arak | roll-back | 78: Anubarak rollBackward | 248.4 | 121.3 | back; 245.1/183.1 |
| Anub'arak | spot-dodge | 55: Anubarak spotDodge | 130.6 | 26.5 | in place; 127.3/37.0 |
| Anub'arak | air-dodge | 36: Anubarak airDodge | 121.7 | 20.9 | in place; 119.5/34.8 |
| Anub'arak | tech | 56: Anubarak tech | 112.8 | 47.0 | in place; 111.4/78.4 |
| Anub'arak | tech-forward | 75: Anubarak techForward | 248.1 | 120.7 | forward; 186.4/245.5 |
| Anub'arak | tech-back | 79: Anubarak techBackward | 248.2 | 121.5 | back; 245.5/186.4 |
| Anub'arak | get-up | 53: Anubarak getUp | 181.1 | 72.2 | up; 122.7/180.8 |
| Anub'arak | get-up-forward | 76: Anubarak getUpRollForward | 230.7 | 114.1 | forward; 201.2/178.8 |
| Anub'arak | get-up-back | 80: Anubarak getUpRollBackward | 238.7 | 114.8 | back; 176.0/187.0 |
| Anub'arak | get-up-attack | 54: Anubarak getUpAttack | 179.2 | 81.4 | both; 169.0/128.9 |
| Anub'arak | ledge-get-up | 49: Anubarak ledgeClimb | 170.9 | 32.9 | up; 165.8/69.7 |
| Anub'arak | ledge-roll | 77: Anubarak ledgeRoll | 248.0 | 120.4 | forward; 186.4/245.5 |
| Anub'arak | ledge-attack | 50: Anubarak ledgeAttack | 81.1 | 11.6 | both; 61.7/23.5 |
| Archimonde the Defiler | walk | 2: Walk | 160.6 | 38.6 | forward; 159.9/133.8 |
| Archimonde the Defiler | dash | 2: Walk | 85.3 | 29.0 | forward; 80.4/45.8 |
| Archimonde the Defiler | run | 2: Walk | 158.9 | 39.4 | forward; 124.9/157.3 |
| Archimonde the Defiler | turn | 2: Walk | 40.2 | 10.5 | back; 22.6/20.2 |
| Archimonde the Defiler | brake | 2: Walk | 33.4 | 8.4 | in place; 17.0/15.9 |
| Archimonde the Defiler | jump-squat | 0: Stand | 0.0 | 0.0 | down; 0.0/0.0 |
| Archimonde the Defiler | roll-forward | 2: Walk | 160.7 | 38.5 | forward; 160.2/133.7 |
| Archimonde the Defiler | roll-back | 2: Walk | 160.7 | 38.5 | back; 133.7/160.2 |
| Archimonde the Defiler | spot-dodge | 1: Stand - 2 | 36.8 | 9.0 | in place; 30.1/36.8 |
| Archimonde the Defiler | air-dodge | 1: Stand - 2 | 36.9 | 9.0 | in place; 30.1/36.9 |
| Archimonde the Defiler | tech | 0: Stand | 12.7 | 3.3 | in place; 12.7/8.1 |
| Archimonde the Defiler | tech-forward | 0: Stand | 12.4 | 3.3 | forward; 12.4/8.1 |
| Archimonde the Defiler | tech-back | 0: Stand | 12.4 | 3.3 | back; 8.1/12.4 |
| Archimonde the Defiler | get-up | 1: Stand - 2 | 36.9 | 9.0 | up; 12.1/10.2 |
| Archimonde the Defiler | get-up-forward | 0: Stand | 12.5 | 3.3 | forward; 12.5/8.1 |
| Archimonde the Defiler | get-up-back | 0: Stand | 12.5 | 3.3 | back; 8.1/12.5 |
| Archimonde the Defiler | get-up-attack | 7: Attack - 2 | 219.5 | 68.8 | both; 127.2/166.6 |
| Archimonde the Defiler | ledge-get-up | 2: Walk | 160.5 | 38.5 | up; 96.1/63.2 |
| Archimonde the Defiler | ledge-roll | 2: Walk | 160.7 | 38.6 | forward; 160.2/133.7 |
| Archimonde the Defiler | ledge-attack | 6: Attack - 1 | 195.4 | 72.9 | both; 195.1/126.0 |

Walking/running cadence uses grounded vertices' horizontal excursion twice per cycle. The Lich floats and uses the stock sequence's movement speed. Both measurements use the fighter's displayed model scale.
