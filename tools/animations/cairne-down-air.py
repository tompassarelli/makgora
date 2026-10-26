"""Blender boundary: author Cairne's down air (#96), a two-handed halberd slam driven straight down beneath him.

The rig comes from `cairne-clips.ts SHIPPED OUT downAir --rig RIG.json`: every node becomes a bone with identity
rest orientation, so a bone's local rotation and location are the model's own keys. Each channel is an
auto-clamped Blender F-curve. He rises with his hooves tucked and his back arched, the halberd hauled up behind his
horns in both hands, then drops and slams it straight down beneath him on the first active frame. Through the
active window his legs kick back and his body pitches head-first over the haft, so the dive keeps driving after
the blade stops. From the last hit he rights himself while the halberd swings back under him to its carry. The
recovery is paced by arc length of the posed bones, so it moves at an even speed the end-lag check accepts and
reaches ready one frame before the clip ends. The weapon hand is solved to its grip each frame and turned so the
haft points along the keyed angle with the blade broadside to the camera; the off hand is solved onto the haft.
Tail, loincloth and hair trail the body's drop. Clip frame N is attack frame N; `cairne-clips.ts --keys` splices the baked frames and the halberd follows the hand.

  blender --background --factory-startup --python tools/animations/cairne-down-air.py -- RIG.json KEYS.json
"""
import json
import sys
from math import atan2, cos, radians, sin

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames, contact, active = spec['frames'], spec['contact'], spec['active']
last = contact + active - 1

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Cairne')
rig = bpy.data.objects.new('Cairne', armature)
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
GRIP_OFFSET = -40
grip = Vector(spec['handPivot'])
shaft = (Vector(spec['weaponPoint']) - grip).normalized()
for name, at in {'AxeTip': Vector(spec['weaponPoint']), 'AxeGrip': grip + shaft * GRIP_OFFSET}.items():
    bone = armature.edit_bones.new(name)
    bone.head = at
    bone.tail = at + Vector((0, 4, 0))
    bone.parent = armature.edit_bones[spec['hand']]
nodes = dict(zip(created, spec['nodes']))
for name in ('AxeTip', 'AxeGrip'):
    nodes[name] = {'rotation': None, 'translation': None}
bpy.ops.object.mode_set(mode='POSE')
bones = rig.pose.bones
update = bpy.context.view_layer.update

X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
REST = {}
for b in bones:
    x, y, z, w = nodes[b.name]['rotation'] or (0, 0, 0, 1)
    REST[b.name] = (Quaternion((w, x, y, z)), Vector(nodes[b.name]['translation'] or (0, 0, 0)))


def rest_pose():
    for b in bones:
        b.rotation_mode = 'QUATERNION'
        b.rotation_quaternion, b.location = REST[b.name][0].copy(), REST[b.name][1].copy()


def turn(name, pitch=0.0, yaw=0.0):
    bones[name].rotation_quaternion = Quaternion(Y, radians(pitch)) @ Quaternion(Z, radians(yaw)) @ REST[name][0]


HAND = spec['hand']
rest_pose()
update()
READY_GRIP = bones[HAND].head.copy()
READY_SHAFT = bones['AxeTip'].head - bones[HAND].head
READY_AIM = atan2(READY_SHAFT.z, READY_SHAFT.x) * 57.29578
BLADE = bones[HAND].matrix.to_quaternion().inverted() @ Y
HAND_Y = -40

KEYS = {
    0: dict(rise=0, lean=0, chest=0, head=0, hips=0, knees=0, shins=0, hooves=0, gripX=READY_GRIP.x, gripZ=READY_GRIP.z, aim=READY_AIM, solve=0),
    4: dict(rise=6, lean=-6, chest=-14, head=-8, hips=-50, knees=64, shins=-10, hooves=18, gripX=-10, gripZ=150, aim=95, solve=1),
    contact - 2: dict(rise=34, lean=-12, chest=-34, head=-18, hips=-80, knees=110, shins=-20, hooves=30, gripX=-40, gripZ=170, aim=150, solve=1),
    contact: dict(rise=-42, lean=10, chest=22, head=24, hips=14, knees=-28, shins=0, hooves=-18, gripX=44, gripZ=10, aim=-88, solve=1),
    contact + 3: dict(rise=-68, lean=14, chest=28, head=28, hips=16, knees=-32, shins=0, hooves=-20, gripX=46, gripZ=-4, aim=-96, solve=1),
    last: dict(rise=-54, lean=12, chest=32, head=26, hips=-46, knees=72, shins=-6, hooves=8, gripX=36, gripZ=10, aim=-122, solve=1),
    last + 9: dict(rise=-38, lean=8, chest=18, head=16, hips=-26, knees=38, shins=-4, hooves=4, gripX=18, gripZ=26, aim=-138, solve=0.85),
    last + 20: dict(rise=-22, lean=4, chest=8, head=7, hips=-12, knees=16, shins=0, hooves=2, gripX=-8, gripZ=42, aim=-152, solve=0.55),
    last + 30: dict(rise=-8, lean=1, chest=2, head=3, hips=-4, knees=5, shins=0, hooves=0, gripX=-34, gripZ=54, aim=-162, solve=0.25),
    frames: dict(rise=0, lean=0, chest=0, head=0, hips=0, knees=0, shins=0, hooves=0, gripX=READY_GRIP.x, gripZ=READY_GRIP.z, aim=READY_AIM, solve=0),
}

curves = bpy.data.objects.new('Curves', None)
bpy.context.scene.collection.objects.link(curves)
for frame, pose in sorted(KEYS.items()):
    for channel, value in pose.items():
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


def raw(time):
    return {name: fc.evaluate(time) for name, fc in fcurves.items()}


RELAX, STAY = 0.01, 0.2


def solve(params, effector, target, start, relax=RELAX):
    angles = list(start)

    def loss():
        grouped = {}
        for (name, axis), angle in zip(params, angles):
            grouped.setdefault(name, [0.0, 0.0])[axis] = angle
        for name, (pitch, yaw) in grouped.items():
            turn(name, pitch, yaw)
        update()
        return (bones[effector].head - target).length_squared + relax * sum(a * a for a in angles) + STAY * sum((a - s) ** 2 for a, s in zip(angles, start))

    for step in (20, 6, 2, 0.5):
        for _ in range(2):
            for i in range(len(angles)):
                origin, best, choice = angles[i], loss(), angles[i]
                for delta in (-3 * step, -2 * step, -step, step, 2 * step, 3 * step):
                    angles[i] = origin + delta
                    score = loss()
                    if score < best:
                        best, choice = score, angles[i]
                angles[i] = choice
    loss()
    return angles


def aim_halberd(degrees_):
    hand = bones[HAND]
    direction = Vector((cos(radians(degrees_)), 0, sin(radians(degrees_))))
    held = (bones['AxeTip'].head - hand.head).normalized()
    m = hand.matrix.copy()
    turned = held.rotation_difference(direction) @ m.to_quaternion()
    normal = turned @ BLADE
    across = (normal - direction * normal.dot(direction)).normalized()
    turned = Quaternion(direction, atan2(direction.dot(across.cross(Y)), across.dot(Y))) @ turned
    hand.matrix = Matrix.LocRotScale(m.translation, turned, m.to_scale())
    update()


def blend_to_rest(names, weight):
    for name in names:
        b = bones[name]
        b.rotation_quaternion = REST[name][0].slerp(b.rotation_quaternion, weight)


ARM = [('Bone_UpperArmR', 0), ('Bone_UpperArmR', 1), ('Bone_LowerArmR', 0), ('Bone_LowerArmR', 1)]
OFF_ARM = [('Bone_UpperArmL', 0), ('Bone_UpperArmL', 1), ('Bone_LowerArmL', 0), ('Bone_LowerArmL', 1)]
TRAIL = {'Bone_Tail1': 0.5, 'Bone_Tail2': 0.4, 'Bone_Tail3': 0.3, 'Bone_Tail4': 0.25, 'Bone_Cloth1': -0.35, 'Bone_Cloth2': -0.25,
         'Bone_Cloth003': -0.2, 'Bone_Hair1M': -0.3, 'Bone_Hair2M': -0.25, 'Bone_Hiar1L': -0.3, 'Bone_Hair2L': -0.25,
         'Bone_Hiar1R': -0.3, 'Bone_Hair2R': -0.25, 'Bone_Beard': -0.3}
LAG = 3
TRACKED = [b.name for b in bones if b.name.startswith('Bone_') or b.name.startswith('Axe')]


def pose(time, state):
    c = raw(time)
    rest_pose()
    bones['Main'].location = REST['Main'][1] + Vector((0, 0, c['rise']))
    turn('Root', c['lean'])
    turn('Bone_Chest', c['chest'])
    turn('Bone_Head', c['head'])
    for side, share in (('L', 1.0), ('R', 0.9)):
        turn(f'Bone_Upperleg{side}', c['hips'] * share)
        turn(f'Bone_Leg2{side}', c['knees'] * share)
        turn(f'Bone_Leg3{side}', c['shins'])
        turn(f'Bone_Foot{side}', c['hooves'])
    update()
    relax = RELAX + 2 * (1 - c['solve'])
    target = Vector((c['gripX'], READY_GRIP.y + (HAND_Y - READY_GRIP.y) * c['solve'], c['gripZ'] + c['rise']))
    state['arm'] = solve(ARM, HAND, target, state['arm'], relax)
    aim_halberd(c['aim'])
    blend_to_rest(['Bone_UpperArmR', 'Bone_LowerArmR', HAND], c['solve'])
    update()
    state['off'] = solve(OFF_ARM, 'Bone_HandL', bones['AxeGrip'].head.copy(), state['off'], relax)
    blend_to_rest(['Bone_UpperArmL', 'Bone_LowerArmL'], c['solve'])
    sink = raw(max(0, time - LAG))['rise'] - raw(max(0, time - LAG - 2))['rise']
    for name, gain in TRAIL.items():
        turn(name, max(-40.0, min(40.0, gain * -sink * 3)) * c['solve'])
    update()


def even_recovery(per_frame=4):
    state = {'arm': [0, 0, 0, 0], 'off': [0, 0, 0, 0]}
    for frame in range(last + 1):
        pose(frame, state)
    steps = (frames - last) * per_frame
    times, lengths, before = [], [], None
    for i in range(steps + 1):
        time = last + (frames - last) * i / steps
        pose(time, state)
        now = [bones[name].head.copy() for name in TRACKED]
        lengths.append(0.0 if before is None else lengths[-1] + sum((a - b).length for a, b in zip(now, before)) / len(now))
        times.append(time)
        before = now
    return times, lengths


TIMES, LENGTHS = even_recovery()


def clip_time(frame):
    if frame <= last:
        return frame
    if frame >= frames - 1:
        return frames
    want = LENGTHS[-1] * (frame - last) / (frames - 1 - last)
    i = next(i for i, length in enumerate(LENGTHS) if length >= want - 1e-9)
    if i == 0:
        return TIMES[0]
    span = LENGTHS[i] - LENGTHS[i - 1]
    return TIMES[i - 1] + (TIMES[i] - TIMES[i - 1]) * (0 if span <= 0 else (want - LENGTHS[i - 1]) / span)


state = {'arm': [0, 0, 0, 0], 'off': [0, 0, 0, 0]}
out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
last_q = {}
for frame in range(frames + 1):
    pose(clip_time(frame), state)
    for name, entry in zip(created, out['nodes']):
        b = bones[name]
        q = b.rotation_quaternion.normalized()
        if name in last_q and last_q[name].dot(q) < 0:
            q.negate()
        last_q[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(b.location))
    if frame in KEYS:
        tip = bones['AxeTip'].head
        print(f'frame {frame} grip {tuple(round(v) for v in bones[HAND].head)} tip {tuple(round(v) for v in tip)}'
              f' off {round((bones["Bone_HandL"].head - bones["AxeGrip"].head).length)}', flush=True)
open(keys_path, 'w').write(json.dumps(out))
print('CAIRNE_DOWN_AIR_KEYS', keys_path, frames + 1, 'frames', 'ready aim', round(READY_AIM), flush=True)
