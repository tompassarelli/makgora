"""Blender boundary: author Mal'Ganis's forward and back air and his forward smash, so the two aerials strike on opposite sides with different limbs and the smash is a planted double claw rake.

The rig comes from `attack-gesture-clips.ts PRIVATE_ASSETS OUT --character 8 --replace-pose backAir|forwardAir --rig RIG.json`:
every node becomes a bone with identity rest orientation, so a bone's local rotation and location are the model's own
keys. Hands and hooves are solved to side-view targets each frame and the wings are swung about their roots.

backAir: he tucks his knees, coils both hooves up behind his hips as his chest pitches forward, drives them level
straight back on the first active frame with his wings swung clear above the kick, lets them sink down-back through
the late hit, then pulls the legs in and settles.
forwardAir: he draws his right claw up behind his head with his knees tucked and his chest leaning back, rakes it
over and down through the space in front of him as his chest pitches forward, carries it low past his knees and settles.

forwardSmash: he plants his hooves wide, arches back with the wings raised, the right claw drawn up behind his head and the
left drawn low behind his hip, holds that charge, then whips forward so both claws cross in an X in front of him through the
active frames (right high to low, left low to high), carries them through and settles.

  blender --background --factory-startup --python tools/animations/dreadlord-aerials.py -- backAir|forwardAir|forwardSmash RIG.json KEYS.json
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
PLANT = move == 'forwardSmash'
CLAW_LENGTH = 32
rest_foot = {side: (bones[f'Bone_Foot_{side}'].head.x, bones[f'Bone_Foot_{side}'].head.z) for side in 'LR'}
READY = dict(aim=0, clawR=(0, 0), clawL=(0, 0), dx=0, dz=0, lean=0, chest=0, head=0, wing=0,
             handR=relative('Bone_Arm1_R', 'Bone_Hand_R'), handL=relative('Bone_Arm1_L', 'Bone_Hand_L'),
             footL=relative('Bone_Leg1_L', 'Bone_Foot_L'), footR=relative('Bone_Leg1_R', 'Bone_Foot_R'))
if PLANT:
    READY.update(footL=(0, 0), footR=(0, 0))

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
    LET_GO = lambda t: t
    RELEASE = lambda t: smooth(t)
elif move == 'forwardAir':
    DRAW = dict(dx=-8, dz=6, lean=-22, chest=-20, head=-6, wing=-30, handR=(-26, 40), handL=(-20, 36), footL=(14, -22), footR=(10, -24))
    CROWN = dict(dx=-8, dz=7, lean=-26, chest=-22, head=-4, wing=-38, handR=(-16, 52), handL=(-12, 48), footL=(16, -20), footR=(12, -22))
    OVER = dict(dx=0, dz=7, lean=-8, chest=-6, head=2, wing=-10, handR=(14, 52), handL=(10, 48), footL=(16, -22), footR=(12, -24))
    RAKE = dict(dx=10, dz=6, lean=26, chest=18, head=8, wing=40, handR=(64, 18), handL=(56, 8), footL=(12, -26), footR=(8, -28))
    THRU = dict(dx=14, dz=5, lean=28, chest=18, head=10, wing=38, handR=(70, -22), handL=(54, -18), footL=(10, -28), footR=(6, -30))
    LOW = dict(dx=13, dz=4, lean=24, chest=16, head=10, wing=30, handR=(58, -50), handL=(40, -40), footL=(10, -30), footR=(6, -32))
    SINK = dict(LOW, dx=12, lean=22, wing=26, handR=(52, -56), handL=(36, -42))
    CARRY = dict(dx=6, dz=2, lean=16, chest=10, head=6, wing=12, handR=(14, -42), handL=(10, -40), footL=(8, -34), footR=(4, -36))
    BEATS = [(0, READY), (3, DRAW), (contact - 2, CROWN), (contact - 1, OVER), (contact, RAKE), (contact + 1, THRU), (last - 1, LOW), (last, SINK)]
    AFTER = CARRY
    FINAL = SINK
    LET_GO = lambda t: 0.5 * t
    RELEASE = lambda t: min(1, t / 0.9)
elif move == 'forwardSmash':
    HANDS = dict(aim=0, clawR=(0, 0), clawL=(0, 0))
    COIL = dict(HANDS, dx=-3, dz=-4, lean=-8, chest=-8, head=3, wing=-14, handR=(-10, 38), handL=(-10, -34), footL=(10, 0), footR=(-8, 0))
    CHARGE = dict(HANDS, dx=-6, dz=-7, lean=-14, chest=-12, head=6, wing=-20, handR=(-22, 46), handL=(-18, -40), footL=(12, 0), footR=(-12, 0))
    SHUDDER = dict(CHARGE, dx=-7, dz=-8, lean=-16, chest=-14, wing=-22, handR=(-24, 48), handL=(-20, -42))
    HOLD = dict(CHARGE, dx=-6, dz=-7, lean=-15, chest=-13, wing=-21, handR=(-23, 47), handL=(-19, -41))
    WHIP = dict(HANDS, dx=3, dz=-6, lean=6, chest=0, head=2, wing=-4, handR=(24, 40), handL=(22, -40), footL=(12, 0), footR=(-12, 0))
    BODY = dict(dx=12, dz=-10, lean=24, chest=16, head=-2, footL=(16, 0), footR=(-14, 0), handR=(0, 0), handL=(0, 0), aim=1)
    STRIKE = dict(BODY, wing=26, clawR=(92, 61), clawL=(92, 28))
    SECOND = dict(BODY, dx=15, wing=28, clawR=(102, 55), clawL=(102, 35))
    CROSS = dict(BODY, dx=18, wing=30, clawR=(110, 46), clawL=(110, 46))
    DOWN = dict(BODY, dx=20, wing=32, clawR=(116, 36), clawL=(116, 56))
    CARRY = dict(BODY, dx=12, dz=-6, lean=18, chest=12, head=0, wing=16, clawR=(104, 22), clawL=(104, 66))
    BEATS = [(0, READY), (5, COIL), (8, CHARGE), (10, SHUDDER), (12, HOLD), (contact - 2, SHUDDER), (contact - 1, WHIP), (contact, STRIKE), (contact + 1, SECOND), (contact + 2, CROSS), (last, DOWN)]
    AFTER = CARRY
    FINAL = DOWN
    LET_GO = lambda t: min(1, t / 0.3)
    RELEASE = lambda t: smooth(max(0, (t - 0.1) / 0.9))
elif move == 'downAir':
    HANDS = dict(aim=0, clawR=(0, 0), clawL=(0, 0))
    RISE = dict(HANDS, dx=-2, dz=10, lean=-10, chest=-10, head=-4, wing=-8, handR=(8, 38), handL=(4, 34), footL=(12, -22), footR=(8, -24))
    CROWN = dict(HANDS, dx=-6, dz=20, lean=-24, chest=-18, head=-8, wing=-16, handR=(-6, 62), handL=(-10, 58), footL=(2, -20), footR=(-2, -22))
    PLUNGE = dict(HANDS, dx=2, dz=6, lean=22, chest=10, head=-4, wing=-46, handR=(6, -54), handL=(0, -52), footL=(-2, -66), footR=(-6, -68))
    DRIVE = dict(HANDS, dx=4, dz=-6, lean=30, chest=14, head=-8, wing=-58, handR=(8, -72), handL=(2, -70), footL=(-4, -76), footR=(-8, -78))
    DEEP = dict(HANDS, dx=4, dz=-16, lean=32, chest=16, head=-10, wing=-62, handR=(8, -78), handL=(2, -76), footL=(-4, -82), footR=(-8, -84))
    HELD = dict(DEEP, dz=-22, handR=(8, -82), handL=(2, -80))
    CATCH = dict(HANDS, dx=0, dz=2, lean=-4, chest=-4, head=0, wing=0, handR=(14, -24), handL=(10, -22), footL=(14, -30), footR=(10, -32))
    BEATS = [(0, READY), (4, RISE), (contact - 2, CROWN), (contact, PLUNGE), (contact + 1, DRIVE), (contact + 2, DEEP), (last, HELD)]
    AFTER = CATCH
    FINAL = HELD
    LET_GO = lambda t: 0.35 * t
    RELEASE = lambda t: t
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
        return blend(FINAL, AFTER, LET_GO(recovery(frame)))
    for (a, pa), (b, pb) in zip(BEATS, BEATS[1:]):
        if a <= frame <= b:
            t = (frame - a) / (b - a) if b > a else 1
            return blend(pa, pb, t if b - a == 1 else smooth(t))
    return READY


def settled(frame):
    if frame < 2:
        return 1 - smooth(frame / 2)
    if frame > last:
        return RELEASE(recovery(frame))
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
        x, z = (rest_foot[side][0] + dx, rest_foot[side][1] + dz) if PLANT else (hip.x + dx, hip.z + dz)
        reach(f'Bone_Leg1_{side}', f'Bone_Leg2_{side}', f'Bone_Foot_{side}', x, z, (1, 0, 0.3))
    for side in 'RL':
        shoulder = bones[f'Bone_Arm1_{side}'].head
        dx, dz = p[f'hand{side}']
        if p['aim']:
            cx, cz = p[f'claw{side}']
            gx, gz = cx - shoulder.x, cz - shoulder.z
            length = (gx * gx + gz * gz) ** 0.5
            far = max(length - CLAW_LENGTH, 6) / length
            dx, dz = dx * (1 - p['aim']) + gx * far * p['aim'], dz * (1 - p['aim']) + gz * far * p['aim']
        reach(f'Bone_Arm1_{side}', f'Bone_Arm2_{side}', f'Bone_Hand_{side}', shoulder.x + dx, shoulder.z + dz, (-0.3, 0, -1))


def point(name):
    h = bones[name].head
    return round(h.x), round(h.z)


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
previous = {}
for frame in range(frames + 1):
    pose(at(frame))
    if '--debug' in sys.argv:
        print('DBG', frame, 'clawR', point(CLAW['R']), 'clawL', point(CLAW['L']), 'shR', point('Bone_Arm1_R'), 'handR', point('Bone_Hand_R'), 'footL', point('Bone_Foot_L'), 'footR', point('Bone_Foot_R'),
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
