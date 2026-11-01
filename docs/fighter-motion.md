# Fighter movement and recovery clips

Generated from the packaged models by `bun wisp view motion --assets DIR` (#171). Each row follows production pose selection over the state's completed frames. Motion is the greatest local vertex travel; body is the mean of each vertex's greatest travel, in world units. The direction column measures vertex travel toward/against the action's direction (vertical for standing up or crouching, horizontal otherwise). Local measurements exclude the simulation's movement across the stage. Clip numbers and names identify sequences of the fighter's model. A zero reveals a held pose. These measurements expose gaps; a stock Walk in a roll row still needs a roll clip.

| Fighter | State | Clip | Motion | Body | Direction; toward/against |
| --- | --- | --- | ---: | ---: | --- |
| Illidan | walk | 119: Locomotion Walk | 139.2 | 20.8 | forward; 129.1/139.0 |
| Illidan | dash | 120: Locomotion Run | 124.5 | 17.6 | forward; 113.1/123.9 |
| Illidan | run | 120: Locomotion Run | 104.9 | 19.1 | forward; 102.8/95.1 |
| Illidan | turn | 89: Stop | 22.3 | 9.4 | back; 10.4/22.3 |
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
| Samuro | walk | 6: Walk | 117.9 | 47.6 | forward; 112.1/115.9 |
| Samuro | dash | 6: Walk | 114.9 | 46.1 | forward; 110.8/112.2 |
| Samuro | run | 6: Walk | 94.0 | 40.3 | forward; 92.6/85.2 |
| Samuro | turn | 15: Recovery stop | 148.3 | 28.1 | back; 56.9/143.0 |
| Samuro | brake | 15: Recovery stop | 148.3 | 28.1 | in place; 143.0/56.9 |
| Samuro | jump-squat | 16: Recovery jumpSquat | 165.2 | 29.7 | down; 111.1/28.0 |
| Samuro | roll-forward | 23: Recovery rollForward | 226.6 | 79.7 | forward; 158.8/118.2 |
| Samuro | roll-back | 24: Recovery rollBackward | 227.0 | 80.9 | back; 118.5/160.4 |
| Samuro | spot-dodge | 25: Recovery spotDodge | 115.2 | 37.9 | in place; 106.3/45.0 |
| Samuro | air-dodge | 17: Recovery airDodge | 116.1 | 27.3 | in place; 111.8/45.6 |
| Samuro | tech | 18: Recovery tech | 150.1 | 65.9 | in place; 125.9/144.4 |
| Samuro | tech-forward | 19: Recovery techForward | 194.1 | 65.3 | forward; 149.1/143.0 |
| Samuro | tech-back | 20: Recovery techBackward | 184.2 | 82.2 | back; 163.2/147.8 |
| Samuro | get-up | 26: Recovery getUp | 175.3 | 73.7 | up; 114.7/76.5 |
| Samuro | get-up-forward | 21: Recovery getUpRollForward | 193.5 | 65.8 | forward; 148.7/143.0 |
| Samuro | get-up-back | 22: Recovery getUpRollBackward | 183.5 | 81.8 | back; 163.3/147.7 |
| Samuro | get-up-attack | 27: Recovery getUpAttack | 227.8 | 90.7 | both; 155.0/217.0 |
| Samuro | ledge-get-up | 28: Recovery ledgeClimb | 136.7 | 86.3 | up; 122.8/60.7 |
| Samuro | ledge-roll | 29: Recovery ledgeRoll | 194.1 | 64.8 | forward; 149.2/142.8 |
| Samuro | ledge-attack | 30: Recovery ledgeAttack | 194.6 | 92.1 | both; 114.1/194.2 |
| Muradin | walk | 7: Walk | 84.3 | 28.2 | forward; 71.0/79.3 |
| Muradin | dash | 7: Walk | 82.9 | 27.6 | forward; 70.9/77.8 |
| Muradin | run | 7: Walk | 77.4 | 23.8 | forward; 69.7/59.5 |
| Muradin | turn | 28: Recovery stop | 20.9 | 8.6 | back; 15.7/13.4 |
| Muradin | brake | 28: Recovery stop | 20.9 | 8.6 | in place; 13.4/15.7 |
| Muradin | jump-squat | 29: Recovery jumpSquat | 30.4 | 11.6 | down; 30.4/13.7 |
| Muradin | roll-forward | 36: Recovery rollForward | 114.3 | 49.0 | forward; 97.0/105.8 |
| Muradin | roll-back | 37: Recovery rollBackward | 114.5 | 49.5 | back; 105.7/97.4 |
| Muradin | spot-dodge | 38: Recovery spotDodge | 38.3 | 14.1 | in place; 25.1/24.0 |
| Muradin | air-dodge | 30: Recovery airDodge | 37.8 | 12.6 | in place; 23.0/21.5 |
| Muradin | tech | 31: Recovery tech | 87.5 | 32.0 | in place; 75.0/48.3 |
| Muradin | tech-forward | 32: Recovery techForward | 109.9 | 43.5 | forward; 71.1/83.5 |
| Muradin | tech-back | 33: Recovery techBackward | 110.8 | 44.1 | back; 69.7/85.8 |
| Muradin | get-up | 39: Recovery getUp | 81.5 | 31.3 | up; 59.0/78.2 |
| Muradin | get-up-forward | 34: Recovery getUpRollForward | 110.0 | 42.8 | forward; 70.9/83.4 |
| Muradin | get-up-back | 35: Recovery getUpRollBackward | 110.9 | 44.1 | back; 69.7/85.8 |
| Muradin | get-up-attack | 40: Recovery getUpAttack | 124.6 | 56.8 | both; 106.3/109.5 |
| Muradin | ledge-get-up | 41: Recovery ledgeClimb | 112.3 | 64.2 | up; 110.7/0.0 |
| Muradin | ledge-roll | 42: Recovery ledgeRoll | 109.9 | 43.3 | forward; 71.0/83.6 |
| Muradin | ledge-attack | 43: Recovery ledgeAttack | 185.5 | 83.0 | both; 110.7/106.4 |
| Maiev | walk | 78: Movement run | 90.1 | 11.4 | forward; 84.2/88.5 |
| Maiev | dash | 2: Walk | 86.2 | 20.2 | forward; 85.4/85.1 |
| Maiev | run | 2: Walk | 77.6 | 25.9 | forward; 57.4/73.3 |
| Maiev | turn | 13: Recovery stop | 25.9 | 13.8 | back; 20.4/18.8 |
| Maiev | brake | 13: Recovery stop | 25.9 | 13.8 | in place; 18.8/20.4 |
| Maiev | jump-squat | 14: Recovery jumpSquat | 42.8 | 19.4 | down; 41.8/22.1 |
| Maiev | roll-forward | 21: Recovery rollForward | 165.5 | 69.1 | forward; 151.6/88.5 |
| Maiev | roll-back | 22: Recovery rollBackward | 165.5 | 68.9 | back; 88.8/151.8 |
| Maiev | spot-dodge | 23: Recovery spotDodge | 62.8 | 20.1 | in place; 50.1/36.3 |
| Maiev | air-dodge | 15: Recovery airDodge | 52.9 | 18.6 | in place; 46.1/32.9 |
| Maiev | tech | 16: Recovery tech | 120.3 | 52.0 | in place; 93.9/71.4 |
| Maiev | tech-forward | 17: Recovery techForward | 157.1 | 61.6 | forward; 105.6/138.9 |
| Maiev | tech-back | 18: Recovery techBackward | 165.6 | 69.6 | back; 105.9/137.5 |
| Maiev | get-up | 24: Recovery getUp | 129.0 | 52.0 | up; 108.2/99.9 |
| Maiev | get-up-forward | 19: Recovery getUpRollForward | 157.4 | 62.1 | forward; 105.5/139.0 |
| Maiev | get-up-back | 20: Recovery getUpRollBackward | 165.6 | 69.6 | back; 106.1/137.5 |
| Maiev | get-up-attack | 25: Recovery getUpAttack | 185.3 | 81.1 | both; 171.8/148.7 |
| Maiev | ledge-get-up | 26: Recovery ledgeClimb | 135.3 | 75.0 | up; 120.3/23.3 |
| Maiev | ledge-roll | 27: Recovery ledgeRoll | 157.1 | 61.0 | forward; 105.5/138.6 |
| Maiev | ledge-attack | 28: Recovery ledgeAttack | 192.7 | 94.7 | both; 170.1/88.9 |
| Kel'Thuzad | walk | 4: Walk | 70.7 | 11.0 | forward; 49.7/20.6 |
| Kel'Thuzad | dash | 4: Walk | 57.3 | 9.2 | forward; 45.0/19.5 |
| Kel'Thuzad | run | 4: Walk | 78.3 | 14.1 | forward; 29.3/35.9 |
| Kel'Thuzad | turn | 11: Recovery stop | 51.6 | 20.2 | back; 27.6/51.4 |
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
| Uther | walk | 12: Walk | 116.5 | 48.6 | forward; 104.4/116.3 |
| Uther | dash | 12: Walk | 116.1 | 47.5 | forward; 104.4/116.0 |
| Uther | run | 12: Walk | 102.4 | 43.4 | forward; 87.9/101.8 |
| Uther | turn | 36: Uther stop | 43.4 | 11.2 | back; 18.5/41.0 |
| Uther | brake | 36: Uther stop | 43.4 | 11.2 | in place; 41.0/18.5 |
| Uther | jump-squat | 37: Uther jumpSquat | 61.6 | 20.0 | down; 26.0/38.5 |
| Uther | roll-forward | 70: Uther rollForward | 191.2 | 108.1 | forward; 142.7/100.4 |
| Uther | roll-back | 74: Uther rollBackward | 191.0 | 106.5 | back; 96.6/142.9 |
| Uther | spot-dodge | 51: Uther spotDodge | 46.7 | 14.8 | in place; 42.3/17.3 |
| Uther | air-dodge | 32: Uther airDodge | 45.7 | 12.4 | in place; 41.9/12.8 |
| Uther | tech | 52: Uther tech | 89.6 | 47.9 | in place; 67.2/88.9 |
| Uther | tech-forward | 71: Uther techForward | 191.7 | 106.5 | forward; 141.8/103.2 |
| Uther | tech-back | 75: Uther techBackward | 191.6 | 105.2 | back; 96.5/142.9 |
| Uther | get-up | 49: Uther getUp | 98.3 | 60.6 | up; 90.7/48.2 |
| Uther | get-up-forward | 72: Uther getUpRollForward | 191.5 | 109.5 | forward; 140.4/103.1 |
| Uther | get-up-back | 76: Uther getUpRollBackward | 191.4 | 106.8 | back; 96.6/142.6 |
| Uther | get-up-attack | 50: Uther getUpAttack | 152.6 | 68.9 | both; 152.5/102.4 |
| Uther | ledge-get-up | 45: Uther ledgeClimb | 187.5 | 34.3 | up; 183.4/75.7 |
| Uther | ledge-roll | 73: Uther ledgeRoll | 192.0 | 108.7 | forward; 140.1/103.6 |
| Uther | ledge-attack | 46: Uther ledgeAttack | 105.8 | 22.6 | both; 90.4/32.4 |
| Mal'Ganis | walk | 5: Walk | 117.4 | 38.1 | forward; 107.5/105.7 |
| Mal'Ganis | dash | 5: Walk | 114.4 | 36.3 | forward; 106.7/105.0 |
| Mal'Ganis | run | 5: Walk | 128.5 | 45.2 | forward; 124.4/110.5 |
| Mal'Ganis | turn | 13: Recovery stop | 32.6 | 12.6 | back; 32.1/23.7 |
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
| Rokhan | walk | 0: Walk | 172.9 | 44.3 | forward; 157.3/166.5 |
| Rokhan | dash | 0: Walk | 173.0 | 35.8 | forward; 156.1/166.4 |
| Rokhan | run | 0: Walk | 126.9 | 42.7 | forward; 106.7/121.9 |
| Rokhan | turn | 15: Recovery stop | 26.6 | 10.8 | back; 18.5/15.0 |
| Rokhan | brake | 15: Recovery stop | 26.6 | 10.8 | in place; 15.0/18.5 |
| Rokhan | jump-squat | 16: Recovery jumpSquat | 30.3 | 13.5 | down; 28.6/18.6 |
| Rokhan | roll-forward | 23: Recovery rollForward | 156.4 | 70.5 | forward; 130.9/147.0 |
| Rokhan | roll-back | 24: Recovery rollBackward | 156.5 | 70.7 | back; 147.2/130.8 |
| Rokhan | spot-dodge | 25: Recovery spotDodge | 64.1 | 20.2 | in place; 35.9/34.6 |
| Rokhan | air-dodge | 17: Recovery airDodge | 57.3 | 20.0 | in place; 31.8/31.9 |
| Rokhan | tech | 18: Recovery tech | 118.1 | 48.2 | in place; 110.1/101.8 |
| Rokhan | tech-forward | 19: Recovery techForward | 161.6 | 71.4 | forward; 114.2/120.4 |
| Rokhan | tech-back | 20: Recovery techBackward | 147.7 | 62.4 | back; 115.9/127.1 |
| Rokhan | get-up | 26: Recovery getUp | 125.7 | 48.6 | up; 68.4/105.4 |
| Rokhan | get-up-forward | 21: Recovery getUpRollForward | 161.6 | 71.4 | forward; 114.4/120.2 |
| Rokhan | get-up-back | 22: Recovery getUpRollBackward | 148.0 | 62.2 | back; 115.8/127.1 |
| Rokhan | get-up-attack | 27: Recovery getUpAttack | 262.8 | 105.0 | both; 222.4/138.1 |
| Rokhan | ledge-get-up | 28: Recovery ledgeClimb | 114.2 | 64.6 | up; 95.6/30.7 |
| Rokhan | ledge-roll | 29: Recovery ledgeRoll | 160.8 | 71.5 | forward; 114.4/120.6 |
| Rokhan | ledge-attack | 30: Recovery ledgeAttack | 265.1 | 117.2 | both; 184.2/115.4 |
| Mannoroth | walk | 1: Walk | 103.7 | 21.6 | forward; 99.4/98.7 |
| Mannoroth | dash | 3: Walk Fast | 149.6 | 39.7 | forward; 145.9/91.5 |
| Mannoroth | run | 3: Walk Fast | 129.0 | 45.3 | forward; 110.7/121.8 |
| Mannoroth | turn | 17: Recovery turn | 361.0 | 95.5 | back; 350.7/301.9 |
| Mannoroth | brake | 18: Recovery stop | 158.7 | 43.6 | in place; 59.0/91.4 |
| Mannoroth | jump-squat | 19: Recovery jumpSquat | 160.1 | 40.0 | down; 159.8/111.8 |
| Mannoroth | roll-forward | 26: Recovery rollForward | 355.9 | 162.4 | forward; 288.0/341.3 |
| Mannoroth | roll-back | 27: Recovery rollBackward | 364.5 | 169.6 | back; 344.8/282.3 |
| Mannoroth | spot-dodge | 28: Recovery spotDodge | 152.1 | 76.0 | in place; 96.9/56.0 |
| Mannoroth | air-dodge | 20: Recovery airDodge | 122.0 | 39.4 | in place; 89.6/54.2 |
| Mannoroth | tech | 21: Recovery tech | 313.1 | 91.0 | in place; 153.7/77.6 |
| Mannoroth | tech-forward | 22: Recovery techForward | 385.6 | 161.6 | forward; 251.6/222.9 |
| Mannoroth | tech-back | 23: Recovery techBackward | 359.6 | 157.1 | back; 240.2/197.4 |
| Mannoroth | get-up | 29: Recovery getUp | 305.9 | 92.5 | up; 168.9/297.3 |
| Mannoroth | get-up-forward | 24: Recovery getUpRollForward | 384.7 | 162.0 | forward; 252.3/223.0 |
| Mannoroth | get-up-back | 25: Recovery getUpRollBackward | 359.6 | 156.8 | back; 240.1/196.7 |
| Mannoroth | get-up-attack | 30: Recovery getUpAttack | 336.6 | 160.5 | both; 231.3/332.0 |
| Mannoroth | ledge-get-up | 31: Recovery ledgeClimb | 227.5 | 95.5 | up; 226.6/141.8 |
| Mannoroth | ledge-roll | 32: Recovery ledgeRoll | 383.6 | 161.1 | forward; 252.3/222.9 |
| Mannoroth | ledge-attack | 33: Recovery ledgeAttack | 231.9 | 118.7 | both; 152.7/83.3 |
| Rexxar | walk | 0: walk | 181.5 | 54.1 | forward; 149.1/180.8 |
| Rexxar | dash | 0: walk | 181.5 | 53.6 | forward; 148.2/180.8 |
| Rexxar | run | 0: walk | 166.8 | 47.1 | forward; 126.0/162.1 |
| Rexxar | turn | 11: Recovery stop | 33.4 | 23.5 | back; 24.2/21.8 |
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
| Arthas | walk | 2: Walk | 90.9 | 24.8 | forward; 89.3/85.8 |
| Arthas | dash | 10: Walk Fast | 98.4 | 35.4 | forward; 83.5/89.3 |
| Arthas | run | 10: Walk Fast | 116.9 | 31.8 | forward; 112.7/101.1 |
| Arthas | turn | 67: Stop | 96.4 | 20.0 | back; 69.3/47.6 |
| Arthas | brake | 67: Stop | 96.4 | 20.0 | in place; 47.6/69.3 |
| Arthas | jump-squat | 68: Jump Squat | 75.6 | 12.9 | down; 68.0/15.2 |
| Arthas | roll-forward | 33: Roll Forward | 253.1 | 58.7 | forward; 50.7/58.8 |
| Arthas | roll-back | 34: Roll Backward | 75.1 | 30.6 | back; 57.3/63.1 |
| Arthas | spot-dodge | 32: Spot Dodge | 73.5 | 30.6 | in place; 16.7/73.5 |
| Arthas | air-dodge | 35: Air Dodge | 162.1 | 20.4 | in place; 44.9/94.2 |
| Arthas | tech | 69: Tech | 222.7 | 64.2 | in place; 101.6/70.8 |
| Arthas | tech-forward | 70: Tech Forward | 221.9 | 64.9 | forward; 101.5/79.0 |
| Arthas | tech-back | 71: Tech Backward | 224.0 | 68.2 | back; 101.0/118.1 |
| Arthas | get-up | 54: Get Up | 193.2 | 96.9 | up; 185.1/60.1 |
| Arthas | get-up-forward | 72: Get Up Roll Forward | 181.7 | 98.6 | forward; 62.9/149.4 |
| Arthas | get-up-back | 73: Get Up Roll Backward | 183.8 | 103.3 | back; 133.5/68.0 |
| Arthas | get-up-attack | 55: Get Up Attack | 226.1 | 99.6 | both; 80.6/213.9 |
| Arthas | ledge-get-up | 57: Ledge Climb | 249.9 | 43.8 | up; 248.9/72.8 |
| Arthas | ledge-roll | 58: Ledge Roll | 244.7 | 53.5 | forward; 79.4/80.3 |
| Arthas | ledge-attack | 59: Ledge Attack | 283.7 | 51.2 | both; 150.1/170.1 |
| Thrall | walk | 15: Walk | 132.7 | 46.3 | forward; 129.7/132.0 |
| Thrall | dash | 15: Walk | 132.9 | 45.9 | forward; 128.9/132.3 |
| Thrall | run | 15: Walk | 129.9 | 38.2 | forward; 112.6/129.8 |
| Thrall | turn | 53: Thrall turn | 146.8 | 42.7 | back; 82.6/146.6 |
| Thrall | brake | 54: Thrall stop | 40.5 | 8.4 | in place; 30.0/17.3 |
| Thrall | jump-squat | 55: Thrall jumpSquat | 72.0 | 29.6 | down; 54.6/24.6 |
| Thrall | roll-forward | 88: Thrall rollForward | 223.4 | 122.9 | forward; 80.7/140.4 |
| Thrall | roll-back | 92: Thrall rollBackward | 224.2 | 122.3 | back; 140.2/80.8 |
| Thrall | spot-dodge | 69: Thrall spotDodge | 51.9 | 15.5 | in place; 25.8/25.8 |
| Thrall | air-dodge | 50: Thrall airDodge | 47.5 | 12.2 | in place; 27.9/20.2 |
| Thrall | tech | 70: Thrall tech | 99.9 | 49.2 | in place; 61.5/97.8 |
| Thrall | tech-forward | 89: Thrall techForward | 223.8 | 122.8 | forward; 80.7/140.5 |
| Thrall | tech-back | 93: Thrall techBackward | 223.9 | 121.9 | back; 140.3/80.9 |
| Thrall | get-up | 67: Thrall getUp | 115.7 | 63.2 | up; 100.2/66.7 |
| Thrall | get-up-forward | 90: Thrall getUpRollForward | 222.8 | 122.7 | forward; 80.6/140.7 |
| Thrall | get-up-back | 94: Thrall getUpRollBackward | 224.2 | 122.2 | back; 140.5/80.7 |
| Thrall | get-up-attack | 68: Thrall getUpAttack | 173.7 | 72.4 | both; 115.2/104.2 |
| Thrall | ledge-get-up | 63: Thrall ledgeClimb | 185.0 | 35.2 | up; 158.8/60.4 |
| Thrall | ledge-roll | 91: Thrall ledgeRoll | 223.9 | 123.1 | forward; 80.7/140.6 |
| Thrall | ledge-attack | 64: Thrall ledgeAttack | 85.4 | 48.1 | both; 51.8/47.3 |
| Jaina | walk | 6: Walk | 104.8 | 21.9 | forward; 95.9/103.3 |
| Jaina | dash | 6: Walk | 86.7 | 21.2 | forward; 80.4/86.4 |
| Jaina | run | 6: Walk | 92.1 | 17.9 | forward; 91.8/83.6 |
| Jaina | turn | 32: Jaina stop | 33.1 | 4.1 | back; 19.2/29.3 |
| Jaina | brake | 32: Jaina stop | 33.1 | 4.1 | in place; 29.3/19.2 |
| Jaina | jump-squat | 33: Jaina jumpSquat | 59.0 | 9.3 | down; 21.2/42.9 |
| Jaina | roll-forward | 66: Jaina rollForward | 130.2 | 76.0 | forward; 86.9/87.9 |
| Jaina | roll-back | 70: Jaina rollBackward | 129.6 | 76.3 | back; 87.8/86.8 |
| Jaina | spot-dodge | 47: Jaina spotDodge | 39.0 | 9.5 | in place; 37.0/15.5 |
| Jaina | air-dodge | 28: Jaina airDodge | 35.5 | 6.5 | in place; 31.7/11.2 |
| Jaina | tech | 48: Jaina tech | 83.1 | 43.3 | in place; 41.3/82.6 |
| Jaina | tech-forward | 67: Jaina techForward | 129.6 | 74.7 | forward; 87.1/87.9 |
| Jaina | tech-back | 71: Jaina techBackward | 132.0 | 77.4 | back; 88.0/86.9 |
| Jaina | get-up | 45: Jaina getUp | 102.7 | 62.4 | up; 100.6/46.2 |
| Jaina | get-up-forward | 68: Jaina getUpRollForward | 130.4 | 76.1 | forward; 86.8/87.8 |
| Jaina | get-up-back | 72: Jaina getUpRollBackward | 130.0 | 77.6 | back; 87.8/86.6 |
| Jaina | get-up-attack | 46: Jaina getUpAttack | 116.0 | 66.0 | both; 101.0/107.8 |
| Jaina | ledge-get-up | 41: Jaina ledgeClimb | 176.4 | 20.1 | up; 176.0/78.2 |
| Jaina | ledge-roll | 69: Jaina ledgeRoll | 128.9 | 74.8 | forward; 87.0/87.8 |
| Jaina | ledge-attack | 42: Jaina ledgeAttack | 76.6 | 11.1 | both; 55.2/26.2 |
| Sylvanas | walk | 8: Walk | 100.4 | 32.0 | forward; 99.4/82.5 |
| Sylvanas | dash | 8: Walk | 100.5 | 31.4 | forward; 99.7/80.0 |
| Sylvanas | run | 8: Walk | 103.0 | 23.6 | forward; 94.8/100.3 |
| Sylvanas | turn | 33: Sylvanas stop | 21.7 | 8.5 | back; 13.0/21.3 |
| Sylvanas | brake | 33: Sylvanas stop | 21.7 | 8.5 | in place; 21.3/13.0 |
| Sylvanas | jump-squat | 34: Sylvanas jumpSquat | 63.9 | 27.0 | down; 56.7/18.8 |
| Sylvanas | roll-forward | 42: Sylvanas rollForward | 142.4 | 66.7 | forward; 70.4/99.2 |
| Sylvanas | roll-back | 43: Sylvanas rollBackward | 139.6 | 67.4 | back; 99.7/70.8 |
| Sylvanas | spot-dodge | 49: Sylvanas spotDodge | 100.8 | 26.3 | in place; 29.9/78.0 |
| Sylvanas | air-dodge | 40: Sylvanas airDodge | 100.9 | 24.6 | in place; 42.2/76.2 |
| Sylvanas | tech | 41: Sylvanas tech | 124.8 | 47.5 | in place; 83.7/82.8 |
| Sylvanas | tech-forward | 44: Sylvanas techForward | 134.6 | 66.3 | forward; 126.2/99.0 |
| Sylvanas | tech-back | 45: Sylvanas techBackward | 143.3 | 59.8 | back; 126.7/107.0 |
| Sylvanas | get-up | 51: Sylvanas getUp | 118.5 | 45.3 | up; 112.6/72.3 |
| Sylvanas | get-up-forward | 46: Sylvanas getUpRollForward | 134.5 | 66.2 | forward; 126.2/99.2 |
| Sylvanas | get-up-back | 47: Sylvanas getUpRollBackward | 143.8 | 59.8 | back; 126.3/106.9 |
| Sylvanas | get-up-attack | 52: Sylvanas getUpAttack | 167.8 | 63.5 | both; 118.5/131.5 |
| Sylvanas | ledge-get-up | 54: Sylvanas ledgeClimb | 136.1 | 75.8 | up; 128.5/23.9 |
| Sylvanas | ledge-roll | 48: Sylvanas ledgeRoll | 135.1 | 66.2 | forward; 126.3/99.3 |
| Sylvanas | ledge-attack | 55: Sylvanas ledgeAttack | 167.2 | 81.4 | both; 99.3/134.8 |
| Cairne | walk | 3: Walk | 109.3 | 40.8 | forward; 100.9/109.1 |
| Cairne | dash | 3: Walk | 105.1 | 35.3 | forward; 100.3/75.0 |
| Cairne | run | 3: Walk | 106.4 | 35.9 | forward; 106.3/89.1 |
| Cairne | turn | 34: Cairne turn | 289.4 | 78.0 | back; 289.3/163.5 |
| Cairne | brake | 35: Cairne stop | 121.0 | 43.2 | in place; 28.8/15.2 |
| Cairne | jump-squat | 36: Cairne jumpSquat | 64.3 | 17.5 | down; 26.1/43.2 |
| Cairne | roll-forward | 69: Cairne rollForward | 284.7 | 130.8 | forward; 275.2/193.7 |
| Cairne | roll-back | 70: Cairne rollBackward | 285.2 | 131.2 | back; 193.9/275.2 |
| Cairne | spot-dodge | 50: Cairne spotDodge | 134.8 | 53.5 | in place; 31.5/17.0 |
| Cairne | air-dodge | 32: Cairne airDodge | 88.1 | 17.5 | in place; 33.5/18.8 |
| Cairne | tech | 51: Cairne tech | 135.2 | 53.5 | in place; 88.2/98.0 |
| Cairne | tech-forward | 71: Cairne techForward | 285.3 | 131.4 | forward; 274.8/193.9 |
| Cairne | tech-back | 72: Cairne techBackward | 285.3 | 131.4 | back; 193.9/274.8 |
| Cairne | get-up | 48: Cairne getUp | 199.0 | 87.8 | up; 166.6/199.0 |
| Cairne | get-up-forward | 73: Cairne getUpRollForward | 285.3 | 131.4 | forward; 275.3/193.8 |
| Cairne | get-up-back | 74: Cairne getUpRollBackward | 285.6 | 131.1 | back; 193.7/275.3 |
| Cairne | get-up-attack | 49: Cairne getUpAttack | 357.5 | 115.0 | both; 297.6/167.4 |
| Cairne | ledge-get-up | 44: Cairne ledgeClimb | 113.1 | 45.4 | up; 110.9/59.8 |
| Cairne | ledge-roll | 75: Cairne ledgeRoll | 285.5 | 131.1 | forward; 275.0/193.8 |
| Cairne | ledge-attack | 45: Cairne ledgeAttack | 355.0 | 88.7 | both; 352.5/105.4 |
| Chen | walk | 0: walk | 116.8 | 40.1 | forward; 116.4/112.8 |
| Chen | dash | 0: walk | 116.7 | 38.9 | forward; 116.3/112.1 |
| Chen | run | 0: walk | 124.1 | 34.8 | forward; 123.9/110.6 |
| Chen | turn | 36: Chen stop | 57.0 | 25.0 | back; 11.0/36.2 |
| Chen | brake | 36: Chen stop | 57.0 | 25.0 | in place; 36.2/11.0 |
| Chen | jump-squat | 37: Chen jumpSquat | 39.1 | 17.6 | down; 31.1/34.0 |
| Chen | roll-forward | 59: Chen rollForward | 305.7 | 123.3 | forward; 143.7/305.6 |
| Chen | roll-back | 63: Chen rollBackward | 305.5 | 123.2 | back; 305.1/142.3 |
| Chen | spot-dodge | 51: Chen spotDodge | 87.7 | 31.3 | in place; 54.7/33.8 |
| Chen | air-dodge | 32: Chen airDodge | 59.9 | 16.9 | in place; 49.0/25.8 |
| Chen | tech | 52: Chen tech | 131.3 | 62.5 | in place; 90.3/59.9 |
| Chen | tech-forward | 60: Chen techForward | 304.9 | 123.4 | forward; 144.7/304.5 |
| Chen | tech-back | 64: Chen techBackward | 304.8 | 123.2 | back; 304.5/143.4 |
| Chen | get-up | 49: Chen getUp | 88.2 | 44.2 | up; 87.5/71.0 |
| Chen | get-up-forward | 61: Chen getUpRollForward | 305.8 | 123.4 | forward; 143.7/305.7 |
| Chen | get-up-back | 65: Chen getUpRollBackward | 305.6 | 123.2 | back; 305.2/142.5 |
| Chen | get-up-attack | 50: Chen getUpAttack | 277.9 | 58.2 | both; 152.6/277.8 |
| Chen | ledge-get-up | 45: Chen ledgeClimb | 296.6 | 43.8 | up; 209.7/165.1 |
| Chen | ledge-roll | 62: Chen ledgeRoll | 305.9 | 123.4 | forward; 143.7/305.5 |
| Chen | ledge-attack | 46: Chen ledgeAttack | 64.0 | 16.6 | both; 52.8/18.0 |
| Peon | walk | 1: Walk | 81.6 | 32.3 | forward; 73.3/81.5 |
| Peon | dash | 1: Walk | 81.2 | 32.0 | forward; 71.5/81.1 |
| Peon | run | 1: Walk | 61.4 | 26.0 | forward; 61.3/60.5 |
| Peon | turn | 43: Peon stop | 17.2 | 7.5 | back; 13.6/8.7 |
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
| Gazlowe | walk | 0: Walk | 97.4 | 30.3 | forward; 94.3/94.7 |
| Gazlowe | dash | 0: Walk | 97.5 | 29.8 | forward; 94.2/93.8 |
| Gazlowe | run | 0: Walk | 99.8 | 27.3 | forward; 99.6/78.7 |
| Gazlowe | turn | 54: Tinker stop | 32.8 | 14.9 | back; 10.6/25.1 |
| Gazlowe | brake | 54: Tinker stop | 32.8 | 14.9 | in place; 25.1/10.6 |
| Gazlowe | jump-squat | 55: Tinker jumpSquat | 60.7 | 16.6 | down; 40.5/54.9 |
| Gazlowe | roll-forward | 65: Tinker rollForward | 172.0 | 81.7 | forward; 128.7/163.0 |
| Gazlowe | roll-back | 66: Tinker rollBackward | 172.0 | 81.4 | back; 162.9/127.8 |
| Gazlowe | spot-dodge | 63: Tinker spotDodge | 92.1 | 28.8 | in place; 14.4/60.0 |
| Gazlowe | air-dodge | 64: Tinker airDodge | 90.7 | 21.4 | in place; 11.3/64.9 |
| Gazlowe | tech | 75: Tinker tech | 137.8 | 57.1 | in place; 90.1/105.0 |
| Gazlowe | tech-forward | 67: Tinker techForward | 199.5 | 86.0 | forward; 94.9/191.2 |
| Gazlowe | tech-back | 68: Tinker techBackward | 199.0 | 86.0 | back; 191.7/95.7 |
| Gazlowe | get-up | 74: Tinker getUp | 126.1 | 58.1 | up; 125.5/92.8 |
| Gazlowe | get-up-forward | 69: Tinker getUpRollForward | 199.7 | 85.9 | forward; 95.1/191.2 |
| Gazlowe | get-up-back | 70: Tinker getUpRollBackward | 198.8 | 86.0 | back; 191.7/95.7 |
| Gazlowe | get-up-attack | 76: Tinker getUpAttack | 208.3 | 77.3 | both; 96.5/175.0 |
| Gazlowe | ledge-get-up | 78: Tinker ledgeClimb | 149.0 | 75.6 | up; 125.2/9.4 |
| Gazlowe | ledge-roll | 71: Tinker ledgeRoll | 199.7 | 85.9 | forward; 95.1/191.2 |
| Gazlowe | ledge-attack | 79: Tinker ledgeAttack | 153.4 | 79.3 | both; 124.5/22.6 |
| Kael'thas | walk | 2: Walk | 92.3 | 25.1 | forward; 90.7/92.2 |
| Kael'thas | dash | 2: Walk | 86.9 | 24.2 | forward; 75.2/86.5 |
| Kael'thas | run | 2: Walk | 76.8 | 20.2 | forward; 68.1/76.4 |
| Kael'thas | turn | 34: Kaelthas stop | 83.3 | 10.3 | back; 27.1/74.9 |
| Kael'thas | brake | 34: Kaelthas stop | 83.3 | 10.3 | in place; 74.9/27.1 |
| Kael'thas | jump-squat | 35: Kaelthas jumpSquat | 55.2 | 13.5 | down; 7.1/41.5 |
| Kael'thas | roll-forward | 68: Kaelthas rollForward | 173.0 | 80.4 | forward; 138.4/96.5 |
| Kael'thas | roll-back | 72: Kaelthas rollBackward | 173.6 | 79.4 | back; 102.5/138.4 |
| Kael'thas | spot-dodge | 49: Kaelthas spotDodge | 92.8 | 11.7 | in place; 79.6/29.8 |
| Kael'thas | air-dodge | 30: Kaelthas airDodge | 87.3 | 9.0 | in place; 77.9/28.3 |
| Kael'thas | tech | 50: Kaelthas tech | 94.2 | 40.3 | in place; 75.8/83.0 |
| Kael'thas | tech-forward | 69: Kaelthas techForward | 172.7 | 78.5 | forward; 138.4/102.6 |
| Kael'thas | tech-back | 73: Kaelthas techBackward | 173.6 | 78.9 | back; 102.6/138.4 |
| Kael'thas | get-up | 47: Kaelthas getUp | 128.7 | 63.4 | up; 104.7/86.2 |
| Kael'thas | get-up-forward | 70: Kaelthas getUpRollForward | 166.4 | 90.6 | forward; 145.9/155.9 |
| Kael'thas | get-up-back | 74: Kaelthas getUpRollBackward | 165.8 | 88.1 | back; 158.1/145.8 |
| Kael'thas | get-up-attack | 48: Kaelthas getUpAttack | 160.8 | 76.6 | both; 141.2/136.0 |
| Kael'thas | ledge-get-up | 43: Kaelthas ledgeClimb | 114.3 | 20.7 | up; 108.5/8.9 |
| Kael'thas | ledge-roll | 71: Kaelthas ledgeRoll | 173.0 | 78.2 | forward; 138.3/102.3 |
| Kael'thas | ledge-attack | 44: Kaelthas ledgeAttack | 68.1 | 11.1 | both; 55.2/19.3 |
| Mrgl&Grgl | walk | 1: Walk | 126.4 | 32.7 | forward; 117.8/124.4 |
| Mrgl&Grgl | dash | 1: Walk | 125.9 | 31.3 | forward; 112.8/123.7 |
| Mrgl&Grgl | run | 1: Walk | 110.4 | 34.5 | forward; 109.3/93.9 |
| Mrgl&Grgl | turn | 32: Murloc stop | 67.8 | 15.4 | back; 49.8/43.8 |
| Mrgl&Grgl | brake | 32: Murloc stop | 67.8 | 15.4 | in place; 43.8/49.8 |
| Mrgl&Grgl | jump-squat | 33: Murloc jumpSquat | 36.8 | 13.0 | down; 22.0/33.3 |
| Mrgl&Grgl | roll-forward | 66: Murloc rollForward | 167.4 | 71.9 | forward; 71.6/157.4 |
| Mrgl&Grgl | roll-back | 70: Murloc rollBackward | 166.3 | 71.1 | back; 157.3/71.6 |
| Mrgl&Grgl | spot-dodge | 47: Murloc spotDodge | 77.2 | 23.0 | in place; 46.2/59.5 |
| Mrgl&Grgl | air-dodge | 28: Murloc airDodge | 65.4 | 13.9 | in place; 45.5/55.4 |
| Mrgl&Grgl | tech | 48: Murloc tech | 75.3 | 31.5 | in place; 24.5/47.5 |
| Mrgl&Grgl | tech-forward | 67: Murloc techForward | 167.5 | 71.5 | forward; 71.5/157.5 |
| Mrgl&Grgl | tech-back | 71: Murloc techBackward | 167.5 | 71.4 | back; 157.5/71.6 |
| Mrgl&Grgl | get-up | 45: Murloc getUp | 111.1 | 44.9 | up; 73.6/77.5 |
| Mrgl&Grgl | get-up-forward | 68: Murloc getUpRollForward | 147.7 | 60.7 | forward; 123.7/94.2 |
| Mrgl&Grgl | get-up-back | 72: Murloc getUpRollBackward | 128.4 | 60.6 | back; 98.8/121.6 |
| Mrgl&Grgl | get-up-attack | 46: Murloc getUpAttack | 134.6 | 49.8 | both; 133.3/39.7 |
| Mrgl&Grgl | ledge-get-up | 41: Murloc ledgeClimb | 107.1 | 26.3 | up; 76.0/89.8 |
| Mrgl&Grgl | ledge-roll | 69: Murloc ledgeRoll | 167.3 | 71.7 | forward; 71.6/157.2 |
| Mrgl&Grgl | ledge-attack | 42: Murloc ledgeAttack | 77.2 | 15.7 | both; 22.0/75.7 |
| Grom | walk | 5: Walk | 121.9 | 50.4 | forward; 118.7/111.2 |
| Grom | dash | 5: Walk | 121.9 | 49.0 | forward; 118.7/109.6 |
| Grom | run | 5: Walk | 135.2 | 46.2 | forward; 134.4/132.1 |
| Grom | turn | 39: Grom stop | 107.4 | 18.9 | back; 28.8/104.3 |
| Grom | brake | 39: Grom stop | 107.4 | 18.9 | in place; 104.3/28.8 |
| Grom | jump-squat | 40: Grom jumpSquat | 70.9 | 20.1 | down; 12.7/49.3 |
| Grom | roll-forward | 73: Grom rollForward | 252.1 | 108.6 | forward; 182.0/114.2 |
| Grom | roll-back | 77: Grom rollBackward | 251.3 | 99.7 | back; 110.7/187.9 |
| Grom | spot-dodge | 54: Grom spotDodge | 116.7 | 18.1 | in place; 111.9/42.8 |
| Grom | air-dodge | 35: Grom airDodge | 113.2 | 15.8 | in place; 109.1/37.0 |
| Grom | tech | 55: Grom tech | 157.0 | 48.5 | in place; 155.3/54.9 |
| Grom | tech-forward | 74: Grom techForward | 251.1 | 104.1 | forward; 188.1/110.8 |
| Grom | tech-back | 78: Grom techBackward | 250.8 | 104.0 | back; 110.9/188.0 |
| Grom | get-up | 52: Grom getUp | 194.8 | 77.7 | up; 101.4/87.4 |
| Grom | get-up-forward | 75: Grom getUpRollForward | 258.9 | 113.1 | forward; 146.9/253.8 |
| Grom | get-up-back | 79: Grom getUpRollBackward | 258.4 | 110.2 | back; 253.1/138.5 |
| Grom | get-up-attack | 53: Grom getUpAttack | 204.7 | 85.4 | both; 103.0/188.5 |
| Grom | ledge-get-up | 48: Grom ledgeClimb | 112.9 | 31.5 | up; 112.9/61.4 |
| Grom | ledge-roll | 76: Grom ledgeRoll | 253.0 | 106.6 | forward; 187.6/117.0 |
| Grom | ledge-attack | 49: Grom ledgeAttack | 86.3 | 20.0 | both; 33.0/13.0 |
| Malfurion | walk | 7: Walk | 126.8 | 28.0 | forward; 117.7/126.1 |
| Malfurion | dash | 7: Walk | 126.6 | 26.6 | forward; 117.7/125.8 |
| Malfurion | run | 7: Walk | 123.8 | 22.9 | forward; 82.3/120.3 |
| Malfurion | turn | 31: Malfurion stop | 61.8 | 8.8 | back; 27.9/58.0 |
| Malfurion | brake | 31: Malfurion stop | 61.8 | 8.8 | in place; 58.0/27.9 |
| Malfurion | jump-squat | 32: Malfurion jumpSquat | 81.1 | 13.7 | down; 11.8/56.5 |
| Malfurion | roll-forward | 65: Malfurion rollForward | 194.6 | 94.9 | forward; 112.0/134.9 |
| Malfurion | roll-back | 69: Malfurion rollBackward | 201.8 | 96.8 | back; 134.9/111.9 |
| Malfurion | spot-dodge | 46: Malfurion spotDodge | 70.7 | 14.4 | in place; 61.6/31.7 |
| Malfurion | air-dodge | 27: Malfurion airDodge | 65.8 | 10.7 | in place; 60.5/22.9 |
| Malfurion | tech | 47: Malfurion tech | 112.9 | 54.2 | in place; 67.7/112.0 |
| Malfurion | tech-forward | 66: Malfurion techForward | 191.9 | 92.2 | forward; 112.1/134.9 |
| Malfurion | tech-back | 70: Malfurion techBackward | 195.5 | 94.6 | back; 134.9/111.9 |
| Malfurion | get-up | 44: Malfurion getUp | 152.7 | 77.0 | up; 140.9/70.8 |
| Malfurion | get-up-forward | 67: Malfurion getUpRollForward | 194.4 | 94.6 | forward; 112.0/134.8 |
| Malfurion | get-up-back | 71: Malfurion getUpRollBackward | 198.0 | 96.4 | back; 134.7/111.8 |
| Malfurion | get-up-attack | 45: Malfurion getUpAttack | 173.5 | 86.2 | both; 150.5/129.0 |
| Malfurion | ledge-get-up | 40: Malfurion ledgeClimb | 245.8 | 36.4 | up; 245.6/115.5 |
| Malfurion | ledge-roll | 68: Malfurion ledgeRoll | 191.2 | 92.9 | forward; 111.9/134.8 |
| Malfurion | ledge-attack | 41: Malfurion ledgeAttack | 74.0 | 16.1 | both; 68.2/25.6 |
| Medivh | walk | 1: Walk | 102.3 | 25.6 | forward; 98.7/82.2 |
| Medivh | dash | 1: Walk | 101.2 | 25.4 | forward; 98.8/81.1 |
| Medivh | run | 1: Walk | 106.6 | 23.1 | forward; 106.0/106.0 |
| Medivh | turn | 45: Medivh stop | 58.1 | 9.4 | back; 43.3/51.9 |
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
| Anub'arak | walk | 2: Walk | 131.3 | 21.7 | forward; 129.4/74.1 |
| Anub'arak | dash | 2: Walk | 131.0 | 21.2 | forward; 129.3/73.9 |
| Anub'arak | run | 2: Walk | 108.1 | 19.8 | forward; 97.7/105.7 |
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
| Lady Vashj | walk | 1: Walk | 44.7 | 13.3 | forward; 41.5/44.6 |
| Lady Vashj | dash | 78: Lady Vashj run | 108.5 | 31.0 | forward; 72.8/102.8 |
| Lady Vashj | run | 78: Lady Vashj run | 158.7 | 31.6 | forward; 158.7/32.4 |
| Lady Vashj | turn | 39: Lady Vashj turn | 136.4 | 33.4 | back; 135.2/114.0 |
| Lady Vashj | brake | 40: Lady Vashj stop | 158.9 | 75.1 | in place; 118.1/118.5 |
| Lady Vashj | jump-squat | 41: Lady Vashj jumpSquat | 125.7 | 70.7 | down; 82.1/87.2 |
| Lady Vashj | roll-forward | 71: Lady Vashj rollForward | 273.1 | 120.0 | forward; 247.7/230.4 |
| Lady Vashj | roll-back | 75: Lady Vashj rollBackward | 262.8 | 63.2 | back; 220.2/251.3 |
| Lady Vashj | spot-dodge | 53: Lady Vashj spotDodge | 164.4 | 93.1 | in place; 162.4/38.4 |
| Lady Vashj | air-dodge | 36: Lady Vashj airDodge | 239.6 | 61.7 | in place; 200.5/29.3 |
| Lady Vashj | tech | 54: Lady Vashj tech | 169.2 | 82.7 | in place; 164.2/128.8 |
| Lady Vashj | tech-forward | 72: Lady Vashj techForward | 273.2 | 120.0 | forward; 247.7/230.4 |
| Lady Vashj | tech-back | 76: Lady Vashj techBackward | 261.3 | 63.3 | back; 220.2/250.5 |
| Lady Vashj | get-up | 52: Lady Vashj getUp | 183.3 | 93.4 | up; 105.5/75.3 |
| Lady Vashj | get-up-forward | 73: Lady Vashj getUpRollForward | 273.2 | 120.0 | forward; 247.7/230.4 |
| Lady Vashj | get-up-back | 77: Lady Vashj getUpRollBackward | 261.3 | 63.2 | back; 220.2/250.4 |
| Lady Vashj | get-up-attack | 31: Lady Vashj getUpAttack | 320.7 | 138.5 | both; 222.5/204.3 |
| Lady Vashj | ledge-get-up | 49: Lady Vashj ledgeClimb | 293.9 | 103.8 | up; 263.1/168.1 |
| Lady Vashj | ledge-roll | 74: Lady Vashj ledgeRoll | 273.2 | 120.0 | forward; 247.7/230.5 |
| Lady Vashj | ledge-attack | 32: Lady Vashj ledgeAttack | 262.8 | 103.0 | both; 262.8/101.2 |
| Archimonde | walk | 2: Walk | 160.7 | 38.6 | forward; 160.1/133.8 |
| Archimonde | dash | 2: Walk | 87.3 | 29.9 | forward; 83.2/47.7 |
| Archimonde | run | 2: Walk | 180.8 | 40.5 | forward; 159.6/179.3 |
| Archimonde | turn | 11: Recovery turn | 254.1 | 56.8 | back; 131.6/254.1 |
| Archimonde | brake | 12: Recovery stop | 48.0 | 34.1 | in place; 25.0/29.9 |
| Archimonde | jump-squat | 13: Recovery jumpSquat | 59.9 | 31.6 | down; 58.9/36.2 |
| Archimonde | roll-forward | 20: Recovery rollForward | 297.1 | 128.9 | forward; 283.7/145.7 |
| Archimonde | roll-back | 21: Recovery rollBackward | 297.0 | 129.7 | back; 145.6/283.3 |
| Archimonde | spot-dodge | 22: Recovery spotDodge | 111.2 | 52.5 | in place; 74.7/50.6 |
| Archimonde | air-dodge | 14: Recovery airDodge | 75.4 | 31.2 | in place; 67.4/44.8 |
| Archimonde | tech | 15: Recovery tech | 194.1 | 99.9 | in place; 137.8/85.4 |
| Archimonde | tech-forward | 16: Recovery techForward | 250.6 | 141.8 | forward; 151.1/220.0 |
| Archimonde | tech-back | 17: Recovery techBackward | 283.9 | 149.0 | back; 145.3/216.6 |
| Archimonde | get-up | 23: Recovery getUp | 194.0 | 98.0 | up; 173.1/188.2 |
| Archimonde | get-up-forward | 18: Recovery getUpRollForward | 250.6 | 140.3 | forward; 151.0/219.7 |
| Archimonde | get-up-back | 19: Recovery getUpRollBackward | 285.1 | 148.8 | back; 145.4/217.1 |
| Archimonde | get-up-attack | 24: Recovery getUpAttack | 255.5 | 149.2 | both; 212.8/230.5 |
| Archimonde | ledge-get-up | 25: Recovery ledgeClimb | 201.5 | 127.5 | up; 197.4/73.2 |
| Archimonde | ledge-roll | 26: Recovery ledgeRoll | 250.6 | 141.1 | forward; 151.0/219.8 |
| Archimonde | ledge-attack | 27: Recovery ledgeAttack | 257.2 | 147.9 | both; 192.4/103.6 |
| Tyrande | walk | 8: Walk | 100.0 | 45.7 | forward; 99.0/80.6 |
| Tyrande | dash | 84: Movement run | 56.6 | 14.3 | forward; 55.5/56.0 |
| Tyrande | run | 84: Movement run | 56.3 | 20.2 | forward; 44.8/47.2 |
| Tyrande | turn | 38: Tyrande stop | 25.3 | 11.4 | back; 12.9/25.0 |
| Tyrande | brake | 38: Tyrande stop | 25.3 | 11.4 | in place; 25.0/12.9 |
| Tyrande | jump-squat | 39: Tyrande jumpSquat | 78.9 | 44.1 | down; 70.5/6.0 |
| Tyrande | roll-forward | 47: Tyrande rollForward | 188.7 | 92.4 | forward; 62.2/118.0 |
| Tyrande | roll-back | 48: Tyrande rollBackward | 187.7 | 91.9 | back; 115.2/58.6 |
| Tyrande | spot-dodge | 54: Tyrande spotDodge | 148.7 | 60.5 | in place; 64.4/110.5 |
| Tyrande | air-dodge | 45: Tyrande airDodge | 143.9 | 64.6 | in place; 65.6/112.0 |
| Tyrande | tech | 46: Tyrande tech | 143.3 | 64.6 | in place; 82.0/79.2 |
| Tyrande | tech-forward | 49: Tyrande techForward | 159.0 | 82.2 | forward; 157.9/134.9 |
| Tyrande | tech-back | 50: Tyrande techBackward | 171.7 | 84.6 | back; 162.8/112.0 |
| Tyrande | get-up | 56: Tyrande getUp | 139.0 | 63.0 | up; 130.0/73.4 |
| Tyrande | get-up-forward | 51: Tyrande getUpRollForward | 158.9 | 82.2 | forward; 158.1/134.8 |
| Tyrande | get-up-back | 52: Tyrande getUpRollBackward | 171.5 | 84.6 | back; 162.9/111.5 |
| Tyrande | get-up-attack | 57: Tyrande getUpAttack | 178.5 | 98.0 | both; 144.3/126.0 |
| Tyrande | ledge-get-up | 59: Tyrande ledgeClimb | 148.7 | 90.0 | up; 137.6/0.0 |
| Tyrande | ledge-roll | 53: Tyrande ledgeRoll | 159.1 | 82.1 | forward; 157.9/134.4 |
| Tyrande | ledge-attack | 60: Tyrande ledgeAttack | 187.4 | 126.2 | both; 135.2/154.0 |
| Stitches | walk | 1: Walk | 155.6 | 42.4 | forward; 149.7/143.4 |
| Stitches | dash | 1: Walk | 154.2 | 36.4 | forward; 146.6/71.6 |
| Stitches | run | 1: Walk | 166.1 | 37.7 | forward; 139.9/164.9 |
| Stitches | turn | 1: Walk | 84.2 | 12.9 | back; 84.0/44.2 |
| Stitches | brake | 1: Walk | 62.5 | 10.3 | in place; 61.8/38.2 |
| Stitches | jump-squat | 0: Stand - 1 | 0.0 | 0.0 | down; 0.0/0.0 |
| Stitches | roll-forward | 1: Walk | 155.5 | 42.3 | forward; 149.8/143.5 |
| Stitches | roll-back | 1: Walk | 155.5 | 42.3 | back; 143.5/149.8 |
| Stitches | spot-dodge | 7: Stand - 3 | 359.3 | 60.1 | in place; 137.3/203.2 |
| Stitches | air-dodge | 7: Stand - 3 | 360.0 | 60.3 | in place; 138.6/203.2 |
| Stitches | tech | 0: Stand - 1 | 57.1 | 12.6 | in place; 21.1/19.6 |
| Stitches | tech-forward | 0: Stand - 1 | 57.1 | 12.6 | forward; 21.1/19.6 |
| Stitches | tech-back | 0: Stand - 1 | 57.1 | 12.6 | back; 19.6/21.1 |
| Stitches | get-up | 7: Stand - 3 | 359.9 | 60.2 | up; 323.1/90.9 |
| Stitches | get-up-forward | 0: Stand - 1 | 57.1 | 12.6 | forward; 21.1/19.6 |
| Stitches | get-up-back | 0: Stand - 1 | 57.1 | 12.6 | back; 19.6/21.1 |
| Stitches | get-up-attack | 4: Attack -2 | 397.1 | 74.2 | both; 356.8/207.5 |
| Stitches | ledge-get-up | 1: Walk | 155.1 | 42.3 | up; 84.3/58.4 |
| Stitches | ledge-roll | 1: Walk | 155.5 | 42.4 | forward; 149.4/143.6 |
| Stitches | ledge-attack | 2: Attack | 371.8 | 93.9 | both; 317.8/325.1 |
| Akama (WIP) | walk | 2: Walk | 110.5 | 52.0 | forward; 88.7/107.4 |
| Akama (WIP) | dash | 2: Walk | 109.3 | 50.4 | forward; 87.9/105.6 |
| Akama (WIP) | run | 2: Walk | 118.4 | 44.6 | forward; 106.5/118.4 |
| Akama (WIP) | turn | 2: Walk | 54.6 | 23.1 | back; 35.4/39.2 |
| Akama (WIP) | brake | 2: Walk | 58.1 | 25.0 | in place; 45.5/40.3 |
| Akama (WIP) | jump-squat | 0: Stand | 0.0 | 0.0 | down; 0.0/0.0 |
| Akama (WIP) | roll-forward | 2: Walk | 110.5 | 51.9 | forward; 88.7/107.3 |
| Akama (WIP) | roll-back | 2: Walk | 110.5 | 51.9 | back; 107.3/88.7 |
| Akama (WIP) | spot-dodge | 9: Stand - Var3 | 111.7 | 19.2 | in place; 28.8/64.7 |
| Akama (WIP) | air-dodge | 9: Stand - Var3 | 112.1 | 19.2 | in place; 28.9/64.7 |
| Akama (WIP) | tech | 0: Stand | 10.5 | 1.8 | in place; 8.0/1.0 |
| Akama (WIP) | tech-forward | 0: Stand | 10.5 | 1.8 | forward; 8.0/1.0 |
| Akama (WIP) | tech-back | 0: Stand | 10.5 | 1.8 | back; 1.0/8.0 |
| Akama (WIP) | get-up | 9: Stand - Var3 | 112.1 | 19.2 | up; 98.6/12.5 |
| Akama (WIP) | get-up-forward | 0: Stand | 10.5 | 1.8 | forward; 8.0/1.0 |
| Akama (WIP) | get-up-back | 0: Stand | 10.5 | 1.8 | back; 1.0/8.0 |
| Akama (WIP) | get-up-attack | 6: Attack -1HVar2 | 176.4 | 56.1 | both; 122.9/118.1 |
| Akama (WIP) | ledge-get-up | 2: Walk | 110.3 | 51.9 | up; 65.3/86.5 |
| Akama (WIP) | ledge-roll | 2: Walk | 110.5 | 52.0 | forward; 88.7/107.4 |
| Akama (WIP) | ledge-attack | 5: Attack - 1HVar1 | 271.2 | 75.0 | both; 127.9/191.3 |
| Ragnaros (WIP) | walk | 2: Walk | 105.4 | 40.8 | forward; 63.3/96.6 |
| Ragnaros (WIP) | dash | 2: Walk | 104.8 | 39.7 | forward; 63.2/95.7 |
| Ragnaros (WIP) | run | 2: Walk | 159.3 | 49.7 | forward; 145.1/131.5 |
| Ragnaros (WIP) | turn | 2: Walk | 30.7 | 7.5 | back; 9.5/26.1 |
| Ragnaros (WIP) | brake | 2: Walk | 33.3 | 8.6 | in place; 28.5/9.5 |
| Ragnaros (WIP) | jump-squat | 0: Stand | 0.0 | 0.0 | down; 0.0/0.0 |
| Ragnaros (WIP) | roll-forward | 2: Walk | 105.6 | 41.2 | forward; 63.6/97.1 |
| Ragnaros (WIP) | roll-back | 2: Walk | 105.6 | 41.2 | back; 97.1/63.6 |
| Ragnaros (WIP) | spot-dodge | 8: Stand Ready | 22.6 | 6.3 | in place; 15.6/16.4 |
| Ragnaros (WIP) | air-dodge | 8: Stand Ready | 22.7 | 6.4 | in place; 15.8/16.4 |
| Ragnaros (WIP) | tech | 0: Stand | 22.6 | 6.4 | in place; 16.1/16.4 |
| Ragnaros (WIP) | tech-forward | 0: Stand | 22.6 | 6.4 | forward; 16.0/16.4 |
| Ragnaros (WIP) | tech-back | 0: Stand | 22.6 | 6.4 | back; 16.4/16.0 |
| Ragnaros (WIP) | get-up | 8: Stand Ready | 22.7 | 6.3 | up; 22.2/12.3 |
| Ragnaros (WIP) | get-up-forward | 0: Stand | 22.6 | 6.4 | forward; 16.0/16.4 |
| Ragnaros (WIP) | get-up-back | 0: Stand | 22.6 | 6.4 | back; 16.4/16.0 |
| Ragnaros (WIP) | get-up-attack | 4: Attack - 2 | 199.5 | 66.9 | both; 103.5/196.6 |
| Ragnaros (WIP) | ledge-get-up | 2: Walk | 105.7 | 41.1 | up; 50.9/61.6 |
| Ragnaros (WIP) | ledge-roll | 2: Walk | 105.6 | 41.2 | forward; 63.6/97.7 |
| Ragnaros (WIP) | ledge-attack | 3: Attack | 220.7 | 66.1 | both; 129.6/220.5 |
| Alchemist (WIP) | walk | 4: Walk 1 | 114.4 | 31.2 | forward; 107.5/108.9 |
| Alchemist (WIP) | dash | 4: Walk 1 | 100.6 | 29.9 | forward; 91.9/93.0 |
| Alchemist (WIP) | run | 4: Walk 1 | 98.1 | 38.0 | forward; 82.8/57.1 |
| Alchemist (WIP) | turn | 4: Walk 1 | 58.1 | 20.6 | back; 29.5/54.8 |
| Alchemist (WIP) | brake | 4: Walk 1 | 66.1 | 22.8 | in place; 60.9/37.5 |
| Alchemist (WIP) | jump-squat | 0: Stand | 0.0 | 0.0 | down; 0.0/0.0 |
| Alchemist (WIP) | roll-forward | 4: Walk 1 | 114.4 | 31.1 | forward; 107.0/108.7 |
| Alchemist (WIP) | roll-back | 4: Walk 1 | 114.4 | 31.1 | back; 108.7/107.0 |
| Alchemist (WIP) | spot-dodge | 2: Stand 3 | 86.2 | 29.2 | in place; 85.9/31.4 |
| Alchemist (WIP) | air-dodge | 2: Stand 3 | 86.2 | 29.3 | in place; 85.9/31.4 |
| Alchemist (WIP) | tech | 0: Stand | 10.8 | 5.3 | in place; 3.7/3.2 |
| Alchemist (WIP) | tech-forward | 0: Stand | 11.0 | 5.3 | forward; 3.7/3.4 |
| Alchemist (WIP) | tech-back | 0: Stand | 11.0 | 5.3 | back; 3.4/3.7 |
| Alchemist (WIP) | get-up | 2: Stand 3 | 86.3 | 29.2 | up; 29.7/56.7 |
| Alchemist (WIP) | get-up-forward | 0: Stand | 11.0 | 5.3 | forward; 3.7/3.8 |
| Alchemist (WIP) | get-up-back | 0: Stand | 11.0 | 5.3 | back; 3.8/3.7 |
| Alchemist (WIP) | get-up-attack | 5: attack one - 2 NEW | 132.2 | 53.0 | both; 94.5/132.2 |
| Alchemist (WIP) | ledge-get-up | 4: Walk 1 | 112.9 | 31.1 | up; 58.6/52.2 |
| Alchemist (WIP) | ledge-roll | 4: Walk 1 | 114.2 | 31.2 | forward; 107.3/108.7 |
| Alchemist (WIP) | ledge-attack | 3: attack one -1 NEW | 140.2 | 38.2 | both; 73.2/135.7 |
| Onyxia | walk | 6: Walk | 64.1 | 35.7 | forward; 58.2/63.6 |
| Onyxia | dash | 6: Walk | 61.6 | 34.9 | forward; 58.2/61.3 |
| Onyxia | run | 6: Walk | 56.9 | 26.6 | forward; 51.9/56.8 |
| Onyxia | turn | 6: Walk | 25.7 | 10.0 | back; 17.1/20.5 |
| Onyxia | brake | 6: Walk | 25.8 | 10.4 | in place; 21.3/17.9 |
| Onyxia | jump-squat | 0: Stand - 1 | 0.0 | 0.0 | down; 0.0/0.0 |
| Onyxia | roll-forward | 6: Walk | 64.6 | 35.7 | forward; 58.2/64.2 |
| Onyxia | roll-back | 6: Walk | 64.6 | 35.7 | back; 64.2/58.2 |
| Onyxia | spot-dodge | 0: Stand - 1 | 11.8 | 6.3 | in place; 4.0/11.7 |
| Onyxia | air-dodge | 0: Stand - 1 | 12.2 | 6.2 | in place; 4.1/12.2 |
| Onyxia | tech | 0: Stand - 1 | 12.3 | 6.3 | in place; 4.0/12.3 |
| Onyxia | tech-forward | 0: Stand - 1 | 12.4 | 6.4 | forward; 4.1/12.3 |
| Onyxia | tech-back | 0: Stand - 1 | 12.4 | 6.4 | back; 12.3/4.1 |
| Onyxia | get-up | 0: Stand - 1 | 12.0 | 6.3 | up; 6.2/4.1 |
| Onyxia | get-up-forward | 0: Stand - 1 | 12.2 | 6.2 | forward; 4.1/12.2 |
| Onyxia | get-up-back | 0: Stand - 1 | 12.2 | 6.2 | back; 12.2/4.1 |
| Onyxia | get-up-attack | 2: Attack -1 | 159.5 | 68.8 | both; 102.6/91.4 |
| Onyxia | ledge-get-up | 6: Walk | 64.0 | 35.5 | up; 42.1/30.9 |
| Onyxia | ledge-roll | 6: Walk | 62.3 | 35.3 | forward; 58.2/61.8 |
| Onyxia | ledge-attack | 2: Attack -1 | 159.5 | 69.0 | both; 100.5/90.9 |
| Onyxia | walk | 3: Walk | 183.0 | 15.0 | forward; 118.4/27.6 |
| Onyxia | dash | 3: Walk | 180.3 | 14.8 | forward; 116.9/28.9 |
| Onyxia | run | 3: Walk | 185.5 | 17.3 | forward; 126.0/23.2 |
| Onyxia | turn | 3: Walk | 48.2 | 6.6 | back; 28.0/8.5 |
| Onyxia | brake | 3: Walk | 34.2 | 5.1 | in place; 20.3/7.1 |
| Onyxia | jump-squat | 0: Stand - 1 | 0.0 | 0.0 | down; 0.0/0.0 |
| Onyxia | roll-forward | 3: Walk | 183.0 | 15.1 | forward; 118.4/28.7 |
| Onyxia | roll-back | 3: Walk | 183.0 | 15.1 | back; 28.7/118.4 |
| Onyxia | spot-dodge | 2: Stand - 3 | 184.4 | 32.4 | in place; 59.2/34.4 |
| Onyxia | air-dodge | 2: Stand - 3 | 183.2 | 32.8 | in place; 64.5/34.7 |
| Onyxia | tech | 0: Stand - 1 | 173.1 | 22.9 | in place; 63.6/32.5 |
| Onyxia | tech-forward | 0: Stand - 1 | 173.0 | 23.0 | forward; 63.4/32.6 |
| Onyxia | tech-back | 0: Stand - 1 | 173.0 | 23.0 | back; 32.6/63.4 |
| Onyxia | get-up | 2: Stand - 3 | 182.2 | 32.2 | up; 180.9/46.7 |
| Onyxia | get-up-forward | 0: Stand - 1 | 173.2 | 22.9 | forward; 63.6/32.5 |
| Onyxia | get-up-back | 0: Stand - 1 | 173.2 | 22.9 | back; 32.5/63.6 |
| Onyxia | get-up-attack | 1: Attack 1 | 186.2 | 51.6 | both; 89.8/55.8 |
| Onyxia | ledge-get-up | 3: Walk | 183.0 | 15.0 | up; 144.7/33.2 |
| Onyxia | ledge-roll | 3: Walk | 182.8 | 15.1 | forward; 118.8/28.9 |
| Onyxia | ledge-attack | 1: Attack 1 | 186.9 | 51.5 | both; 87.7/55.8 |

Walking/running cadence uses grounded vertices' horizontal excursion twice per gait cycle, times the cycles the widest-swinging vertices draw in the clip, because a stock Walk may loop more than once: Jaina's and Prestor's 2 s Walk loop three times and the Warden model's 1.166 s Walk twice, and the measure read one loop until 2026-11-01. The Lich floats and uses the stock sequence's movement speed. Both measurements use the fighter's displayed model scale. Ground clips play at body speed over drawn stride, capped at 5x (GROUND_LOCOMOTION_RATE_CAP in fighterLocomotion.ts), so past it the body outruns the feet. That reads well on the floaters Firelord (Ragnaros) and Lady Vashj; Firelord's stock Walk loops once, so his 5x cap stands. Tyrande runs on an authored `Movement run` (tools/animations/run-clips.ts, #834) whose stride is measured over the grounded vertices that move, leaving the hem and pelvis out. Warden walks on that clip (`--walk`) at 3.38x and runs and dashes on her stock Walk at 3.08x and 2.68x (Tom asked for this split on 2026-10-31; the one-loop reading had played it at 6.17x and 5.36x under a 6.25x cap, feet at twice the body). Jaina walks, runs and dashes on her stock Walk at 1.33x, 1.83x and 1.67x with body to feet 1.00. The one-loop reading had played the clip at 4.18x, 5x and 5x, feet drawing 3.1, 2.7 and 3.0 times the ground she covered (body to feet 0.32, 0.37 and 0.33), which Tom saw in a playtest on 2026-11-01 as her legs churning while she barely moved and asked to be capped lower like Ragnaros. Prestor walks at 3.76x and runs at the 5x cap with her feet 7% behind the body.
