"""Blender boundary: author Maiev's Pursuit Lunge (#487), a held glaive windup driven into a lunge on frame 14.

The rig comes from `attack-gesture-clips.ts PRIVATE_ASSETS OUT --character 5 --replace-pose sideSpecial --rig RIG.json`:
every node becomes a bone with identity rest orientation, so a bone's local rotation and location are the model's
own keys. Both feet and both hands are solved to side-view targets each frame, the glaive ring is swung about the
side-view axis so its face stays to the camera, and her cloak's ground anchor follows the body so the cloth hangs
from her instead of stretching back to where she stood. She leans back over her rear leg with the glaive raised
overhead and coils lower through the hold, springs forward on the first active frame with the ring thrown out
ahead, then somersaults forward through the active window with the ring held out at arm's length, spinning the
crescent ahead of her like a saw while she splits her legs wide upside down, lands in a low crouch with the ring ahead, and cuts it
down before she glides back to ready.
Her arm keeps nearly the same reach from the shoulder from windup to contact, so the body carries the glaive.

  blender --background --factory-startup --python tools/animations/warden-pursuit-lunge.py -- RIG.json KEYS.json
"""
import json
import sys
from math import atan2, cos, degrees, radians, sin

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames, contact, active = spec['frames'], spec['contact'], spec['active']
last = contact + active - 1

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Warden')
rig = bpy.data.objects.new('Warden', armature)
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
RING = [f'Plane0{i}' for i in range(1, 9)]


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


def pitch(name, angle):
    if angle:
        turn(name, Quaternion(Y, radians(angle)))


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


def ring_center():
    return sum((bones[name].head for name in RING), Vector()) / len(RING)


def side_angle(v):
    return degrees(atan2(v.z, v.x))


rest()
FLOOR = min(bones['Bone_Foot_L'].head.z, bones['Bone_Foot_R'].head.z)
SHOULDER = {side: bones[f'Bone_Arm1_{side}'].head.copy() for side in 'LR'}
relative = lambda side: (bones[f'Bone_Hand_{side}'].head.x - SHOULDER[side].x, bones[f'Bone_Hand_{side}'].head.z - SHOULDER[side].z)
READY = dict(dx=0, dz=0, lean=0, chest=0, head=0, hand=relative('R'), ring=side_angle(ring_center() - bones['Bone_Hand_R'].head),
             off=relative('L'), front=bones['Bone_Foot_L'].head.x, back=bones['Bone_Foot_R'].head.x, cape=0)
GRIP = bones['Bone_Hand_R'].matrix.to_quaternion()
WINDUP = dict(dx=-66, dz=-22, lean=-24, chest=-8, head=18, hand=(22, 26), ring=95, off=(40, -4), front=-30, back=-116, cape=-20)
COIL = dict(dx=-72, dz=-28, lean=-28, chest=-10, head=22, hand=(20, 30), ring=105, off=(42, 0), front=-30, back=-118, cape=-24)
THROW = dict(dx=88, dz=-14, lean=22, chest=10, head=-20, hand=(24, 4), ring=-10, off=(-30, -20), front=114, back=32, cape=30)
EXTEND = dict(dx=94, dz=-16, lean=26, chest=12, head=-22, hand=(26, 2), ring=-15, off=(-32, -18), front=116, back=38, cape=34)
TUCK = (12, -22, -8, -20)
SPLIT = (34, -40, -34, -40)


def body(lean, x, z):
    t = radians(lean)
    return (x * cos(t) + z * sin(t), -x * sin(t) + z * cos(t))


def flip(lean, dx, dz, air, arm=26, legs=TUCK):
    return dict(dx=dx, dz=dz, lean=lean, chest=0, head=-10, hand=body(lean, arm, 0), ring=-lean, off=body(lean, -10, -14),
                front=110, back=44, cape=-60, air=air, legs=legs)


DIVE = flip(95, 88, -4, 0.6, 18)
INVERT = dict(flip(180, 92, 22, 1, legs=SPLIT), hand=(22, -10), ring=-395)
OVER = dict(flip(270, 92, 12, 1), ring=-630)
LAND = dict(dx=90, dz=-30, lean=380, chest=10, head=-20, hand=(20, -12), ring=-740, off=(-30, -14), front=112, back=44, cape=40)
FOLLOW = dict(dx=86, dz=-26, lean=376, chest=8, head=-16, hand=(14, -18), ring=-770, off=(-26, -16), front=110, back=42, cape=34)
for key in (READY, WINDUP, COIL, THROW, EXTEND, LAND, FOLLOW):
    key.update(air=0, legs=TUCK)
DONE = dict(READY, lean=360, ring=READY['ring'] - 360 * ((READY['ring'] - FOLLOW['ring']) // 360 + 1))
settle = 6
cut = last - 1
follow = cut + 4
rise = follow + 10
BEATS = [(0, READY), (settle, WINDUP), (contact - 1, COIL), (contact, THROW), (contact + 1, EXTEND), (contact + 3, DIVE), (contact + 5, INVERT),
         (contact + 7, OVER), (cut, LAND), (follow, FOLLOW)]


def blend(a, b, t):
    mix = lambda u, v: tuple(p * (1 - t) + q * t for p, q in zip(u, v)) if isinstance(u, tuple) else u * (1 - t) + v * t
    return {k: mix(a[k], b[k]) for k in a}


RISE = blend(FOLLOW, DONE, 0.6)


def glide(t, ramp=0.2):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)


def smooth(t):
    return t * t * (3 - 2 * t)


def at(frame):
    if frame > rise:
        u = (frame - rise) / (frames - rise)
        return blend(RISE, DONE, 1 - (1 - u) ** 2)
    if frame > follow:
        return blend(FOLLOW, RISE, (frame - follow) / (rise - follow))
    for (a, pa), (b, pb) in zip(BEATS, BEATS[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a)
            return blend(pa, pb, t if a >= contact else smooth(t))
    return READY


def pose(p):
    rest()
    root = bones['Bone_Root']
    root.location += Vector((p['dx'], 0, p['dz']))
    anchor = bones['Cape_Dummy04']
    anchor.location += Vector((p['dx'], 0, p['dz'] * 0.5))
    update()
    pitch('Bone_Root', p['lean'])
    pitch('Bone_Chest', p['chest'])
    pitch('Bone_Head', p['head'])
    pitch('Cape_Dummy02', p['cape'] - p['lean'] - p['chest'])
    t = radians(p['lean'])
    ahead, up = Vector((cos(t), 0, -sin(t))), Vector((sin(t), 0, cos(t)))
    for upper, lower, end, x, tuck in (('Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Foot_L', p['front'], p['legs'][:2]), ('Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Foot_R', p['back'], p['legs'][2:])):
        tucked = bones[upper].head + ahead * tuck[0] + up * tuck[1]
        reach(upper, lower, end, x * (1 - p['air']) + tucked.x * p['air'], FLOOR * (1 - p['air']) + tucked.z * p['air'], ahead)
    for side, key in (('R', 'hand'), ('L', 'off')):
        shoulder = bones[f'Bone_Arm1_{side}'].head
        reach(f'Bone_Arm1_{side}', f'Bone_Arm2_{side}', f'Bone_Hand_{side}', shoulder.x + p[key][0], shoulder.z + p[key][1], -up)
    held = Quaternion(Y, radians(READY['ring'] - p['ring'])) @ GRIP
    turn('Bone_Hand_R', held @ bones['Bone_Hand_R'].matrix.to_quaternion().inverted())


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
previous = {}
for frame in range(frames + 1):
    pose(at(frame))
    for name, entry in zip(created, out['nodes']):
        q = bones[name].rotation_quaternion.normalized()
        if name in previous and previous[name].dot(q) < 0:
            q.negate()
        previous[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(bones[name].location))
open(keys_path, 'w').write(json.dumps(out))
print('WARDEN_PURSUIT_LUNGE_KEYS', keys_path, frames + 1, 'frames', flush=True)
