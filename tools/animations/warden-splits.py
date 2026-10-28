"""Blender boundary: author Maiev's down smash (#518) as the splits, one leg kicked out in front and one behind.

The rig comes from `attack-gesture-clips.ts PRIVATE_ASSETS OUT --character 5 --replace-pose downSmash --rig RIG.json`:
every node becomes a bone with identity rest orientation, so a bone's local rotation and location are the model's
own keys. Both feet and hands are solved to side-view targets each frame, the glaive ring is swung about the
side-view axis so its face stays to the camera, and her cloak's ground anchor follows the body. She dips, then
rises onto her back foot through the charge with her front knee tucked and both arms raised behind her, drops her
pelvis to the floor with both legs driven straight out along it, front and back, on the first active frame with the
glaive thrown forward above her front leg, slides forward on the split through the active window, folds over her
front leg, draws her rear leg in under her and springs back up to ready. Her chest flaps and cloak drape on the floor
instead of passing through it.

  blender --background --factory-startup --python tools/animations/warden-splits.py -- RIG.json KEYS.json
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
CLOTH = ['Cape_Dummy03', *(f'Cape_Piece{i:02}' for i in (1, 2, 3, 4, 11, 12, 13, 14, 15, 16))]
FLAPS = [('Mesh06', 'Mesh29', 'Mesh30', -1), ('Mesh45', 'Mesh48', 'Mesh34', -1), ('Mesh46', 'Mesh47', 'Mesh36', -1),
         ('Mesh05', 'Mesh09', 'Mesh35', -1), ('Mesh41', 'Mesh44', 'Mesh32', 1), ('Mesh42', 'Mesh43', 'Mesh37', 1)]


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
LIMIT = {name: min([FLOOR + 2, bones[name].head.z] + [c.head.z for c in bones[name].children_recursive]) for name in CLOTH}
SHOULDER = {side: bones[f'Bone_Arm1_{side}'].head.copy() for side in 'LR'}
relative = lambda side: (bones[f'Bone_Hand_{side}'].head.x - SHOULDER[side].x, bones[f'Bone_Hand_{side}'].head.z - SHOULDER[side].z)
RING0 = side_angle(ring_center() - bones['Bone_Hand_R'].head)
READY = dict(dx=0, dz=0, lean=0, chest=0, head=0, hand=relative('R'), ring=RING0 + 360 if RING0 < 0 else RING0,
             off=relative('L'), front=bones['Bone_Foot_L'].head.x, back=bones['Bone_Foot_R'].head.x, fl=0, bl=0,
             fk=(1, 0, 0), bk=(1, 0, 0), cape=0, cx=0)
GRIP = bones['Bone_Hand_R'].matrix.to_quaternion()
DIP = dict(dx=0, dz=-10, lean=8, chest=4, head=-4, hand=(14, 4), ring=220, off=(20, -8), front=12, back=-22, fl=0, bl=0,
           fk=(1, 0, 0), bk=(1, 0, 0), cape=0, cx=0)
COIL = dict(dx=-2, dz=2, lean=-12, chest=-8, head=-8, hand=(-10, 42), ring=110, off=(-14, 36), front=-16, back=-14, fl=16, bl=0,
            fk=(1, 0, 0), bk=(1, 0, 0), cape=-6, cx=0)
COIL2 = dict(COIL, dz=4, lean=-14, chest=-10, hand=(-12, 44), ring=105, off=(-16, 38), front=-18, fl=18)
DROP = dict(dx=0, dz=-26, lean=-6, chest=-2, head=-4, hand=(10, 34), ring=80, off=(-20, 24), front=46, back=-62, fl=6, bl=6,
            fk=(1, 0, 1), bk=(1, 0, 0), cape=4, cx=-16)
SPLIT = dict(dx=2, dz=-44, lean=-4, chest=-2, head=2, hand=(22, 22), ring=50, off=(-38, 14), front=100, back=-100, fl=2, bl=2,
             fk=(0, 0, 1), bk=(1, 0, 0), cape=6, cx=-30)
SLIDE = dict(SPLIT, dx=20, dz=-40, lean=6, chest=4, hand=(26, 18), ring=40, off=(-40, 18), front=120)
SINK = dict(SLIDE, dx=14, dz=-42, lean=10, hand=(24, 20), ring=45, off=(-38, 14))
FOLD = dict(dx=10, dz=-40, lean=24, chest=10, head=-6, hand=(20, 30), ring=60, off=(30, -20), front=120, back=-100, fl=2, bl=2,
            fk=(0, 0, 1), bk=(1, 0, 0), cape=20, cx=-24)
GATHER = dict(dx=2, dz=-34, lean=22, chest=10, head=-10, hand=(12, 24), ring=120, off=(30, -24), front=70, back=-64, fl=0, bl=0,
              fk=(0, 0, 1), bk=(1, 0, 1), cape=20, cx=-16)
SPRING = dict(dx=0, dz=4, lean=-4, chest=-2, head=-4, hand=(6, -30), ring=225, off=(14, -30), front=16, back=-32, fl=0, bl=0,
              fk=(1, 0, 0), bk=(1, 0, 0), cape=-4, cx=-4)
BEATS = [(0, READY), (1, DIP), (2, COIL), (contact - 2, COIL2), (contact - 1, DROP), (contact, SPLIT), (contact + 3, SLIDE),
         (last + 1, SINK), (16, FOLD), (22, GATHER), (38, SPRING), (frames - 1, READY), (frames, READY)]
SETTLE = 38


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
    for (a, pa), (b, pb) in zip(BEATS, BEATS[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a)
            return blend(pa, pb, t if b - a == 1 else smooth(t) if b - a < 4 else glide(t))
    return READY


def pose(p):
    rest()
    root = bones['Bone_Root']
    root.location += Vector((p['dx'], 0, p['dz']))
    anchor = bones['Cape_Dummy04']
    anchor.location += Vector((p['dx'] + p['cx'], 0, 0))
    update()
    pitch('Bone_Root', p['lean'])
    pitch('Bone_Chest', p['chest'])
    pitch('Bone_Head', p['head'])
    pitch('Cape_Dummy02', p['cape'] - p['lean'] - p['chest'])
    for upper, lower, end, x, lift, bend in (('Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Foot_L', p['front'], p['fl'], p['fk']),
                                             ('Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Foot_R', p['back'], p['bl'], p['bk'])):
        reach(upper, lower, end, x, FLOOR + lift, bend)
    for side, key in (('R', 'hand'), ('L', 'off')):
        shoulder = bones[f'Bone_Arm1_{side}'].head
        reach(f'Bone_Arm1_{side}', f'Bone_Arm2_{side}', f'Bone_Hand_{side}', shoulder.x + p[key][0], shoulder.z + p[key][1], (0, 0, -1))
    held = Quaternion(Y, radians(READY['ring'] - p['ring'])) @ GRIP
    turn('Bone_Hand_R', held @ bones['Bone_Hand_R'].matrix.to_quaternion().inverted())
    for upper, lower, end, away in FLAPS:
        top, mid = bones[upper].head, bones[lower].head
        slack = (mid - top).length + (bones[end].head - mid).length - (top.z - FLOOR - 2)
        if slack > 0:
            reach(upper, lower, end, top.x + away * 10 * min(1, slack / 20), FLOOR + 2, (away, 0, 0))
    for name in CLOTH:
        b = bones[name]
        lift = LIMIT[name] - min([b.head.z] + [c.head.z for c in b.children_recursive])
        if lift > 0:
            away = 1 if b.head.x > bones['Bone_Pelvis'].head.x else -1
            b.matrix = Matrix.Translation(Vector((away * lift * 0.8, 0, lift))) @ b.matrix
            update()


def settle(frame):
    return 1.0 if frame == 0 else smooth(min(1, max(0, (frame - SETTLE) / (frames - 1 - SETTLE))))


def ease_to_rest(weight):
    solved = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in bones}
    rest()
    for b in bones:
        q, loc = solved[b.name]
        b.rotation_quaternion = q.slerp(b.rotation_quaternion, weight)
        b.location = loc.lerp(b.location, weight)
    update()


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
previous = {}
last_heads = []
for frame in range(frames + 1):
    pose(at(frame))
    if settle(frame) > 0:
        ease_to_rest(settle(frame))
    if '--debug' in sys.argv:
        r = ring_center()
        heads = [b.head.copy() for b in bones]
        step = sum((h - q).length for h, q in zip(heads, last_heads)) / len(heads) if frame else 0
        last_heads = heads
        print('DBG', frame, 'step', round(step, 1), *(f"{k} {round(bones[b].head.x)},{round(bones[b].head.z)}" for k, b in (
            ('pelvis', 'Bone_Pelvis'), ('head', 'Bone_Head'), ('hand', 'Bone_Hand_R'), ('footF', 'Bone_Foot_L'), ('footB', 'Bone_Foot_R'))),
            'ring', round(r.x), round(r.z), 'lowest', min((round(b.head.z), b.name) for b in bones if 'Motion' not in b.name))
    for name, entry in zip(created, out['nodes']):
        q = bones[name].rotation_quaternion.normalized()
        if name in previous and previous[name].dot(q) < 0:
            q.negate()
        previous[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(bones[name].location))
open(keys_path, 'w').write(json.dumps(out))
print('WARDEN_SPLITS_KEYS', keys_path, frames + 1, 'frames', flush=True)
