"""Blender boundary: author Mountain King's neutral and forward air around his hammers (#511).

The rig comes from `mountain-king-aerials.ts SHIPPED OUT POSE --rig RIG.json`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the model's own keys, and the rest pose
is Stand Ready, the pose he falls in before and after an aerial. Each arm segment and each hammer is aimed along
a direction in the body's frame, the trunk and legs are pitched about the side-view axis, and the whole body
then spins about its long axis and tilts at the Attack Gesture root.

Neutral air (Barrel Turn): he tucks and winds against the turn, then bursts out with both hammers at arm's
length and his legs driven down, turns a full revolution through the active frames, carries past it and
settles. Forward air (Hammer Drop): he arches back with both hammers cocked over his head, crunches forward so
the heads swing down in front through the active frames, follows them under him, and rises heavily to ready.
Clip frame N is attack frame N through the last active frame; the recovery then glides to ready at an even pace along its arc length, reaching it on the move's last drawn frame. The trunk tilts before the arms aim and the spin turns last; `mountain-king-aerials.ts --keys` splices the baked frames.

  blender --background --factory-startup --python tools/animations/mountain-king-aerials.py -- RIG.json KEYS.json
"""
import json
import sys
from math import cos, radians, sin

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames, contact, active, move = spec['frames'], spec['contact'], spec['active'], spec['pose']
last = contact + active - 1

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('MountainKing')
rig = bpy.data.objects.new('MountainKing', armature)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
created = []
for n in spec['nodes']:
    bone = armature.edit_bones.new(n['name'])
    bone.head = Vector(n['pivot'])
    bone.tail = bone.head + Vector((0, 4, 0))
    bone.roll = 0
    created.append(bone.name)
for n, name in zip(spec['nodes'], created):
    if n['parent'] >= 0:
        armature.edit_bones[name].parent = armature.edit_bones[created[n['parent']]]
nodes = dict(zip(created, spec['nodes']))
for h in spec['hammers']:
    head = armature.edit_bones.new('Head' + h['side'])
    head.head = Vector(h['head'])
    head.tail = head.head + Vector((0, 4, 0))
    head.parent = armature.edit_bones[h['bone']]
    nodes['Head' + h['side']] = {'rotation': None, 'translation': None}
bpy.ops.object.mode_set(mode='POSE')
bones = rig.pose.bones
update = bpy.context.view_layer.update

ROOT, PELVIS, CHEST, HEAD = 'Attack Gesture', 'Bone_Pelvis', 'Bone_Chest', 'Bone_Head'
SIDES = {'R': -1, 'L': 1}


def rest():
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
        b.scale = Vector((1, 1, 1))
    update()


def turn(b, rotation):
    pivot = b.matrix.to_translation()
    b.matrix = Matrix.Translation(pivot) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ b.matrix
    update()


def pitch(name, degrees):
    if degrees:
        turn(bones[name], Quaternion((0, 1, 0), radians(degrees)))


def direction(elevation, spread, side):
    e, s = radians(elevation), radians(spread)
    return Vector((cos(e) * cos(s), side * sin(s), sin(e) * cos(s)))


def aim(name, tip, target):
    current = tip() - bones[name].head
    turn(bones[name], current.normalized().rotation_difference(target.normalized()))


READY = dict(spin=0, tilt=0, rise=0, travel=0, waist=0, chest=0, head=0, hipR=0, hipL=0, kneeR=0, kneeL=0, footR=0, footL=0,
             reach=0, armR=-60, armL=-60, spreadR=10, spreadL=10, foreR=-40, foreL=-40, foreSpreadR=10, foreSpreadL=10,
             hammerR=0, hammerL=0, hammerSpreadR=0, hammerSpreadL=0)


def arms(c):
    held = {name: bones[name].rotation_quaternion.copy() for s in SIDES for name in (f'Bone_Arm1_{s}', f'Bone_Arm2_{s}', f'Bone_Hand_{s}')}
    for s, side in SIDES.items():
        aim(f'Bone_Arm1_{s}', lambda: bones[f'Bone_Arm2_{s}'].head, direction(c['arm' + s], c['spread' + s], side))
        aim(f'Bone_Arm2_{s}', lambda: bones[f'Bone_Hand_{s}'].head, direction(c['fore' + s], c['foreSpread' + s], side))
        aim(f'Bone_Hand_{s}', lambda: bones['Head' + s].head, direction(c['hammer' + s], c['hammerSpread' + s], side))
    weight = min(1.0, max(0.0, c['reach']))
    for name, q in held.items():
        bones[name].rotation_quaternion = q.slerp(bones[name].rotation_quaternion, weight)
    update()


def pose(c):
    rest()
    root = bones[ROOT]
    root.location += Vector((c['travel'], 0, c['rise']))
    update()
    pitch(ROOT, c['tilt'])
    pitch(PELVIS, c['waist'])
    pitch(CHEST, c['chest'])
    pitch(HEAD, c['head'])
    for s in SIDES:
        pitch(f'Bone_Leg1_{s}', -c['hip' + s])
        pitch(f'Bone_Leg2_{s}', c['knee' + s])
        pitch(f'Bone_Foot_{s}', c['foot' + s])
    arms(c)
    if c['spin']:
        turn(root, Quaternion((0, 0, 1), radians(c['spin'])))


def full(p):
    return {k: p.get(k, v) for k, v in READY.items()}


def out(side_r, side_l=None, **common):
    side_l = side_l if side_l is not None else side_r
    return {**{k + 'R': v for k, v in side_r.items()}, **{k + 'L': v for k, v in side_l.items()}, **common}


if move == 'neutralAir':
    tuck = dict(spin=-45, rise=8, waist=-10, chest=30, head=-12, reach=1,
                **out(dict(hip=95, knee=115, foot=20, arm=-60, spread=25, fore=-30, foreSpread=20, hammer=-35, hammerSpread=15)))
    opening = dict(spin=5, rise=1, waist=0, chest=8, head=-4, reach=1,
                   **out(dict(hip=45, knee=60, foot=30, arm=-25, spread=70, fore=-20, foreSpread=70, hammer=-20, hammerSpread=65)))
    burst = dict(spin=70, rise=-12, waist=6, chest=-8, head=6, reach=1,
                 **out(dict(hip=-6, knee=4, foot=45, arm=0, spread=88, fore=0, foreSpread=88, hammer=0, hammerSpread=88)))
    turned = dict(burst, spin=250, rise=-16, chest=2, **out(dict(hip=55, knee=85, foot=30, arm=4, spread=90, fore=4, foreSpread=90, hammer=4, hammerSpread=90)))
    round_ = dict(burst, spin=360, rise=-15, chest=8, **out(dict(hip=55, knee=85, foot=25, arm=-4, spread=86, fore=-4, foreSpread=86, hammer=-8, hammerSpread=86)))
    KEYS = {0: READY, contact - 4: dict(tuck, spin=-25), contact - 2: tuck, contact - 1: opening, contact: burst, contact + 2: turned, last - 1: dict(round_, rise=-15), last: round_}
    PATH = [round_,
            dict(spin=360, rise=-11, chest=10, head=-4, reach=0.9, **out(dict(hip=45, knee=70, foot=15, arm=-30, spread=65, fore=-25, foreSpread=60, hammer=-35, hammerSpread=50))),
            dict(spin=360, rise=-4, chest=4, head=-2, reach=0.45, **out(dict(hip=18, knee=28, foot=5, arm=-50, spread=30, fore=-45, foreSpread=25, hammer=-40, hammerSpread=15))),
            dict(READY, spin=360)]
else:
    def swing(arm, hammer, spread=12):
        return out(dict(arm=arm, spread=spread, fore=arm, foreSpread=spread - 2, hammer=hammer, hammerSpread=4))
    raise_ = dict(tilt=-12, travel=-6, rise=3, waist=-8, chest=-18, head=-10, reach=0.9, **out(dict(hip=-15, knee=50, foot=8)), **swing(100, 130))
    cock = dict(tilt=-18, travel=-12, rise=4, waist=-12, chest=-28, head=-14, reach=1, **out(dict(hip=-25, knee=70, foot=10)), **swing(104, 140))
    loaded = dict(cock, tilt=-22, travel=-14, chest=-34, **out(dict(hip=-30, knee=80, foot=12)), **swing(108, 148))
    over = dict(tilt=-12, travel=-8, rise=3, waist=-4, chest=-14, head=-10, reach=1, **out(dict(hip=-10, knee=70, foot=12)), **swing(88, 112))
    high = dict(tilt=0, travel=4, rise=2, waist=4, chest=6, head=-8, reach=1, **out(dict(hip=15, knee=65, foot=14)), **swing(55, 66))
    drive = dict(tilt=12, travel=14, rise=0, waist=8, chest=22, head=-6, reach=1, **out(dict(hip=35, knee=60, foot=15)), **swing(14, 4))
    falling = dict(drive, tilt=15, travel=15, chest=28, **out(dict(hip=45, knee=68, foot=15)), **swing(-18, -42))
    smash = dict(drive, tilt=17, travel=15, rise=-2, chest=34, head=-2, **out(dict(hip=55, knee=80, foot=15)), **swing(-40, -75))
    KEYS = {0: READY, 4: raise_, 8: cock, contact - 3: loaded, contact - 2: over, contact - 1: high, contact: drive,
            contact + 1: falling, last - 1: dict(smash, rise=-1, chest=32), last: smash}
    PATH = [smash,
            dict(tilt=10, travel=9, rise=-2, waist=4, chest=24, head=-6, reach=0.8, **out(dict(hip=45, knee=70, foot=10)), **swing(-72, -90, 16)),
            dict(tilt=3, travel=2, rise=0, chest=6, head=-2, reach=0.35, **out(dict(hip=12, knee=20, foot=4)), **swing(-62, -40)),
            READY]

curves = bpy.data.objects.new('Curves', None)
bpy.context.scene.collection.objects.link(curves)
for frame, keyed in sorted({**KEYS, last + 2: PATH[1]}.items()):
    for channel, value in full(keyed).items():
        curves[channel] = float(value)
        curves.keyframe_insert(f'["{channel}"]', frame=frame)
fcurves = {}
for layer in curves.animation_data.action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fc in bag.fcurves:
                for point in fc.keyframe_points:
                    point.handle_left_type = point.handle_right_type = 'AUTO_CLAMPED'
                fc.update()
                fcurves[fc.data_path[2:-2]] = fc

STOPS = [i / (len(PATH) - 1) for i in range(len(PATH))]
LEGS = [full(p) for p in PATH]


def recovery(u):
    for (a, pa), (b, pb) in zip(zip(STOPS, LEGS), zip(STOPS[1:], LEGS[1:])):
        if u <= b:
            t = (u - a) / (b - a)
            return {k: pa[k] * (1 - t) + pb[k] * t for k in READY}
    return LEGS[-1]


def glide(t, ramp=0.15):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)


samples = [i / 120 for i in range(121)]
walked = [0.0]
pose(recovery(0))
previous = [b.head.copy() for b in bones]
for u in samples[1:]:
    pose(recovery(u))
    points = [b.head.copy() for b in bones]
    walked.append(walked[-1] + sum((a - b).length for a, b in zip(points, previous)))
    previous = points


def along(s):
    goal = s * walked[-1]
    for i in range(1, len(walked)):
        if walked[i] >= goal:
            return samples[i - 1] + (samples[i] - samples[i - 1]) * (goal - walked[i - 1]) / max(walked[i] - walked[i - 1], 1e-9)
    return 1.0


settled = frames - 1
baked = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
last_q = {}
for frame in range(frames + 1):
    if frame <= last:
        pose({name: fc.evaluate(frame) for name, fc in fcurves.items()})
    else:
        pose(recovery(along(glide(min(1.0, (frame - last) / (settled - last))))))
    for name, entry in zip(created, baked['nodes']):
        b = bones[name]
        q = b.rotation_quaternion.normalized()
        if name in last_q and last_q[name].dot(q) < 0:
            q.negate()
        last_q[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(b.location))
open(keys_path, 'w').write(json.dumps(baked))
print('MOUNTAIN_KING_AERIAL_KEYS', move, keys_path, frames + 1, 'frames', flush=True)
