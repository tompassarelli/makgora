"""Blender boundary: author Muradin's forward air, a two-hit swing: one hammer, then the other.

The rig comes from `attack-gesture-clips.ts PRIVATE_ASSETS OUT --character 4 --replace-pose forwardAir --rig RIG.json`,
whose `hits` lists the move's two active windows. Every node becomes a bone with identity rest orientation, so a bone's
local rotation and location are the model's own keys. Hands and feet are solved to side-view targets each frame, each
hammer is swung about the side-view axis so its head stays in the camera's plane, and the chest twists about the
vertical so the swinging shoulder leads. Legs stay tucked under him throughout: it is an aerial.
He cocks the left hammer back over his shoulder and sweeps it level through the first window, drops it under him as
the right hammer rises overhead, chops the right hammer forward and down through the second window, carries it under
his hips and settles to ready.

  blender --background --factory-startup --python tools/animations/mountain-king-forward-air.py -- RIG.json KEYS.json
"""
import json
import sys
from math import atan2, degrees, radians

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:][:2]
spec = json.loads(open(rig_path).read())
frames = spec['frames']
(first, first_end), (second, second_end) = spec['hits']

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
HAMMER = {side: [n['name'] for n in spec['nodes'] if n['parent'] >= 0 and spec['nodes'][n['parent']]['name'] == weapon]
          for side, weapon in (('R', '1Cylinder04'), ('L', '1Cylinder03'))}


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


def hammer_head(side):
    return sum((bones[name].head for name in HAMMER[side]), Vector()) / len(HAMMER[side])


def side_angle(v):
    return degrees(atan2(v.z, v.x))


def near(angle, to):
    return angle + 360 * round((to - angle) / 360)


rest()
relative = lambda side: (bones[f'Bone_Hand_{side}'].head.x - bones[f'Bone_Arm1_{side}'].head.x, bones[f'Bone_Hand_{side}'].head.z - bones[f'Bone_Arm1_{side}'].head.z)
foot = lambda side: (bones[f'Bone_Foot_{side}'].head.x - bones[f'Bone_Leg1_{side}'].head.x, bones[f'Bone_Foot_{side}'].head.z - bones[f'Bone_Leg1_{side}'].head.z)
REST = {side: side_angle(hammer_head(side) - bones[f'Bone_Hand_{side}'].head) for side in 'LR'}
GRIP = {side: bones[f'Bone_Hand_{side}'].matrix.to_quaternion() for side in 'LR'}
READY = dict(dx=0, dz=0, lean=0, twist=0, chest=0, head=0, handR=relative('R'), axeR=REST['R'], handL=relative('L'), axeL=REST['L'],
             footL=foot('L'), footR=foot('R'))
TUCK = dict(footL=(14, -24), footR=(4, -28))
COCK = dict(READY, **TUCK, dx=-4, dz=3, lean=-6, twist=16, chest=-6, head=-4, handL=(-12, 22), axeL=near(150, REST['L']), handR=(12, -14), axeR=near(-20, REST['R']))
SWEEP = dict(COCK, dx=6, lean=8, twist=-14, chest=6, head=4, handL=(30, 2), axeL=near(0, REST['L']), handR=(4, -16), axeR=near(-40, REST['R']))
THROUGH = dict(SWEEP, dx=8, lean=10, twist=-18, handL=(26, -10), axeL=near(-30, REST['L']))
DROP = dict(THROUGH, dx=2, lean=0, twist=-4, chest=-4, head=-2, handL=(8, -22), axeL=near(-95, REST['L']), handR=(-6, 22), axeR=near(140, REST['R']))
RAISE = dict(DROP, dx=-2, dz=4, lean=-6, twist=-16, chest=-8, head=-6, handL=(-8, -16), axeL=near(-120, REST['L']), handR=(2, 28), axeR=near(105, REST['R']))
CHOP = dict(RAISE, dx=8, dz=2, lean=14, twist=12, chest=10, head=8, handR=(26, 12), axeR=near(15, REST['R']))
CLEAVE = dict(CHOP, dx=10, lean=18, twist=16, chest=12, handR=(26, -2), axeR=near(-30, REST['R']))
FINISH = dict(CLEAVE, dx=10, lean=20, twist=16, chest=12, handR=(20, -14), axeR=near(-62, REST['R']))
CARRY = dict(FINISH, dx=6, lean=12, twist=8, chest=6, head=4, handR=(6, -24), axeR=near(-100, REST['R']))
SETTLE = dict(READY, **TUCK, axeR=near(REST['R'], CARRY['axeR']), axeL=near(REST['L'], CARRY['axeL']))
BEATS = [(0, READY), (3, COCK), (first - 2, COCK), (first, SWEEP), (first_end, THROUGH), (first_end + 2, DROP),
         (second - 2, RAISE), (second - 1, RAISE), (second, CHOP), (second + 1, CLEAVE), (second_end, FINISH), (second_end + 3, CARRY)]
last = BEATS[-1][0]


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
        return blend(CARRY, SETTLE, glide(((frame - last) / (frames - last)) ** 1.2))
    for (a, pa), (b, pb) in zip(BEATS, BEATS[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a) if b > a else 1
            return blend(pa, pb, t if b - a == 1 else smooth(t))
    return READY


def settled(frame):
    if frame > last:
        return glide(((frame - last) / (frames - last)) ** 1.6)
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
    for side in 'RL':
        shoulder = bones[f'Bone_Arm1_{side}'].head
        hx, hz = p[f'hand{side}']
        reach(f'Bone_Arm1_{side}', f'Bone_Arm2_{side}', f'Bone_Hand_{side}', shoulder.x + hx, shoulder.z + hz, (0, 0, -1))
        held = Quaternion(Y, radians(REST[side] - p[f'axe{side}'])) @ GRIP[side]
        turn(f'Bone_Hand_{side}', held @ bones[f'Bone_Hand_{side}'].matrix.to_quaternion().inverted())


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
previous = {}
for frame in range(frames + 1):
    pose(at(frame))
    if '--debug' in sys.argv:
        print('DBG', frame, *(f"{side} hand {round(bones[f'Bone_Hand_{side}'].head.x)} {round(bones[f'Bone_Hand_{side}'].head.z)} head {round(hammer_head(side).x)} {round(hammer_head(side).z)}" for side in 'LR'))
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
print('MOUNTAIN_KING_FORWARD_AIR_KEYS', keys_path, frames + 1, 'frames', flush=True)
