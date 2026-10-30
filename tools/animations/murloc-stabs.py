"""Blender boundary: author Murloc's jabs, rapid jab and forward tilts as point-first spear stabs (#497).

He draws the spear back along the hit line, drives it point-first with the shoulder, hips and a step behind it
and holds the extension through the active frames. Each windup and active frame solves the shoulder and elbow so
the tip lands on a straight line between its drawn-back and extended points, so the point never swings an arc;
tip points are model units from his feet. The spear is aimed by `pitch`, his ready grip turned about the side
axis, so its roll never flips. The jabs and forward tilt share one motion at their own reach, the tilt drawn
deeper and lunging further. The rapid jab pokes on each of its hit windows from a half coil, then draws deep
for the finisher. In recovery the spear pulls back along the line, lowers and returns to ready at an even
arc-length pace.

Forward smash swings the spear back under him and over into a level swing along the stage: every joint turns about
the side-view axis, so the blade stays in the side plane in both facings.

Neutral air draws the spear up behind him, drives the point down and forward into the hit region and draws it back to
near ready by the last active frame.

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


def bake_drill():
    rig.rest()
    level = rig.floor()
    hang = rig.hanging

    def P(**kw):
        return {'pitch': hang, **kw}
    ready = P()

    def beat(beats, frame):
        for (a, pa), (b, pb) in zip(beats, beats[1:]):
            if a <= frame <= b:
                t = (frame - a) / (b - a)
                return blend(pa, pb, t * t * (3 - 2 * t))
        return beats[-1][1]

    def aimed(p, goal):
        return rig.reach(p, goal, level)

    def drill():
        over = P(drop=4, squash=0.12, stretch=-0.08, lean=-8, chest=-6, arm=-150, elbow=-20, leftArm=-120, leftElbow=-20, front=-30, kneeFront=40, back=40, kneeBack=60, footBack=-15, pitch=70)
        body = P(drop=-4, lean=26, squash=0.14, stretch=-0.1, chest=10, head=-10, leftArm=-110, leftElbow=-25, front=-55, kneeFront=70, footFront=-20, back=55, kneeBack=75, footBack=-20, pitch=-90)
        landed = P(squash=0.05, drop=-2)
        wind = [(0, ready), (2, over), (4, P(drop=2, lean=10, squash=0.1, arm=-90, elbow=-10, leftArm=-100, front=-40, kneeFront=50, back=50, kneeBack=70, pitch=10))]

        def drilled(frame, weight):
            p = blend(landed, body, weight)
            p['spin'] = 720.0 / 16 * min(frame - contact, 16)
            p['pitch'] = hang + (-90 - hang) * weight
            return aimed(p, (-10, -22)) if weight > 0.5 else p

        def at(frame):
            if frame < contact - 1:
                return beat(wind, frame)
            if frame == contact - 1:
                return blend(wind[-1][1], body, 0.5)
            if frame > 21:
                return blend(ready, landed, (frames - 1 - frame) / (frames - 22.0))
            return drilled(frame, 1.0 if frame <= 14 else max(0.0, 1 - (frame - 14) / 7.0))
        return at

    at = drill()
    for frame in range(frames + 1):
        rig.pose(at(frame))
        tip = rig.tip()
        print('MURLOC_DRILL_TIP', pose_name, frame, round(tip.x, 1), round(tip.z + rig.floor() - level, 1), flush=True)
    rig.bake(at, keys_path)
    print('MURLOC_DRILL_KEYS', pose_name, keys_path, frames + 1, 'frames', flush=True)


SMASHES = {
    'forwardSmash': dict(
        spin=-360,
        keys=[(0, None, {}),
              (3, (-20, 24), dict(pitch=-150, travel=-6, drop=-2, lean=-6, chest=-8, head=6, twist=-15, leftArm=25, squash=-0.05, stretch=0.05,
                                  front=-10, kneeFront=10, back=25, kneeBack=30, footBack=-10)),
              (7, (-40, 88), dict(pitch=-205, travel=-12, drop=-3, lean=-12, chest=-14, head=10, twist=-30, leftArm=40, squash=-0.1, stretch=0.08,
                                  front=-15, kneeFront=15, back=35, kneeBack=40, footBack=-15)),
              (11, (-44, 92), dict(pitch=-200, travel=-14, drop=-4, lean=-14, chest=-16, head=10, twist=-35, leftArm=45, squash=-0.12, stretch=0.1,
                                   front=-18, kneeFront=18, back=38, kneeBack=45, footBack=-15)),
              (13, (84, 48), dict(pitch=-355, travel=22, drop=-4, lean=20, chest=14, head=-12, twist=30, leftArm=-70, stretch=0.3, squash=-0.15,
                                  front=-55, kneeFront=45, footFront=-20, back=40, kneeBack=0)),
              (15, (90, 30), dict(pitch=-378, travel=25, drop=-5, lean=24, chest=18, head=-12, twist=34, leftArm=-75, stretch=0.32, squash=-0.16,
                                  front=-58, kneeFront=48, footFront=-20, back=42, kneeBack=0)),
              (22, (74, 4), dict(pitch=-410, travel=22, drop=-6, lean=28, chest=24, head=-8, twist=28, leftArm=-60, stretch=0.2, squash=-0.08,
                                 front=-50, kneeFront=50, footFront=-15, back=40, kneeBack=10))],
        ramp=0.15),
    'neutralAir': dict(
        glide=8,
        keys=[(0, None, {}),
              (2, (-14, 78), dict(pitch=105, drop=3, lean=-14, chest=-12, head=8, leftArm=20, squash=0.16, stretch=-0.1,
                                  front=-45, kneeFront=62, footFront=-15, back=42, kneeBack=70, footBack=-15)),
              (3, (60, 16), dict(pitch=-57, drop=-8, travel=14, lean=22, chest=12, head=-10, leftArm=-60, squash=0.06, stretch=0.16,
                                 front=-42, kneeFront=48, footFront=-15, back=36, kneeBack=55, footBack=-15)),
              (5, (66, 10), dict(pitch=-60, drop=-9, travel=16, lean=26, chest=14, head=-12, leftArm=-65, squash=0.06, stretch=0.18,
                                 front=-44, kneeFront=50, footFront=-15, back=38, kneeBack=58, footBack=-15)),
              (8, (56, -2), dict(pitch=rig.hanging + 8, drop=-2, travel=3, lean=4, chest=3, head=-2, leftArm=-20, squash=0.03, stretch=0.02,
                                 front=-10, kneeFront=14, back=10, kneeBack=14))],
        ramp=0.1),
    'upSmash': dict(
        glide=14,
        keys=[(0, None, {}),
              (3, (46, -3), dict(pitch=rig.hanging, drop=-15, lean=6, chest=8, head=6, leftArm=-10, squash=-0.28, stretch=0.12,
                                  front=-35, kneeFront=60, footFront=-20, back=40, kneeBack=72, footBack=-25)),
              (9, (-14, 64), dict(pitch=90, drop=-13, lean=10, chest=14, head=10, leftArm=-25, squash=-0.26, stretch=0.14,
                                  front=-40, kneeFront=74, footFront=-25, back=45, kneeBack=84, footBack=-30)),
              (10, (2, 92), dict(pitch=91, drop=15, lean=-4, chest=-12, head=-16, leftArm=-140, squash=0.24, stretch=-0.08,
                                 front=-5, back=5)),
              (12, (4, 118), dict(pitch=90, drop=15, lean=-6, chest=-16, head=-22, leftArm=-155, squash=0.28, stretch=-0.1, front=-5, back=5)),
              (14, (5, 117), dict(pitch=89, drop=14, lean=-6, chest=-15, head=-20, leftArm=-150, squash=0.26, stretch=-0.09, front=-5, back=5)),
              (24, (5, 96), dict(pitch=86, drop=-2, lean=-2, chest=-6, head=-8, leftArm=-100, squash=0.06, stretch=-0.02,
                                 front=-15, kneeFront=28, back=15, kneeBack=32)),
              (32, (16, 72), dict(pitch=66, drop=-4, lean=4, chest=4, head=2, leftArm=-55, squash=-0.06, stretch=0.04,
                                  front=-20, kneeFront=35, back=25, kneeBack=40, footBack=-10)),
              (40, (38, 30), dict(pitch=25, drop=-2, lean=4, chest=4, head=2, leftArm=-25, squash=-0.03, stretch=0.02,
                                  front=-12, kneeFront=20, back=15, kneeBack=22))],
        ramp=0.06),
}


def bake_smash():
    smash = SMASHES[pose_name]
    ready = {'pitch': rig.hanging}

    def bound(arm, elbow):
        return min(70.0, max(-180.0, arm)), min(10.0, max(-140.0, elbow))

    def aimed(p, goal):
        def error(arm, elbow):
            rig.pose({**p, 'arm': arm, 'elbow': elbow})
            point = rig.tip()
            return (point.x - goal[0]) ** 2 + (point.z - goal[1]) ** 2 + 0.01 * (elbow + 40) ** 2
        best = min((error(arm, elbow), arm, elbow) for arm in range(-180, 71, 15) for elbow in range(-140, 11, 10))
        for step in (6, 2, 0.5):
            _, arm, elbow = best
            best = min((error(*bound(arm + i * step, elbow + j * step)), *bound(arm + i * step, elbow + j * step))
                       for i in (-2, -1, 0, 1, 2) for j in (-2, -1, 0, 1, 2))
        return {**p, 'arm': best[1], 'elbow': best[2]}

    beats = [(frame, ready if goal is None else aimed(p, goal)) for frame, goal, p in smash['keys']]
    end = smash.get('glide', beats[-1][0])
    rested = {'pitch': rig.hanging + smash.get('spin', 0)}
    tail = [p for frame, p in beats if frame >= end] + [rested]

    def through(u):
        k = min(int(u * (len(tail) - 1)), len(tail) - 2)
        return blend(tail[k], tail[k + 1], u * (len(tail) - 1) - k)
    along = rig.arc(through)

    def at(frame):
        if frame > end:
            u = (frame - end) / (frames - end)
            return through(along(1 - (1 - u) ** smash['out'] if 'out' in smash else glide(u, smash['ramp'])))
        for (a, pa), (b, pb) in zip(beats, beats[1:]):
            if a <= frame <= b:
                t = (frame - a) / (b - a)
                return blend(pa, pb, t * t * (3 - 2 * t) if b - a > 2 else t)
        return beats[-1][1]

    for frame in range(frames + 1):
        rig.pose(at(frame))
        point = rig.tip()
        print('MURLOC_SMASH_TIP', pose_name, frame, round(point.x, 1), round(point.z, 1), flush=True)
    rig.bake(at, keys_path)
    print('MURLOC_SMASH_KEYS', pose_name, keys_path, frames + 1, 'frames', flush=True)


if pose_name == 'downAir':
    bake_drill()
    sys.exit(0)
if pose_name in SMASHES:
    bake_smash()
    sys.exit(0)

coil = dict(twist=-25, lean=-10, chest=-6, head=8, leftArm=35, stretch=-0.12, squash=0.1,
            front=-10, kneeFront=10, back=30, kneeBack=40, footBack=-15, travel=-14, drop=-4)
thrust = dict(twist=25, lean=14, chest=8, head=-10, leftArm=-55, stretch=0.35, squash=-0.2,
              front=-50, kneeFront=40, footFront=-20, back=35, kneeBack=0, travel=14, drop=-3)
STABS = {
    'jab': dict(drawn=(38, 42), hit=(62, 42), reach=(66, 42), body=0.85, windup=1.2, lower=False, lead=2.5, lag=1.8, ramp=0.01),
    'jab2': dict(drawn=(28, 42), hit=(66, 42), reach=(70, 42), body=1.0, windup=1.2, lower=False, lead=3, lag=2, ramp=0.05),
    'jab3': dict(drawn=(42, 41), hit=(58, 41), reach=(58, 41), body=0.9, windup=1.1, withdraw=0.35, coil=0.4, lower=False, ramp=0.01),
    'forwardTilt': dict(drawn=(34, 40), hit=(72, 40), reach=(78, 40), body=1.3, windup=1.5, withdraw=0.35, thrust=dict(lean=20, front=-60, kneeFront=50)),
    'forwardTiltDown': dict(drawn=(42, 32), hit=(66, 18), reach=(70, 14), body=1.0, withdraw=0.35),
}
stab = STABS[pose_name]
drawn, hit, reach = stab['drawn'], stab['hit'], stab['reach']
aim = degrees(atan2(reach[1] - drawn[1], reach[0] - drawn[0]))
load = {k: v * stab.get('windup', stab['body']) for k, v in coil.items()}
drive = {k: v * stab['body'] for k, v in {**thrust, **stab.get('thrust', {})}.items()}
extend = {**drive, 'lean': drive['lean'] + 4, 'travel': drive['travel'] + 3, 'stretch': drive['stretch'] + 0.05}
FINISHER = dict(drawn=(36, 41), hit=(68, 41), reach=(71, 41), body=1.0)


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


def flurry():
    *pokes, (strike, end) = rig.spec['hits']
    between = solve(blend(load, drive, 0.5), drawn)
    out = solve(drive, hit)
    keys = {contact - 1: solve(load, drawn)}
    for first, _ in pokes:
        keys.update({first: out, first + 1: out, first + 2: solve(blend(out, between, 0.6), tuple(r + (d - r) * 0.6 for r, d in zip(reach, drawn))), first + 3: between})
    deep = {k: v * FINISHER['body'] for k, v in load.items()}
    lunge = {k: v * FINISHER['body'] for k, v in drive.items()}
    keys[strike - 1] = solve(deep, FINISHER['drawn'])
    for frame in range(strike, end + 1):
        t = (frame - strike) / max(1, end - strike)
        keys[frame] = solve(blend(lunge, {**lunge, 'lean': lunge['lean'] + 4, 'travel': lunge['travel'] + 3}, t),
                            tuple(h + (r - h) * t for h, r in zip(FINISHER['hit'], FINISHER['reach'])))
    return keys


if pose_name == 'jab3':
    solved = flurry()
else:
    solved = {contact - 1: solve(load, drawn)}
    for frame in range(contact, last + 1):
        t = (frame - contact) / max(1, last - contact)
        solved[frame] = solve(blend(drive, extend, t), tuple(h + (r - h) * t for h, r in zip(hit, reach)))
withdraw = solve(blend(extend, load, stab.get('coil', 0.6)), drawn)
ready = {'pitch': rig.hanging}
lowered = {**withdraw, 'pitch': rig.hanging}
path = [(0, solved[last])] + ([(stab['withdraw'], withdraw)] if stab.get('withdraw') else [])
path += ([(0.7, lowered)] if stab.get('lower', True) else []) + [(1, ready)]


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
