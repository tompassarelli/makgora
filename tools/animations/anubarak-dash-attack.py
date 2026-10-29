"""Blender boundary: author Anub'arak's dash attack (#339), a lunge driven through Melee's 12 active frames.

The rig comes from `anubarak-clips.ts STOCK_ANUBARAK.mdx OUT --rig RIG.json`: every bone and helper becomes a bone
with identity rest orientation, so a bone's local rotation and location are the model's own keys. Each joint turns
about a world axis whatever its parent's stand pose, so a pitch reads in profile. He rears back with both claws
drawn up behind his head, lunges flat with the claws raised high ahead on the first active frame, then through
the active window pitches nose down as his hind legs swing under his hips and his abdomen lifts, so his rear rises
while both claws stab down in front, and glides evenly back to ready. Clip frame N is attack frame N;
`anubarak-clips.ts STOCK_ANUBARAK.mdx OUT --keys KEYS.json` splices the baked frames and sets each one on the floor.

  blender --background --factory-startup --python tools/animations/anubarak-dash-attack.py -- RIG.json KEYS.json
"""
import json
import sys
from math import radians

import bpy
from mathutils import Quaternion, Vector

rig_path, keys_path = sys.argv[sys.argv.index('--') + 1:]
spec = json.loads(open(rig_path).read())
frames, contact, active = spec['frames'], spec['contact'], spec['active']
last = contact + active - 1

bpy.ops.wm.read_factory_settings(use_empty=True)
armature = bpy.data.armatures.new('Anubarak')
rig = bpy.data.objects.new('Anubarak', armature)
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

PITCH, ROLL, YAW = Vector((0, 1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1))
PITCHED = {
    'lean': ('Bone_Root',), 'chest': ('Bone_Chest',), 'head': ('Bone_Head',), 'butt': ('Bone_Butt',),
    'arms': ('Bone_Arm1R', 'Bone_Arm1L'), 'right': ('Bone_Arm1R',), 'left': ('Bone_Arm1L',), 'elbows': ('Bone_Arm2R', 'Bone_Arm2L'),
    'wrists': ('Bone_Arm3R', 'Bone_Arm3L'), 'claws': ('Bone_ArmClawR', 'Bone_ArmClawL'),
    'front': ('Bone_LFLeg04', 'Bone_LFLeg07'), 'frontKnee': ('Bone_LFLeg03', 'Bone_LFLeg06'),
    'rear': ('Bone_LFLeg13', 'Bone_LFLeg09'), 'rearKnee': ('Bone_LFLeg14', 'Bone_LFLeg10'),
}
ROLLED = {
    'splay': {'Bone_LFLeg13': 1, 'Bone_LFLeg04': 1, 'Bone_LFLeg09': -1, 'Bone_LFLeg07': -1},
}


def pose(p):
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
    pitch = {}
    for joint, degrees in p.items():
        for name in PITCHED.get(joint, ()):
            pitch[name] = pitch.get(name, 0) + degrees
    roll = {name: p.get(joint, 0) * sign for joint, signs in ROLLED.items() for name, sign in signs.items()}
    world = {}

    def side_view(b):
        if b.name in world:
            return world[b.name]
        parent = side_view(b.parent) if b.parent else Quaternion()
        if b.name in pitch or b.name in roll or b.name == 'Bone_Root':
            turn = Quaternion(YAW, radians(p.get('twist', 0) if b.name == 'Bone_Root' else 0)) @ Quaternion(PITCH, radians(pitch.get(b.name, 0))) @ Quaternion(ROLL, radians(roll.get(b.name, 0)))
            b.rotation_quaternion = parent.inverted() @ turn @ parent @ b.rotation_quaternion
        world[b.name] = parent @ b.rotation_quaternion
        return world[b.name]

    for b in bones:
        side_view(b)
    root = bones['Bone_Root']
    root.location += Vector((p.get('travel', 0), 0, p.get('drop', 0)))
    bpy.context.view_layer.update()


def blend(a, b, t):
    return {k: a.get(k, 0) * (1 - t) + b.get(k, 0) * t for k in set(a) | set(b)}


READY = {}
load = dict(lean=-12, chest=-8, head=8, arms=-60, elbows=20, front=-15, rear=10, rearKnee=15, travel=-8)
coil = dict(lean=-30, chest=-18, head=14, butt=10, arms=-170, elbows=35, wrists=20, claws=20,
            front=-35, frontKnee=-20, rear=20, rearKnee=30, travel=-16)
strike = dict(lean=12, chest=10, head=-10, butt=-5, arms=-145, elbows=-10, wrists=-5, claws=-5,
              front=-45, frontKnee=10, rear=30, rearKnee=-10, travel=30)
drive = dict(lean=32, chest=15, head=-15, butt=25, arms=-60, elbows=0, wrists=0, claws=0,
             front=-75, frontKnee=40, rear=-20, rearKnee=-15, travel=50)
recoil = dict(lean=75, chest=12, head=-15, butt=45, arms=0, elbows=-15, wrists=-10, claws=-5,
              front=-110, frontKnee=60, rear=-60, rearKnee=-20, travel=62)


def glide(t, ramp=0.05):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)


keys = {
    0: READY,
    contact - 6: load,
    contact - 3: coil,
    contact - 1: blend(coil, strike, 0.4),
    contact: strike,
    contact + 5: drive,
    last: recoil,
}
keys.update({frame: blend(recoil, READY, glide((frame - last) / (frames - last))) for frame in range(last + 1, frames + 1)})

posed = {}
for frame in sorted(keys):
    pose(keys[frame])
    posed[frame] = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in bones}
rig.animation_data_create()
rig.animation_data.action = bpy.data.actions.new('Anubarak dashAttack')
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
print('ANUBARAK_DASH_ATTACK_KEYS', keys_path, frames + 1, 'frames', flush=True)
