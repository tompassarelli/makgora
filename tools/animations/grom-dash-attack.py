"""Blender boundary: author Grom's dash attack (#344), an axe lunge driven through Melee's 12 active frames.

The rig comes from `grom-clips.ts SHIPPED OUT dashAttack --rig RIG.json`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the model's own keys. He brakes out of
the run and rocks back over his bent back leg with Gorehowl cocked over his shoulder, throws his whole body
into the lunge on the first active frame with the axe chopping level, keeps driving lower and further through
the active window, carries past the last hit with the axe sweeping on, then pushes up off the lunge and settles
into ready. Clip frame N is attack frame N; `grom-clips.ts --keys` splices the baked frames and sets each one
on the floor.

  blender --background --factory-startup --python tools/animations/grom-dash-attack.py -- RIG.json KEYS.json
"""
import json
import sys
from math import radians

import bpy
from mathutils import Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames, contact, last = spec['frames'], spec['contact'], spec['lastActive']

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Grom')
rig = bpy.data.objects.new('Grom', armature)
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
scene = bpy.context.scene
scene.render.fps = 60

PITCH, ROLL, YAW = (0, 1, 0), (1, 0, 0), (0, 0, 1)
JOINTS = {
    'lean': 'Bone_Root', 'pelvis': 'Bone_Pelvis', 'chest': 'Bone_Chest', 'head': 'Bone_Head',
    'arm': 'Bone_Arm1_R', 'elbow': 'Bone_Arm2_R', 'hand': 'Bone_Hand_R',
    'leftArm': 'Bone_Arm1_L', 'leftElbow': 'Bone_Arm2_L',
    'thigh': 'Bone_Leg1_R', 'knee': 'Bone_Leg2_R', 'foot': 'Bone_Foot_R',
    'leftThigh': 'Bone_Leg1_L', 'leftKnee': 'Bone_Leg2_L', 'leftFoot': 'Bone_Foot_L', 'banner': 'Banner',
}
ROLLS = {'armRoll': 'Bone_Arm1_R', 'handRoll': 'Bone_Hand_R'}
YAWS = {'twist': 'Bone_Chest', 'hipTwist': 'Bone_Pelvis', 'handTwist': 'Bone_Hand_R', 'bannerTwist': 'Banner'}


def pose(p):
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
    turns = {}
    for joint, degrees in p.items():
        if joint in ROLLS:
            turns[ROLLS[joint]] = turns.get(ROLLS[joint], Quaternion()) @ Quaternion(Vector(ROLL), radians(degrees))
        if joint in YAWS:
            turns[YAWS[joint]] = Quaternion(Vector(YAW), radians(degrees)) @ turns.get(YAWS[joint], Quaternion())
    for joint, degrees in p.items():
        if joint in JOINTS:
            turns[JOINTS[joint]] = Quaternion(Vector(PITCH), radians(degrees)) @ turns.get(JOINTS[joint], Quaternion())
    world = {}

    def place(b):
        if b.name not in world:
            above = place(b.parent) if b.parent else Quaternion()
            if b.name in turns:
                b.rotation_quaternion = above.inverted() @ turns[b.name] @ above @ b.rotation_quaternion
            world[b.name] = above @ b.rotation_quaternion
        return world[b.name]

    for b in bones:
        place(b)
    bones[JOINTS['lean']].location += Vector((p.get('travel', 0), 0, 0))
    bpy.context.view_layer.update()


def reach(p, seed):
    solved = dict(p)
    if "aim" in p:
        aim(solved, seed)
    solved.update(banner=-0.8 * (solved.get("chest", 0) + solved.get("lean", 0)), bannerTwist=-solved.get("twist", 0))
    return solved


def aim(solved, seed):
    hand_x, hand_z, head_x, head_z = solved.pop("aim")
    solved.update({joint: seed.get(joint, 0) for joint in ("arm", "elbow", "hand")})

    def miss():
        pose(solved)
        s, h, w = (bones[name].head for name in ('Bone_Arm1_R', 'Bone_Hand_R', 'axe'))
        return (h.x - s.x - hand_x) ** 2 + (h.z - s.z - hand_z) ** 2 + (w.x - s.x - head_x) ** 2 + (w.z - s.z - head_z) ** 2

    for step in (30, 10, 3, 1):
        for joint in ('arm', 'elbow', 'hand', 'arm', 'elbow', 'hand'):
            centre = solved[joint]
            solved[joint] = min((centre + k * step for k in range(-6, 7)), key=lambda angle: (solved.__setitem__(joint, angle), miss())[1])


def blend(a, b, t):
    return {k: a.get(k, 0) * (1 - t) + b.get(k, 0) * t for k in set(a) | set(b)}


def glide(t, ramp=0.2):
    pace = 1 / (1 - ramp / 2)
    return pace * t if t < 1 - ramp else 1 - pace * (1 - t) ** 2 / (2 * ramp)


READY = {}
KEYS = {
    0: dict(chest=10, lean=8, head=-8, leftArm=25, thigh=-26, knee=40, leftThigh=24, leftKnee=46),
    2: dict(chest=-8, lean=-6, head=6, twist=-15, leftArm=-40, thigh=-36, knee=6, foot=14, leftThigh=16, leftKnee=46, travel=-12),
    contact - 2: dict(chest=-30, pelvis=8, lean=-18, head=24, twist=-50, leftArm=-95, leftElbow=-35,
                      thigh=-30, knee=8, foot=22, leftThigh=32, leftKnee=88, leftFoot=-34, travel=-32,
                      aim=(-14, 26, -70, 75)),
    contact: dict(chest=36, pelvis=-12, lean=18, head=-32, twist=45, leftArm=40, leftElbow=-20,
                  thigh=-74, knee=68, foot=8, leftThigh=40, leftKnee=6, travel=36,
                  aim=(26, -14, 114, -20)),
    (contact + last) // 2: dict(chest=28, pelvis=-10, lean=12, head=-24, twist=40, leftArm=30, leftElbow=-20,
                                thigh=-30, knee=30, foot=6, leftThigh=-40, leftKnee=80, leftFoot=-10, travel=54,
                                aim=(24, -6, 110, 6)),
    last: dict(chest=58, pelvis=-20, lean=26, head=-46, twist=62, leftArm=60, leftElbow=-10,
               thigh=56, knee=12, foot=8, leftThigh=-92, leftKnee=100, leftFoot=8, travel=70,
               aim=(24, -32, 100, -58)),
    last + 4: dict(chest=50, pelvis=-17, lean=21, head=-38, twist=55, leftArm=52, leftElbow=-14,
                   thigh=34, knee=34, foot=6, leftThigh=-82, leftKnee=92, leftFoot=6, travel=68,
                   aim=(6, -16, 56, 34)),
    last + 7: dict(chest=40, pelvis=-14, lean=16, head=-28, twist=48, leftArm=45, leftElbow=-18,
                   thigh=8, knee=62, foot=4, leftThigh=-62, leftKnee=78, leftFoot=4, travel=66,
                   aim=(6, -8, 40, 74)),
}
keys, seed = {}, {}
for frame in sorted(KEYS):
    keys[frame] = seed = reach(KEYS[frame], seed)
settle = max(KEYS)
keys.update({frame: blend(keys[settle], READY, glide((frame - settle) / (frames - settle))) for frame in range(settle + 1, frames + 1)})

posed = {}
for frame in sorted(keys):
    pose(keys[frame])
    posed[frame] = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in bones}
rig.animation_data_create()
rig.animation_data.action = bpy.data.actions.new('Grom dashAttack')
previous = {}
for frame in sorted(posed):
    for b in bones:
        q, location = posed[frame][b.name]
        if b.name in previous and previous[b.name].dot(q) < 0:
            q.negate()
        previous[b.name] = q
        b.rotation_quaternion = q
        b.location = location
        b.keyframe_insert('rotation_quaternion', frame=frame)
        b.keyframe_insert('location', frame=frame)
out = {'frames': frames, 'nodes': [{'rotation': [], 'translation': []} for _ in created]}
for frame in range(frames + 1):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    for name, entry in zip(created, out['nodes']):
        b = bones[name]
        q = b.rotation_quaternion.normalized()
        entry['rotation'].append([q.x, q.y, q.z, q.w])
        entry['translation'].append(list(b.location))
open(keys_path, 'w').write(json.dumps(out))
print('GROM_DASH_ATTACK_KEYS', keys_path, frames + 1, 'frames', flush=True)
