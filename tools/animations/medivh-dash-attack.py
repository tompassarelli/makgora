"""Blender boundary: author Medivh's dash attack (#343), a staff lunge driven through Melee's 12 active frames.

The rig comes from `medivh-clips.ts SHIPPED OUT dashAttack --rig RIG.json`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the model's own keys. Each channel is
an auto-clamped Blender F-curve. He rocks back onto a bent back leg with the staff drawn behind him, plants
the front foot far forward on the first active frame and bends from the hips over it, sinking lower while
the back leg stretches out through the active window. His robe flares open over the striding legs just
enough to keep its hem off the floor. From the last hit every channel glides evenly back to ready. Both
feet and the staff hand are solved to their targets each frame, and the staff is aimed along its own shaft.
Clip frame N is attack frame N; `medivh-clips.ts --keys` splices the baked frames and floor-sets each one.

  blender --background --factory-startup --python tools/animations/medivh-dash-attack.py -- RIG.json KEYS.json
"""
import json
import sys
from math import acos, degrees, radians

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames, contact, active = spec['frames'], spec['contact'], spec['active']
last = contact + active - 1

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Medivh')
rig = bpy.data.objects.new('Medivh', armature)
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
tip = armature.edit_bones.new('StaffTip')
tip.head = Vector(spec['staffTip'])
tip.tail = tip.head + Vector((0, 4, 0))
tip.parent = armature.edit_bones['Staff']
nodes = dict(zip(created, spec['nodes']))
nodes['StaffTip'] = {'rotation': None, 'translation': None}
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
    bones[name].rotation_quaternion = Quaternion(Z, radians(yaw)) @ Quaternion(Y, radians(pitch)) @ REST[name][0]


rest_pose()
update()
ANKLE = {side: bones[f'Bone_Foot_{side}'].head.copy() for side in 'LR'}
HAND_Y = -18
READY_HAND = bones['Bone_Hand_L'].head.copy()
READY_AIM = (bones['StaffTip'].head - bones['Staff'].head).normalized()
PANELS = ['Front Cape', 'Mesh13', 'Mesh16', 'Mesh19', 'Cape']
HANGS = {'Front Cape A': 'Front Cape', 'Mesh14': 'Mesh13', 'Mesh15': 'Mesh14', 'Mesh17': 'Mesh16', 'Mesh18': 'Mesh17',
         'Mesh20': 'Mesh19', 'Mesh21': 'Mesh20', 'Mesh12': 'Cape', 'Mesh11': 'Mesh12'}
PANEL_REST = {name: bones[name].matrix.to_quaternion() for name in PANELS}
PANEL_TOP = {name: bones[name].head.z for name in PANELS}
FLARE = {'Front Cape': (Y, -1), 'Mesh13': (X, -1), 'Mesh16': (Y, 1), 'Mesh19': (Y, 1), 'Cape': (Y, 1)}
HEM = 8

KEYS = {
    0: dict(travel=0, drop=0, lean=4, chest=10, yaw=0, head=-4, freeArm=-15, freeElbow=10, handX=24, handZ=54, aimX=1, aimZ=0.05,
            frontX=16, frontZ=4, backX=-18, backZ=8, drag=8, solve=1),
    2: dict(travel=-8, drop=-6, lean=-6, chest=-10, yaw=-12, head=6, freeArm=-35, freeElbow=20, handX=-2, handZ=52, aimX=-0.8, aimZ=-0.4,
            frontX=20, frontZ=4, backX=-14, backZ=0, drag=2, solve=1),
    contact - 1: dict(travel=-18, drop=-14, lean=-12, chest=-26, yaw=-30, head=14, freeArm=-35, freeElbow=30, handX=-14, handZ=52, aimX=-1, aimZ=-0.25,
                      frontX=24, frontZ=12, backX=-14, backZ=0, drag=-14, solve=1),
    contact: dict(travel=24, drop=-12, lean=6, chest=22, yaw=14, head=-16, freeArm=40, freeElbow=20, handX=34, handZ=46, aimX=1, aimZ=-0.3,
                  frontX=48, frontZ=0, backX=-16, backZ=4, drag=10, solve=1),
    contact + 5: dict(travel=32, drop=-24, lean=9, chest=34, yaw=18, head=-24, freeArm=70, freeElbow=25, handX=40, handZ=40, aimX=1, aimZ=-0.28,
                      frontX=48, frontZ=0, backX=-12, backZ=6, drag=16, solve=1),
    last: dict(travel=40, drop=-36, lean=13, chest=46, yaw=20, head=-28, freeArm=80, freeElbow=30, handX=34, handZ=50, aimX=1, aimZ=0.15,
               frontX=48, frontZ=0, backX=-10, backZ=8, drag=18, solve=1),
    frames: dict(travel=0, drop=0, lean=0, chest=0, yaw=0, head=0, freeArm=0, freeElbow=0, handX=READY_HAND.x, handZ=READY_HAND.z,
                 aimX=READY_AIM.x, aimZ=READY_AIM.z, frontX=0, frontZ=0, backX=0, backZ=0, drag=0, solve=0),
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


def glide(t, ramp=0.06):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)


EASE_OUT = 1.3


def channels(frame):
    if frame <= last:
        return {name: fc.evaluate(frame) for name, fc in fcurves.items()}
    t = glide(((frame - last) / (frames - last)) ** EASE_OUT)
    return {name: KEYS[last][name] * (1 - t) + KEYS[frames][name] * t for name in KEYS[last]}


RELAX = 0.01


def solve(params, effector, target, start):
    angles = list(start)

    def loss():
        grouped = {}
        for (name, axis, *_), angle in zip(params, angles):
            grouped.setdefault(name, [0.0, 0.0])[axis] = angle
        for name, (pitch, yaw) in grouped.items():
            turn(name, pitch, yaw)
        update()
        return (bones[effector].head - target).length_squared + RELAX * sum(a * a for a in angles)

    for step in (20, 6, 2, 0.5):
        for _ in range(2):
            for i in range(len(angles)):
                origin, best, choice = angles[i], loss(), angles[i]
                for delta in (-3 * step, -2 * step, -step, step, 2 * step, 3 * step):
                    angles[i] = min(max(origin + delta, params[i][2]), params[i][3]) if len(params[i]) > 2 else origin + delta
                    score = loss()
                    if score < best:
                        best, choice = score, angles[i]
                angles[i] = choice
    loss()
    return angles


def blend_to_rest(names, weight):
    for name in names:
        b = bones[name]
        b.rotation_quaternion = REST[name][0].slerp(b.rotation_quaternion, weight)


def aim_staff(direction):
    hand = bones['Bone_Hand_L']
    held = (bones['StaffTip'].head - bones['Staff'].head).normalized()
    m = hand.matrix.copy()
    turned = held.rotation_difference(direction.normalized()) @ m.to_quaternion()
    hand.matrix = Matrix.LocRotScale(m.translation, turned, m.to_scale())
    update()


LEG = {side: [(f'Bone_Leg1_{side}', 0), (f'Bone_Leg2_{side}', 0, 0, 150)] for side in 'LR'}
ARM = [('Bone_Arm1_L', 0), ('Bone_Arm1_L', 1), ('Bone_Arm2_L', 0), ('Bone_Arm2_L', 1)]
previous = {'L': [0, 0], 'R': [0, 0], 'arm': [0, 0, 0, 0]}
drags = []
out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
last_q = {}
for frame in range(frames + 1):
    c = channels(frame)
    drags.append(c['drag'])
    rest_pose()
    root = bones['Bone_Root']
    root.location = REST['Bone_Root'][1] + Vector((c['travel'], 0, c['drop']))
    turn('Bone_Root', c['lean'])
    turn('Bone_Chest', c['chest'], c['yaw'])
    turn('Bone_Head', c['head'])
    turn('Bone_Arm1_R', c['freeArm'])
    turn('Bone_Arm2_R', c['freeElbow'])
    update()
    for side, (x, z) in {'L': (c['frontX'], c['frontZ']), 'R': (c['backX'], c['backZ'])}.items():
        target = ANKLE[side] + Vector((x, 0, z))
        previous[side] = solve(LEG[side], f'Bone_Foot_{side}', target, previous[side])
        foot = bones[f'Bone_Foot_{side}']
        update()
        foot.matrix = Matrix.LocRotScale(foot.matrix.translation, Quaternion(), foot.matrix.to_scale())
        update()
    previous['arm'] = solve(ARM, 'Bone_Hand_L', Vector((c['handX'] + c['travel'], HAND_Y, c['handZ'])), previous['arm'])
    aim_staff(Vector((c['aimX'], 0, c['aimZ'])))
    blend_to_rest(['Bone_Arm1_L', 'Bone_Arm2_L', 'Bone_Hand_L', 'Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Foot_L',
                   'Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Foot_R'], c['solve'])
    update()
    lag = drags[max(0, frame - 2)]
    for name in PANELS:
        b = bones[name]
        m = b.matrix.copy()
        hang = m.to_quaternion().slerp(PANEL_REST[name], 0.85)
        axis, side = FLARE[name]
        sink = max(0.0, PANEL_TOP[name] - b.head.z)
        flare = degrees(acos(max(-1.0, 1 - sink / (PANEL_TOP[name] - HEM))))
        swing = Quaternion(axis, radians(side * (flare if axis is X else max(flare, flare + side * c['drag']))))
        b.matrix = Matrix.LocRotScale(m.translation, swing @ hang, m.to_scale())
        update()
    for name, parent in HANGS.items():
        while parent in HANGS:
            parent = HANGS[parent]
        axis, side = FLARE[parent]
        if axis is Y:
            b = bones[name]
            b.rotation_quaternion = Quaternion(Y, radians(side * max(0.0, side * 0.5 * lag))) @ b.rotation_quaternion
    update()
    for name, entry in zip(created, out['nodes']):
        b = bones[name]
        q = b.rotation_quaternion.normalized()
        if name in last_q and last_q[name].dot(q) < 0:
            q.negate()
        last_q[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(b.location))
open(keys_path, 'w').write(json.dumps(out))
print('MEDIVH_DASH_ATTACK_KEYS', keys_path, frames + 1, 'frames', flush=True)
