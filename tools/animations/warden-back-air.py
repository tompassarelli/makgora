"""Blender boundary: author Maiev's back air (#550), a glaive whipped in a backward arc through the space behind her.

The rig comes from `attack-gesture-clips.ts PRIVATE_ASSETS OUT --character 5 --replace-pose backAir --rig RIG.json`:
every node becomes a bone with identity rest orientation, so a bone's local rotation and location are the model's
own keys. Both feet and hands are solved to side-view targets each frame, the glaive ring is swung about the
side-view axis so its face stays to the camera, and her cloak's ground anchor follows the body. She tucks forward
with the glaive drawn across her chest, throws it up over her shoulder, and whips it back and down behind her
through the active window while her legs stay off the floor, then carries it through and settles to ready.

  blender --background --factory-startup --python tools/animations/warden-pursuit-lunge.py -- RIG.json KEYS.json
"""
import json
import sys
from math import atan2, cos, degrees, radians, sin

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:][:2]
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
RING0 = side_angle(ring_center() - bones['Bone_Hand_R'].head)
READY = dict(dx=0, dz=0, lean=0, chest=0, head=0, hand=relative('R'), ring=RING0 + 360 if RING0 < 0 else RING0,
             off=relative('L'), front=bones['Bone_Foot_L'].head.x, back=bones['Bone_Foot_R'].head.x, fl=0, bl=0, cape=0)
GRIP = bones['Bone_Hand_R'].matrix.to_quaternion()
TUCK = dict(dx=4, dz=14, lean=14, chest=8, head=-4, hand=(26, 8), ring=20, off=(22, -8), front=30, back=-14, fl=18, bl=26, cape=10)
COCK = dict(dx=2, dz=22, lean=10, chest=4, head=-8, hand=(8, 40), ring=100, off=(18, 8), front=26, back=-8, fl=22, bl=30, cape=14)
WHIP = dict(dx=-6, dz=20, lean=26, chest=18, head=14, hand=(-34, 14), ring=160, off=(30, -4), front=44, back=-34, fl=14, bl=36, cape=26)
SWEEP = dict(dx=-12, dz=14, lean=34, chest=22, head=20, hand=(-46, 2), ring=195, off=(36, -8), front=50, back=-44, fl=8, bl=40, cape=34)
LOW = dict(dx=-14, dz=8, lean=36, chest=22, head=18, hand=(-40, -14), ring=215, off=(34, -10), front=52, back=-40, fl=4, bl=36, cape=38)
CARRY = dict(dx=-6, dz=4, lean=18, chest=10, head=8, hand=(-24, -22), ring=230, off=(24, -14), front=40, back=-20, fl=2, bl=16, cape=22)
BEATS = [(0, READY), (2, TUCK), (contact - 1, COCK), (contact, WHIP), (contact + 1, SWEEP), (last, LOW)]


def blend(a, b, t):
    mix = lambda u, v: tuple(p * (1 - t) + q * t for p, q in zip(u, v)) if isinstance(u, tuple) else u * (1 - t) + v * t
    return {k: mix(a[k], b[k]) for k in a}


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
    if frame > last:
        u = glide((frame - last) / (frames - last))
        return blend(LOW, CARRY, u / 0.45) if u < 0.45 else blend(CARRY, READY, (u - 0.45) / 0.55)
    for (a, pa), (b, pb) in zip(BEATS, BEATS[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a)
            return blend(pa, pb, t if b - a == 1 else smooth(t))
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
    for upper, lower, end, x, lift in (('Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Foot_L', p['front'], p['fl']), ('Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Foot_R', p['back'], p['bl'])):
        reach(upper, lower, end, x, FLOOR + lift, (1, 0, 0))
    for side, key in (('R', 'hand'), ('L', 'off')):
        shoulder = bones[f'Bone_Arm1_{side}'].head
        reach(f'Bone_Arm1_{side}', f'Bone_Arm2_{side}', f'Bone_Hand_{side}', shoulder.x + p[key][0], shoulder.z + p[key][1], (0, 0, -1))
    held = Quaternion(Y, radians(READY['ring'] - p['ring'])) @ GRIP
    turn('Bone_Hand_R', held @ bones['Bone_Hand_R'].matrix.to_quaternion().inverted())


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
previous = {}
for frame in range(frames + 1):
    pose(at(frame))
    if '--debug' in sys.argv:
        h=bones['Bone_Hand_R'].head; r=ring_center(); print('DBG',frame,'hand',round(h.x),round(h.z),'ring',round(r.x),round(r.z),'pelvis',round(bones['Bone_Pelvis'].head.x),round(bones['Bone_Pelvis'].head.z),'head',round(bones['Bone_Head'].head.x),round(bones['Bone_Head'].head.z))
    for name, entry in zip(created, out['nodes']):
        q = bones[name].rotation_quaternion.normalized()
        if name in previous and previous[name].dot(q) < 0:
            q.negate()
        previous[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(bones[name].location))
open(keys_path, 'w').write(json.dumps(out))
print('WARDEN_BACK_AIR_KEYS', keys_path, frames + 1, 'frames', flush=True)
