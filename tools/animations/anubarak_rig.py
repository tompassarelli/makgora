"""Blender boundary shared by Anub'arak's Blender-authored attacks: rig, pose vocabulary and key bake.

The rig comes from `anubarak-clips.ts STOCK_ANUBARAK.mdx OUT POSE --rig RIG.json`: every bone and helper becomes
a bone with identity rest orientation, so a bone's local rotation and location are the model's own keys. Each
joint turns about a world axis whatever its parent's stand pose, so a pitch reads in profile.
"""
import json
from math import radians

import bpy
from mathutils import Quaternion, Vector

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
READY = {}


class Rig:
    def __init__(self, rig_path):
        spec = json.loads(open(rig_path).read())
        self.frames, self.contact, self.active = spec['frames'], spec['contact'], spec['active']
        self.last = self.contact + self.active - 1
        bpy.ops.wm.read_factory_settings(use_empty=True)
        armature = bpy.data.armatures.new('Anubarak')
        self.rig = bpy.data.objects.new('Anubarak', armature)
        bpy.context.scene.collection.objects.link(self.rig)
        bpy.context.view_layer.objects.active = self.rig
        bpy.ops.object.mode_set(mode='EDIT')
        self.created = []
        for n in spec['nodes']:
            bone = armature.edit_bones.new(n['name'])
            bone.head = Vector(n['pivot'])
            bone.tail = bone.head + Vector((0, 4, 0))
            bone.roll = 0
            self.created.append(bone.name)
        for n, name in zip(spec['nodes'], self.created):
            if n['parent'] >= 0:
                armature.edit_bones[name].parent = armature.edit_bones[self.created[n['parent']]]
        self.nodes = dict(zip(self.created, spec['nodes']))
        bpy.ops.object.mode_set(mode='POSE')
        self.bones = self.rig.pose.bones
        self.scene = bpy.context.scene
        self.scene.render.fps = 60

    def pose(self, p):
        for b in self.bones:
            n = self.nodes[b.name]
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

        for b in self.bones:
            side_view(b)
        root = self.bones['Bone_Root']
        root.location += Vector((p.get('travel', 0), 0, p.get('drop', 0)))
        bpy.context.view_layer.update()

    def bake(self, keys, keys_path, label):
        posed = {}
        for frame in sorted(keys):
            self.pose(keys[frame])
            posed[frame] = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in self.bones}
        self.rig.animation_data_create()
        self.rig.animation_data.action = bpy.data.actions.new(f'Anubarak {label}')
        previous = {}
        for frame in sorted(posed):
            for b in self.bones:
                q, location = posed[frame][b.name]
                if b.name in previous and previous[b.name].dot(q) < 0:
                    q.negate()
                previous[b.name] = q
                b.rotation_quaternion = q
                b.location = location
                b.keyframe_insert('rotation_quaternion', frame=frame)
                b.keyframe_insert('location', frame=frame)
        out = {'frames': self.frames, 'nodes': [{'rotation': [], 'translation': []} for _ in self.created]}
        for frame in range(self.frames + 1):
            self.scene.frame_set(frame)
            bpy.context.view_layer.update()
            for name, entry in zip(self.created, out['nodes']):
                b = self.bones[name]
                q = b.rotation_quaternion.normalized()
                entry['rotation'].append([q.x, q.y, q.z, q.w])
                entry['translation'].append(list(b.location))
        open(keys_path, 'w').write(json.dumps(out))


def blend(a, b, t):
    return {k: a.get(k, 0) * (1 - t) + b.get(k, 0) * t for k in set(a) | set(b)}


def glide(t, ramp=0.05):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)
