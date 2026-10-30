"""Blender boundary shared by Murloc's Blender-authored attacks: rig, pose vocabulary and key bake.

The rig comes from `murloc-clips.ts SHIPPED OUT POSE --rig RIG.json`: every node becomes a bone with
identity rest orientation, so a bone's local rotation and location are the model's own keys. Each joint is
pitched about the side-view axis in armature space, so the rig's yawed leg frames cannot turn a bend into a
roll; the waist twists about the vertical, the spear is aimed by the blade axis the rig measures from its
mesh, and the body mesh bones squash and stretch, since his round body hides pitch.
"""
import json
from math import atan2, cos, degrees, radians, sin

import bpy
from mathutils import Matrix, Quaternion, Vector

JOINTS = {
    'lean': 'Bone_Root', 'spin': 'Bone_Root', 'twist': 'Bone_Waist', 'waist': 'Bone_Waist', 'chest': 'Bone_Chest', 'head': 'Bone_Head',
    'arm': 'Bone_Arm1_R', 'elbow': 'Bone_Arm2_R', 'leftArm': 'Bone_Arm1_L', 'leftElbow': 'Bone_Arm2_L',
    'front': 'Bone_Leg1_L', 'kneeFront': 'Bone_Leg2_L', 'footFront': 'Bone_Foot_L',
    'back': 'Bone_Leg1_R', 'kneeBack': 'Bone_Leg2_R', 'footBack': 'Bone_Foot_R',
}
ORDER = ['lean', 'spin', 'twist', 'waist', 'chest', 'head', 'arm', 'elbow', 'leftArm', 'leftElbow',
         'front', 'kneeFront', 'footFront', 'back', 'kneeBack', 'footBack']
HAND = 'Bone_Hand_R'
BODY = ('Spine', 'chest', 'Head')
READY = {}


class Rig:
    def __init__(self, rig_path, body_axes_per_pose=False):
        self.body_axes_per_pose = body_axes_per_pose
        self.spec = json.loads(open(rig_path).read())
        self.frames, self.contact, self.active = self.spec['frames'], self.spec['contact'], self.spec['active']
        self.last = self.contact + self.active - 1
        bpy.ops.wm.read_factory_settings(use_empty=True)
        armature = bpy.data.armatures.new('Murloc')
        rig = bpy.data.objects.new('Murloc', armature)
        bpy.context.scene.collection.objects.link(rig)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode='EDIT')
        self.created = []
        for n in self.spec['nodes']:
            bone = armature.edit_bones.new(n['name'])
            bone.head = Vector(n['pivot'])
            bone.tail = bone.head + Vector((0, 4, 0))
            bone.roll = 0
            self.created.append(bone.name)
        for n, name in zip(self.spec['nodes'], self.created):
            if n['parent'] >= 0:
                armature.edit_bones[name].parent = armature.edit_bones[self.created[n['parent']]]
        self.nodes = dict(zip(self.created, self.spec['nodes']))
        bpy.ops.object.mode_set(mode='POSE')
        self.bones = rig.pose.bones
        self.blade_local = Vector(self.spec['blade']).normalized()
        self.spear = Vector(self.spec['blade']).length
        self.rest()
        self.body_axes = {name: self.axes(self.bones[name]) for name in BODY}
        self.grip = self.bones[HAND].matrix.to_quaternion()
        hanging = self.grip @ self.blade_local
        self.hanging = degrees(atan2(hanging.z, hanging.x))

    @staticmethod
    def axes(b):
        axes = b.matrix.to_3x3().normalized().transposed()
        forward = max(range(3), key=lambda i: abs(axes[i].x))
        return forward, max((i for i in range(3) if i != forward), key=lambda i: abs(axes[i].z))

    def rest(self):
        for b in self.bones:
            n = self.nodes[b.name]
            b.rotation_mode = 'QUATERNION'
            x, y, z, w = n['rotation'] or (0, 0, 0, 1)
            b.rotation_quaternion = Quaternion((w, x, y, z))
            b.location = Vector(n['translation'] or (0, 0, 0))
            b.scale = Vector((1, 1, 1))
        bpy.context.view_layer.update()

    def turn(self, b, rotation):
        head = b.matrix.to_translation()
        b.matrix = Matrix.Translation(head) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-head) @ b.matrix
        bpy.context.view_layer.update()

    def pose(self, p):
        bones = self.bones
        self.rest()
        bones[JOINTS['lean']].location += Vector((p.get('travel', 0), 0, p.get('drop', 0)))
        bpy.context.view_layer.update()
        for joint in ORDER:
            if p.get(joint):
                self.turn(bones[JOINTS[joint]], Quaternion((0, 0, 1) if joint == 'twist' else (0, 1, 0), radians(p[joint])))
        if 'aim' in p:
            hand = bones[HAND]
            blade = hand.matrix.to_quaternion() @ self.blade_local
            elevation = radians(p['aim'])
            whole = blade.rotation_difference(Vector((cos(elevation), 0, sin(elevation))))
            self.turn(hand, Quaternion().slerp(whole, p.get('grip', 1)))
        if 'pitch' in p:
            hand = bones[HAND]
            held = Quaternion((0, 1, 0), radians(self.hanging - p['pitch'])) @ self.grip
            self.turn(hand, held @ hand.matrix.to_quaternion().inverted())
        for name in BODY:
            b = bones[name]
            forward, up = self.axes(b) if self.body_axes_per_pose else self.body_axes[name]
            scale = [1.0, 1.0, 1.0]
            scale[forward], scale[up] = 1 + p.get('stretch', 0), 1 + p.get('squash', 0)
            b.scale = Vector(scale)
        bpy.context.view_layer.update()

    def reach(self, p, goal, level, weight=0.01):
        def error(arm, elbow):
            self.pose({**p, 'arm': arm, 'elbow': elbow})
            point = self.tip() + Vector((0, 0, self.floor() - level))
            return (point.x - goal[0]) ** 2 + (point.z - goal[1]) ** 2 + weight * (elbow + 40) ** 2

        def limit(arm, elbow):
            return min(70.0, max(-170.0, arm)), min(10.0, max(-130.0, elbow))
        best = min((error(arm, elbow), arm, elbow) for arm in range(-170, 71, 15) for elbow in range(-120, 11, 10))
        for step in (6, 2, 0.5):
            _, arm, elbow = best
            best = min((error(*limit(arm + i * step, elbow + j * step)), *limit(arm + i * step, elbow + j * step))
                       for i in (-2, -1, 0, 1, 2) for j in (-2, -1, 0, 1, 2))
        return {**p, 'arm': best[1], 'elbow': best[2]}

    def floor(self):
        return min(self.bones[JOINTS[foot]].head.z for foot in ('footFront', 'footBack'))

    def tip(self, along=1.0):
        hand = self.bones[HAND]
        point = Vector(self.spec['tip']) - Vector(self.spec['blade']) * (1 - along)
        return hand.matrix @ (point - Vector(self.nodes[HAND]['pivot'])) - Vector((0, 0, self.floor()))

    def drawn(self, p):
        self.pose(p)
        hand = self.bones[HAND]
        points = [b.head.copy() for b in self.bones] + [hand.head + (hand.matrix.to_quaternion() @ self.blade_local) * self.spear]
        floor = self.floor()
        return [point - Vector((0, 0, floor)) for point in points]

    def arc(self, path, steps=200, drawn=None):
        drawn = drawn or self.drawn
        samples = [i / steps for i in range(steps + 1)]
        walked = [0.0]
        previous = drawn(path(0))
        for u in samples[1:]:
            points = drawn(path(u))
            walked.append(walked[-1] + sum((a - b).length for a, b in zip(points, previous)))
            previous = points

        def along(s):
            goal = s * walked[-1]
            for i in range(1, len(walked)):
                if walked[i] >= goal:
                    return samples[i - 1] + (samples[i] - samples[i - 1]) * (goal - walked[i - 1]) / max(walked[i] - walked[i - 1], 1e-9)
            return 1.0
        return along

    def bake(self, at, keys_path):
        out = {'frames': self.frames, 'nodes': [{'rotation': [], 'translation': [], 'scaling': []} for _ in self.created]}
        previous = {}
        for frame in range(self.frames + 1):
            self.pose(at(frame))
            for name, entry in zip(self.created, out['nodes']):
                q = self.bones[name].rotation_quaternion.normalized()
                if name in previous and previous[name].dot(q) < 0:
                    q.negate()
                previous[name] = q
                entry['rotation'].append([q.x, q.y, q.z, q.w])
                entry['translation'].append(list(self.bones[name].location))
                entry['scaling'].append(list(self.bones[name].scale))
        open(keys_path, 'w').write(json.dumps(out))


def blend(a, b, t):
    held = {**a, **b, 'grip': a.get('grip', 0) * (1 - t) + b.get('grip', 0) * t}
    held.update({k: a.get(k, held[k] if k == 'aim' else 0) * (1 - t) + b.get(k, held[k] if k == 'aim' else 0) * t for k in set(a) | set(b) if k != 'grip'})
    return held


def glide(t, ramp=0.25):
    peak = 1 / (1 - ramp)
    if t < ramp:
        return peak * t * t / (2 * ramp)
    if t < 1 - ramp:
        return peak * (t - ramp / 2)
    return 1 - peak * (1 - t) ** 2 / (2 * ramp)
