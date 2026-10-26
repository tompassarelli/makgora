"""Blender boundary: author Thrall's back air (#260), a two-hit mounted strike behind him.

The rig comes from `thrall-clips.ts STOCK OUT backAir --rig RIG.json`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the model's own keys. Each joint is
pitched about the side-view axis in armature space and the rider twists about the vertical. Both hits get
their own held windup: the wolf gathers its hind legs under it while the rider leans over its neck with the
hammer raised forward, then the wolf bucks nose-down, kicking both hind legs straight back as the rider
throws the hammer down behind; the rider then crunches forward and twists the hammer overhead, and the wolf
rears as he sweeps it back level at full reach. The hammer carries on down and around behind him, and from
the last hit the pose glides back to ready at an even pace along its arc length. The hammer hand is solved to a target off the shoulder each frame and the
hammer aimed along its shaft. Clip frame N is attack frame N; `thrall-clips.ts --keys` splices the baked
frames.

  blender --background --factory-startup --python tools/animations/thrall-back-air.py -- RIG.json KEYS.json
"""
import json
import sys
from math import atan2, cos, degrees, radians, sin

import bpy
from mathutils import Matrix, Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames = spec['frames']
(kick, kick_last), (swing, swing_last) = spec['hits']

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Thrall')
rig = bpy.data.objects.new('Thrall', armature)
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
head = armature.edit_bones.new('HammerHead')
head.head = Vector(spec['hammerHead'])
head.tail = head.head + Vector((0, 4, 0))
head.parent = armature.edit_bones['Hammer']
nodes = dict(zip(created, spec['nodes']))
nodes['HammerHead'] = {'rotation': None, 'translation': None}
bpy.ops.object.mode_set(mode='POSE')
bones = rig.pose.bones
update = bpy.context.view_layer.update

PITCH = {
    'lean': 'Bone Center', 'wolf': 'Bone Wolf Waist', 'tail': 'Bone Tail 1', 'tailTip': 'Bone Tail 2',
    'neck': 'Bone Wolf Neck', 'wolfHead': 'Bone Wolf Head',
    'hindR': 'Bone Back R Leg', 'hockR': 'Bone Back R Shin', 'hindL': 'Bone Back L Leg', 'hockL': 'Bone Back L Shin',
    'frontR': 'Bone Front R Leg', 'kneeR': 'Bone_Mesh49', 'frontL': 'Bone Front L Leg', 'kneeL': 'Bone Front L Shin',
    'waist': 'Bone Rider Waist', 'chest': 'Bone_Chest', 'head': 'Bone_Head', 'leftArm': 'Bone Rider L Arm',
}
ORDER = ['lean', 'wolf', 'tail', 'tailTip', 'neck', 'wolfHead', 'hindR', 'hockR', 'hindL', 'hockL',
         'frontR', 'kneeR', 'frontL', 'kneeL', 'twist', 'waist', 'chest', 'look', 'head', 'leftArm']
YAW = {'twist': 'Bone Rider Waist', 'look': 'Bone_Head'}
SHOULDER, ELBOW, GRIP = 'Bone Rider R Arm', 'Bone Rider R Wrist', 'Hammer'


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


def shaft():
    return bones['HammerHead'].head - bones[GRIP].head


rest()
READY_GRIP = bones[GRIP].head - bones[SHOULDER].head
READY_AIM = degrees(atan2(shaft().z, shaft().x))

READY = dict(travel=0, rise=0, gripX=READY_GRIP.x, gripZ=READY_GRIP.z, aim=READY_AIM, solve=0,
             **{k: 0 for k in ORDER})
gather = dict(lean=-6, rise=18, travel=10, hindR=-110, hindL=-102, hockR=50, hockL=45, frontR=22, frontL=26, kneeR=-20, kneeL=-20,
              tail=-25, neck=8, wolfHead=10, waist=42, twist=50, chest=18, head=-12, look=10, leftArm=-25,
              gripX=36, gripZ=2, aim=30, solve=1)
buck = dict(lean=-4, rise=-4, travel=-20, hindR=36, hindL=30, hockR=-14, hockL=-10, frontR=8, frontL=12, kneeR=-10, kneeL=-10,
            tail=25, neck=-14, wolfHead=-12, waist=-50, twist=-60, chest=-30, head=12, look=-45, leftArm=35,
            gripX=-40, gripZ=-16, aim=210, solve=1)
kicked = dict(buck, lean=-6, travel=-38, hindR=76, hindL=70, waist=-56, twist=-66, gripX=-40, gripZ=-24, aim=228, tail=32)
recoil = dict(lean=-2, rise=0, travel=-26, hindR=40, hindL=36, hockR=-6, hockL=-4, frontR=8, frontL=10, tail=20, neck=-8,
              waist=-30, twist=-40, chest=-16, head=8, look=-35, leftArm=25, gripX=-30, gripZ=-38, aim=265, solve=1)
cock = dict(lean=-6, rise=-10, travel=4, hindR=-85, hindL=-78, hockR=45, hockL=40, frontR=18, frontL=22, kneeR=-15, kneeL=-15,
            tail=-15, neck=10, wolfHead=12, waist=48, twist=54, chest=20, head=-14, look=15, leftArm=-35,
            gripX=34, gripZ=18, aim=420, solve=1)
sweep = dict(lean=-22, rise=8, travel=-24, hindR=12, hindL=18, hockR=10, hockL=10, frontR=20, frontL=26, kneeR=-25, kneeL=-25,
             tail=-10, neck=-16, wolfHead=-12, waist=-60, twist=-68, chest=-32, head=14, look=-55, leftArm=55,
             gripX=-40, gripZ=6, aim=536, solve=1)
carried = dict(sweep, lean=-10, travel=-12, waist=-46, twist=-62, chest=-26, gripX=-38, gripZ=-12, aim=566, frontR=12, frontL=16)
trail = dict(lean=-4, rise=2, travel=-8, hindR=4, hindL=6, frontR=-12, frontL=-10, kneeR=10, kneeL=10, tail=8, neck=-4,
             waist=-24, twist=-44, chest=-10, head=8, look=-30, leftArm=30, gripX=-26, gripZ=-28, aim=605, solve=1)
unwind = dict(lean=-1, waist=-6, twist=-12, chest=-3, head=2, look=-8, leftArm=8, tail=3,
              gripX=-6, gripZ=-30, aim=645, solve=0.6)

KEYS = {
    0: READY, kick - 4: gather, kick - 2: dict(gather, lean=-8, rise=24, hindR=-116, hindL=-108, waist=54, twist=60, gripX=42, gripZ=-4, aim=12), kick: buck,
    kick_last: kicked, kick_last + 2: recoil, swing - 3: cock, swing - 2: dict(cock, hindR=-95, hindL=-88, waist=54, twist=62, gripX=36, gripZ=22, aim=426),
    swing: sweep, swing_last: carried, swing_last + 5: trail, frames - 12: unwind,
    frames: dict(READY, aim=READY_AIM + 720),
}

curves = bpy.data.objects.new('Curves', None)
bpy.context.scene.collection.objects.link(curves)
for frame, pose in sorted(KEYS.items()):
    for channel in READY:
        curves[channel] = float(pose.get(channel, READY[channel]))
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

ARM = [SHOULDER, ELBOW]


def solve_arm(target, start):
    basis = {name: bones[name].rotation_quaternion.copy() for name in ARM + [GRIP]}
    angles = list(start)

    def loss():
        for name in ARM:
            bones[name].rotation_quaternion = basis[name].copy()
        update()
        for name, angle in zip(ARM, angles):
            turn(bones[name], Quaternion((0, 1, 0), radians(angle)))
        d = bones[GRIP].head - target
        return d.x * d.x + d.z * d.z + 0.002 * sum(a * a for a in angles)

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


def aim(elevation):
    grip = bones[GRIP]
    direction = Vector((cos(radians(elevation)), 0, sin(radians(elevation))))
    turn(grip, shaft().normalized().rotation_difference(direction))


def pose(c, start):
    rest()
    center = bones['Bone Center']
    center.location += Vector((c['travel'], 0, c['rise']))
    update()
    for joint in ORDER:
        if c[joint]:
            if joint in YAW:
                turn(bones[YAW[joint]], Quaternion((0, 0, 1), radians(c[joint])))
            else:
                turn(bones[PITCH[joint]], Quaternion((0, 1, 0), radians(c[joint])))
    held = {name: bones[name].rotation_quaternion.copy() for name in ARM + [GRIP]}
    angles = solve_arm(bones[SHOULDER].head + Vector((c['gripX'], 0, c['gripZ'])), start)
    aim(c['aim'])
    for name in ARM + [GRIP]:
        bones[name].rotation_quaternion = held[name].slerp(bones[name].rotation_quaternion, min(1.0, max(0.0, c['solve'])))
    update()
    return angles


def full(p):
    return {k: p.get(k, v) for k, v in READY.items()}


END = full(KEYS[frames])
PATH = [(0.0, full(carried)), (0.3, full(trail)), (0.65, full(unwind)), (1.0, END)]


def recovery(u):
    for (a, pa), (b, pb) in zip(PATH, PATH[1:]):
        if u <= b:
            t = (u - a) / (b - a)
            return {k: pa[k] * (1 - t) + pb[k] * t for k in READY}
    return END


def glide(t, ramp=0.1):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)


samples = [i / 80 for i in range(81)]
walked, angles = [0.0], pose(recovery(0), [0.0, 0.0])
previous = [b.head.copy() for b in bones]
for u in samples[1:]:
    angles = pose(recovery(u), angles)
    points = [b.head.copy() for b in bones]
    walked.append(walked[-1] + sum((a - b).length for a, b in zip(points, previous)))
    previous = points


def along(s):
    goal = s * walked[-1]
    for i in range(1, len(walked)):
        if walked[i] >= goal:
            return samples[i - 1] + (samples[i] - samples[i - 1]) * (goal - walked[i - 1]) / max(walked[i] - walked[i - 1], 1e-9)
    return 1.0


out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
last_q = {}
arm = [0.0, 0.0]
for frame in range(frames + 1):
    if frame <= swing_last:
        c = {name: fc.evaluate(frame) for name, fc in fcurves.items()}
    else:
        c = recovery(along(glide((frame - swing_last) / (frames - swing_last))))
    arm = pose(c, arm)
    for name, entry in zip(created, out['nodes']):
        b = bones[name]
        q = b.rotation_quaternion.normalized()
        if name in last_q and last_q[name].dot(q) < 0:
            q.negate()
        last_q[name] = q
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(b.location))
open(keys_path, 'w').write(json.dumps(out))
print('THRALL_BACK_AIR_KEYS', keys_path, frames + 1, 'frames', flush=True)
