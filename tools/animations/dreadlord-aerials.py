"""Blender boundary: author Mal'Ganis's forward and back air, so the two aerials strike on opposite sides with different limbs.

The rig comes from `attack-gesture-clips.ts PRIVATE_ASSETS OUT --character 8 --replace-pose backAir|forwardAir --rig RIG.json`:
every node becomes a bone with identity rest orientation, so a bone's local rotation and location are the model's own
keys. Hands and hooves are solved to side-view targets each frame and the wings are swung about their roots.

backAir: he tucks his knees, coils both hooves up behind his hips as his chest pitches forward, drives them level
straight back on the first active frame with his wings swung clear above the kick, lets them sink down-back through
the late hit, then pulls the legs in and settles.
forwardAir: he draws his right claw up behind his head with his knees tucked and his chest leaning back, rakes it
over and down through the space in front of him as his chest pitches forward, carries it low past his knees and settles.

  blender --background --factory-startup --python tools/animations/dreadlord-aerials.py -- backAir|forwardAir RIG.json KEYS.json
"""
import json
import sys
from math import radians

import bpy
from mathutils import Matrix, Quaternion, Vector

move, rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:][:3]
spec = json.loads(open(rig_path).read())
frames, contact, active = spec['frames'], spec['contact'], spec['active']
last = contact + active - 1

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Dreadlord')
rig = bpy.data.objects.new('Dreadlord', armature)
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
WINGS = {'R': 'Mesh67', 'L': 'New Wings'}
CLAW = {'R': 'Bone Finger L', 'L': 'Bone Finger R'}


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


rest()
relative = lambda root, end: (bones[end].head.x - bones[root].head.x, bones[end].head.z - bones[root].head.z)
READY = dict(dx=0, dz=0, lean=0, chest=0, head=0, wing=0,
             handR=relative('Bone_Arm1_R', 'Bone_Hand_R'), handL=relative('Bone_Arm1_L', 'Bone_Hand_L'),
             footL=relative('Bone_Leg1_L', 'Bone_Foot_L'), footR=relative('Bone_Leg1_R', 'Bone_Foot_R'))

if move == 'backAir':
    TUCK = dict(dx=0, dz=6, lean=8, chest=6, head=-4, wing=4, handR=(6, -30), handL=(2, -32), footL=(16, -14), footR=(12, -16))
    COIL = dict(dx=0, dz=8, lean=24, chest=12, head=-10, wing=0, handR=(4, -30), handL=(0, -32), footL=(-26, 10), footR=(-30, 14))
    KICK = dict(dx=-12, dz=8, lean=40, chest=18, head=-24, wing=-70, handR=(-4, -34), handL=(-8, -34), footL=(-60, -2), footR=(-60, 2))
    DRIVE = dict(dx=-14, dz=8, lean=44, chest=20, head=-28, wing=-80, handR=(-6, -34), handL=(-10, -34), footL=(-58, -14), footR=(-58, -10))
    HELD = dict(dx=-10, dz=7, lean=40, chest=18, head=-26, wing=-70, handR=(-4, -36), handL=(-8, -36), footL=(-50, -20), footR=(-50, -16))
    PULL = dict(dx=-6, dz=5, lean=22, chest=10, head=-14, wing=-30, handR=(2, -36), handL=(-2, -36), footL=(-14, -28), footR=(-10, -26))
    BEATS = [(0, READY), (3, TUCK), (contact - 2, COIL), (contact, KICK), (contact + 1, DRIVE), (last, HELD)]
    AFTER = PULL
    FINAL = HELD
elif move == 'forwardAir':
    DRAW = dict(dx=-4, dz=6, lean=-10, chest=-14, head=-6, wing=8, handR=(-26, 34), handL=(10, -30), footL=(14, -22), footR=(10, -24))
    CROWN = dict(dx=-4, dz=7, lean=-12, chest=-18, head=-4, wing=12, handR=(-14, 48), handL=(12, -28), footL=(16, -20), footR=(12, -22))
    OVER = dict(dx=0, dz=7, lean=-6, chest=-10, head=2, wing=8, handR=(8, 50), handL=(6, -30), footL=(16, -22), footR=(12, -24))
    RAKE = dict(dx=6, dz=6, lean=14, chest=10, head=10, wing=-6, handR=(64, 18), handL=(-10, -26), footL=(12, -26), footR=(8, -28))
    THRU = dict(dx=8, dz=5, lean=20, chest=14, head=12, wing=-10, handR=(62, -10), handL=(-16, -22), footL=(10, -28), footR=(6, -30))
    LOW = dict(dx=8, dz=4, lean=22, chest=16, head=12, wing=-10, handR=(46, -38), handL=(-18, -20), footL=(10, -30), footR=(6, -32))
    CARRY = dict(dx=4, dz=2, lean=12, chest=8, head=6, wing=-4, handR=(14, -42), handL=(-8, -26), footL=(8, -34), footR=(4, -36))
    BEATS = [(0, READY), (3, DRAW), (contact - 2, CROWN), (contact - 1, OVER), (contact, RAKE), (contact + 1, THRU), (last, LOW)]
    AFTER = CARRY
    FINAL = LOW
else:
    raise SystemExit(f'unknown move {move}')


def blend(a, b, t):
    mix = lambda u, v: tuple(p * (1 - t) + q * t for p, q in zip(u, v)) if isinstance(u, tuple) else u * (1 - t) + v * t
    return {k: mix(a[k], b[k]) for k in a}


def smooth(t):
    return t * t * (3 - 2 * t)


def recovery(frame):
    return (frame - last) / (frames - last)


def at(frame):
    if frame > last:
        return blend(FINAL, AFTER, recovery(frame))
    for (a, pa), (b, pb) in zip(BEATS, BEATS[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a) if b > a else 1
            return blend(pa, pb, t if b - a == 1 else smooth(t))
    return READY


def settled(frame):
    if frame < 2:
        return 1 - smooth(frame / 2)
    if frame > last:
        return smooth(recovery(frame))
    return 0


def pose(p):
    rest()
    bones['Bone_Root'].location += Vector((p['dx'], 0, p['dz']))
    update()
    pitch('Bone_Root', p['lean'])
    pitch('Bone_Chest', p['chest'])
    pitch('Bone_Head', p['head'] - p['chest'] - p['lean'])
    for wing in WINGS.values():
        pitch(wing, p['wing'])
    for side in 'LR':
        hip = bones[f'Bone_Leg1_{side}'].head
        dx, dz = p[f'foot{side}']
        reach(f'Bone_Leg1_{side}', f'Bone_Leg2_{side}', f'Bone_Foot_{side}', hip.x + dx, hip.z + dz, (1, 0, 0.3))
    for side in 'RL':
        shoulder = bones[f'Bone_Arm1_{side}'].head
        dx, dz = p[f'hand{side}']
        reach(f'Bone_Arm1_{side}', f'Bone_Arm2_{side}', f'Bone_Hand_{side}', shoulder.x + dx, shoulder.z + dz, (-0.3, 0, -1))


def point(name):
    h = bones[name].head
    return round(h.x), round(h.z)


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
previous = {}
for frame in range(frames + 1):
    pose(at(frame))
    if '--debug' in sys.argv:
        print('DBG', frame, 'clawR', point(CLAW['R']), 'handR', point('Bone_Hand_R'), 'footL', point('Bone_Foot_L'), 'footR', point('Bone_Foot_R'),
              'kneeR', point('Bone_Leg2_R'), 'hipR', point('Bone_Leg1_R'), 'head', point('Bone_Head'), 'wingtip', point('Mesh75'), point('Mesh68'))
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
print('DREADLORD_AERIAL_KEYS', move, keys_path, frames + 1, 'frames', flush=True)
