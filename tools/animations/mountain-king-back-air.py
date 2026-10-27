"""Blender boundary: author Muradin's back air (#569), a backhand axe swing through the space behind him.

The rig comes from `attack-gesture-clips.ts PRIVATE_ASSETS OUT --character 4 --replace-pose backAir --rig RIG.json`:
every node becomes a bone with identity rest orientation, so a bone's local rotation and location are the model's
own keys. Both hands and feet are solved to side-view targets each frame, the axe is swung about the side-view axis
so its blade stays in the camera's plane, and the chest twists about the vertical so the shoulders lead the swing.
He winds the axe across his front with his shoulders turned toward it, lifts it over his head, and whips it back and
down behind him through the active window with his shoulders turning into it and his legs kicked forward, carries
it on past his hip and settles to ready.

  blender --background --factory-startup --python tools/animations/mountain-king-back-air.py -- RIG.json KEYS.json
"""
import json
import sys
from math import atan2, degrees, radians

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:][:2]
spec = json.loads(open(rig_path).read())
frames, contact, active = spec['frames'], spec['contact'], spec['active']
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
bpy.ops.object.mode_set(mode='POSE')
bones = rig.pose.bones
update = bpy.context.view_layer.update
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))
AXE = [n['name'] for n in spec['nodes'] if n['parent'] >= 0 and spec['nodes'][n['parent']]['name'] == '1Cylinder04']


def rest():
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
    update()


def turn(name, rotation):
    b = bones[name]
    head = b.head.copy()
    b.matrix = Matrix.Translation(head) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-head) @ b.matrix
    update()


def pitch(name, angle, axis=Y):
    if angle:
        turn(name, Quaternion(axis, radians(angle)))


def aim(name, start, goal):
    turn(name, start.rotation_difference(goal))


def reach(upper, lower, end, x, z, bend):
    """Two-bone solve in the side view: put `end` at (x, z), the middle joint bending toward `bend`."""
    hip, mid = bones[upper].head.copy(), bones[lower].head.copy()
    a, b = (mid - hip).length, (bones[end].head - mid).length
    target = Vector((x, bones[end].head.y, z))
    span = target - hip
    d = min(span.length, a + b - 0.05)
    along = span.normalized()
    hint = Vector(bend) - along * along.dot(Vector(bend))
    offset = (a * a - b * b + d * d) / (2 * d)
    knee = hip + along * offset + hint.normalized() * max(a * a - offset * offset, 0) ** 0.5
    aim(upper, mid - hip, knee - hip)
    aim(lower, bones[end].head - bones[lower].head, target - bones[lower].head)


def axe_head():
    return sum((bones[name].head for name in AXE), Vector()) / len(AXE)


def side_angle(v):
    return degrees(atan2(v.z, v.x))


rest()
SHOULDER = {side: bones[f'Bone_Arm1_{side}'].head.copy() for side in 'LR'}
relative = lambda side: (bones[f'Bone_Hand_{side}'].head.x - SHOULDER[side].x, bones[f'Bone_Hand_{side}'].head.z - SHOULDER[side].z)
foot = lambda side: (bones[f'Bone_Foot_{side}'].head.x - bones[f'Bone_Leg1_{side}'].head.x, bones[f'Bone_Foot_{side}'].head.z - bones[f'Bone_Leg1_{side}'].head.z)
AXE0 = side_angle(axe_head() - bones['Bone_Hand_R'].head)
READY = dict(dx=0, dz=0, lean=0, twist=0, chest=0, head=0, hand=relative('R'), axe=AXE0, off=relative('L'), footL=foot('L'), footR=foot('R'))
GRIP = bones['Bone_Hand_R'].matrix.to_quaternion()
WIND = dict(dx=19, dz=2, lean=-8, twist=-12, chest=-6, head=-6, hand=(20, -4), axe=58, off=(12, -18), footL=(10, -30), footR=(-4, -32))
LIFT = dict(dx=10, dz=4, lean=-4, twist=-10, chest=-10, head=-10, hand=(4, 20), axe=104, off=(14, -14), footL=(10, -30), footR=(-2, -32))
ARC = dict(dx=0, dz=5, lean=2, twist=-4, chest=-2, head=0, hand=(-10, 22), axe=133, off=(18, -10), footL=(13, -31), footR=(3, -33))
WHIP = dict(dx=-12, dz=4, lean=10, twist=0, chest=4, head=8, hand=(-22, 14), axe=162, off=(22, -6), footL=(16, -32), footR=(8, -34))
SWEEP = dict(dx=-15, dz=3, lean=14, twist=4, chest=8, head=12, hand=(-32, -2), axe=192, off=(24, -10), footL=(18, -32), footR=(10, -34))
LOW = dict(dx=-14, dz=2, lean=16, twist=6, chest=10, head=12, hand=(-28, -14), axe=214, off=(24, -14), footL=(18, -32), footR=(10, -34))
CARRY = dict(dx=-10, dz=1, lean=12, twist=4, chest=6, head=8, hand=(-16, -26), axe=250, off=(18, -18), footL=(12, -34), footR=(10, -34))
BEATS = [(0, READY), (3, WIND), (contact - 4, WIND), (contact - 2, LIFT), (contact - 1, ARC), (contact, WHIP), (contact + 1, SWEEP), (last, LOW)]
SETTLE = dict(READY, axe=AXE0 + 360)


def blend(a, b, t):
    mix = lambda u, v: tuple(p * (1 - t) + q * t for p, q in zip(u, v)) if isinstance(u, tuple) else u * (1 - t) + v * t
    return {k: mix(a[k], b[k]) for k in a}


def glide(t, ramp=0.15):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)


def smooth(t):
    return t * t * (3 - 2 * t)


def at(frame):
    if frame > last:
        u = glide(((frame - last) / (frames - last)) ** 1.2)
        return blend(LOW, CARRY, u / 0.4) if u < 0.4 else blend(CARRY, SETTLE, (u - 0.4) / 0.6)
    for (a, pa), (b, pb) in zip(BEATS, BEATS[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a) if b > a else 1
            return blend(pa, pb, t if b - a == 1 else smooth(t))
    return READY


def settled(frame):
    if frame < 3:
        return 1 - smooth(frame / 3)
    if frame > last:
        return glide(((frame - last) / (frames - last)) ** 1.2)
    return 0


def pose(p):
    rest()
    bones['Bone_Root'].location += Vector((p['dx'], 0, p['dz']))
    update()
    pitch('Bone_Root', p['lean'])
    pitch('Bone_Chest', p['twist'], Z)
    pitch('Bone_Chest', p['chest'])
    pitch('Bone_Head', p['head'] - p['chest'] - p['lean'])
    for side, key in (('L', 'footL'), ('R', 'footR')):
        hip = bones[f'Bone_Leg1_{side}'].head
        reach(f'Bone_Leg1_{side}', f'Bone_Leg2_{side}', f'Bone_Foot_{side}', hip.x + p[key][0], hip.z + p[key][1], (1, 0, 0))
    for side, key in (('R', 'hand'), ('L', 'off')):
        shoulder = bones[f'Bone_Arm1_{side}'].head
        reach(f'Bone_Arm1_{side}', f'Bone_Arm2_{side}', f'Bone_Hand_{side}', shoulder.x + p[key][0], shoulder.z + p[key][1], (0, 0, -1))
    held = Quaternion(Y, radians(READY['axe'] - p['axe'])) @ GRIP
    turn('Bone_Hand_R', held @ bones['Bone_Hand_R'].matrix.to_quaternion().inverted())


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
previous = {}
for frame in range(frames + 1):
    pose(at(frame))
    if '--debug' in sys.argv:
        h, a, s = bones['Bone_Hand_R'].head, axe_head(), bones['Bone_Arm1_R'].head
        print('DBG', frame, 'hand', round(h.x), round(h.z), 'axe', round(a.x), round(a.z), 'shoulder', round(s.x), round(s.z), 'head', round(bones['Bone_Head'].head.x), round(bones['Bone_Head'].head.z))
    w = settled(frame)
    for name, entry in zip(created, out['nodes']):
        x, y, z, s = nodes[name]['rotation'] or (0, 0, 0, 1)
        q = bones[name].rotation_quaternion.normalized().slerp(Quaternion((s, x, y, z)), w)
        location = bones[name].location.lerp(Vector(nodes[name]['translation'] or (0, 0, 0)), w)
        if name in previous and previous[name].dot(q) < 0:
            q.negate()
        previous[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(location))
open(keys_path, 'w').write(json.dumps(out))
print('MOUNTAIN_KING_BACK_AIR_KEYS', keys_path, frames + 1, 'frames', flush=True)
