"""Blender boundary: author Murloc's dash attack (#345), a spear lunge driven through Melee's 12 active frames.

The rig, pose vocabulary and bake live in murloc_rig.py. His round body hides pitch, so the move reads
through squash and stretch of the body mesh bones, stance, twist and spear: he rocks back on bent knees with
the spear drawn back clear behind him, lunges long and flat on the first active frame with the spear level
below his crest, skitters low through the active window on quick alternating steps, recoils the spear on the
last, then rises into ready along an even arc-length glide. Clip frame N is attack frame N;
`murloc-clips.ts --keys` splices the baked frames and sets each one on his feet.

  blender --background --factory-startup --python tools/animations/murloc-dash-attack.py -- RIG.json KEYS.json
"""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from murloc_rig import BODY, READY, Rig, blend, glide  # noqa: E402

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
rig = Rig(rig_path)
frames, contact, last = rig.frames, rig.contact, rig.last
coil = dict(twist=-15, lean=-30, chest=-14, head=14, arm=-125, elbow=-10, leftArm=-40, aim=140, grip=1, stretch=0.1, squash=-0.25,
            front=-55, kneeFront=70, footFront=-10, back=25, kneeBack=70, footBack=-20, travel=-34, drop=-12)
strike = dict(twist=30, lean=20, chest=10, head=-30, arm=-30, elbow=0, leftArm=60, aim=-3, grip=1, stretch=0.5, squash=-0.25,
              front=-65, kneeFront=40, footFront=-20, back=50, kneeBack=0, travel=30, drop=-6)
skitter = dict(twist=35, lean=32, chest=14, head=-24, arm=-35, elbow=0, leftArm=75, aim=-8, grip=1, stretch=0.6, squash=-0.32,
               front=10, kneeFront=80, footFront=-30, back=-20, kneeBack=80, travel=40, drop=-18)
drive = dict(twist=40, lean=50, chest=20, head=-30, arm=-40, elbow=0, leftArm=80, aim=-16, grip=1, stretch=0.85, squash=-0.42,
             front=-85, kneeFront=75, footFront=-30, back=75, kneeBack=0, travel=44, drop=-28)
gather = dict(twist=35, lean=34, chest=14, head=-22, arm=-35, elbow=-5, leftArm=70, aim=-12, grip=1, stretch=0.55, squash=-0.3,
              front=5, kneeFront=85, footFront=-30, back=-15, kneeBack=85, travel=42, drop=-20)
recoil = dict(twist=-10, lean=26, chest=10, head=-14, arm=-30, elbow=-90, leftArm=40, aim=-10, grip=1, stretch=0.2, squash=-0.15,
              front=-50, kneeFront=70, footFront=-20, back=45, kneeBack=30, travel=34, drop=-16)
settle = dict(twist=-5, lean=10, chest=4, head=-4, arm=-10, elbow=-50, leftArm=15, aim=-30, grip=1, stretch=0.05, squash=0.05,
              front=-25, kneeFront=45, back=20, kneeBack=35, travel=20, drop=-8)

rig.pose(strike)
rig.body_axes = {name: rig.axes(rig.bones[name]) for name in BODY}

beats = [(0, READY), (2, coil), (contact - 1, coil), (contact, strike), (contact + 3, skitter), (contact + 6, drive),
         (contact + 9, gather), (last, recoil)]


def recovery(u):
    return blend(recoil, settle, u * 2) if u < 0.5 else blend(settle, READY, u * 2 - 1)


along = rig.arc(recovery)


def at(frame):
    if frame > last:
        return recovery(along(glide((frame - last) / (frames - last), 0.08)))
    for (a, pa), (b, pb) in zip(beats, beats[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a)
            return blend(pa, pb, t * t * (3 - 2 * t))
    return READY


rig.bake(at, keys_path)
print('MURLOC_DASH_ATTACK_KEYS', keys_path, frames + 1, 'frames', flush=True)
