"""Blender boundary: author Murloc's dash attack (#345), a spear lunge driven through Melee's 12 active frames.

The rig, pose vocabulary and bake live in murloc_rig.py. His round body hides pitch, so the move reads
through squash and stretch of the body mesh bones, stance, twist and spear: he squashes back over a bent back
leg wound away with the spear cocked, stretches long and flat as he drives forward on the first active frame
and through a level extension, gathers into a low crouch with the tip dropping on the last, steps through as
the tip dips, then rises into ready along an even arc-length glide. Clip frame N is attack frame N;
`murloc-clips.ts --keys` splices the baked frames and sets each one on his feet.

  blender --background --factory-startup --python tools/animations/murloc-dash-attack.py -- RIG.json KEYS.json
"""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from murloc_rig import READY, Rig, blend, glide  # noqa: E402

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
rig = Rig(rig_path, body_axes_per_pose=True)
frames, contact, last = rig.frames, rig.contact, rig.last
load = dict(twist=-30, lean=-20, chest=-10, head=12, arm=90, elbow=-40, leftArm=-50, aim=115, grip=1, stretch=-0.2, squash=-0.28,
            front=-30, kneeFront=0, back=25, kneeBack=55, footBack=-20, travel=-34, drop=-6)
strike = dict(twist=0, lean=15, chest=8, head=-12, arm=-90, elbow=-5, leftArm=60, aim=-12, grip=1, stretch=0.5, squash=-0.25,
              front=-45, kneeFront=45, footFront=-20, back=30, kneeBack=5, travel=34, drop=-2)
lunge = dict(twist=25, lean=12, chest=6, head=-10, arm=-115, elbow=0, leftArm=80, aim=-4, grip=1, stretch=0.6, squash=-0.3,
             front=-60, kneeFront=35, footFront=-25, back=55, kneeBack=0, travel=40, drop=0)
drive = dict(twist=55, lean=35, chest=16, head=-24, arm=-95, elbow=0, leftArm=70, aim=-48, grip=1, stretch=0.1, squash=0.05,
             front=-95, kneeFront=105, footFront=-40, back=35, kneeBack=0, travel=44, drop=-16)
carry = dict(twist=-15, lean=5, chest=4, head=-4, arm=-40, elbow=-40, leftArm=30, aim=-88, grip=1, stretch=-0.12, squash=0.15,
             front=-10, kneeFront=25, footFront=-5, back=-45, kneeBack=40, travel=26, drop=-2)


beats = [(0, READY), (contact - 2, load), (contact - 1, blend(load, strike, 0.15)), (contact, strike), ((contact + last) // 2, lunge), (last, drive)]


def recovery(u):
    return blend(drive, carry, u * 2) if u < 0.5 else blend(carry, READY, u * 2 - 1)


along = rig.arc(recovery)


def at(frame):
    if frame > last:
        return recovery(along(glide((frame - last) / (frames - last), 0.2)))
    for (a, pa), (b, pb) in zip(beats, beats[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a)
            return blend(pa, pb, t * t if a == 0 else t)
    return READY


rig.bake(at, keys_path)
print('MURLOC_DASH_ATTACK_KEYS', keys_path, frames + 1, 'frames', flush=True)
