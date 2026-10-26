"""Blender boundary: author Anub'arak's forward air (#464), a claw rake thrown clear ahead of his legs.

The rig, pose vocabulary and bake live in anubarak_rig.py. He rears back with his striking claw raised over his
shell, folds his legs back under him as he levels out and hurls the claw straight ahead on the first active frame,
rakes it down through the active window, carries it on down past his folded legs as his nose dips and he sinks,
then glides evenly back to ready. Clip frame N is attack frame N; `anubarak-clips.ts SHIPPED_ANUBARAK.mdx
OUT forwardAir --keys KEYS.json --rekey forwardAir` splices the baked frames.

  blender --background --factory-startup --python tools/animations/anubarak-forward-air.py -- RIG.json KEYS.json
"""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anubarak_rig import READY, Rig, blend, glide  # noqa: E402

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
rig = Rig(rig_path)
frames, contact, last = rig.frames, rig.contact, rig.last
load = dict(lean=-10, chest=-6, head=6, right=-50, left=-20, front=-10, rear=8, travel=-4)
coil = dict(lean=-25, chest=-15, head=12, right=-160, elbows=30, left=-60, front=-20, rear=15, rearKnee=15, travel=-10)
strike = dict(lean=10, chest=12, head=-8, right=-75, elbows=30, wrists=-25, left=-150, front=50, frontKnee=20, rear=40, rearKnee=30, travel=20)
rake = dict(lean=14, chest=14, head=-10, right=-55, elbows=25, wrists=-10, left=-140, front=50, frontKnee=20, rear=40, rearKnee=30, travel=21)
carry = dict(lean=20, chest=15, head=-8, right=-5, elbows=20, wrists=40, left=-90, front=35, frontKnee=10, rear=30, rearKnee=20, travel=17, drop=-9)
swept = last + 9

keys = {
    0: READY,
    contact - 8: load,
    contact - 4: coil,
    contact - 1: blend(coil, strike, 0.5),
    contact: strike,
    last: rake,
}
keys.update({frame: blend(rake, carry, glide((frame - last) / (swept - last))) for frame in range(last + 1, swept)})
keys.update({frame: blend(carry, READY, glide((frame - swept) / (frames - 1 - swept))) for frame in range(swept, frames)})
keys[frames] = READY

rig.bake(keys, keys_path, 'forwardAir')
print('ANUBARAK_FORWARD_AIR_KEYS', keys_path, frames + 1, 'frames', flush=True)
