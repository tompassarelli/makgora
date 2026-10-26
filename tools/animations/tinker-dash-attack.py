"""Blender boundary: author Goblin Tinker's dash attack (#340), a whole-body lunge driven through Melee's 12 active frames.

The rig comes from `tinker-clips.ts SHIPPED OUT rekey dashAttack --rig RIG.json`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the model's own keys. Each joint pitches
about the side-view axis whatever its parent's stand yaw, so a lean reads in profile. He sinks back over bent knees
with both claws drawn behind the pack, lunges the whole body with the claws reaching on the first active frame,
drives lower and flatter mid-window, then twists the pack and lifts the claws level on the last active frame and
glides evenly back to ready. Clip frame N is attack frame N; `tinker-clips.ts rekey dashAttack --keys KEYS.json`
splices the baked frames and sets each one on the floor.

  blender --background --factory-startup --python tools/animations/tinker-dash-attack.py -- RIG.json KEYS.json
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
armature = bpy.data.armatures.new('Tinker')
rig = bpy.data.objects.new('Tinker', armature)
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

PITCH, YAW = Vector((0, 1, 0)), Vector((0, 0, 1))
JOINTS = {
    'lean': ('Bone_Root01', 'Bone_MainTank_Tank', 'Dummy01_Tank'), 'waist': ('Bone_Pelvis01',), 'chest': ('Bone_Chest01',),
    'head': ('Bone_Head01',), 'pack': ('bonebackpack',), 'mast': ('Bone_BackPack_UpJoint1',),
    'right': ('Bone_BackPack_ArmRight1',), 'left': ('Bone_BackPack_ArmLeft1',),
    'rightElbow': ('Bone_BackPack_ArmRight2',), 'leftElbow': ('Bone_BackPack_ArmLeft2',),
    'rightClaw': ('Bone_BackPack_ArmRight3',), 'leftClaw': ('Bone_BackPack_ArmLeft3',),
    'arms': ('Bone_Arm1_R01', 'Bone_Arm1_L01'), 'forearms': ('Bone_Arm2_R01', 'Bone_Arm2_L01'),
    'front': ('Bone_Leg1_R01',), 'frontKnee': ('Bone_Leg2_R01',), 'frontFoot': ('Bone_Foot_R01',),
    'back': ('Bone_Leg1_L01',), 'backKnee': ('Bone_Leg2_L01',), 'backFoot': ('Bone_Foot_L01',),
}


def pose(p):
    for b in bones:
        n = nodes[b.name]
        b.rotation_mode = 'QUATERNION'
        x, y, z, w = n['rotation'] or (0, 0, 0, 1)
        b.rotation_quaternion = Quaternion((w, x, y, z))
        b.location = Vector(n['translation'] or (0, 0, 0))
    pitch = {name: degrees for joint, degrees in p.items() for name in JOINTS.get(joint, ())}
    yaw = {name: p.get('twist', 0) for name in JOINTS['lean']}
    world = {}

    def side_view(b):
        if b.name in world:
            return world[b.name]
        parent = side_view(b.parent) if b.parent else Quaternion()
        if b.name in pitch or b.name in yaw:
            turn = Quaternion(YAW, radians(yaw.get(b.name, 0))) @ Quaternion(PITCH, radians(pitch.get(b.name, 0)))
            b.rotation_quaternion = parent.inverted() @ turn @ parent @ b.rotation_quaternion
        world[b.name] = parent @ b.rotation_quaternion
        return world[b.name]

    for b in bones:
        side_view(b)
    root = bones['Bone_Root01']
    root.location += Vector((p.get('travel', 0), 0, p.get('drop', 0)))
    bpy.context.view_layer.update()


def blend(a, b, t):
    return {k: a.get(k, 0) * (1 - t) + b.get(k, 0) * t for k in set(a) | set(b)}


READY = {}
load = dict(lean=-8, chest=-6, head=6, right=-50, left=-45, rightElbow=8, leftElbow=8, arms=-25,
            front=-25, frontKnee=25, back=-20, backKnee=45, travel=-8, drop=-8)
coil = dict(lean=-18, chest=-12, head=14, pack=-8, right=-130, left=-120, rightElbow=15, leftElbow=15, rightClaw=-20, leftClaw=-20,
            arms=-55, forearms=-20, front=-45, frontKnee=35, back=-35, backKnee=85, travel=-20, drop=-16)
strike = dict(lean=40, chest=18, head=-18, pack=6, right=5, left=10, rightElbow=-45, leftElbow=-45, rightClaw=-10, leftClaw=-10,
              arms=50, forearms=-10, front=-85, frontKnee=45, back=-5, backKnee=10, travel=24)
drive = dict(lean=58, chest=20, head=-28, pack=8, right=-8, left=-3, rightElbow=-50, leftElbow=-50, rightClaw=-5, leftClaw=-5,
             arms=65, forearms=-20, front=-90, frontKnee=60, back=-20, backKnee=10, travel=34)
recoil = dict(lean=44, twist=25, chest=14, head=-20, pack=6, right=-20, left=-14, rightElbow=-60, leftElbow=-60, rightClaw=-20, leftClaw=-20,
              arms=10, forearms=-50, front=-80, frontKnee=55, back=-35, backKnee=20, travel=44)


def glide(t, ramp=0.05):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)


keys = {
    0: READY,
    contact - 5: load,
    contact - 3: coil,
    contact - 1: blend(coil, strike, 0.35),
    contact: strike,
    contact + 5: drive,
    last: recoil,
}
settle = last
keys.update({frame: blend(recoil, READY, glide((frame - settle) / (frames - settle))) for frame in range(settle + 1, frames + 1)})

posed = {}
for frame in sorted(keys):
    pose(keys[frame])
    posed[frame] = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in bones}
rig.animation_data_create()
rig.animation_data.action = bpy.data.actions.new('Tinker dashAttack')
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
print('TINKER_DASH_ATTACK_KEYS', keys_path, frames + 1, 'frames', flush=True)
