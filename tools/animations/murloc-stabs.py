"""Blender boundary: author Murloc's jabs and forward tilts as point-first spear stabs (#497).

He draws the spear back along the hit line, drives it point-first with the shoulder, hips and a step behind it
and holds the extension through the active frames. Each windup and active frame solves the shoulder and elbow so
the tip lands on a straight line between its drawn-back and extended points, so the point never swings an arc;
tip points are model units from his feet. The spear is aimed by `pitch`, his ready grip turned about the side
axis, so its roll never flips. In recovery the forward tilts pull the spear back along the line, lower it and
return to ready; the jabs drop the point ahead of the hand so it never passes the contact reach, and the
first jab sinks briefly for contrast. Recovery runs at an even arc-length pace.

  blender --background --factory-startup --python tools/animations/murloc-stabs.py -- POSE RIG.json KEYS.json
"""
import os
import sys
from math import atan2, degrees

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from murloc_rig import Rig, blend, glide  # noqa: E402

pose_name, rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
rig = Rig(rig_path)
frames, contact, last = rig.frames, rig.contact, rig.last

coil = dict(twist=-25, lean=-10, chest=-6, head=8, leftArm=35, stretch=-0.12, squash=0.1,
            front=-10, kneeFront=10, back=30, kneeBack=40, footBack=-15, travel=-14, drop=-4)
thrust = dict(twist=25, lean=14, chest=8, head=-10, leftArm=-55, stretch=0.35, squash=-0.2,
              front=-50, kneeFront=40, footFront=-20, back=35, kneeBack=0, travel=14, drop=-3)
STABS = {
    'jab': dict(drawn=(38, 42), hit=(62, 42), reach=(66, 42), body=0.75, windup=1.2, ramp=0.01, lower=False, lead=2.5, lag=1.8, thrust=dict(stretch=0.6, squash=-0.3, lean=14, twist=40),
                settle=0.5, sink=dict(squash=0.12, stretch=-0.08, kneeFront=15, kneeBack=18, lean=-3)),
    'jab2': dict(drawn=(40, 42), hit=(66, 42), reach=(70, 42), body=0.9, ramp=0.05, lower=False, lead=3, lag=2),
    'forwardTilt': dict(drawn=(40, 40), hit=(70, 40), reach=(75, 40), body=1.0, windup=1.3, withdraw=0.35),
    'forwardTiltDown': dict(drawn=(42, 32), hit=(66, 18), reach=(70, 14), body=1.0, withdraw=0.35),
}
stab = STABS[pose_name]
drawn, hit, reach = stab['drawn'], stab['hit'], stab['reach']
aim = degrees(atan2(reach[1] - drawn[1], reach[0] - drawn[0]))
load = {k: v * stab.get('windup', stab['body']) for k, v in coil.items()}
drive = {k: v * stab['body'] for k, v in {**thrust, **stab.get('thrust', {})}.items()}
extend = {**drive, 'lean': drive['lean'] + 4, 'travel': drive['travel'] + 3, 'stretch': drive['stretch'] + 0.05}


def tip_at(p, arm, elbow):
    rig.pose({**p, 'arm': arm, 'elbow': elbow})
    point = rig.tip()
    return point.x, point.z


def limit(arm, elbow):
    return min(70.0, max(-120.0, arm)), min(10.0, max(-130.0, elbow))


def solve(p, goal):
    p = {**p, 'pitch': aim}

    def error(arm, elbow):
        x, z = tip_at(p, arm, elbow)
        return (x - goal[0]) ** 2 + (z - goal[1]) ** 2 + 0.01 * (elbow + 40) ** 2
    best = min((error(arm, elbow), arm, elbow) for arm in range(-120, 71, 15) for elbow in range(-120, 11, 10))
    for step in (6, 2, 0.5):
        _, arm, elbow = best
        best = min((error(*limit(arm + i * step, elbow + j * step)), *limit(arm + i * step, elbow + j * step))
                   for i in (-2, -1, 0, 1, 2) for j in (-2, -1, 0, 1, 2))
    return {**p, 'arm': best[1], 'elbow': best[2]}


solved = {contact - 1: solve(load, drawn)}
for frame in range(contact, last + 1):
    t = (frame - contact) / max(1, last - contact)
    solved[frame] = solve(blend(drive, extend, t), tuple(h + (r - h) * t for h, r in zip(hit, reach)))
withdraw = solve(blend(extend, load, 0.6), drawn)
ready = {'pitch': rig.hanging}
lowered = {**withdraw, 'pitch': rig.hanging}
path = [(0, solved[last])] + ([(stab['withdraw'], withdraw)] if stab.get('withdraw') else [])
path += ([(0.7, lowered)] if stab.get('lower', True) else []) + ([(stab['settle'], {**ready, **stab['sink']})] if 'sink' in stab else []) + [(1, ready)]


def recovery(u):
    for (a, pa), (b, pb) in zip(path, path[1:]):
        if u <= b:
            t = min(1.0, (u - a) / (b - a))
            return {**blend(pa, pb, t ** stab.get('lag', 1)), 'pitch': pa['pitch'] + (pb['pitch'] - pa['pitch']) * (1 - (1 - t) ** stab.get('lead', 1))}
    return ready


along = rig.arc(recovery)


def at(frame):
    if frame < contact - 1:
        t = frame / (contact - 1)
        return blend(ready, solved[contact - 1], t * t)
    if frame in solved:
        return solved[frame]
    return recovery(along(glide((frame - last) / (frames - last), stab.get('ramp', 0.2))))


for frame in sorted(solved):
    rig.pose(solved[frame])
    point = rig.tip()
    print('MURLOC_STAB_TIP', pose_name, frame, round(point.x, 1), round(point.z, 1), flush=True)
rig.bake(at, keys_path)
print('MURLOC_STAB_KEYS', pose_name, keys_path, frames + 1, 'frames', flush=True)
