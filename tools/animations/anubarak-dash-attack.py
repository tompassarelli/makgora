"""Blender boundary: author Anub'arak's dash attack (#339), a lunge driven through Melee's 12 active frames.

The rig, pose vocabulary and bake live in anubarak_rig.py. He rears back with both claws drawn up behind his
head, lunges flat with the claws raised high ahead on the first active frame, then through the active window
pitches nose down as his hind legs swing under his hips and his abdomen lifts, so his rear rises while both
claws stab down in front, and glides evenly back to ready. Clip frame N is attack frame N;
`anubarak-clips.ts STOCK_ANUBARAK.mdx OUT dashAttack --keys KEYS.json` splices the baked frames and sets each one on the floor.

  blender --background --factory-startup --python tools/animations/anubarak-dash-attack.py -- RIG.json KEYS.json
"""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anubarak_rig import READY, Rig, blend, glide  # noqa: E402

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
rig = Rig(rig_path)
frames, contact, last = rig.frames, rig.contact, rig.last
load = dict(lean=-12, chest=-8, head=8, arms=-60, elbows=20, front=-15, rear=10, rearKnee=15, travel=-8)
coil = dict(lean=-30, chest=-18, head=14, butt=10, arms=-170, elbows=35, wrists=20, claws=20,
            front=-35, frontKnee=-20, rear=20, rearKnee=30, travel=-16)
strike = dict(lean=12, chest=10, head=-10, butt=-5, arms=-145, elbows=-10, wrists=-5, claws=-5,
              front=-45, frontKnee=10, rear=30, rearKnee=-10, travel=30)
drive = dict(lean=32, chest=15, head=-15, butt=25, arms=-60, elbows=0, wrists=0, claws=0,
             front=-75, frontKnee=40, rear=-20, rearKnee=-15, travel=50)
recoil = dict(lean=75, chest=12, head=-15, butt=45, arms=0, elbows=-15, wrists=-10, claws=-5,
              front=-110, frontKnee=60, rear=-60, rearKnee=-20, travel=62)

keys = {
    0: READY,
    contact - 6: load,
    contact - 3: coil,
    contact - 1: blend(coil, strike, 0.4),
    contact: strike,
    contact + 5: drive,
    last: recoil,
}
keys.update({frame: blend(recoil, READY, glide((frame - last) / (frames - last))) for frame in range(last + 1, frames + 1)})

rig.bake(keys, keys_path, 'dashAttack')
print('ANUBARAK_DASH_ATTACK_KEYS', keys_path, frames + 1, 'frames', flush=True)
